"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import type { AttendancePoint } from "@/lib/stats-types";
import type { Granularity } from "@/lib/domain/periods";
import { cn } from "@/lib/cn";
import { AttendanceChart, AttendanceLegend, AttendanceTable } from "./attendance-chart";

/** Graphique de fréquentation avec bascule vers la vue tableau. */
export function AttendancePanel({ data, granularity, height }: { data: AttendancePoint[]; granularity: Granularity; height?: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const empty = data.every((p) => p.entries === 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AttendanceLegend />
        <div className="no-print inline-flex rounded-md border border-line bg-surface-muted p-0.5" role="group" aria-label="Mode d'affichage">
          {(
            [
              ["chart", "Graphique", BarChart3],
              ["table", "Tableau", Table2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors",
                view === key ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {empty ? (
        <div className="grid h-[220px] place-items-center rounded-md border border-dashed border-line-strong text-center text-sm text-ink-muted">
          Aucune entrée enregistrée sur cette période.
        </div>
      ) : view === "chart" ? (
        <AttendanceChart data={data} granularity={granularity} height={height} />
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <AttendanceTable data={data} granularity={granularity} />
        </div>
      )}
    </div>
  );
}
