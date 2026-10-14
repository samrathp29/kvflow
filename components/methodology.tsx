import { bytesPerToken, DEFAULT_MODEL } from "@/lib/sim/memory";
import type { ExperimentConfig } from "@/lib/sim/types";
import { Formula } from "./formula";

const CACHE_MATH = String.raw`
\begin{aligned}
\mathrm{input} &= C + N \\
\mathrm{prefill} &= \mathrm{input} - R \\
\mathrm{recomputed} &= C - R \\
R &=
\begin{cases}
C & \text{full hit} \\
0 & \text{otherwise}
\end{cases} \\
\mathrm{reserve} &= \mathrm{input} + \mathrm{maxOutputTokens} \\
\mathrm{bytes/token} &= 2 \cdot L \cdot H_{kv} \cdot D \cdot S
\end{aligned}
`;

const SCORE_TEX = String.raw`
s = \frac{P \cdot t_{\mathrm{recompute}}}{m^{0.65}},
\quad
m = \max(\mathrm{residentMiB},\, 2^{-10})
`;

export function Methodology({
  runConfig,
  agentCount,
}: {
  runConfig: ExperimentConfig;
  agentCount: number;
}) {
  const bpt = bytesPerToken(DEFAULT_MODEL);
  const modelTex = String.raw`L=${DEFAULT_MODEL.layers},\; H_{kv}=${DEFAULT_MODEL.kvHeads},\; D=${DEFAULT_MODEL.headDim},\; S=${DEFAULT_MODEL.bytesPerElement}`;
  const rateTex = String.raw`\mathrm{prefill}=${DEFAULT_MODEL.prefillTokensPerSecond}\,\mathrm{s}^{-1},\; \mathrm{decode}=${DEFAULT_MODEL.decodeTokensPerSecond}\,\mathrm{s}^{-1}`;

  return (
    <section className="rounded-[14px] border border-border bg-panel p-5 md:p-6">
      <h2 className="text-[20px] tracking-tight">Methodology</h2>
      <p className="mt-2 max-w-3xl text-[14px] leading-6 text-mute">
        KVFlow isolates one causal variable: the cache retention policy. Arrivals,
        turn token counts, tool durations, the FIFO worker, and the hypothetical
        transformer profile stay fixed. Once policies diverge, queue timings
        change for real. That is a consequence of the policy, not contamination
        of the workload.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
            This run
          </h3>
          <ul className="mt-3 space-y-2 text-[13px] leading-6 text-ink">
            <li>preset {runConfig.preset}</li>
            <li>agents launched {agentCount}</li>
            <li>budget {runConfig.memoryBudgetGiB} GiB</li>
            <li>seed {runConfig.seed}</li>
            <li>
              <Formula tex={modelTex} />
            </li>
            <li>
              bytes/token {bpt.toLocaleString("en-US")}
            </li>
            <li>
              <Formula tex={rateTex} />
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
            Cache math
          </h3>
          <div className="mt-3 text-ink">
            <Formula tex={CACHE_MATH} display />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-[13px] tracking-[0.14em] text-mute uppercase">
          Policies
        </h3>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-mute">
          LRU evicts the eligible non-active entry with the oldest last prefix
          access, then by agent id. Trajectory-aware assigns each eligible entry
          a retention score
        </p>
        <div className="mt-3 max-w-3xl text-ink">
          <Formula tex={SCORE_TEX} display />
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-mute">
          <Formula tex="P" /> comes from the current tool kind, elapsed wait, and
          completed turns, then is clamped. It is not a calibrated probability.
          Neither policy sees future tool completion times or future turns.
        </p>
      </div>
    </section>
  );
}
