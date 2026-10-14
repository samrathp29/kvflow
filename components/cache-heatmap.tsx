import { useMemo } from "react";
import { heatmapFor, type HeatCellState } from "@/lib/chart-data";
import { formatMs, formatTokens } from "@/lib/formatting";
import type { EvictionDecision, SimulationResult } from "@/lib/sim/types";

const FILL: Record<HeatCellState, string> = {
  absent: "transparent",
  resident: "rgba(130,158,210,0.42)",
  active: "rgba(167,189,240,0.88)",
  evicted: "rgba(222,152,124,0.85)",
};

export function CacheHeatmap({
  result,
  agentIds,
  makespanMs,
  playheadMs,
  selectedAgentId,
  onSelectAgent,
  onSelectEviction,
}: {
  result: SimulationResult;
  agentIds: readonly string[];
  makespanMs: number;
  playheadMs: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onSelectEviction: (eviction: EvictionDecision) => void;
}) {
  const cells = useMemo(
    () => heatmapFor(result, agentIds, makespanMs),
    [result, agentIds, makespanMs],
  );
  const bins = 100;
  const playheadPct = makespanMs <= 0 ? 0 : (playheadMs / makespanMs) * 100;

  return (
    <section className="rounded-[14px] border border-border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] tracking-[0.16em] text-mute uppercase">
            KV-cache residency
          </h2>
          <p className="mt-1 text-[12px] text-mute">
            Reconstructed from cache events. Simulated virtual time, not wall clock.
          </p>
        </div>
        <Legend />
      </div>
      <div className="relative overflow-x-auto">
        <div
          className="relative min-w-[640px]"
          style={{
            display: "grid",
            gridTemplateColumns: `42px repeat(${bins}, minmax(0, 1fr))`,
            gap: 1,
          }}
        >
          {agentIds.map((agentId) => (
            <Row
              key={agentId}
              agentId={agentId}
              cells={cells.filter((cell) => cell.agentId === agentId)}
              selected={selectedAgentId === agentId}
              evictions={result.evictions}
              onSelectAgent={onSelectAgent}
              onSelectEviction={onSelectEviction}
            />
          ))}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent-bright"
            style={{ left: `calc(42px + (100% - 42px) * ${playheadPct / 100})` }}
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-mute">
        Hover a cell for tokens and phase. Click an eviction cell to open the inspector.
      </p>
    </section>
  );
}

function Row({
  agentId,
  cells,
  selected,
  evictions,
  onSelectAgent,
  onSelectEviction,
}: {
  agentId: string;
  cells: ReturnType<typeof heatmapFor>;
  selected: boolean;
  evictions: readonly EvictionDecision[];
  onSelectAgent: (agentId: string) => void;
  onSelectEviction: (eviction: EvictionDecision) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelectAgent(agentId)}
        className={`tabular pr-2 text-right text-[10px] ${
          selected ? "text-accent-bright" : "text-mute"
        }`}
      >
        {agentId}
      </button>
      {cells.map((cell) => {
        const eviction = evictions.find(
          (item) =>
            item.evictedAgentId === agentId &&
            item.atMs >= cell.startMs &&
            item.atMs < cell.endMs,
        );
        return (
          <button
            key={`${agentId}-${cell.bin}`}
            type="button"
            title={`${agentId} ${formatMs(cell.startMs)}–${formatMs(cell.endMs)} · ${cell.state}${
              cell.residentTokens ? ` · ${formatTokens(cell.residentTokens)} tok` : ""
            }`}
            onClick={() => {
              onSelectAgent(agentId);
              if (eviction) onSelectEviction(eviction);
            }}
            className="h-2.5 rounded-[1px] focus-visible:ring-1 focus-visible:ring-accent-bright focus-visible:outline-none"
            style={{
              background: FILL[cell.state],
              boxShadow: selected ? "inset 0 0 0 1px rgba(167,189,240,0.7)" : undefined,
            }}
          />
        );
      })}
    </>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-3 text-[11px] text-mute">
      <Item color={FILL.resident} label="Resident" />
      <Item color={FILL.active} label="Active reservation" />
      <Item color={FILL.evicted} label="Evicted in bin" />
      <Item color="#3b3946" label="Absent" />
    </ul>
  );
}

function Item({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="h-2 w-3 rounded-[2px] border border-border"
        style={{ background: color }}
      />
      {label}
    </li>
  );
}
