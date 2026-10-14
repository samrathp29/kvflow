export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function intInRange(rng: Rng, min: number, max: number): number {
  if (max < min) {
    throw new Error(`intInRange: max ${max} < min ${min}`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickWeighted<T extends string>(
  rng: Rng,
  weights: ReadonlyArray<readonly [T, number]>,
): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let cursor = rng() * total;
  for (const [value, weight] of weights) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return weights[weights.length - 1][0];
}

export function lognormalMs(
  rng: Rng,
  medianMs: number,
  sigma: number,
  minMs: number,
  maxMs: number,
): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const mu = Math.log(medianMs);
  const sample = Math.exp(mu + sigma * z);
  return Math.round(Math.min(maxMs, Math.max(minMs, sample)));
}
