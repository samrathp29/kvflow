import type {
  AgentPhase,
  CacheEntry,
  PolicyName,
  PolicyObservation,
  ToolKind,
} from "./types";

const BASE_RETURN_SOON: Record<ToolKind, number> = {
  "file-read": 0.8,
  shell: 0.65,
  "file-write": 0.75,
  web: 0.45,
  "long-running": 0.2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function selectLRUVictim(candidates: CacheEntry[]): CacheEntry {
  if (candidates.length === 0) {
    throw new Error("No eligible eviction candidate");
  }
  return [...candidates].sort(
    (a, b) =>
      a.lastAccessMs - b.lastAccessMs || a.agentId.localeCompare(b.agentId),
  )[0];
}

export function baseReturnSoonProbability(
  phase: AgentPhase,
  toolKind?: ToolKind,
): number {
  if (phase === "tool-wait" && toolKind) {
    return BASE_RETURN_SOON[toolKind];
  }
  return 0.95;
}

export function trajectoryRetentionValue(input: {
  phase: AgentPhase;
  toolKind?: ToolKind;
  elapsedToolWaitMs?: number;
  completedTurns: number;
  maxConfiguredTurns: number;
  estimatedRecomputeMs: number;
  residentMiB: number;
}): { probability: number; value: number } {
  const base = baseReturnSoonProbability(input.phase, input.toolKind);
  const elapsedWaitAdjustment =
    input.phase === "tool-wait"
      ? Math.exp(-(input.elapsedToolWaitMs ?? 0) / 12000)
      : 1;
  const progressRatio =
    input.maxConfiguredTurns <= 0
      ? 0
      : Math.min(input.completedTurns / input.maxConfiguredTurns, 1);
  const progressAdjustment = 1 - 0.25 * progressRatio;
  const probability = clamp(
    base * elapsedWaitAdjustment * progressAdjustment,
    0.02,
    0.99,
  );
  const footprint = Math.max(input.residentMiB, 1 / 1024);
  const value =
    (probability * input.estimatedRecomputeMs) / footprint ** 0.65;
  return { probability, value };
}

export function selectTrajectoryVictim(observation: PolicyObservation): {
  agentId: string;
  scores: Record<string, number>;
} {
  if (observation.candidates.length === 0) {
    throw new Error("No eligible eviction candidate");
  }
  const scores: Record<string, number> = {};
  let bestId = observation.candidates[0].agentId;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of observation.candidates) {
    const { value } = trajectoryRetentionValue({
      phase: candidate.currentPhase,
      toolKind: candidate.currentToolKind,
      elapsedToolWaitMs: candidate.elapsedToolWaitMs,
      completedTurns: candidate.completedTurns,
      maxConfiguredTurns: candidate.maxConfiguredTurns,
      estimatedRecomputeMs: candidate.estimatedRecomputeMs,
      residentMiB: candidate.residentMiB,
    });
    scores[candidate.agentId] = value;
    if (
      value < bestScore ||
      (value === bestScore && candidate.agentId.localeCompare(bestId) < 0)
    ) {
      bestScore = value;
      bestId = candidate.agentId;
    }
  }
  return { agentId: bestId, scores };
}

export function policyLabel(policy: PolicyName): string {
  return policy === "lru" ? "LRU" : "Trajectory-aware";
}
