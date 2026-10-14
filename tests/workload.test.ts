import { describe, expect, it } from "vitest";
import { generateWorkload } from "@/lib/sim/workload";
import { parseShareConfig } from "@/lib/share-config";

describe("workload generation", () => {
  it("is deterministic for the same seed", () => {
    const a = generateWorkload({
      preset: "code",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    const b = generateWorkload({
      preset: "code",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 42,
    });
    expect(a).toEqual(b);
  });

  it("changes when the seed changes", () => {
    const a = generateWorkload({
      preset: "code",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 1,
    });
    const b = generateWorkload({
      preset: "code",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 2,
    });
    expect(a).not.toEqual(b);
  });

  it("never lets output tokens exceed the reservation ceiling", () => {
    const workload = generateWorkload({
      preset: "research",
      agentCount: 12,
      memoryBudgetGiB: 8,
      seed: 7,
    });
    for (const agent of workload.agents) {
      for (const turn of agent.turns) {
        expect(turn.outputTokens).toBeLessThanOrEqual(turn.maxOutputTokens);
      }
    }
  });
});

describe("URL config", () => {
  it("accepts a valid query string", () => {
    const parsed = parseShareConfig(
      "?preset=terminal&agents=20&memory=12&seed=9&policy=lru",
    );
    expect(parsed).toEqual({
      experiment: {
        preset: "terminal",
        agentCount: 20,
        memoryBudgetGiB: 12,
        seed: 9,
      },
      policy: "lru",
    });
  });

  it("rejects unsupported params instead of coercing them", () => {
    expect(parseShareConfig("?preset=magic&agents=25&memory=8&seed=42")).toBeNull();
    expect(parseShareConfig("?preset=code&agents=400&memory=8&seed=42")).toBeNull();
    expect(parseShareConfig("?preset=code&agents=25&memory=7&seed=42")).toBeNull();
    expect(parseShareConfig("?fresh=1")).toBeNull();
  });
});
