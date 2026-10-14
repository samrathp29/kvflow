import { inputReuseShare } from "./sim/metrics";
import type { ExperimentRun } from "./sim/experiment";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportJson(run: Extract<ExperimentRun, { ok: true }>) {
  download(
    `kvflow-${run.config.preset}-${run.config.seed}.json`,
    JSON.stringify(
      {
        config: run.config,
        lru: {
          policy: run.lru.policy,
          metrics: run.lru.metrics,
          evictions: run.lru.evictions,
          events: run.lru.events,
        },
        aware: {
          policy: run.aware.policy,
          metrics: run.aware.metrics,
          evictions: run.aware.evictions,
          events: run.aware.events,
        },
      },
      null,
      2,
    ),
    "application/json",
  );
}

export function exportCsv(run: Extract<ExperimentRun, { ok: true }>) {
  const lines = [
    "policy,reuse_share,recomputed_tokens,makespan_ms,evictions,hit_rate,p50_latency_ms,p95_latency_ms,peak_cache_bytes",
    row("lru", run),
    row("trajectory-aware", run),
    "",
    "policy,at_ms,evicted,trigger,freed_bytes,prefix_tokens",
    ...run.lru.evictions.map(
      (eviction) =>
        `lru,${eviction.atMs},${eviction.evictedAgentId},${eviction.triggeringAgentId},${eviction.freedBytes},${eviction.residentPrefixTokens}`,
    ),
    ...run.aware.evictions.map(
      (eviction) =>
        `trajectory-aware,${eviction.atMs},${eviction.evictedAgentId},${eviction.triggeringAgentId},${eviction.freedBytes},${eviction.residentPrefixTokens}`,
    ),
  ];
  download(
    `kvflow-${run.config.preset}-${run.config.seed}.csv`,
    lines.join("\n"),
    "text/csv",
  );
}

function row(policy: "lru" | "trajectory-aware", run: Extract<ExperimentRun, { ok: true }>) {
  const result = policy === "lru" ? run.lru : run.aware;
  const reuse = inputReuseShare(result.metrics);
  return [
    policy,
    reuse === null ? "NA" : reuse,
    result.metrics.recomputedInputTokens,
    result.metrics.makespanMs,
    result.metrics.evictionCount,
    result.metrics.cacheHitRate,
    result.metrics.p50AgentLatencyMs,
    result.metrics.p95AgentLatencyMs,
    result.metrics.peakCacheBytes,
  ].join(",");
}
