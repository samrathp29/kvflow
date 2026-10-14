import { bytesPerToken, DEFAULT_MODEL } from "@/lib/sim/memory";
import type { ExperimentConfig } from "@/lib/sim/types";

export function Methodology({
  runConfig,
  agentCount,
}: {
  runConfig: ExperimentConfig;
  agentCount: number;
}) {
  const bpt = bytesPerToken(DEFAULT_MODEL);
  return (
    <section
      id="methodology"
      className="rounded-[14px] border border-border bg-panel p-5 md:p-6"
    >
      <h2 className="text-[20px] tracking-tight">Methodology</h2>
      <p className="mt-2 max-w-3xl text-[14px] leading-6 text-mute">
        KVFlow isolates one causal variable: the cache retention policy. Arrivals,
        turn token counts, tool durations, the FIFO worker, and the hypothetical
        transformer profile stay fixed. Once policies diverge, queue timings
        change for real. That is a consequence of the policy, not contamination
        of the workload.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
            This run
          </h3>
          <ul className="mt-2 space-y-1 font-mono text-[12px] text-ink">
            <li>preset {runConfig.preset}</li>
            <li>agents launched {agentCount}</li>
            <li>budget {runConfig.memoryBudgetGiB} GiB</li>
            <li>seed {runConfig.seed}</li>
            <li>
              model L={DEFAULT_MODEL.layers} Hkv={DEFAULT_MODEL.kvHeads} D=
              {DEFAULT_MODEL.headDim} S={DEFAULT_MODEL.bytesPerElement}
            </li>
            <li>bytes/token {bpt.toLocaleString("en-US")}</li>
            <li>
              prefill {DEFAULT_MODEL.prefillTokensPerSecond}/s · decode{" "}
              {DEFAULT_MODEL.decodeTokensPerSecond}/s
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
            Cache math
          </h3>
          <pre className="mt-2 overflow-auto text-[12px] leading-5 text-mute">
{`input = C + N
prefill = input − R
recomputed = C − R
R = C on a full hit, else 0
reserve input + maxOutputTokens
bytes/token = 2 × L × Hkv × D × S`}
          </pre>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
          Policies
        </h3>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-mute">
          LRU evicts the eligible non-active entry with the oldest last prefix
          access, then by agent id. Trajectory-aware scores each eligible entry
          as P × estimated recompute ms / residentMiB^0.65, using only the
          current tool kind, elapsed wait, completed turns, and footprint. P is
          a speculative clamp, not a calibrated probability. Neither policy
          sees future tool completion times or future turns.
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border px-5 py-6 text-[12px] leading-5 text-mute md:px-8">
      All charts are simulated. Workloads are synthetic.
    </footer>
  );
}
