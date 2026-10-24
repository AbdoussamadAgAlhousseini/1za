"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttendancePoint } from "@/lib/stats-types";
import type { Granularity } from "@/lib/domain/periods";
import { formatDayLabel, formatDuration, formatMonthLabel, formatNumber } from "@/lib/domain/format";

const SERIES_ENTRIES = "var(--color-chart-1)";
const SERIES_UNIQUE = "var(--color-chart-2)";

function bucketLabel(bucket: string, granularity: Granularity) {
  if (granularity === "month") return formatMonthLabel(bucket);
  if (granularity === "week") return `Sem. du ${formatDayLabel(bucket)}`;
  return formatDayLabel(bucket);
}

export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-2.5 rounded-[3px] bg-chart-1" aria-hidden="true" />
        Entrées
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="relative h-0.5 w-4 rounded-full bg-chart-2" aria-hidden="true">
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-chart-2" />
        </span>
        Sportifs uniques
      </span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AttendancePoint }[];
  granularity: Granularity;
  showUnique?: boolean;
}

function ChartTooltip({ active, payload, granularity, showUnique = true }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-48 rounded-md border border-line bg-surface px-3.5 py-3 text-[13px] shadow-raised">
      <p className="mb-2 font-semibold text-ink">{bucketLabel(point.bucket, granularity)}</p>
      <dl className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <dt className="flex items-center gap-2 text-ink-muted">
            <span className="h-3 w-2.5 rounded-[3px] bg-chart-1" aria-hidden="true" />
            Entrées
          </dt>
          <dd className="tabular font-semibold text-ink">{formatNumber(point.entries)}</dd>
        </div>
        <div className={showUnique ? "flex items-center justify-between gap-6" : "hidden"}>
          <dt className="flex items-center gap-2 text-ink-muted">
            <span className="size-2.5 rounded-full bg-chart-2" aria-hidden="true" />
            Sportifs uniques
          </dt>
          <dd className="tabular font-semibold text-ink">{formatNumber(point.unique_athletes)}</dd>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-line pt-1">
          <dt className="text-ink-muted">Visites terminées</dt>
          <dd className="tabular text-ink-soft">{formatNumber(point.completed)}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="text-ink-muted">Durée moyenne</dt>
          <dd className="tabular text-ink-soft">{formatDuration(point.avg_duration_seconds)}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Fréquentation : colonnes = entrées, ligne = sportifs uniques. Même unité
 * (nombre de personnes/passages) : un seul axe.
 */
export function AttendanceChart({
  data,
  granularity,
  height = 280,
  showUnique = true,
}: {
  data: AttendancePoint[];
  granularity: Granularity;
  height?: number;
  showUnique?: boolean;
}) {
  const tickInterval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(v: string) => bucketLabel(v, granularity).replace("Sem. du ", "")}
            interval={tickInterval}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
            width={44}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-sunken)", opacity: 0.7 }}
            content={<ChartTooltip granularity={granularity} showUnique={showUnique} />}
            isAnimationActive={false}
          />
          <Bar dataKey="entries" name="Entrées" fill={SERIES_ENTRIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          {showUnique ? (
          <Line
            dataKey="unique_athletes"
            name="Sportifs uniques"
            type="monotone"
            stroke={SERIES_UNIQUE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2, fill: SERIES_UNIQUE }}
            isAnimationActive={false}
          />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Équivalent tabulaire du graphique (accessibilité, impression). */
export function AttendanceTable({ data, granularity }: { data: AttendancePoint[]; granularity: Granularity }) {
  return (
    <table className="w-full text-left text-[13px]">
      <caption className="sr-only">Fréquentation par période</caption>
      <thead className="text-xs uppercase tracking-[0.06em] text-ink-muted">
        <tr className="border-b border-line">
          <th scope="col" className="py-2 pr-3 font-semibold">Période</th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">Entrées</th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">Sportifs uniques</th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">Terminées</th>
          <th scope="col" className="py-2 text-right font-semibold">Durée moy.</th>
        </tr>
      </thead>
      <tbody className="tabular divide-y divide-line">
        {data.map((p) => (
          <tr key={p.bucket}>
            <th scope="row" className="py-1.5 pr-3 font-medium text-ink-soft">{bucketLabel(p.bucket, granularity)}</th>
            <td className="py-1.5 pr-3 text-right">{formatNumber(p.entries)}</td>
            <td className="py-1.5 pr-3 text-right">{formatNumber(p.unique_athletes)}</td>
            <td className="py-1.5 pr-3 text-right">{formatNumber(p.completed)}</td>
            <td className="py-1.5 text-right">{formatDuration(p.avg_duration_seconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
