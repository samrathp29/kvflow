"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AgentTimeline } from "./agent-timeline";
import { CacheHeatmap } from "./cache-heatmap";
import { ComparisonCharts } from "./comparison-charts";
import { EvictionInspector } from "./eviction-inspector";
import { ExperimentControls } from "./experiment-controls";
import { Footer, Methodology } from "./methodology";
import { Header } from "./header";
import { Hero } from "./hero";
import { MetricStrip } from "./metric-strip";
import { PlaybackControls } from "./playback-controls";
import { nextEviction } from "@/lib/chart-data";
import { exportCsv, exportJson } from "@/lib/export";
import { formatGiB } from "@/lib/formatting";
import {
  configsEqual,
  DEFAULT_EXPERIMENT,
  DEFAULT_POLICY,
  parseShareConfig,
  toShareQuery,
} from "@/lib/share-config";
import { runExperiment } from "@/lib/sim/experiment";
import { PRESETS } from "@/lib/sim/presets";
import type { EvictionDecision, ExperimentConfig, PolicyName } from "@/lib/sim/types";

const defaultRun = runExperiment(DEFAULT_EXPERIMENT);

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function subscribeSearch(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function Dashboard() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const search = useSyncExternalStore(
    subscribeSearch,
    () => window.location.search,
    () => "",
  );
  const urlBoot = parseShareConfig(search);

  const [draft, setDraft] = useState<ExperimentConfig | null>(null);
  const [committed, setCommitted] = useState<{
    config: ExperimentConfig;
    policy: PolicyName;
  } | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedEviction, setSelectedEviction] = useState<EvictionDecision | null>(null);
  const [shareState, setShareState] = useState("Share URL");
  const playRef = useRef<number>(0);

  const runConfig = committed?.config ?? urlBoot?.experiment ?? DEFAULT_EXPERIMENT;
  const policy = committed?.policy ?? urlBoot?.policy ?? DEFAULT_POLICY;
  const visibleDraft = draft ?? runConfig;
  const stale = !configsEqual(visibleDraft, runConfig);

  const run = useMemo(() => {
    if (configsEqual(runConfig, DEFAULT_EXPERIMENT)) return defaultRun;
    return runExperiment(runConfig);
  }, [runConfig]);

  const visible = run.ok ? (policy === "lru" ? run.lru : run.aware) : null;
  const other = run.ok ? (policy === "lru" ? run.aware : run.lru) : null;
  const agentIds = run.ok ? run.workload.agents.map((agent) => agent.id) : [];
  const makespanMs = visible?.metrics.makespanMs ?? 0;
  const activeEviction =
    selectedEviction ?? (visible?.evictions[0] ?? null);

  const statsLine = useMemo(() => {
    if (!run.ok) return null;
    return {
      agents: run.workload.agents.length,
      peakActive: Math.max(
        run.lru.metrics.peakActiveAgents,
        run.aware.metrics.peakActiveAgents,
      ),
      preset: PRESETS[run.config.preset].label,
    };
  }, [run]);

  useEffect(() => {
    if (!isPlaying || reducedMotion || makespanMs <= 0) return;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc >= 33) {
        const step = acc * speed;
        acc = 0;
        setPlayheadMs((current) => {
          const next = current + step;
          if (next >= makespanMs) {
            setIsPlaying(false);
            return makespanMs;
          }
          return next;
        });
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playRef.current);
  }, [isPlaying, reducedMotion, speed, makespanMs]);

  function writeUrl(config: ExperimentConfig, nextPolicy: PolicyName) {
    window.history.replaceState(null, "", toShareQuery(config, nextPolicy));
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function applyRun(nextConfig: ExperimentConfig, nextPolicy = policy) {
    setCommitted({ config: nextConfig, policy: nextPolicy });
    setDraft(nextConfig);
    setPlayheadMs(0);
    setIsPlaying(false);
    setSelectedEviction(null);
    writeUrl(nextConfig, nextPolicy);
  }

  function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}${toShareQuery(runConfig, policy)}`;
    writeUrl(runConfig, policy);
    void navigator.clipboard.writeText(url).then(() => {
      setShareState("Copied");
      window.setTimeout(() => setShareState("Share URL"), 1500);
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <Hero onRun={() => applyRun(visibleDraft)} stale={stale} />

      {statsLine && run.ok ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border px-5 py-3 text-[12px] text-mute md:px-8">
          <span className="tabular text-ink">{statsLine.agents} agents launched</span>
          <span className="tabular">peak active {statsLine.peakActive}</span>
          <span>{run.config.memoryBudgetGiB} GiB simulated KV budget</span>
          <span>{statsLine.preset}</span>
          <span className="tabular">seed {run.config.seed}</span>
          <span>All values simulated</span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-6 px-5 py-6 md:flex-row md:px-8">
        <ExperimentControls
          draft={visibleDraft}
          runConfig={runConfig}
          policy={policy}
          speed={speed}
          onDraft={setDraft}
          onPolicy={(next) => {
            setCommitted({ config: runConfig, policy: next });
            setSelectedEviction(null);
            writeUrl(runConfig, next);
          }}
          onSpeed={setSpeed}
          onRun={() => applyRun(visibleDraft)}
          onReset={() => {
            setDraft(DEFAULT_EXPERIMENT);
            applyRun(DEFAULT_EXPERIMENT, DEFAULT_POLICY);
          }}
          onShare={handleShare}
          onExportJson={() => {
            if (run.ok) exportJson(run);
          }}
          onExportCsv={() => {
            if (run.ok) exportCsv(run);
          }}
          shareState={shareState}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!run.ok ? (
            <div className="rounded-[14px] border border-warning/40 bg-panel p-5 text-[14px] leading-6">
              Agent {run.failure.agentId} turn {run.failure.turnIndex + 1} needs{" "}
              {formatGiB(run.failure.requiredBytes)} of reserved KV, which
              exceeds the {formatGiB(run.failure.capacityBytes)} budget. Raise
              memory or pick a smaller context workload. The simulator will not
              overcommit.
            </div>
          ) : visible && other ? (
            <>
              <MetricStrip
                selected={visible.metrics}
                other={other.metrics}
                selectedPolicy={policy}
              />
              <PlaybackControls
                playheadMs={playheadMs}
                makespanMs={makespanMs}
                isPlaying={isPlaying}
                reducedMotion={reducedMotion}
                onToggle={() => {
                  if (reducedMotion) {
                    setPlayheadMs(makespanMs);
                    return;
                  }
                  setIsPlaying((value) => !value);
                }}
                onReplay={() => {
                  setPlayheadMs(0);
                  setIsPlaying(!reducedMotion);
                }}
                onSeek={(ms) => {
                  setIsPlaying(false);
                  setPlayheadMs(ms);
                }}
                onNextEviction={() => {
                  const nxt = nextEviction(visible.evictions, playheadMs);
                  if (!nxt) return;
                  setIsPlaying(false);
                  setPlayheadMs(nxt.atMs);
                  setSelectedEviction(nxt);
                  setSelectedAgentId(nxt.evictedAgentId);
                }}
              />
              <CacheHeatmap
                result={visible}
                agentIds={agentIds}
                makespanMs={makespanMs}
                playheadMs={playheadMs}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onSelectEviction={(decision) => {
                  setSelectedEviction(decision);
                  setPlayheadMs(decision.atMs);
                  setIsPlaying(false);
                }}
              />
              <AgentTimeline
                result={visible}
                agentIds={agentIds}
                makespanMs={makespanMs}
                playheadMs={playheadMs}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />
              <ComparisonCharts
                lru={run.lru}
                aware={run.aware}
                capacityGiB={run.config.memoryBudgetGiB}
              />
              <EvictionInspector
                result={visible}
                selected={activeEviction}
                selectedAgentId={selectedAgentId}
                onSelect={(decision) => {
                  setSelectedEviction(decision);
                  setPlayheadMs(decision.atMs);
                  setSelectedAgentId(decision.evictedAgentId);
                }}
              />
            </>
          ) : null}
          <Methodology
            runConfig={run.config}
            agentCount={run.ok ? run.workload.agents.length : run.config.agentCount}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
