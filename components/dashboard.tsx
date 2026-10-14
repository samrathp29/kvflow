"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AgentTimeline } from "./agent-timeline";
import { CacheHeatmap } from "./cache-heatmap";
import { ComparisonCharts } from "./comparison-charts";
import { EvictionInspector } from "./eviction-inspector";
import { ExperimentControls, PolicyToggle } from "./experiment-controls";
import { Methodology } from "./methodology";
import { Header } from "./header";
import { Hero } from "./hero";
import { MetricStrip } from "./metric-strip";
import { PlaybackControls } from "./playback-controls";
import { TuneDrawer } from "./tune-drawer";
import { Reveal, ViewStage } from "./view-stage";
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
import type { EvictionDecision, ExperimentConfig, PolicyName } from "@/lib/sim/types";
import { hashForView, viewFromHash, type AppView, type LabPane } from "@/lib/views";

const defaultRun = runExperiment(DEFAULT_EXPERIMENT);

const LAB_PANES: { id: LabPane; label: string }[] = [
  { id: "residency", label: "Residency" },
  { id: "timeline", label: "Timeline" },
  { id: "charts", label: "Charts" },
];

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function subscribeLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

export function Dashboard() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const search = useSyncExternalStore(
    subscribeLocation,
    () => window.location.search,
    () => "",
  );
  const hash = useSyncExternalStore(
    subscribeLocation,
    () => window.location.hash,
    () => "",
  );
  const urlBoot = parseShareConfig(search);
  const view = viewFromHash(hash);

  const [ran, setRan] = useState(false);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [labPane, setLabPane] = useState<LabPane>("residency");
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

  const revealed = ran || Boolean(urlBoot);
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
  const activeEviction = selectedEviction ?? (visible?.evictions[0] ?? null);

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
    window.history.replaceState(
      null,
      "",
      `${toShareQuery(config, nextPolicy)}${window.location.hash}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function navigate(next: AppView) {
    const url = `${window.location.pathname}${window.location.search}${hashForView(next)}`;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function applyRun(nextConfig: ExperimentConfig, nextPolicy = policy) {
    setCommitted({ config: nextConfig, policy: nextPolicy });
    setDraft(nextConfig);
    setPlayheadMs(0);
    setIsPlaying(false);
    setSelectedEviction(null);
    setRan(true);
    setTuneOpen(false);
    writeUrl(nextConfig, nextPolicy);
    if (view !== "lab") navigate("lab");
  }

  function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}${toShareQuery(runConfig, policy)}`;
    writeUrl(runConfig, policy);
    void navigator.clipboard.writeText(url).then(() => {
      setShareState("Copied");
      window.setTimeout(() => setShareState("Share URL"), 1500);
    });
  }

  function setPolicy(next: PolicyName) {
    setCommitted({ config: runConfig, policy: next });
    setSelectedEviction(null);
    writeUrl(runConfig, next);
  }

  const showStage = revealed || view !== "lab";

  const lab = (
    <Reveal show={revealed} reducedMotion={reducedMotion}>
      {!run.ok ? (
        <div className="p-5 md:p-8">
          <div className="rounded-[14px] border border-warning/40 bg-panel p-5 text-[14px] leading-6">
            Agent {run.failure.agentId} turn {run.failure.turnIndex + 1} needs{" "}
            {formatGiB(run.failure.requiredBytes)} of reserved KV, which exceeds
            the {formatGiB(run.failure.capacityBytes)} budget. Raise memory or
            pick a smaller context workload. The simulator will not overcommit.
          </div>
        </div>
      ) : visible && other ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4 md:px-8">
          <MetricStrip
            selected={visible.metrics}
            other={other.metrics}
            selectedPolicy={policy}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-[10px] bg-panel-elevated p-1">
              {LAB_PANES.map((pane) => (
                <button
                  key={pane.id}
                  type="button"
                  onClick={() => setLabPane(pane.id)}
                  className={`rounded-md px-3 py-1.5 text-[12px] transition-colors duration-200 ${
                    labPane === pane.id
                      ? "bg-accent text-[#1c1b21]"
                      : "text-mute hover:text-ink"
                  }`}
                >
                  {pane.label}
                </button>
              ))}
            </div>
            <div className="w-[220px]">
              <PolicyToggle policy={policy} onPolicy={setPolicy} />
            </div>
          </div>
          {labPane !== "charts" ? (
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
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {labPane === "residency" ? (
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
                  navigate("inspector");
                }}
              />
            ) : null}
            {labPane === "timeline" ? (
              <AgentTimeline
                result={visible}
                agentIds={agentIds}
                makespanMs={makespanMs}
                playheadMs={playheadMs}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />
            ) : null}
            {labPane === "charts" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <ComparisonCharts
                  lru={run.lru}
                  aware={run.aware}
                  capacityGiB={run.config.memoryBudgetGiB}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Reveal>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header view={view} onNavigate={navigate} />
      {view === "lab" ? (
        <Hero
          onRun={() => applyRun(visibleDraft)}
          onTune={() => setTuneOpen(true)}
          stale={stale}
          compact={revealed}
          fill={!revealed}
        />
      ) : null}

      {showStage ? (
        <ViewStage
          view={view}
          reducedMotion={reducedMotion}
          panes={{
            lab,
            inspector: (
              <PanelFrame onBack={() => navigate("lab")}>
                {visible ? (
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
                ) : (
                  <p className="text-[14px] text-mute">
                    Run the experiment to inspect eviction decisions.
                  </p>
                )}
              </PanelFrame>
            ),
            methodology: (
              <PanelFrame onBack={() => navigate("lab")}>
                <Methodology
                  runConfig={run.config}
                  agentCount={
                    run.ok ? run.workload.agents.length : run.config.agentCount
                  }
                />
              </PanelFrame>
            ),
          }}
        />
      ) : null}

      <TuneDrawer
        open={tuneOpen}
        reducedMotion={reducedMotion}
        onClose={() => setTuneOpen(false)}
      >
        <ExperimentControls
          draft={visibleDraft}
          runConfig={runConfig}
          policy={policy}
          speed={speed}
          onDraft={setDraft}
          onPolicy={setPolicy}
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
      </TuneDrawer>
    </div>
  );
}

function PanelFrame({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 justify-end px-5 py-3 md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-mute transition-colors duration-200 hover:text-ink"
        >
          Back
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 md:px-8">
        {children}
      </div>
    </div>
  );
}
