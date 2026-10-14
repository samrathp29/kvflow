export function Hero({
  onRun,
  onTune,
  stale,
  compact,
  fill,
}: {
  onRun: () => void;
  onTune?: () => void;
  stale: boolean;
  compact: boolean;
  fill?: boolean;
}) {
  return (
    <section
      className={
        fill
          ? "flex flex-1 flex-col justify-center px-5 pb-16 md:px-8"
          : `flex shrink-0 flex-col gap-5 border-b border-border px-5 md:flex-row md:items-end md:justify-between md:px-8 ${
              compact ? "py-4" : "py-8 md:py-12"
            }`
      }
    >
      <div className={compact ? "max-w-2xl" : "max-w-3xl"}>
        <h1
          className={
            compact
              ? "text-[22px] leading-tight font-medium tracking-[-0.03em]"
              : "text-[clamp(2.1rem,4.4vw,3.7rem)] leading-[1.05] font-medium tracking-[-0.04em]"
          }
        >
          Inference is a memory problem.
        </h1>
        {compact ? null : (
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-mute md:text-[17px]">
            Compare how cache retention policies respond to growing multi-turn
            agent workloads.
          </p>
        )}
      </div>
      <div className={`flex shrink-0 flex-wrap gap-2 ${fill ? "mt-8" : ""}`}>
        {compact && onTune ? (
          <button
            type="button"
            onClick={onTune}
            className="h-11 rounded-[12px] border border-border px-4 text-[14px] text-mute transition-colors duration-200 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:outline-none"
          >
            Tune
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRun}
          className="h-11 rounded-[12px] bg-accent px-5 text-[14px] font-medium text-[#1c1b21] transition-colors duration-200 hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:outline-none"
        >
          {stale ? "Run to apply changes" : "Run experiment"}
        </button>
      </div>
    </section>
  );
}
