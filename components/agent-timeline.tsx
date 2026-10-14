import { formatMs } from "@/lib/formatting";
import type { AgentPhase, SimulationResult, TimelineSegment } from "@/lib/sim/types";

const PHASE_COLOR: Record<AgentPhase, string> = {
  queued: "var(--queued)",
  prefill: "var(--accent-primary)",
  decode: "var(--accent-bright)",
  "tool-wait": "var(--tool)",
  completed: "var(--accent-success)",
};

export function AgentTimeline({
  result,
  agentIds,
  makespanMs,
  playheadMs,
  selectedAgentId,
  onSelectAgent,
}: {
  result: SimulationResult;
  agentIds: readonly string[];
  makespanMs: number;
  playheadMs: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}) {
  const span = Math.max(makespanMs, 1);
  const playheadPct = (Math.min(playheadMs, span) / span) * 100;
  const byAgent = new Map<string, TimelineSegment[]>();
  for (const segment of result.timeline) {
    if (segment.endMs < 0) continue;
    const list = byAgent.get(segment.agentId) ?? [];
    list.push(segment);
    byAgent.set(segment.agentId, list);
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[14px] border border-border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] tracking-[0.16em] text-mute uppercase">
            Agent timeline
          </h2>
          <p className="mt-1 text-[12px] text-mute">
            One serial inference worker. Tool waits run asynchronously.
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] text-mute">
          <LegendSwatch color={PHASE_COLOR.queued} label="Queued" />
          <LegendSwatch color={PHASE_COLOR.prefill} label="Prefill" />
          <LegendSwatch color={PHASE_COLOR.decode} label="Decode" />
          <LegendSwatch color={PHASE_COLOR["tool-wait"]} label="Tool wait" />
        </ul>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative min-w-[640px]">
          {agentIds.map((agentId) => {
            const segments = byAgent.get(agentId) ?? [];
            return (
              <button
                key={agentId}
                type="button"
                onClick={() => onSelectAgent(agentId)}
                className={`grid grid-cols-[42px_1fr] items-center gap-2 border-b border-border/60 py-1 text-left ${
                  selectedAgentId === agentId ? "bg-panel-elevated/60" : ""
                }`}
              >
                <span
                  className={`tabular text-right text-[10px] ${
                    selectedAgentId === agentId ? "text-accent-bright" : "text-mute"
                  }`}
                >
                  {agentId}
                </span>
                <span className="relative h-3 rounded-sm bg-background/60">
                  {segments.map((segment, index) => {
                    const left = (segment.startMs / span) * 100;
                    const width = Math.max(
                      ((Math.min(segment.endMs, playheadMs) - segment.startMs) /
                        span) *
                        100,
                      segment.endMs <= playheadMs ? 0.15 : 0,
                    );
                    if (segment.startMs > playheadMs) return null;
                    return (
                      <span
                        key={`${segment.phase}-${index}`}
                        title={`${agentId} ${segment.phase} ${formatMs(segment.startMs)}–${formatMs(segment.endMs)}`}
                        className="absolute top-0 h-full rounded-[2px]"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: PHASE_COLOR[segment.phase],
                        }}
                      />
                    );
                  })}
                </span>
              </button>
            );
          })}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-warning"
            style={{ left: `calc(42px + 8px + (100% - 50px) * ${playheadPct / 100})` }}
          />
        </div>
      </div>
    </section>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="h-2 w-3 rounded-[2px]" style={{ background: color }} />
      {label}
    </li>
  );
}
