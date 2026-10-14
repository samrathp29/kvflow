import { describe, expect, it } from "vitest";
import {
  selectLRUVictim,
  selectTrajectoryVictim,
  trajectoryRetentionValue,
} from "@/lib/sim/policies";
import type { CacheEntry, PolicyObservation } from "@/lib/sim/types";

describe("LRU selection", () => {
  it("evicts the oldest eligible entry and breaks ties by agent id", () => {
    const candidates: CacheEntry[] = [
      { agentId: "A03", prefixTokens: 10, reservedTokens: 10, lastAccessMs: 40 },
      { agentId: "A01", prefixTokens: 10, reservedTokens: 10, lastAccessMs: 10 },
      { agentId: "A02", prefixTokens: 10, reservedTokens: 10, lastAccessMs: 10 },
    ];
    expect(selectLRUVictim(candidates).agentId).toBe("A01");
  });

  it("throws when no candidate exists", () => {
    expect(() => selectLRUVictim([])).toThrow(/No eligible eviction candidate/);
  });
});

describe("trajectory-aware selection", () => {
  it("evicts the lowest retention value using only causal fields", () => {
    const observation: PolicyObservation = {
      nowMs: 8000,
      triggeringAgentId: "A09",
      candidates: [
        {
          agentId: "A01",
          residentTokens: 8000,
          residentMiB: 1000,
          lastAccessMs: 100,
          currentPhase: "tool-wait",
          currentToolKind: "file-read",
          elapsedToolWaitMs: 200,
          completedTurns: 1,
          maxConfiguredTurns: 8,
          estimatedRecomputeMs: 1333,
        },
        {
          agentId: "A02",
          residentTokens: 8000,
          residentMiB: 1000,
          lastAccessMs: 50,
          currentPhase: "tool-wait",
          currentToolKind: "long-running",
          elapsedToolWaitMs: 200,
          completedTurns: 1,
          maxConfiguredTurns: 8,
          estimatedRecomputeMs: 1333,
        },
      ],
    };
    const keys = JSON.stringify(observation);
    expect(keys).not.toContain("durationMs");
    expect(keys).not.toContain("nextTool");
    expect(keys).not.toContain("turns");
    expect(selectTrajectoryVictim(observation).agentId).toBe("A02");
  });

  it("keeps a soon-returning small prefix over a stale long-running one", () => {
    const soon = trajectoryRetentionValue({
      phase: "tool-wait",
      toolKind: "file-read",
      elapsedToolWaitMs: 100,
      completedTurns: 1,
      maxConfiguredTurns: 10,
      estimatedRecomputeMs: 2000,
      residentMiB: 200,
    });
    const later = trajectoryRetentionValue({
      phase: "tool-wait",
      toolKind: "long-running",
      elapsedToolWaitMs: 100,
      completedTurns: 1,
      maxConfiguredTurns: 10,
      estimatedRecomputeMs: 2000,
      residentMiB: 200,
    });
    expect(soon.value).toBeGreaterThan(later.value);
  });
});
