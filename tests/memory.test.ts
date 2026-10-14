import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  bytesPerToken,
  giBToBytes,
} from "@/lib/sim/memory";

describe("KV accounting", () => {
  it("uses 128 KiB per token for the default grouped-query model", () => {
    expect(bytesPerToken(DEFAULT_MODEL)).toBe(131_072);
  });

  it("fits 65,536 tokens in an 8 GiB budget", () => {
    const capacity = giBToBytes(8);
    const tokens = capacity / bytesPerToken(DEFAULT_MODEL);
    expect(tokens).toBe(65_536);
  });
});
