import {
  DEFAULT_AGENTS,
  DEFAULT_MEMORY_GIB,
  DEFAULT_PRESET,
  DEFAULT_SEED,
  MAX_AGENTS,
  MEMORY_BUDGETS_GIB,
  MIN_AGENTS,
  PRESETS,
} from "./sim/presets";
import type { ExperimentConfig, PolicyName, WorkloadPreset } from "./sim/types";

export const DEFAULT_EXPERIMENT: ExperimentConfig = {
  preset: DEFAULT_PRESET,
  agentCount: DEFAULT_AGENTS,
  memoryBudgetGiB: DEFAULT_MEMORY_GIB,
  seed: DEFAULT_SEED,
};

export const DEFAULT_POLICY: PolicyName = "trajectory-aware";

const PRESET_IDS = new Set(Object.keys(PRESETS));
const MEMORY_SET = new Set<number>(MEMORY_BUDGETS_GIB);

export function parseShareConfig(search: string): {
  experiment: ExperimentConfig;
  policy: PolicyName;
} | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const hasKnown =
    params.has("preset") ||
    params.has("policy") ||
    params.has("agents") ||
    params.has("memory") ||
    params.has("seed");
  if (!hasKnown) return null;

  const presetRaw = params.get("preset") ?? DEFAULT_PRESET;
  const policyRaw = params.get("policy") ?? DEFAULT_POLICY;
  const agentsRaw = params.get("agents");
  const memoryRaw = params.get("memory");
  const seedRaw = params.get("seed");

  if (!PRESET_IDS.has(presetRaw)) return null;
  if (policyRaw !== "lru" && policyRaw !== "trajectory-aware") return null;

  const agentCount = agentsRaw
    ? Number.parseInt(agentsRaw, 10)
    : PRESETS[presetRaw as WorkloadPreset].defaultAgents;
  const memoryBudgetGiB = memoryRaw
    ? Number.parseInt(memoryRaw, 10)
    : DEFAULT_MEMORY_GIB;
  const seed = seedRaw ? Number.parseInt(seedRaw, 10) : DEFAULT_SEED;

  if (!Number.isInteger(agentCount) || agentCount < MIN_AGENTS || agentCount > MAX_AGENTS) {
    return null;
  }
  if (!MEMORY_SET.has(memoryBudgetGiB)) return null;
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000_000) return null;

  return {
    experiment: {
      preset: presetRaw as WorkloadPreset,
      agentCount,
      memoryBudgetGiB,
      seed,
    },
    policy: policyRaw,
  };
}

export function toShareQuery(
  experiment: ExperimentConfig,
  policy: PolicyName,
): string {
  const params = new URLSearchParams({
    preset: experiment.preset,
    agents: String(experiment.agentCount),
    memory: String(experiment.memoryBudgetGiB),
    seed: String(experiment.seed),
    policy,
  });
  return `?${params.toString()}`;
}

export function configsEqual(a: ExperimentConfig, b: ExperimentConfig): boolean {
  return (
    a.preset === b.preset &&
    a.agentCount === b.agentCount &&
    a.memoryBudgetGiB === b.memoryBudgetGiB &&
    a.seed === b.seed
  );
}
