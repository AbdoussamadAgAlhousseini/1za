"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PERIOD_LABELS, PERIOD_PRESETS, GRANULARITY_LABELS, resolvePreset, type Granularity, type PeriodPreset } from "@/lib/domain/periods";
import { cn } from "@/lib/cn";

export function PeriodPicker({ from, to, granularity, today }: { from: string; to: string; granularity: Granularity; today: string }) {
  const router = useRouter();
  const [custom, setCustom] = useState({ from, to });
  const activePreset = PERIOD_PRESETS.find((p) => {
    const r = resolvePreset(p, today);
    return r.from === from && r.to === to;
  });
  const go = (f: string, t: string, g: Granularity = granularity) => router.push(`/rapports?du=${f}&au=${t}&pas=${g}`);

  return (
    <div className="no-print mb-6 space-y-3 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Période prédéfinie">
        {PERIOD_PRESETS.map((p: PeriodPreset) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              const r = resolvePreset(p, today);
              setCustom(r);
              go(r.from, r.to, p === "year" ? "month" : p === "90d" ? "week" : "day");
            }}
            aria-pressed={activePreset === p}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              activePreset === p ? "border-pitch-800 bg-pitch-800 text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.from && custom.to && custom.from <= custom.to) go(custom.from, custom.to);
        }}
      >
        <label className="text-[13px] font-semibold text-ink-soft">
          Du
          <Input type="date" className="mt-1 h-10 w-40" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
        </label>
        <label className="text-[13px] font-semibold text-ink-soft">
          Au
          <Input type="date" className="mt-1 h-10 w-40" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </label>
        <label className="text-[13px] font-semibold text-ink-soft">
          Regrouper par
          <Select className="mt-1 h-10 w-36" value={granularity} onChange={(e) => go(from, to, e.target.value as Granularity)}>
            {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
              <option key={g} value={g}>
                {GRANULARITY_LABELS[g]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary" className="h-10">
          <CalendarRange />
          Appliquer
        </Button>
        <Button type="button" variant="ghost" className="ml-auto h-10" onClick={() => window.print()}>
          <Printer />
          Imprimer le rapport
        </Button>
      </form>
    </div>
  );
}
