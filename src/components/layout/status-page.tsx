import type { ReactNode } from "react";
import { BrandMark, TrackLines } from "@/components/brand/brand";

/** Gabarit des pages d'erreur et d'accès (hors de la navigation principale). */
export function StatusPage({
  code,
  title,
  description,
  icon,
  actions,
}: {
  code?: string;
  title: string;
  description: ReactNode;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-16">
      <TrackLines className="absolute left-1/2 top-1/2 w-[1400px] max-w-none -translate-x-1/2 -translate-y-1/2 text-pitch-300" />
      <div className="relative w-full max-w-lg rounded-xl border border-line bg-surface/95 p-8 text-center shadow-raised backdrop-blur sm:p-10">
        <BrandMark className="mx-auto size-11" />
        <div className="mx-auto mt-6 grid size-14 place-items-center rounded-full bg-pitch-50 text-pitch-700 [&_svg]:size-6">{icon}</div>
        {code ? <p className="eyebrow mt-5 text-gold-600">{code}</p> : null}
        <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-[0.02em]">{title}</h1>
        <div className="mt-3 text-sm text-ink-muted">{description}</div>
        {actions ? <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div> : null}
      </div>
    </main>
  );
}
