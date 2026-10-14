import { formatMiB, formatMs, formatTokens } from "@/lib/formatting";
import { policyLabel } from "@/lib/sim/policies";
import type {
  EvictionDecision,
  SimulationEvent,
  SimulationResult,
} from "@/lib/sim/types";

export function EvictionInspector({
  result,
  selected,
  onSelect,
  selectedAgentId,
}: {
  result: SimulationResult;
  selected: EvictionDecision | null;
  onSelect: (decision: EvictionDecision) => void;
  selectedAgentId: string | null;
}) {
  const rows = result.evictions;
  const agentEvents = selectedAgentId
    ? result.events.filter((event) => event.agentId === selectedAgentId)
    : [];

  return (
    <section className="rounded-[14px] border border-border bg-panel p-4">
      <h2 className="text-[13px] tracking-[0.16em] text-mute uppercase">
        Eviction inspector
      </h2>
      <p className="mt-1 text-[12px] text-mute">
        Text is copied from the recorded decision. Future re-entry is shown only
        for replay, never to the policy.
      </p>

      {selected ? (
        <div className="mt-4 rounded-[12px] border border-border bg-panel-elevated p-4">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
            <Field label="Policy" value={policyLabel(selected.policy)} />
            <Field label="Virtual time" value={formatMs(selected.atMs)} />
            <Field label="Evicted" value={selected.evictedAgentId} />
            <Field label="Triggered by" value={selected.triggeringAgentId} />
            <Field
              label="Resident prefix"
              value={`${formatTokens(selected.residentPrefixTokens)} tok`}
            />
            <Field label="Memory freed" value={formatMiB(selected.freedBytes)} />
            <Field
              label="Re-entry"
              value={reentryLabel(result.events, selected)}
            />
          </dl>
          <p className="mt-3 text-[13px] leading-6 text-ink">{selected.reason}</p>
          {selected.candidateScores ? (
            <p className="mt-2 font-mono text-[11px] text-mute">
              Scores{" "}
              {Object.entries(selected.candidateScores)
                .sort((a, b) => a[1] - b[1])
                .slice(0, 6)
                .map(([id, score]) => `${id}:${score.toFixed(3)}`)
                .join("  ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-mute">
          No eviction selected. Run a constrained cache or click Next eviction.
        </p>
      )}

      <div className="mt-4 max-h-56 overflow-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="text-[11px] tracking-[0.12em] text-mute uppercase">
            <tr>
              <th className="py-1.5 font-normal">Time</th>
              <th className="font-normal">Victim</th>
              <th className="font-normal">Trigger</th>
              <th className="font-normal">Freed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const active = selected?.atMs === row.atMs && selected.evictedAgentId === row.evictedAgentId;
              return (
                <tr key={`${row.atMs}-${row.evictedAgentId}-${index}`}>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => onSelect(row)}
                      className={`tabular rounded px-1.5 py-0.5 ${
                        active ? "bg-accent text-[#1c1b21]" : "text-ink hover:bg-panel-elevated"
                      }`}
                    >
                      {formatMs(row.atMs)}
                    </button>
                  </td>
                  <td>{row.evictedAgentId}</td>
                  <td>{row.triggeringAgentId}</td>
                  <td className="tabular">{formatMiB(row.freedBytes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-3 text-[12px] text-mute">
            This run recorded zero evictions.
          </p>
        ) : null}
      </div>

      {selectedAgentId ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-[12px] text-mute">
            Trace for {selectedAgentId}
          </h3>
          <ol className="mt-2 max-h-32 overflow-auto font-mono text-[11px] text-mute">
            {agentEvents.slice(0, 40).map((event) => (
              <li key={event.id}>
                {formatMs(event.atMs)} {event.type}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-mute">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function reentryLabel(
  events: readonly SimulationEvent[],
  selected: EvictionDecision,
): string {
  const next = events.find(
    (event) =>
      event.agentId === selected.evictedAgentId &&
      event.type === "inference-started" &&
      event.atMs > selected.atMs,
  );
  if (!next) return "No later admission in this trace";
  return `${formatMs(next.atMs)} (offline analysis)`;
}
