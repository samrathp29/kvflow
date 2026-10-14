import { describe, expect, it } from "vitest";
import { simulate } from "@/lib/sim/engine";
import { DEFAULT_MODEL, bytesPerToken, giBToBytes } from "@/lib/sim/memory";
import { metricsFromEvents } from "@/lib/sim/metrics";
import { runExperiment } from "@/lib/sim/experiment";
import { findReservationFailure } from "@/lib/sim/workload";
import type { SimulationConfig, Workload } from "@/lib/sim/types";

const tinyConfig: SimulationConfig = {
  memoryBudgetGiB: (900 * bytesPerToken(DEFAULT_MODEL)) / giBToBytes(1),
  model: DEFAULT_MODEL,
  maxConfiguredTurns: 2,
};

const threeAgentWorkload: Workload = {
  seed: 0,
  preset: "code",
  agents: [
    {
      id: "A01",
      arrivalMs: 0,
      turns: [
        {
          addedInputTokens: 400,
          outputTokens: 50,
          maxOutputTokens: 50,
          nextTool: { kind: "file-read", durationMs: 5000 },
        },
        { addedInputTokens: 100, outputTokens: 20, maxOutputTokens: 20 },
      ],
    },
    {
      id: "A02",
      arrivalMs: 100,
      turns: [
        {
          addedInputTokens: 400,
          outputTokens: 50,
          maxOutputTokens: 50,
          nextTool: { kind: "shell", durationMs: 5000 },
        },
        { addedInputTokens: 100, outputTokens: 20, maxOutputTokens: 20 },
      ],
    },
    {
      id: "A03",
      arrivalMs: 200,
      turns: [
        { addedInputTokens: 400, outputTokens: 50, maxOutputTokens: 50 },
      ],
    },
  ],
};

describe("hand-authored three-agent eviction", () => {
  it("evicts A01 under LRU when A03 is admitted and recomputes the prefix", () => {
    const result = simulate({
      workload: threeAgentWorkload,
      policy: "lru",
      config: tinyConfig,
    });
    expect(result.evictions[0]?.evictedAgentId).toBe("A01");
    expect(result.evictions[0]?.triggeringAgentId).toBe("A03");

    const secondTurn = result.events.find(
      (event) =>
        event.type === "inference-started" &&
        event.agentId === "A01" &&
        event.details?.turnIndex === 1,
    );
    expect(secondTurn?.details?.hit).toBe(false);
    expect(secondTurn?.details?.recomputedTokens).toBe(450);
    expect(secondTurn?.details?.prefillTokens).toBe(550);
  });
});

