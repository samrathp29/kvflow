import { formatMs } from "@/lib/formatting";

export function PlaybackControls({
  playheadMs,
  makespanMs,
  isPlaying,
  onToggle,
  onReplay,
  onSeek,
  onNextEviction,
  reducedMotion,
}: {
  playheadMs: number;
  makespanMs: number;
  isPlaying: boolean;
  onToggle: () => void;
  onReplay: () => void;
  onSeek: (ms: number) => void;
  onNextEviction: () => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-panel p-4 sm:flex-row sm:items-center">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-[10px] bg-panel-elevated px-3 py-2 text-[12px] transition-colors duration-200 hover:text-accent-bright"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="rounded-[10px] bg-panel-elevated px-3 py-2 text-[12px] transition-colors duration-200 hover:text-accent-bright"
        >
          Replay
        </button>
        <button
          type="button"
          onClick={onNextEviction}
          className="rounded-[10px] bg-panel-elevated px-3 py-2 text-[12px] transition-colors duration-200 hover:text-accent-bright"
        >
          Next eviction
        </button>
      </div>
      <label className="flex flex-1 items-center gap-3 text-[12px] text-mute">
        <span className="tabular w-24 shrink-0">
          {formatMs(playheadMs)} / {formatMs(makespanMs)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(makespanMs, 1)}
          step={Math.max(makespanMs / 400, 1)}
          value={Math.min(playheadMs, makespanMs)}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="flex-1"
          aria-label="Seek virtual time"
        />
      </label>
      {reducedMotion ? (
        <span className="text-[11px] text-mute">Reduced motion: autoplay off</span>
      ) : null}
    </div>
  );
}
