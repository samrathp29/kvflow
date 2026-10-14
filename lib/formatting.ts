import { bytesToGiB, bytesToMiB } from "./sim/memory";

export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatTokens(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return formatInteger(value);
}

export function formatMs(ms: number): string {
  if (ms >= 60_000) {
    return `${(ms / 60_000).toFixed(2)} min`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${ms.toFixed(1)} ms`;
}

export function formatGiB(bytes: number): string {
  return `${bytesToGiB(bytes).toFixed(2)} GiB`;
}

export function formatMiB(bytes: number): string {
  return `${bytesToMiB(bytes).toFixed(1)} MiB`;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : "";
  return `${sign}${scaled.toFixed(digits)}%`;
}

export function formatPp(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : "";
  return `${sign}${scaled.toFixed(digits)} pp`;
}

export function ratioDelta(input: {
  baseline: number;
  candidate: number;
  higherIsBetter: boolean;
}): number | null {
  if (input.baseline === 0) return null;
  if (input.higherIsBetter) {
    return (input.candidate - input.baseline) / input.baseline;
  }
  return (input.baseline - input.candidate) / input.baseline;
}
