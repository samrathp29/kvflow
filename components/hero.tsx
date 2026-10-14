export function Hero({
  onRun,
  stale,
}: {
  onRun: () => void;
  stale: boolean;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border px-5 py-6 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
      <div className="max-w-3xl">
        <p className="mb-2 text-[11px] tracking-[0.22em] text-accent uppercase">
          Simulated · Deterministic · No GPU required
        </p>
        <h1 className="text-[clamp(2rem,4vw,3.6rem)] leading-[1.05] font-medium tracking-[-0.04em]">
          Inference is a memory problem.
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-7 text-mute md:text-[17px]">
          Compare how cache retention policies respond to growing multi-turn
          agent workloads. Every number on this page is computed from a seeded
          discrete-event run.
        </p>
      </div>
      <button
        type="button"
        onClick={onRun}
        className="h-11 shrink-0 rounded-[12px] bg-accent px-5 text-[14px] font-medium text-[#1c1b21] transition-colors duration-200 hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:outline-none"
      >
        {stale ? "Run to apply changes" : "Run experiment"}
      </button>
    </section>
  );
}
