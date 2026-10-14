export type PolicyName = "lru" | "trajectory-aware";
export type ToolKind =
  | "file-read"
  | "shell"
  | "file-write"
  | "web"
  | "long-running";
export type AgentPhase =
  | "queued"
  | "prefill"
  | "decode"
  | "tool-wait"
  | "completed";
export type WorkloadPreset = "code" | "terminal" | "research" | "adversarial";

export interface ModelProfile {
  layers: number;
  kvHeads: number;
  headDim: number;
  bytesPerElement: number;
  prefillTokensPerSecond: number;
  decodeTokensPerSecond: number;
}

export interface AgentTurn {
  addedInputTokens: number;
  outputTokens: number;
  maxOutputTokens: number;
  nextTool?: { kind: ToolKind; durationMs: number };
}

export interface AgentWorkload {
  id: string;
  arrivalMs: number;
  turns: readonly AgentTurn[];
}

export interface Workload {
  seed: number;
  preset: WorkloadPreset;
  agents: readonly AgentWorkload[];
}

export interface SimulationConfig {
  memoryBudgetGiB: number;
  model: ModelProfile;
  maxConfiguredTurns: number;
}

export interface CacheEntry {
  agentId: string;
  prefixTokens: number;
  reservedTokens: number;
  lastAccessMs: number;
}

export type SimulationEventType =
  | "agent-arrived"
  | "inference-queued"
  | "inference-started"
  | "prefill-completed"
  | "decode-completed"
  | "tool-started"
  | "tool-completed"
  | "cache-evicted"
  | "cache-resized"
  | "agent-completed";

export interface SimulationEvent {
  id: number;
  atMs: number;
  type: SimulationEventType;
  agentId: string;
  details?: Record<string, string | number | boolean>;
}

export interface PolicyCandidate {
  agentId: string;
  residentTokens: number;
  residentMiB: number;
  lastAccessMs: number;
  currentPhase: AgentPhase;
  currentToolKind?: ToolKind;
  elapsedToolWaitMs?: number;
  completedTurns: number;
  maxConfiguredTurns: number;
  estimatedRecomputeMs: number;
}

export interface PolicyObservation {
  nowMs: number;
  triggeringAgentId: string;
  candidates: readonly PolicyCandidate[];
}

export interface EvictionDecision {
  atMs: number;
  policy: PolicyName;
  triggeringAgentId: string;
  evictedAgentId: string;
  freedBytes: number;
  residentPrefixTokens: number;
  reason: string;
  candidateScores?: Record<string, number>;
}

export interface TimelineSegment {
  agentId: string;
  phase: AgentPhase;
  startMs: number;
  endMs: number;
}

export interface CacheSnapshot {
  atMs: number;
  occupiedBytes: number;
  residentAgentIds: readonly string[];
  residentTokensByAgent: Readonly<Record<string, number>>;
  reservedTokensByAgent: Readonly<Record<string, number>>;
  activeAgentId?: string;
}

export interface SimulationMetrics {
  cacheHitRate: number;
  reusedInputTokens: number;
  recomputedInputTokens: number;
  totalInputTokens: number;
  totalPrefillTokens: number;
  totalOutputTokens: number;
  evictionCount: number;
  makespanMs: number;
  outputTokensPerSecond: number;
  p50AgentLatencyMs: number;
  p95AgentLatencyMs: number;
  peakCacheBytes: number;
  peakActiveAgents: number;
  inferenceStarts: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface SimulationResult {
  policy: PolicyName;
  metrics: SimulationMetrics;
  events: readonly SimulationEvent[];
  evictions: readonly EvictionDecision[];
  timeline: readonly TimelineSegment[];
  cacheSnapshots: readonly CacheSnapshot[];
}

export interface ReservationFailure {
  kind: "reservation-exceeded";
  agentId: string;
  turnIndex: number;
  requiredBytes: number;
  capacityBytes: number;
}

export type ExperimentConfig = {
  preset: WorkloadPreset;
  agentCount: number;
  memoryBudgetGiB: number;
  seed: number;
};
