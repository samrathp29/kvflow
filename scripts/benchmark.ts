import { runExperiment } from "../lib/sim/experiment";
import { inputReuseShare } from "../lib/sim/metrics";

const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize(label: string, values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return `${label} mean ${mean(values).toFixed(3)}  min ${sorted[0].toFixed(3)}  max ${sorted[sorted.length - 1].toFixed(3)}`;
}

function main() {
  const reuseLru: number[] = [];
  const reuseAware: number[] = [];
  const prefLru: number[] = [];
  const prefAware: number[] = [];
  const spanLru: number[] = [];
  const spanAware: number[] = [];
  let awareWins = 0;
  let lruWins = 0;
  let ties = 0;

  for (const seed of seeds) {
    const run = runExperiment({
      preset: "code",
      agentCount: 25,
      memoryBudgetGiB: 8,
      seed,
    });
    if (!run.ok) {
      console.log(`seed ${seed} invalid reservation`);
      continue;
    }
    const rLru = inputReuseShare(run.lru.metrics) ?? 0;
    const rAware = inputReuseShare(run.aware.metrics) ?? 0;
    reuseLru.push(rLru);
    reuseAware.push(rAware);
    prefLru.push(run.lru.metrics.recomputedInputTokens);
    prefAware.push(run.aware.metrics.recomputedInputTokens);
    spanLru.push(run.lru.metrics.makespanMs);
    spanAware.push(run.aware.metrics.makespanMs);
    if (run.aware.metrics.recomputedInputTokens < run.lru.metrics.recomputedInputTokens) {
      awareWins += 1;
    } else if (
      run.aware.metrics.recomputedInputTokens > run.lru.metrics.recomputedInputTokens
    ) {
      lruWins += 1;
    } else {
      ties += 1;
    }
    console.log(
      `seed ${seed}  reuse lru ${(rLru * 100).toFixed(1)}% aware ${(rAware * 100).toFixed(1)}%  recompute ${run.lru.metrics.recomputedInputTokens} vs ${run.aware.metrics.recomputedInputTokens}`,
    );
  }

  console.log("");
  console.log("coding 25 agents 8 GiB seeds 1-10");
  console.log(summarize("lru reuse", reuseLru));
  console.log(summarize("aware reuse", reuseAware));
  console.log(summarize("lru recompute", prefLru));
  console.log(summarize("aware recompute", prefAware));
  console.log(summarize("lru makespan ms", spanLru));
  console.log(summarize("aware makespan ms", spanAware));
  console.log(
    `aware lower recompute ${awareWins}  lru lower ${lruWins}  tie ${ties}`,
  );
}

main();
