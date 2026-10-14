import type { ModelProfile } from "./types";

export const GIB_BYTES = 1024 ** 3;
export const MIB_BYTES = 1024 ** 2;

export const DEFAULT_MODEL: ModelProfile = {
  layers: 32,
  kvHeads: 8,
  headDim: 128,
  bytesPerElement: 2,
  prefillTokensPerSecond: 6000,
  decodeTokensPerSecond: 100,
};

export function bytesPerToken(model: ModelProfile): number {
  return (
    2 * model.layers * model.kvHeads * model.headDim * model.bytesPerElement
  );
}

export function giBToBytes(giB: number): number {
  return giB * GIB_BYTES;
}

export function tokensToBytes(tokens: number, model: ModelProfile): number {
  return tokens * bytesPerToken(model);
}

export function bytesToMiB(bytes: number): number {
  return bytes / MIB_BYTES;
}

export function bytesToGiB(bytes: number): number {
  return bytes / GIB_BYTES;
}

export function durationUs(tokens: number, tokensPerSecond: number): number {
  if (tokens <= 0) return 0;
  return Math.round((1_000_000 * tokens) / tokensPerSecond);
}

export function usToMs(us: number): number {
  return us / 1000;
}
