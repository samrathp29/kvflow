import { bytesPerToken, giBToBytes } from "./memory";
import { PRESETS } from "./presets";
import { intInRange, lognormalMs, mulberry32, pickWeighted } from "./prng";
import type {
  AgentTurn,
  AgentWorkload,
  ExperimentConfig,
  ReservationFailure,
  SimulationConfig,
  Workload,
} from "./types";

function padAgentId(index: number): string {
  return `A${String(index + 1).padStart(2, "0")}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function generateWorkload(config: ExperimentConfig): Workload {
  const spec = PRESETS[config.preset];
  const rng = mulberry32(config.seed);
  const agents: AgentWorkload[] = [];

  for (let i = 0; i < config.agentCount; i += 1) {
    const turnCount = intInRange(rng, spec.turnRange[0], spec.turnRange[1]);
    const jitter = Math.floor(rng() * Math.max(1, spec.arrivalSpreadMs / 8));
    const staggered = Math.floor(
      (i * spec.arrivalSpreadMs) / Math.max(config.agentCount, 1),
    );
    const arrivalMs = staggered + jitter;
    const turns: AgentTurn[] = [];

    for (let t = 0; t < turnCount; t += 1) {
      const addedInputTokens =
        t === 0
          ? intInRange(rng, spec.initialPrompt[0], spec.initialPrompt[1])
          : intInRange(rng, spec.addedLater[0], spec.addedLater[1]);
      const outputTokens = intInRange(
        rng,
        spec.outputRange[0],
        spec.outputRange[1],
      );
      const maxOutputTokens = outputTokens + spec.maxOutputSlack;
      const isLast = t === turnCount - 1;
      const turn: AgentTurn = {
        addedInputTokens,
        outputTokens,
        maxOutputTokens,
      };
      if (!isLast && rng() < spec.toolChance) {
        const kind = pickWeighted(rng, spec.tools);
        const duration = spec.toolDuration[kind];
        turn.nextTool = {
          kind,
          durationMs: lognormalMs(
            rng,
            duration.medianMs,
            duration.sigma,
            duration.minMs,
            duration.maxMs,
          ),
        };
      }
      turns.push(turn);
    }

    agents.push({
      id: padAgentId(i),
      arrivalMs,
      turns,
    });
  }

  return deepFreeze({
    seed: config.seed,
    preset: config.preset,
    agents,
  });
}

export function findReservationFailure(
  workload: Workload,
  sim: SimulationConfig,
): ReservationFailure | null {
  const bpt = bytesPerToken(sim.model);
  const capacityBytes = giBToBytes(sim.memoryBudgetGiB);

  for (const agent of workload.agents) {
    let context = 0;
    for (let i = 0; i < agent.turns.length; i += 1) {
      const turn = agent.turns[i];
      if (turn.outputTokens > turn.maxOutputTokens) {
        throw new Error(
          `${agent.id} turn ${i} output ${turn.outputTokens} exceeds max ${turn.maxOutputTokens}`,
        );
      }
      const requiredTokens =
        context + turn.addedInputTokens + turn.maxOutputTokens;
      const requiredBytes = requiredTokens * bpt;
      if (requiredBytes > capacityBytes) {
        return {
          kind: "reservation-exceeded",
          agentId: agent.id,
          turnIndex: i,
          requiredBytes,
          capacityBytes,
        };
      }
      context += turn.addedInputTokens + turn.outputTokens;
    }
  }
  return null;
}
