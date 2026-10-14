"use client";

import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { occupancySeries, cumulativeRecomputeSeries } from "@/lib/chart-data";
import { formatMs, formatPct, formatTokens } from "@/lib/formatting";
import { inputReuseShare } from "@/lib/sim/metrics";
import type { SimulationResult } from "@/lib/sim/types";

export function ComparisonCharts({
  lru,
  aware,
  capacityGiB,
}: {
  lru: SimulationResult;
  aware: SimulationResult;
  capacityGiB: number;
}) {
  const occupancy = useMemo(
    () => occupancySeries(lru, aware, capacityGiB),
    [lru, aware, capacityGiB],
  );
  const recompute = useMemo(
    () => cumulativeRecomputeSeries(lru, aware),
    [lru, aware],
  );
  const bars = [
    {
      metric: "Reuse %",
      LRU: (inputReuseShare(lru.metrics) ?? 0) * 100,
      Trajectory: (inputReuseShare(aware.metrics) ?? 0) * 100,
    },
  ];
  const prefillBars = [
    {
      metric: "Redundant prefill",
      LRU: lru.metrics.recomputedInputTokens,
      Trajectory: aware.metrics.recomputedInputTokens,
    },
  ];
  const makespanBars = [
    {
      metric: "Makespan (s)",
      LRU: lru.metrics.makespanMs / 1000,
      Trajectory: aware.metrics.makespanMs / 1000,
    },
  ];

  return (
    <section className="grid h-full min-h-0 grid-cols-6 grid-rows-2 gap-3 overflow-hidden">
      <ChartCard
        className="col-span-3"
        title="Cache occupancy"
        caption="Simulated GiB reserved vs virtual time"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={occupancy} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#3b3946" strokeDasharray="3 3" />
            <XAxis
              dataKey="tMs"
              tickFormatter={(value) => formatMs(Number(value))}
              stroke="#adabb9"
              fontSize={11}
            />
            <YAxis stroke="#adabb9" fontSize={11} unit=" GiB" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => `Virtual time ${formatMs(Number(value))}`}
              formatter={(value, name) => [
                `${Number(value).toFixed(2)} GiB`,
                String(name),
              ]}
            />
            <Legend />
            <ReferenceLine
              y={capacityGiB}
              stroke="#de987c"
              strokeDasharray="2 4"
              label={{ value: "Capacity", fill: "#de987c", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="lruGiB"
              name="LRU"
              stroke="#92929f"
              strokeDasharray="5 4"
              dot={false}
              strokeWidth={1.6}
            />
            <Line
              type="monotone"
              dataKey="awareGiB"
              name="Trajectory-aware"
              stroke="#829ed2"
              dot={false}
              strokeWidth={1.8}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        className="col-span-3"
        title="Cumulative recomputed prefix"
        caption="Tokens that had already been processed, then paid for again"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recompute} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#3b3946" strokeDasharray="3 3" />
            <XAxis
              dataKey="tMs"
              tickFormatter={(value) => formatMs(Number(value))}
              stroke="#adabb9"
              fontSize={11}
            />
            <YAxis
              stroke="#adabb9"
              fontSize={11}
              tickFormatter={(value) => formatTokens(Number(value))}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => `Virtual time ${formatMs(Number(value))}`}
              formatter={(value, name) => [formatTokens(Number(value)), String(name)]}
            />
            <Legend />
            <Line
              type="stepAfter"
              dataKey="lru"
              name="LRU"
              stroke="#92929f"
              strokeDasharray="5 4"
              dot={false}
              strokeWidth={1.6}
            />
            <Line
              type="stepAfter"
              dataKey="aware"
              name="Trajectory-aware"
              stroke="#829ed2"
              dot={false}
              strokeWidth={1.8}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        className="col-span-2"
        title="Reuse comparison"
        caption="Higher is better. Separate scale."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#3b3946" strokeDasharray="3 3" />
            <XAxis dataKey="metric" stroke="#adabb9" fontSize={11} />
            <YAxis stroke="#adabb9" fontSize={11} unit="%" />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                formatPct(Number(value) / 100),
                String(name),
              ]}
            />
            <Legend />
            <Bar dataKey="LRU" fill="#92929f" radius={4} />
            <Bar dataKey="Trajectory" fill="#829ed2" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        className="col-span-2"
        title="Redundant prefill"
        caption="Lower is better. Token count."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={prefillBars}>
            <CartesianGrid stroke="#3b3946" strokeDasharray="3 3" />
            <XAxis dataKey="metric" stroke="#adabb9" fontSize={11} />
            <YAxis
              stroke="#adabb9"
              fontSize={11}
              tickFormatter={(value) => formatTokens(Number(value))}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [formatTokens(Number(value)), String(name)]}
            />
            <Bar dataKey="LRU" fill="#92929f" radius={4} />
            <Bar dataKey="Trajectory" fill="#829ed2" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard
        className="col-span-2"
        title="Simulated makespan"
        caption="Lower is better. Virtual seconds."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={makespanBars}>
            <CartesianGrid stroke="#3b3946" strokeDasharray="3 3" />
            <XAxis dataKey="metric" stroke="#adabb9" fontSize={11} />
            <YAxis stroke="#adabb9" fontSize={11} unit=" s" />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                `${Number(value).toFixed(2)} s`,
                String(name),
              ]}
            />
            <Bar dataKey="LRU" fill="#92929f" radius={4} />
            <Bar dataKey="Trajectory" fill="#829ed2" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

const tooltipStyle = {
  background: "#2d2c36",
  border: "1px solid #3b3946",
  borderRadius: 10,
  fontSize: 12,
};

function ChartCard({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-panel px-3 py-2.5 ${className ?? ""}`}
    >
      <h2 className="shrink-0 text-[12px] tracking-[0.16em] text-mute uppercase">
        {title}
      </h2>
      <p className="mt-0.5 mb-1.5 shrink-0 truncate text-[11px] text-mute">
        {caption}
      </p>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </article>
  );
}
