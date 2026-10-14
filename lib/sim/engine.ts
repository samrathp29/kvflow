import {
  bytesPerToken,
  bytesToMiB,
  durationUs,
  giBToBytes,
  usToMs,
} from "./memory";
import {
  selectLRUVictim,
  selectTrajectoryVictim,
  trajectoryRetentionValue,
} from "./policies";
import { findReservationFailure } from "./workload";
import type {
  AgentPhase,
  CacheEntry,
  CacheSnapshot,
  EvictionDecision,
  PolicyCandidate,
  PolicyName,
  PolicyObservation,
  SimulationConfig,
  SimulationEvent,
  SimulationEventType,
  SimulationResult,
  TimelineSegment,
  ToolKind,
  Workload,
} from "./types";
import { metricsFromCounters } from "./metrics";

type EventKind =
  | "prefill-complete"
  | "decode-complete"
  | "tool-complete"
  | "arrival";

interface QueuedEvent {
  atUs: number;
  kind: EventKind;
  agentId: string;
  seq: number;
}

interface AgentState {
  id: string;
  arrivalUs: number;
  turnIndex: number;
  logicalContextTokens: number;
  completedTurns: number;
  phase: AgentPhase;
  arrived: boolean;
  completed: boolean;
  completionUs?: number;
  toolKind?: ToolKind;
  toolWaitStartUs?: number;
  queuedAtUs?: number;
}

interface ReadyJob {
  agentId: string;
  seq: number;
}

const EVENT_PRIORITY: Record<EventKind, number> = {
  "prefill-complete": 0,
  "decode-complete": 1,
  "tool-complete": 2,
  arrival: 3,
};

function compareEvents(a: QueuedEvent, b: QueuedEvent): number {
  return (
    a.atUs - b.atUs ||
    EVENT_PRIORITY[a.kind] - EVENT_PRIORITY[b.kind] ||
    a.seq - b.seq ||
    a.agentId.localeCompare(b.agentId)
  );
}

function occupiedBytes(
  entries: Map<string, CacheEntry>,
  bpt: number,
): number {
  let total = 0;
  for (const entry of entries.values()) {
    total += entry.reservedTokens * bpt;
  }
  return total;
}

