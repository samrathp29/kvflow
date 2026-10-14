import type { ReactNode } from "react";
import {
  MAX_AGENTS,
  MEMORY_BUDGETS_GIB,
  MIN_AGENTS,
  PRESETS,
} from "@/lib/sim/presets";
import type { ExperimentConfig, PolicyName, WorkloadPreset } from "@/lib/sim/types";

const SPEEDS = [0.5, 1, 2, 4] as const;

export function ExperimentControls({
  draft,
  runConfig,
  policy,
  speed,
  onDraft,
  onPolicy,
  onSpeed,
  onRun,
  onReset,
  onShare,
  onExportJson,
  onExportCsv,
  shareState,
}: {
  draft: ExperimentConfig;
  runConfig: ExperimentConfig;
  policy: PolicyName;
  speed: number;
  onDraft: (next: ExperimentConfig) => void;
  onPolicy: (policy: PolicyName) => void;
  onSpeed: (speed: number) => void;
  onRun: () => void;
  onReset: () => void;
  onShare: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  shareState: string;
}) {
  const stale =
    draft.preset !== runConfig.preset ||
    draft.agentCount !== runConfig.agentCount ||
    draft.memoryBudgetGiB !== runConfig.memoryBudgetGiB ||
    draft.seed !== runConfig.seed;

  return (
    <aside className="flex flex-col gap-5 border-border md:w-[280px] md:shrink-0 md:border-r md:pr-5">
      <div>
        <Label>Workload</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(PRESETS) as WorkloadPreset[]).map((id) => {
            const spec = PRESETS[id];
            const active = draft.preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onDraft({
                    ...draft,
                    preset: id,
                    agentCount: spec.defaultAgents,
                  })
                }
                className={`rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-200 ${
                  active
                    ? "border-accent bg-panel-elevated"
                    : "border-border bg-panel hover:border-accent/40"
                }`}
              >
                <div className="text-[12px] font-medium">{spec.label}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-mute">
                  {spec.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>
          Agents launched
          <span className="tabular ml-auto text-ink">{draft.agentCount}</span>
        </Label>
        <input
          className="mt-2 w-full"
          type="range"
          min={MIN_AGENTS}
          max={MAX_AGENTS}
          value={draft.agentCount}
          onChange={(event) =>
            onDraft({ ...draft, agentCount: Number(event.target.value) })
          }
          aria-label="Agents launched"
        />
      </div>

      <div>
        <Label>KV-cache budget</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MEMORY_BUDGETS_GIB.map((giB) => (
            <button
              key={giB}
              type="button"
              onClick={() => onDraft({ ...draft, memoryBudgetGiB: giB })}
              className={`rounded-md px-2 py-1 text-[12px] tabular transition-colors duration-200 ${
                draft.memoryBudgetGiB === giB
                  ? "bg-accent text-[#1c1b21]"
                  : "bg-panel-elevated text-mute hover:text-ink"
              }`}
            >
              {giB} GiB
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="seed">Seed</Label>
        <input
          id="seed"
          type="number"
          min={0}
          max={1_000_000_000}
          value={draft.seed}
          onChange={(event) =>
            onDraft({
              ...draft,
              seed: Number.parseInt(event.target.value, 10) || 0,
            })
          }
          className="mt-2 h-9 w-full rounded-[10px] border border-border bg-panel-elevated px-3 text-[13px] tabular outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div>
        <Label>Visible policy</Label>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-[10px] bg-panel-elevated p-1">
          {(
            [
              ["lru", "LRU"],
              ["trajectory-aware", "Trajectory"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onPolicy(id)}
              className={`rounded-md py-1.5 text-[12px] transition-colors duration-200 ${
                policy === id ? "bg-accent text-[#1c1b21]" : "text-mute hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Playback speed</Label>
        <div className="mt-2 flex gap-1">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSpeed(value)}
              className={`flex-1 rounded-md py-1.5 text-[12px] tabular transition-colors duration-200 ${
                speed === value
                  ? "bg-panel-elevated text-ink"
                  : "text-mute hover:text-ink"
              }`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>

      {stale ? (
        <p className="text-[12px] text-warning">
          Controls changed. Charts still show the last run until you press Run.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRun}
          className="rounded-[10px] bg-accent px-3 py-2 text-[12px] font-medium text-[#1c1b21] transition-colors duration-200 hover:bg-accent-bright"
        >
          Run
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-[10px] border border-border px-3 py-2 text-[12px] text-mute transition-colors duration-200 hover:text-ink"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onShare}
          className="rounded-[10px] border border-border px-3 py-2 text-[12px] text-mute transition-colors duration-200 hover:text-ink"
        >
          {shareState}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onExportJson}
          className="text-[11px] text-mute underline-offset-2 hover:text-ink hover:underline"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          className="text-[11px] text-mute underline-offset-2 hover:text-ink hover:underline"
        >
          Download CSV
        </button>
      </div>
    </aside>
  );
}

function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center text-[11px] tracking-[0.14em] text-mute uppercase"
    >
      {children}
    </label>
  );
}