describe("engine invariants", () => {
  it("is deterministic", () => {
    const a = runExperiment({
      preset: "code",
      agentCount: 8,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    const b = runExperiment({
      preset: "code",
      agentCount: 8,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.lru.metrics).toEqual(b.lru.metrics);
      expect(a.aware.metrics).toEqual(b.aware.metrics);
      expect(a.lru.evictions.map((row) => row.evictedAgentId)).toEqual(
        b.lru.evictions.map((row) => row.evictedAgentId),
      );
    }
  });

  it("never lets reservations exceed capacity", () => {
    const run = runExperiment({
      preset: "code",
      agentCount: 25,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const capacity = giBToBytes(8);
    for (const result of [run.lru, run.aware]) {
      for (const snap of result.cacheSnapshots) {
        expect(snap.occupiedBytes).toBeLessThanOrEqual(capacity);
      }
    }
  });

  it("reuses zero prefix tokens on a cold start", () => {
    const run = runExperiment({
      preset: "terminal",
      agentCount: 6,
      memoryBudgetGiB: 16,
      seed: 3,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const firstByAgent = new Map<string, (typeof run.lru.events)[number]>();
    for (const event of run.lru.events) {
      if (event.type !== "inference-started") continue;
      if (!firstByAgent.has(event.agentId)) firstByAgent.set(event.agentId, event);
    }
    for (const event of firstByAgent.values()) {
      expect(event.details?.reusedTokens).toBe(0);
    }
  });

  it("keeps a prefix hit when the cache is huge", () => {
    const run = runExperiment({
      preset: "code",
      agentCount: 6,
      memoryBudgetGiB: 32,
      seed: 11,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.lru.metrics.evictionCount).toBe(0);
    expect(run.aware.metrics.evictionCount).toBe(0);
    expect(run.lru.metrics.recomputedInputTokens).toBe(0);
    expect(run.aware.metrics.recomputedInputTokens).toBe(0);
    expect(run.lru.metrics).toEqual(run.aware.metrics);
  });

  it("releases cache when an agent finishes", () => {
    const result = simulate({
      workload: threeAgentWorkload,
      policy: "lru",
      config: tinyConfig,
    });
    const lastSnap = result.cacheSnapshots[result.cacheSnapshots.length - 1];
    expect(lastSnap.residentAgentIds).toEqual([]);
    expect(
      result.events.filter((event) => event.type === "agent-completed"),
    ).toHaveLength(3);
  });

  it("never overlaps prefill or decode on the single worker", () => {
    const run = runExperiment({
      preset: "code",
      agentCount: 10,
      memoryBudgetGiB: 8,
      seed: 5,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const compute = run.lru.timeline
      .filter((seg) => seg.phase === "prefill" || seg.phase === "decode")
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    for (let i = 1; i < compute.length; i += 1) {
      expect(compute[i].startMs).toBeGreaterThanOrEqual(compute[i - 1].endMs - 1e-9);
    }
  });

  it("lets tool waits overlap other inference", () => {
    const result = simulate({
      workload: threeAgentWorkload,
      policy: "lru",
      config: tinyConfig,
    });
    const tools = result.timeline.filter((seg) => seg.phase === "tool-wait");
    const compute = result.timeline.filter(
      (seg) => seg.phase === "prefill" || seg.phase === "decode",
    );
    const overlap = tools.some((tool) =>
      compute.some(
        (job) =>
          job.agentId !== tool.agentId &&
          job.startMs < tool.endMs &&
          job.endMs > tool.startMs,
      ),
    );
    expect(overlap).toBe(true);
  });

  it("matches summary metrics to the event trace", () => {
    const run = runExperiment({
      preset: "code",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const traced = metricsFromEvents(run.aware);
    expect(traced.reusedInputTokens).toBe(run.aware.metrics.reusedInputTokens);
    expect(traced.recomputedInputTokens).toBe(
      run.aware.metrics.recomputedInputTokens,
    );
    expect(traced.totalPrefillTokens).toBe(run.aware.metrics.totalPrefillTokens);
    expect(traced.evictionCount).toBe(run.aware.metrics.evictionCount);
  });

  it("rejects a reservation larger than the cache instead of overcommitting", () => {
    const workload: Workload = {
      seed: 0,
      preset: "research",
      agents: [
        {
          id: "A01",
          arrivalMs: 0,
          turns: [
            {
              addedInputTokens: 80_000,
              outputTokens: 10,
              maxOutputTokens: 10,
            },
          ],
        },
      ],
    };
    const config: SimulationConfig = {
      memoryBudgetGiB: 8,
      model: DEFAULT_MODEL,
      maxConfiguredTurns: 1,
    };
    expect(findReservationFailure(workload, config)?.kind).toBe(
      "reservation-exceeded",
    );
  });

  it("grows logical context by added input plus generated output", () => {
    const result = simulate({
      workload: threeAgentWorkload,
      policy: "lru",
      config: tinyConfig,
    });
    const done = result.events.find(
      (event) => event.type === "agent-completed" && event.agentId === "A01",
    );
    expect(done?.details?.logicalContextTokens).toBe(400 + 50 + 100 + 20);
  });

  it("runs the default featured experiment", () => {
    const run = runExperiment({
      preset: "code",
      agentCount: 25,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.lru.metrics.makespanMs).toBeGreaterThan(0);
    expect(run.aware.metrics.makespanMs).toBeGreaterThan(0);
    expect(run.workload.agents).toHaveLength(25);
  });
});
