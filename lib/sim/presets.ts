import type { ToolKind, WorkloadPreset } from "./types";

export const MEMORY_BUDGETS_GIB = [4, 8, 12, 16, 24, 32] as const;
export const MIN_AGENTS = 5;
export const MAX_AGENTS = 40;
export const DEFAULT_SEED = 42;
export const DEFAULT_AGENTS = 25;
export const DEFAULT_MEMORY_GIB = 8;
export const DEFAULT_PRESET: WorkloadPreset = "code";

export type ToolWeight = readonly [ToolKind, number];

export interface PresetSpec {
  id: WorkloadPreset;
  label: string;
  blurb: string;
  defaultAgents: number;
  turnRange: readonly [number, number];
  initialPrompt: readonly [number, number];
  addedLater: readonly [number, number];
  outputRange: readonly [number, number];
  maxOutputSlack: number;
  arrivalSpreadMs: number;
  toolChance: number;
  tools: readonly ToolWeight[];
  toolDuration: Record<
    ToolKind,
    { medianMs: number; sigma: number; minMs: number; maxMs: number }
  >;
}

const SHARED_DURATIONS: PresetSpec["toolDuration"] = {
  "file-read": { medianMs: 700, sigma: 0.55, minMs: 180, maxMs: 2800 },
  shell: { medianMs: 1400, sigma: 0.7, minMs: 350, maxMs: 7000 },
  "file-write": { medianMs: 500, sigma: 0.45, minMs: 140, maxMs: 1800 },
  web: { medianMs: 4500, sigma: 0.65, minMs: 1600, maxMs: 14000 },
  "long-running": { medianMs: 14000, sigma: 0.5, minMs: 8000, maxMs: 28000 },
};

export const PRESETS: Record<WorkloadPreset, PresetSpec> = {
  code: {
    id: "code",
    label: "Coding agents",
    blurb: "File reads, edits, and tests fighting for prefix residency.",
    defaultAgents: 25,
    turnRange: [6, 10],
    initialPrompt: [2000, 4000],
    addedLater: [200, 650],
    outputRange: [80, 260],
    maxOutputSlack: 40,
    arrivalSpreadMs: 16000,
    toolChance: 0.92,
    tools: [
      ["file-read", 4],
      ["file-write", 2],
      ["shell", 2],
      ["web", 1],
    ],
    toolDuration: SHARED_DURATIONS,
  },
  terminal: {
    id: "terminal",
    label: "Tool-heavy terminal",
    blurb: "Frequent shell round-trips. Re-entry pressure, shorter prefixes.",
    defaultAgents: 20,
    turnRange: [10, 15],
    initialPrompt: [1000, 2000],
    addedLater: [100, 350],
    outputRange: [40, 160],
    maxOutputSlack: 30,
    arrivalSpreadMs: 12000,
    toolChance: 0.97,
    tools: [
      ["shell", 5],
      ["file-read", 2],
      ["file-write", 2],
      ["long-running", 1],
    ],
    toolDuration: SHARED_DURATIONS,
  },
  research: {
    id: "research",
    label: "Long-context research",
    blurb: "Fat prefixes and slower external calls. Fewer agents, larger KV.",
    defaultAgents: 12,
    turnRange: [4, 7],
    initialPrompt: [8000, 12000],
    addedLater: [600, 1800],
    outputRange: [120, 400],
    maxOutputSlack: 80,
    arrivalSpreadMs: 20000,
    toolChance: 0.88,
    tools: [
      ["web", 4],
      ["file-read", 2],
      ["long-running", 2],
      ["shell", 1],
    ],
    toolDuration: SHARED_DURATIONS,
  },
  adversarial: {
    id: "adversarial",
    label: "Adversarial waits",
    blurb: "Long waits on tools the heuristic thinks will return soon.",
    defaultAgents: 18,
    turnRange: [8, 12],
    initialPrompt: [1800, 3200],
    addedLater: [180, 520],
    outputRange: [70, 200],
    maxOutputSlack: 40,
    arrivalSpreadMs: 10000,
    toolChance: 0.95,
    tools: [
      ["file-read", 6],
      ["file-write", 2],
      ["long-running", 2],
      ["web", 1],
    ],
    toolDuration: {
      "file-read": { medianMs: 22000, sigma: 0.35, minMs: 14000, maxMs: 42000 },
      shell: { medianMs: 900, sigma: 0.4, minMs: 300, maxMs: 2500 },
      "file-write": { medianMs: 18000, sigma: 0.3, minMs: 12000, maxMs: 32000 },
      web: { medianMs: 900, sigma: 0.4, minMs: 250, maxMs: 2200 },
      "long-running": { medianMs: 500, sigma: 0.35, minMs: 180, maxMs: 1100 },
    },
  },
};

export function presetDefaultAgents(preset: WorkloadPreset): number {
  return PRESETS[preset].defaultAgents;
}
