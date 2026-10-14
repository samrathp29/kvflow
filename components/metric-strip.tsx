import {
  formatInteger,
  formatMs,
  formatPct,
  formatPp,
  formatSignedPct,
  formatTokens,
  ratioDelta,
} from "@/lib/formatting";
import { inputReuseShare } from "@/lib/sim/metrics";
import { policyLabel } from "@/lib/sim/policies";
import type { PolicyName, SimulationMetrics } from "@/lib/sim/types";

export function MetricStrip({
  selected,
  other,
  selectedPolicy,
}: {
  selected: SimulationMetrics;
  other: SimulationMetrics;
  selectedPolicy: PolicyName;
}) {
  const selectedReuse = inputReuseShare(selected);
  const otherReuse = inputReuseShare(other);
  const reuseDelta =
    selectedReuse === null || otherReuse === null
      ? null
      : selectedReuse - otherReuse;
  const prefillDelta = ratioDelta({
    baseline: other.recomputedInputTokens,
    candidate: selected.recomputedInputTokens,
    higherIsBetter: false,
  });
  const makespanDelta = ratioDelta({
    baseline: other.makespanMs,
    candidate: selected.makespanMs,
    higherIsBetter: false,
  });
  const evictionDelta = ratioDelta({
    baseline: other.evictionCount,
    candidate: selected.evictionCount,
    higherIsBetter: false,
  });

  return (
    <section className="flex min-w-0 gap-3 overflow-x-auto pb-1">
      <MetricCard
        label="Input reuse"
        value={formatPct(selectedReuse)}
        baseline={`${formatPct(otherReuse)} ${policyLabel(otherName(selectedPolicy))}`}
        delta={formatPp(reuseDelta)}
        better={
          reuseDelta === null ? null : reuseDelta === 0 ? "same" : reuseDelta > 0
        }
        hint="Simulated reused input tokens / total input tokens"
      />
      <MetricCard
        label="Redundant prefill"
        value={formatTokens(selected.recomputedInputTokens)}
        baseline={`${formatTokens(other.recomputedInputTokens)} ${policyLabel(otherName(selectedPolicy))}`}
        delta={formatSignedPct(prefillDelta)}
        better={
          prefillDelta === null
            ? null
            : selected.recomputedInputTokens === other.recomputedInputTokens
              ? "same"
              : selected.recomputedInputTokens < other.recomputedInputTokens
        }
        hint="Simulated previously processed prefix tokens recomputed after eviction"
        lower
      />
      <MetricCard
        label="Simulated makespan"
        value={formatMs(selected.makespanMs)}
        baseline={`${formatMs(other.makespanMs)} ${policyLabel(otherName(selectedPolicy))}`}
        delta={formatSignedPct(makespanDelta)}
        better={
          makespanDelta === null
            ? null
            : selected.makespanMs === other.makespanMs
              ? "same"
              : selected.makespanMs < other.makespanMs
        }
        hint="Last completion minus first arrival, in virtual time"
        lower
      />
      <MetricCard
        label="Evictions"
        value={formatInteger(selected.evictionCount)}
        baseline={`${formatInteger(other.evictionCount)} ${policyLabel(otherName(selectedPolicy))}`}
        delta={formatSignedPct(evictionDelta)}
        better={null}
        hint="Diagnostic count of cache removals, not a quality score"
      />
    </section>
  );
}

function otherName(policy: PolicyName): PolicyName {
  return policy === "lru" ? "trajectory-aware" : "lru";
}

function MetricCard({
  label,
  value,
  baseline,
  delta,
  better,
  hint,
  lower,
}: {
  label: string;
  value: string;
  baseline: string;
  delta: string;
  better: boolean | "same" | null;
  hint: string;
  lower?: boolean;
}) {
  const deltaColor =
    better === null
      ? "text-mute"
      : better === "same"
        ? "text-mute"
        : better
          ? "text-success"
          : "text-warning";
  return (
    <article className="min-w-[220px] flex-1 rounded-[14px] border border-border bg-panel p-4">
      <div className="text-[11px] tracking-[0.14em] text-mute uppercase">
        {label}
      </div>
      <div className="tabular mt-2 text-[30px] leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-mute">{baseline}</span>
        <span className={`tabular ${deltaColor}`}>
          {delta}
          {better === true
            ? lower
              ? " less"
              : " more"
            : better === false
              ? " regression"
              : ""}
        </span>
      </div>
      <p className="sr-only">{hint}</p>
    </article>
  );
}
