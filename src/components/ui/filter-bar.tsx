"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "./field";

export function SearchInput({ value, onChange, placeholder = "Rechercher un matricule…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 pl-9 font-semibold tracking-[0.06em]"
        autoComplete="off"
      />
    </div>
  );
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            value === o.value ? "border-pitch-800 bg-pitch-800 text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DateRange({
  from,
  to,
  onChange,
  max,
  labels = ["Du", "au"],
}: {
  from: string;
  to: string;
  onChange: (v: { from: string; to: string }) => void;
  max?: string;
  labels?: [string, string];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[13px] font-semibold text-ink-soft sm:flex sm:items-center">
      <label className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">{labels[0]}</span>
        <Input type="date" value={from} max={max} onChange={(e) => onChange({ from: e.target.value, to })} className="h-10 min-w-0 sm:w-[9.5rem]" />
      </label>
      <label className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">{labels[1]}</span>
        <Input type="date" value={to} max={max} onChange={(e) => onChange({ from, to: e.target.value })} className="h-10 min-w-0 sm:w-[9.5rem]" />
      </label>
    </div>
  );
}
