"use client";

import { forwardRef } from "react";
import { CheckCircle2, CircleSlash, CloudOff, DoorOpen, LogIn, LogOut, SearchX, ShieldAlert, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CONTROL_PRESENTATION, type Tone } from "@/lib/domain/status";
import { formatDate, formatDateTime, formatDuration, formatRelativeDays, formatTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import type { ControlCheck } from "@/lib/control-types";

const PANEL_TONES: Record<Tone, { panel: string; icon: string; headline: string }> = {
  success: { panel: "border-success-600/35 bg-success-50", icon: "bg-success-600 text-white", headline: "text-success-700" },
  danger: { panel: "border-danger-600/35 bg-danger-50", icon: "bg-danger-600 text-white", headline: "text-danger-700" },
  warning: { panel: "border-warning-600/35 bg-warning-50", icon: "bg-warning-600 text-white", headline: "text-warning-700" },
  info: { panel: "border-info-600/30 bg-info-50", icon: "bg-info-600 text-white", headline: "text-info-700" },
  neutral: { panel: "border-line-strong bg-surface-muted", icon: "bg-ink-soft text-white", headline: "text-ink" },
};

const OUTCOME_ICONS = {
  authorized: CheckCircle2,
  already_inside: DoorOpen,
  expired: ShieldX,
  upcoming: ShieldAlert,
  suspended: CircleSlash,
  no_subscription: ShieldX,
  not_found: SearchX,
  invalid_format: SearchX,
} as const;

interface Props {
  check: ControlCheck;
  timezone: string;
  /** Renseigné quand la vérification a été faite sans réseau (date des données). */
  offlineSince?: string | null;
  busy: boolean;
  onEntry: () => void;
  onExit: () => void;
}

export const VerdictPanel = forwardRef<HTMLButtonElement, Props>(function VerdictPanel(
  { check, timezone, offlineSince, busy, onEntry, onExit },
  actionRef,
) {
  const p = CONTROL_PRESENTATION[check.outcome];
  const tones = PANEL_TONES[p.tone];
  const Icon = OUTCOME_ICONS[check.outcome];
  const sub = check.subscription;
  const openSince = check.open_visit?.entered_at;
  // Durée calculée à partir des horodatages serveur (et non de l'horloge de l'appareil).
  const elapsed = openSince ? Math.max(0, (new Date(check.checked_at).getTime() - new Date(openSince).getTime()) / 1000) : null;

  return (
    <section
      aria-live="assertive"
      aria-atomic="true"
      className={cn("animate-pop-in overflow-hidden rounded-xl border-2", tones.panel)}
      data-outcome={check.outcome}
      data-offline={offlineSince ? "true" : undefined}
    >
      {offlineSince ? (
        <div className="flex items-center gap-2 bg-warning-100 px-5 py-2 text-[13px] font-semibold text-warning-700 sm:px-7">
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
          Vérification hors ligne · abonnements téléchargés le {formatDateTime(offlineSince, timezone)}
        </div>
      ) : null}
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl shadow-raised sm:size-20", tones.icon)}>
          <Icon className="size-9 sm:size-11" strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("font-display text-[2.4rem] font-bold uppercase leading-none tracking-[0.01em] sm:text-5xl", tones.headline)}>
            {p.headline}
          </p>
          <p className="mt-2 text-[15px] font-medium text-ink-soft">
            {offlineSince && check.outcome === "no_subscription"
              ? "Aucun abonnement valide connu pour ce matricule dans les données hors ligne (ou matricule inconnu). Entrée refusée."
              : p.message}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-black/5 bg-black/5 text-sm sm:grid-cols-4">
        <div className="bg-white/70 px-5 py-3.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Matricule</dt>
          <dd className="mt-0.5 font-display text-2xl font-semibold tracking-[0.08em] text-ink">{formatMatricule(check.matricule)}</dd>
        </div>
        <div className="bg-white/70 px-5 py-3.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Formule</dt>
          <dd className="mt-1 font-semibold text-ink">{sub?.plan_name ?? (sub ? "Personnalisée" : "—")}</dd>
        </div>
        <div className="bg-white/70 px-5 py-3.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {check.outcome === "upcoming" ? "Valide à partir du" : "Valide jusqu'au"}
          </dt>
          <dd className="mt-1 font-semibold text-ink">
            {sub ? formatDate(check.outcome === "upcoming" ? sub.starts_on : sub.ends_on) : "—"}
          </dd>
        </div>
        <div className="bg-white/70 px-5 py-3.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {openSince ? "Entré à" : "Échéance"}
          </dt>
          <dd className="mt-1 font-semibold text-ink">
            {openSince ? (
              <>
                {formatTime(openSince, timezone)} <span className="font-normal text-ink-muted">({formatDuration(elapsed)})</span>
              </>
            ) : sub && check.outcome !== "upcoming" ? (
              sub.days_remaining >= 0 ? `Fin ${formatRelativeDays(sub.days_remaining)}` : `Expiré ${formatRelativeDays(sub.days_remaining)}`
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {p.allowsEntry || p.allowsExit ? (
        <div className="border-t border-black/5 bg-white/80 p-4 sm:p-5">
          {p.allowsEntry ? (
            <Button ref={actionRef} variant="success" size="xl" className="w-full" loading={busy} onClick={onEntry}>
              {busy ? null : <LogIn />}
              Enregistrer l&apos;entrée
            </Button>
          ) : (
            <Button ref={actionRef} variant="primary" size="xl" className="w-full" loading={busy} onClick={onExit}>
              {busy ? null : <LogOut />}
              Enregistrer la sortie
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
});
