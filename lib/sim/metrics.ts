import type { SimulationEvent, SimulationMetrics, SimulationResult } from "./types";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function metricsFromCounters(input: {
  reusedInputTokens: number;
  recomputedInputTokens: number;
  totalInputTokens: number;
  totalPrefillTokens: number;
  totalOutputTokens: number;
  evictionCount: number;
  makespanMs: number;
  latencies: number[];
  peakCacheBytes: number;
  peakActiveAgents: number;
  inferenceStarts: number;
  cacheHits: number;
  cacheMisses: number;
}): SimulationMetrics {
  const latencies = [...input.latencies].sort((a, b) => a - b);
  const hitDenom = input.cacheHits + input.cacheMisses;
  return {
    cacheHitRate: hitDenom === 0 ? 0 : input.cacheHits / hitDenom,
    reusedInputTokens: input.reusedInputTokens,
    recomputedInputTokens: input.recomputedInputTokens,
    totalInputTokens: input.totalInputTokens,
    totalPrefillTokens: input.totalPrefillTokens,
    totalOutputTokens: input.totalOutputTokens,
    evictionCount: input.evictionCount,
    makespanMs: input.makespanMs,
    outputTokensPerSecond:
      input.makespanMs <= 0
        ? 0
        : input.totalOutputTokens / (input.makespanMs / 1000),
    p50AgentLatencyMs: percentile(latencies, 50),
    p95AgentLatencyMs: percentile(latencies, 95),
    peakCacheBytes: input.peakCacheBytes,
    peakActiveAgents: input.peakActiveAgents,
    inferenceStarts: input.inferenceStarts,
    cacheHits: input.cacheHits,
    cacheMisses: input.cacheMisses,
  };
}

export function metricsFromEvents(result: SimulationResult): {
  reusedInputTokens: number;
  recomputedInputTokens: number;
  totalInputTokens: number;
  totalPrefillTokens: number;
  totalOutputTokens: number;
  evictionCount: number;
  cacheHits: number;
  cacheMisses: number;
  inferenceStarts: number;
} {
  let reusedInputTokens = 0;
  let recomputedInputTokens = 0;
  let totalInputTokens = 0;
  let totalPrefillTokens = 0;
  let totalOutputTokens = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let inferenceStarts = 0;
  let evictionCount = 0;

  for (const event of result.events) {
    if (event.type === "cache-evicted") evictionCount += 1;
    if (event.type !== "inference-started") continue;
    inferenceStarts += 1;
    reusedInputTokens += num(event, "reusedTokens");
    recomputedInputTokens += num(event, "recomputedTokens");
    totalInputTokens += num(event, "inputTokens");
    totalPrefillTokens += num(event, "prefillTokens");
    totalOutputTokens += num(event, "outputTokens");
    if (event.details?.hit === true) cacheHits += 1;
    else cacheMisses += 1;
  }

  return {
    reusedInputTokens,
    recomputedInputTokens,
    totalInputTokens,
    totalPrefillTokens,
    totalOutputTokens,
    evictionCount,
    cacheHits,
    cacheMisses,
    inferenceStarts,
  };
}

function num(event: SimulationEvent, key: string): number {
  const value = event.details?.[key];
  return typeof value === "number" ? value : 0;
}

export function inputReuseShare(metrics: SimulationMetrics): number | null {
  if (metrics.totalInputTokens === 0) return null;
  return metrics.reusedInputTokens / metrics.totalInputTokens;
}
