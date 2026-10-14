import type {
  CacheSnapshot,
  EvictionDecision,
  SimulationResult,
  TimelineSegment,
} from "./sim/types";

export const HEATMAP_BINS = 100;
export const CHART_POINTS = 200;

export type HeatCellState =
  | "absent"
  | "resident"
  | "active"
  | "evicted";

export interface HeatmapCell {
  agentId: string;
  bin: number;
  startMs: number;
  endMs: number;
  state: HeatCellState;
  residentTokens: number;
}

export interface OccupancyPoint {
  tMs: number;
  lruGiB: number;
  awareGiB: number;
  capacityGiB: number;
}

export interface RecomputePoint {
  tMs: number;
  lru: number;
  aware: number;
}

function lastSnapshotAtOrBefore(
  snapshots: readonly CacheSnapshot[],
  tMs: number,
): CacheSnapshot | null {
  let lo = 0;
  let hi = snapshots.length - 1;
  let found: CacheSnapshot | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].atMs <= tMs) {
      found = snapshots[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function heatmapFor(
  result: SimulationResult,
  agentIds: readonly string[],
  makespanMs: number,
): HeatmapCell[] {
  const span = Math.max(makespanMs, 1);
  const binWidth = span / HEATMAP_BINS;
  const evictedAt = new Map<string, number[]>();
  for (const eviction of result.evictions) {
    const list = evictedAt.get(eviction.evictedAgentId) ?? [];
    list.push(eviction.atMs);
    evictedAt.set(eviction.evictedAgentId, list);
  }

  const cells: HeatmapCell[] = [];
  for (let bin = 0; bin < HEATMAP_BINS; bin += 1) {
    const startMs = bin * binWidth;
    const endMs = (bin + 1) * binWidth;
    const mid = (startMs + endMs) / 2;
    const snap = lastSnapshotAtOrBefore(result.cacheSnapshots, mid);
    for (const agentId of agentIds) {
      const residentTokens = snap?.residentTokensByAgent[agentId] ?? 0;
      const isResident = Boolean(snap?.residentAgentIds.includes(agentId));
      const isActive = snap?.activeAgentId === agentId;
      const recentEviction = (evictedAt.get(agentId) ?? []).some(
        (at) => at >= startMs && at < endMs,
      );
      let state: HeatCellState = "absent";
      if (recentEviction) state = "evicted";
      else if (isActive && isResident) state = "active";
      else if (isResident) state = "resident";
      cells.push({
        agentId,
        bin,
        startMs,
        endMs,
        state,
        residentTokens,
      });
    }
  }
  return cells;
}

export function downsampleSnapshots(
  snapshots: readonly CacheSnapshot[],
  maxPoints: number,
): CacheSnapshot[] {
  if (snapshots.length <= maxPoints) return [...snapshots];
  const out: CacheSnapshot[] = [];
  const last = snapshots.length - 1;
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i * last) / (maxPoints - 1));
    const prev = out[out.length - 1];
    if (!prev || prev.atMs !== snapshots[index].atMs) {
      out.push(snapshots[index]);
    }
  }
  return out;
}

export function occupancySeries(
  lru: SimulationResult,
  aware: SimulationResult,
  capacityGiB: number,
): OccupancyPoint[] {
  const lruSamples = downsampleSnapshots(lru.cacheSnapshots, CHART_POINTS);
  const awareSamples = downsampleSnapshots(aware.cacheSnapshots, CHART_POINTS);
  const times = new Set<number>();
  for (const sample of lruSamples) times.add(sample.atMs);
  for (const sample of awareSamples) times.add(sample.atMs);
  const sorted = [...times].sort((a, b) => a - b);
  const picked =
    sorted.length <= CHART_POINTS
      ? sorted
      : sorted.filter(
          (_, i) =>
            i === 0 ||
            i === sorted.length - 1 ||
            i % Math.ceil(sorted.length / CHART_POINTS) === 0,
        );
  return picked.map((tMs) => {
    const lruSnap = lastSnapshotAtOrBefore(lru.cacheSnapshots, tMs);
    const awareSnap = lastSnapshotAtOrBefore(aware.cacheSnapshots, tMs);
    return {
      tMs,
      lruGiB: (lruSnap?.occupiedBytes ?? 0) / 1024 ** 3,
      awareGiB: (awareSnap?.occupiedBytes ?? 0) / 1024 ** 3,
      capacityGiB,
    };
  });
}

export function cumulativeRecomputeSeries(
  lru: SimulationResult,
  aware: SimulationResult,
): RecomputePoint[] {
  function series(result: SimulationResult): { tMs: number; value: number }[] {
    let acc = 0;
    const points: { tMs: number; value: number }[] = [{ tMs: 0, value: 0 }];
    for (const event of result.events) {
      if (event.type !== "inference-started") continue;
      const rec = event.details?.recomputedTokens;
      acc += typeof rec === "number" ? rec : 0;
      points.push({ tMs: event.atMs, value: acc });
    }
    return points;
  }
  const a = series(lru);
  const b = series(aware);
  const times = new Set<number>();
  for (const p of a) times.add(p.tMs);
  for (const p of b) times.add(p.tMs);
  const sorted = [...times].sort((x, y) => x - y);
  const step = Math.max(1, Math.ceil(sorted.length / CHART_POINTS));
  const picked = sorted.filter(
    (_, i) => i === 0 || i === sorted.length - 1 || i % step === 0,
  );
  const valueAt = (
    points: { tMs: number; value: number }[],
    tMs: number,
  ): number => {
    let current = 0;
    for (const point of points) {
      if (point.tMs > tMs) break;
      current = point.value;
    }
    return current;
  };
  return picked.map((tMs) => ({
    tMs,
    lru: valueAt(a, tMs),
    aware: valueAt(b, tMs),
  }));
}

export function segmentsUntil(
  timeline: readonly TimelineSegment[],
  playheadMs: number,
): TimelineSegment[] {
  return timeline
    .filter((seg) => seg.startMs <= playheadMs)
    .map((seg) => ({
      ...seg,
      endMs: Math.min(seg.endMs, playheadMs),
    }));
}

export function nextEviction(
  evictions: readonly EvictionDecision[],
  playheadMs: number,
): EvictionDecision | null {
  return evictions.find((eviction) => eviction.atMs > playheadMs) ?? null;
}