function snapshotCache(input: {
  atMs: number;
  entries: Map<string, CacheEntry>;
  bpt: number;
  activeAgentId?: string;
}): CacheSnapshot {
  const residentTokensByAgent: Record<string, number> = {};
  const reservedTokensByAgent: Record<string, number> = {};
  const residentAgentIds: string[] = [];
  for (const [id, entry] of [...input.entries.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    residentAgentIds.push(id);
    residentTokensByAgent[id] = entry.prefixTokens;
    reservedTokensByAgent[id] = entry.reservedTokens;
  }
  return {
    atMs: input.atMs,
    occupiedBytes: occupiedBytes(input.entries, input.bpt),
    residentAgentIds,
    residentTokensByAgent,
    reservedTokensByAgent,
    activeAgentId: input.activeAgentId,
  };
}

function buildObservation(input: {
  nowMs: number;
  triggeringAgentId: string;
  entries: Map<string, CacheEntry>;
  agents: Map<string, AgentState>;
  bpt: number;
  maxConfiguredTurns: number;
  prefillTokensPerSecond: number;
}): PolicyObservation {
  const candidates: PolicyCandidate[] = [];
  for (const entry of input.entries.values()) {
    if (entry.agentId === input.triggeringAgentId) continue;
    const agent = input.agents.get(entry.agentId);
    if (!agent) continue;
    const candidate: PolicyCandidate = {
      agentId: entry.agentId,
      residentTokens: entry.prefixTokens,
      residentMiB: bytesToMiB(entry.reservedTokens * input.bpt),
      lastAccessMs: entry.lastAccessMs,
      currentPhase: agent.phase,
      completedTurns: agent.completedTurns,
      maxConfiguredTurns: input.maxConfiguredTurns,
      estimatedRecomputeMs:
        (1000 * entry.prefixTokens) / input.prefillTokensPerSecond,
    };
    if (agent.toolKind !== undefined) {
      candidate.currentToolKind = agent.toolKind;
    }
    if (agent.phase === "tool-wait" && agent.toolWaitStartUs !== undefined) {
      candidate.elapsedToolWaitMs = usToMs(input.nowMs * 1000 - agent.toolWaitStartUs);
    }
    candidates.push(candidate);
  }
  candidates.sort((a, b) => a.agentId.localeCompare(b.agentId));
  return {
    nowMs: input.nowMs,
    triggeringAgentId: input.triggeringAgentId,
    candidates,
  };
}

export function simulate(input: {
  workload: Workload;
  policy: PolicyName;
  config: SimulationConfig;
}): SimulationResult {
  const failure = findReservationFailure(input.workload, input.config);
  if (failure) {
    throw failure;
  }

  const bpt = bytesPerToken(input.config.model);
  const capacityBytes = giBToBytes(input.config.memoryBudgetGiB);
  const agents = new Map<string, AgentState>();
  const workloadById = new Map(
    input.workload.agents.map((agent) => [agent.id, agent]),
  );

  for (const agent of input.workload.agents) {
    agents.set(agent.id, {
      id: agent.id,
      arrivalUs: Math.round(agent.arrivalMs * 1000),
      turnIndex: 0,
      logicalContextTokens: 0,
      completedTurns: 0,
      phase: "queued",
      arrived: false,
      completed: false,
    });
  }

  const events: SimulationEvent[] = [];
  const evictions: EvictionDecision[] = [];
  const timeline: TimelineSegment[] = [];
  const cacheSnapshots: CacheSnapshot[] = [];
  const cache = new Map<string, CacheEntry>();
  const ready: ReadyJob[] = [];
  const pq: QueuedEvent[] = [];

  let eventId = 0;
  let seq = 0;
  let readySeq = 0;
  let nowUs = 0;
  let workerBusy = false;
  let unfinished = input.workload.agents.length;
  let busyStartUs = 0;
  let peekActiveId: string | undefined;

  let reusedInputTokens = 0;
  let recomputedInputTokens = 0;
  let totalInputTokens = 0;
  let totalPrefillTokens = 0;
  let totalOutputTokens = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let inferenceStarts = 0;
  let peakCacheBytes = 0;
  let peakActiveAgents = 0;
  const latencies: number[] = [];
  let earliestArrivalUs = Number.POSITIVE_INFINITY;
  let lastCompletionUs = 0;

  function activeCount(): number {
    let n = 0;
    for (const agent of agents.values()) {
      if (agent.arrived && !agent.completed) n += 1;
    }
    return n;
  }

  function record(
    type: SimulationEventType,
    agentId: string,
    details?: Record<string, string | number | boolean>,
  ) {
    events.push({
      id: eventId,
      atMs: usToMs(nowUs),
      type,
      agentId,
      details,
    });
    eventId += 1;
  }

  function snap(activeAgentId?: string) {
    const shot = snapshotCache({
      atMs: usToMs(nowUs),
      entries: cache,
      bpt,
      activeAgentId,
    });
    if (shot.occupiedBytes > capacityBytes + 1e-9) {
      throw new Error(
        `Capacity invariant violated: ${shot.occupiedBytes} > ${capacityBytes}`,
      );
    }
    peakCacheBytes = Math.max(peakCacheBytes, shot.occupiedBytes);
    cacheSnapshots.push(shot);
  }

  function schedule(kind: EventKind, agentId: string, atUs: number) {
    pq.push({ atUs, kind, agentId, seq });
    seq += 1;
  }

  function enqueue(agentId: string) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`Unknown agent ${agentId}`);
    agent.phase = "queued";
    agent.queuedAtUs = nowUs;
    ready.push({ agentId, seq: readySeq });
    readySeq += 1;
    record("inference-queued", agentId, { turnIndex: agent.turnIndex });
  }

  function evictUntilFits(triggeringAgentId: string, requiredBytes: number) {
    while (true) {
      let others = 0;
      for (const [id, entry] of cache) {
        if (id === triggeringAgentId) continue;
        others += entry.reservedTokens * bpt;
      }
      if (others + requiredBytes <= capacityBytes) return;

      const observation = buildObservation({
        nowMs: usToMs(nowUs),
        triggeringAgentId,
        entries: cache,
        agents,
        bpt,
        maxConfiguredTurns: input.config.maxConfiguredTurns,
        prefillTokensPerSecond: input.config.model.prefillTokensPerSecond,
      });
      if (observation.candidates.length === 0) {
        throw new Error(
          `Cannot free enough memory for ${triggeringAgentId}: need ${requiredBytes} bytes`,
        );
      }

      let victimId: string;
      let scores: Record<string, number> | undefined;
      let reason: string;

      if (input.policy === "lru") {
        const lruCandidates: CacheEntry[] = observation.candidates.map(
          (candidate) => {
            const entry = cache.get(candidate.agentId);
            if (!entry) {
              throw new Error(`Missing cache entry ${candidate.agentId}`);
            }
            return entry;
          },
        );
        const victim = selectLRUVictim(lruCandidates);
        victimId = victim.agentId;
        reason = `Agent ${victimId} had ${victim.prefixTokens} resident tokens. A newly admitted request needed ${bytesToMiB(requiredBytes).toFixed(1)} MiB. Under LRU, this entry had the oldest last access (${victim.lastAccessMs.toFixed(3)} ms).`;
      } else {
        const picked = selectTrajectoryVictim(observation);
        victimId = picked.agentId;
        scores = picked.scores;
        const victim = cache.get(victimId);
        const candidate = observation.candidates.find(
          (row) => row.agentId === victimId,
        );
        if (!victim || !candidate) {
          throw new Error(`Missing trajectory victim ${victimId}`);
        }
        const scored = trajectoryRetentionValue({
          phase: candidate.currentPhase,
          toolKind: candidate.currentToolKind,
          elapsedToolWaitMs: candidate.elapsedToolWaitMs,
          completedTurns: candidate.completedTurns,
          maxConfiguredTurns: candidate.maxConfiguredTurns,
          estimatedRecomputeMs: candidate.estimatedRecomputeMs,
          residentMiB: candidate.residentMiB,
        });
        reason = `Agent ${victimId} had ${victim.prefixTokens} resident tokens. A newly admitted request needed ${bytesToMiB(requiredBytes).toFixed(1)} MiB. Under the trajectory-aware heuristic, ${victimId} had the lowest estimated retention value (${scored.value.toFixed(4)}) among eligible entries.`;
      }

      const victim = cache.get(victimId);
      if (!victim) throw new Error(`Victim ${victimId} missing`);
      const freedBytes = victim.reservedTokens * bpt;
      cache.delete(victimId);
      const decision: EvictionDecision = {
        atMs: usToMs(nowUs),
        policy: input.policy,
        triggeringAgentId,
        evictedAgentId: victimId,
        freedBytes,
        residentPrefixTokens: victim.prefixTokens,
        reason,
      };
      if (scores) decision.candidateScores = scores;
      evictions.push(decision);
      record("cache-evicted", victimId, {
        triggeringAgentId,
        freedBytes,
        residentPrefixTokens: victim.prefixTokens,
      });
      snap(triggeringAgentId);
    }
  }

  function admit(job: ReadyJob) {
    const agent = agents.get(job.agentId);
    const workload = workloadById.get(job.agentId);
    if (!agent || !workload) throw new Error(`Unknown job ${job.agentId}`);
    if (workerBusy) {
      throw new Error("Serial worker admitted while busy");
    }

    const turn = workload.turns[agent.turnIndex];
    if (!turn) throw new Error(`${agent.id} has no turn ${agent.turnIndex}`);

    const contextTokens = agent.logicalContextTokens;
    const inputTokens = contextTokens + turn.addedInputTokens;
    const requiredTokens = inputTokens + turn.maxOutputTokens;
    const requiredBytes = requiredTokens * bpt;
    if (requiredBytes > capacityBytes) {
      throw {
        kind: "reservation-exceeded",
        agentId: agent.id,
        turnIndex: agent.turnIndex,
        requiredBytes,
        capacityBytes,
      };
    }

    const wasResident = cache.has(agent.id);
    workerBusy = true;
    peekActiveId = agent.id;
    busyStartUs = nowUs;

    evictUntilFits(agent.id, requiredBytes);

    const stillResident = wasResident && cache.has(agent.id);
    const reused = stillResident ? contextTokens : 0;
    const prefillTokens = inputTokens - reused;
    const recomputed = contextTokens - reused;

    cache.set(agent.id, {
      agentId: agent.id,
      prefixTokens: contextTokens,
      reservedTokens: requiredTokens,
      lastAccessMs: usToMs(nowUs),
    });

    reusedInputTokens += reused;
    recomputedInputTokens += recomputed;
    totalInputTokens += inputTokens;
    totalPrefillTokens += prefillTokens;
    totalOutputTokens += turn.outputTokens;
    inferenceStarts += 1;
    if (stillResident && contextTokens > 0) cacheHits += 1;
    else cacheMisses += 1;

    if (agent.queuedAtUs !== undefined && agent.queuedAtUs < nowUs) {
      timeline.push({
        agentId: agent.id,
        phase: "queued",
        startMs: usToMs(agent.queuedAtUs),
        endMs: usToMs(nowUs),
      });
    }

    const prefillUs = durationUs(
      prefillTokens,
      input.config.model.prefillTokensPerSecond,
    );
    const decodeUs = durationUs(
      turn.outputTokens,
      input.config.model.decodeTokensPerSecond,
    );

    agent.phase = "prefill";
    record("inference-started", agent.id, {
      turnIndex: agent.turnIndex,
      hit: stillResident && contextTokens > 0,
      reusedTokens: reused,
      recomputedTokens: recomputed,
      inputTokens,
      prefillTokens,
      outputTokens: turn.outputTokens,
      reservedTokens: requiredTokens,
    });
    record("cache-resized", agent.id, {
      reservedTokens: requiredTokens,
      prefixTokens: contextTokens,
      occupiedBytes: occupiedBytes(cache, bpt),
    });
    snap(agent.id);

    const prefillEnd = nowUs + prefillUs;
    const decodeEnd = prefillEnd + decodeUs;
    timeline.push({
      agentId: agent.id,
      phase: "prefill",
      startMs: usToMs(nowUs),
      endMs: usToMs(prefillEnd),
    });
    timeline.push({
      agentId: agent.id,
      phase: "decode",
      startMs: usToMs(prefillEnd),
      endMs: usToMs(decodeEnd),
    });
    schedule("prefill-complete", agent.id, prefillEnd);
    schedule("decode-complete", agent.id, decodeEnd);
  }

  function onArrival(agentId: string) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`Unknown arrival ${agentId}`);
    agent.arrived = true;
    earliestArrivalUs = Math.min(earliestArrivalUs, nowUs);
    peakActiveAgents = Math.max(peakActiveAgents, activeCount());
    record("agent-arrived", agentId, { arrivalMs: usToMs(nowUs) });
    enqueue(agentId);
    snap();
  }

  function onPrefillComplete(agentId: string) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`Unknown prefill ${agentId}`);
    agent.phase = "decode";
    record("prefill-completed", agentId, { turnIndex: agent.turnIndex });
  }

  function onDecodeComplete(agentId: string) {
    const agent = agents.get(agentId);
    const workload = workloadById.get(agentId);
    if (!agent || !workload) throw new Error(`Unknown decode ${agentId}`);
    if (!workerBusy || peekActiveId !== agentId) {
      throw new Error(`Decode completed for ${agentId} while worker mismatched`);
    }
    if (nowUs < busyStartUs) {
      throw new Error("Worker overlap detected");
    }

    const turn = workload.turns[agent.turnIndex];
    agent.logicalContextTokens += turn.addedInputTokens + turn.outputTokens;
    agent.completedTurns += 1;
    agent.turnIndex += 1;
    workerBusy = false;
    peekActiveId = undefined;

    const entry = cache.get(agentId);
    if (entry) {
      entry.prefixTokens = agent.logicalContextTokens;
      entry.reservedTokens = agent.logicalContextTokens;
      cache.set(agentId, entry);
    }

    record("decode-completed", agentId, {
      logicalContextTokens: agent.logicalContextTokens,
      completedTurns: agent.completedTurns,
    });
    record("cache-resized", agentId, {
      reservedTokens: agent.logicalContextTokens,
      prefixTokens: agent.logicalContextTokens,
      occupiedBytes: occupiedBytes(cache, bpt),
    });

    const moreTurns = agent.turnIndex < workload.turns.length;
    if (!moreTurns) {
      cache.delete(agentId);
      agent.completed = true;
      agent.phase = "completed";
      agent.completionUs = nowUs;
      unfinished -= 1;
      lastCompletionUs = Math.max(lastCompletionUs, nowUs);
      latencies.push(usToMs(nowUs - agent.arrivalUs));
      timeline.push({
        agentId,
        phase: "completed",
        startMs: usToMs(nowUs),
        endMs: usToMs(nowUs),
      });
      record("agent-completed", agentId, {
        latencyMs: usToMs(nowUs - agent.arrivalUs),
        logicalContextTokens: agent.logicalContextTokens,
      });
      snap();
      return;
    }

    const nextTool = turn.nextTool;
    if (nextTool) {
      agent.phase = "tool-wait";
      agent.toolKind = nextTool.kind;
      agent.toolWaitStartUs = nowUs;
      record("tool-started", agentId, {
        kind: nextTool.kind,
        durationMs: nextTool.durationMs,
      });
      schedule(
        "tool-complete",
        agentId,
        nowUs + Math.round(nextTool.durationMs * 1000),
      );
      timeline.push({
        agentId,
        phase: "tool-wait",
        startMs: usToMs(nowUs),
        endMs: usToMs(nowUs + Math.round(nextTool.durationMs * 1000)),
      });
      snap();
      return;
    }

    enqueue(agentId);
    snap();
  }

  function onToolComplete(agentId: string) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`Unknown tool ${agentId}`);
    record("tool-completed", agentId, {
      kind: agent.toolKind ?? "",
    });
    agent.toolKind = undefined;
    agent.toolWaitStartUs = undefined;
    enqueue(agentId);
    snap();
  }

  for (const agent of input.workload.agents) {
    schedule("arrival", agent.id, Math.round(agent.arrivalMs * 1000));
  }

  let steps = 0;
  const maxSteps = 2_000_000;
  while (unfinished > 0) {
    steps += 1;
    if (steps > maxSteps) {
      throw new Error("Simulation exceeded step budget");
    }
    pq.sort(compareEvents);
    if (pq.length === 0) {
      if (!workerBusy && ready.length > 0) {
        admit(ready.shift()!);
        continue;
      }
      throw new Error("Simulation deadlock: events exhausted with unfinished agents");
    }

    nowUs = pq[0].atUs;
    while (pq.length > 0) {
      pq.sort(compareEvents);
      if (pq[0].atUs !== nowUs) break;
      const event = pq.shift();
      if (!event) break;
      if (event.kind === "arrival") onArrival(event.agentId);
      else if (event.kind === "prefill-complete") onPrefillComplete(event.agentId);
      else if (event.kind === "decode-complete") onDecodeComplete(event.agentId);
      else onToolComplete(event.agentId);
    }

    if (!workerBusy && ready.length > 0) {
      admit(ready.shift()!);
    }
  }

  const makespanMs =
    Number.isFinite(earliestArrivalUs) && lastCompletionUs >= earliestArrivalUs
      ? usToMs(lastCompletionUs - earliestArrivalUs)
      : 0;

  return {
    policy: input.policy,
    events,
    evictions,
    timeline,
    cacheSnapshots,
    metrics: metricsFromCounters({
      reusedInputTokens,
      recomputedInputTokens,
      totalInputTokens,
      totalPrefillTokens,
      totalOutputTokens,
      evictionCount: evictions.length,
      makespanMs,
      latencies,
      peakCacheBytes,
      peakActiveAgents,
      inferenceStarts,
      cacheHits,
      cacheMisses,
    }),
  };
}

