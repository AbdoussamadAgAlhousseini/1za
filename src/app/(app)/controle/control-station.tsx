"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock3, LogIn, LogOut, RotateCcw, ScanLine, Search, Users2, AlertTriangle } from "lucide-react";
import { checkMatricule, loadControlPanel, recordEntry, recordExit } from "@/server/actions/control";
import type { ControlCheck, ControlPanelData } from "@/lib/control-types";
import type { ActionResult } from "@/lib/action-types";
import { NETWORK_ERROR_MESSAGE } from "@/lib/domain/errors";
import { explainMatriculeError, formatMatricule, MATRICULE_EXAMPLE, normalizeMatricule } from "@/lib/domain/matricule";
import { formatDuration, formatTime } from "@/lib/domain/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { VerdictPanel } from "./verdict-panel";
import { LiveClock } from "./live-clock";

type Phase =
  | { kind: "idle" }
  | { kind: "result"; check: ControlCheck }
  | { kind: "done"; action: "entry" | "exit"; matricule: string; at: string; durationSeconds?: number }
  | { kind: "error"; message: string };

async function safeCall<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

export function ControlStation({
  timezone,
  agentName,
  initialPanel,
}: {
  timezone: string;
  agentName: string;
  initialPanel: ControlPanelData | null;
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [panel, setPanel] = useState<ControlPanelData | null>(initialPanel);
  const [checking, startChecking] = useTransition();
  const [recording, startRecording] = useTransition();
  const [pendingExit, setPendingExit] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const refreshPanel = useCallback(async () => {
    const res = await safeCall(loadControlPanel);
    if (res.ok) setPanel(res.data);
  }, []);

  // Rafraîchissement périodique des présents (toutes les 30 s).
  useEffect(() => {
    const id = window.setInterval(refreshPanel, 30_000);
    return () => window.clearInterval(id);
  }, [refreshPanel]);

  // Résultat : focus sur l'action proposée (Entrée pour valider).
  // Opération terminée : retour immédiat au champ pour le sportif suivant.
  useEffect(() => {
    if (phase.kind === "result") actionRef.current?.focus();
    if (phase.kind === "done") inputRef.current?.focus();
  }, [phase]);

  const reset = useCallback(() => {
    setValue("");
    setPhase({ kind: "idle" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const submitCheck = (raw: string) => {
    const hint = explainMatriculeError(raw);
    if (hint) {
      setPhase({ kind: "error", message: hint });
      inputRef.current?.focus();
      return;
    }
    startChecking(async () => {
      const res = await safeCall(() => checkMatricule(raw));
      setPhase(res.ok ? { kind: "result", check: res.data } : { kind: "error", message: res.message });
    });
  };

  const doEntry = (matricule: string) => {
    startRecording(async () => {
      const res = await safeCall(() => recordEntry(matricule));
      if (res.ok) {
        setPhase({ kind: "done", action: "entry", matricule: res.data.matricule, at: res.data.entered_at });
        setValue("");
        toast.success(`Entrée enregistrée · ${formatMatricule(res.data.matricule)}`);
        void refreshPanel();
      } else {
        setPhase({ kind: "error", message: res.message });
        toast.error(res.message);
      }
    });
  };

  const doExit = (matricule: string, fromList = false) => {
    startRecording(async () => {
      const res = await safeCall(() => recordExit(matricule));
      setPendingExit(null);
      if (res.ok) {
        if (!fromList) {
          setPhase({
            kind: "done",
            action: "exit",
            matricule: res.data.matricule,
            at: res.data.exited_at,
            durationSeconds: res.data.duration_seconds,
          });
          setValue("");
        }
        toast.success(`Sortie enregistrée · ${formatMatricule(res.data.matricule)} · ${formatDuration(res.data.duration_seconds)}`);
        void refreshPanel();
      } else {
        toast.error(res.message);
        if (!fromList) setPhase({ kind: "error", message: res.message });
      }
    });
  };

  const overview = panel?.overview;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-gold-600">Poste de contrôle · {agentName}</p>
          <h1 className="mt-1 font-display text-[2.35rem] font-semibold uppercase leading-none tracking-[0.02em]">Contrôle d&apos;accès</h1>
        </div>
        <LiveClock timezone={timezone} />
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <form
              className="p-5 sm:p-7"
              onSubmit={(e) => {
                e.preventDefault();
                submitCheck(value);
              }}
            >
              <label htmlFor="matricule" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                <ScanLine className="size-4 text-pitch-600" aria-hidden="true" />
                Matricule du sportif
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  id="matricule"
                  name="matricule"
                  value={value}
                  onChange={(e) => {
                    setValue(normalizeMatricule(e.target.value).slice(0, 7));
                    if (phase.kind !== "idle") setPhase({ kind: "idle" });
                  }}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  maxLength={12}
                  placeholder={MATRICULE_EXAMPLE}
                  aria-describedby="matricule-hint"
                  aria-invalid={phase.kind === "error" || undefined}
                  className={cn(
                    "h-[72px] w-full min-w-0 flex-1 rounded-lg border-2 border-line-strong bg-surface-muted px-5",
                    "font-display text-[2.6rem] font-semibold uppercase tracking-[0.22em] text-ink placeholder:text-ink-faint/50",
                    "transition-[border-color,box-shadow] focus:border-pitch-600 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-pitch-600/15",
                    "aria-[invalid=true]:border-warning-600",
                  )}
                />
                <Button type="submit" size="xl" className="h-[72px] sm:w-48" loading={checking} disabled={value.length === 0}>
                  {checking ? null : <Search />}
                  Vérifier
                </Button>
              </div>
              <p id="matricule-hint" className="mt-3 text-[13px] text-ink-muted">
                2 lettres (initiales) puis 5 chiffres · Appuyez sur <kbd className="rounded border border-line-strong bg-surface px-1.5 py-0.5 font-sans text-xs font-semibold shadow-xs">Entrée</kbd> pour vérifier, puis à nouveau pour valider l&apos;action proposée.
              </p>
            </form>
          </Card>

          {phase.kind === "error" ? (
            <InlineAlert tone="warning" icon={<AlertTriangle />} title="Vérification impossible" className="animate-pop-in">
              {phase.message}
            </InlineAlert>
          ) : null}

          {phase.kind === "result" ? (
            <VerdictPanel
              ref={actionRef}
              check={phase.check}
              timezone={timezone}
              busy={recording}
              onEntry={() => doEntry(phase.check.matricule)}
              onExit={() => doExit(phase.check.matricule)}
            />
          ) : null}

          {phase.kind === "done" ? (
            <section aria-live="polite" className="animate-pop-in rounded-xl border-2 border-success-600/35 bg-success-50 p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-success-600 text-white shadow-raised">
                  {phase.action === "entry" ? <LogIn className="size-8" aria-hidden="true" /> : <LogOut className="size-8" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-4xl font-bold uppercase leading-none text-success-700">
                    {phase.action === "entry" ? "Entrée enregistrée" : "Sortie enregistrée"}
                  </p>
                  <p className="mt-2 text-[15px] text-ink-soft">
                    <span className="font-display text-xl font-semibold tracking-[0.08em] text-ink">{formatMatricule(phase.matricule)}</span>
                    {" · "}à {formatTime(phase.at, timezone)}
                    {phase.durationSeconds !== undefined ? ` · durée de la visite : ${formatDuration(phase.durationSeconds)}` : null}
                  </p>
                </div>
                <Button variant="secondary" size="lg" onClick={reset}>
                  <RotateCcw />
                  Sportif suivant
                </Button>
              </div>
            </section>
          ) : null}

          {phase.kind === "idle" ? (
            <div className="grid place-items-center rounded-xl border-2 border-dashed border-line-strong bg-surface/60 px-6 py-8 text-center sm:py-12">
              <div className="grid size-14 place-items-center rounded-full bg-pitch-50 text-pitch-700">
                <ScanLine className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-3 font-display text-lg font-semibold uppercase tracking-[0.05em] text-ink">En attente d&apos;un matricule</p>
              <p className="mt-1 max-w-sm text-sm text-ink-muted">
                Le résultat du contrôle s&apos;affichera ici avec l&apos;action autorisée.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="overflow-hidden rounded-lg border border-pitch-800 bg-pitch-800 text-white shadow-raised">
            <div className="flex items-end justify-between gap-4 px-5 pb-4 pt-4">
              <div>
                <p className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-pitch-200">
                  <Users2 className="size-3.5" aria-hidden="true" />
                  Présents maintenant
                </p>
                <p className="mt-1 text-5xl font-semibold leading-none">{overview?.present_now ?? "—"}</p>
              </div>
              <p className="pb-1 text-right text-xs text-pitch-200">
                {overview ? `${overview.entries_today} entrée(s) aujourd'hui` : ""}
              </p>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 bg-pitch-900/60">
              <MiniStat label="Mes entrées" value={overview?.my_entries_today} icon={<LogIn />} />
              <MiniStat label="Mes sorties" value={overview?.my_exits_today} icon={<LogOut />} />
            </dl>
          </div>

          {overview && overview.long_open_visits > 0 ? (
            <InlineAlert tone="warning" icon={<Clock3 />}>
              {overview.long_open_visits} entrée(s) ouverte(s) depuis longtemps : vérifiez si des sorties n&apos;ont pas été enregistrées.
            </InlineAlert>
          ) : null}

          <Card>
            <CardHeader title="Présents dans le stade" description="Entrées sans sortie enregistrée" />
            {panel && panel.present.length > 0 ? (
              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {panel.present.map((p) => (
                  <li key={p.matricule} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div>
                      <p className="font-display text-lg font-semibold tracking-[0.08em] text-ink">{formatMatricule(p.matricule)}</p>
                      <p className="text-xs text-ink-muted">Entré à {formatTime(p.entered_at, timezone)}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setPendingExit(p.matricule)} aria-label={`Enregistrer la sortie de ${p.matricule}`}>
                      <LogOut />
                      Sortie
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Users2 />} title="Personne à l'intérieur" description="Les sportifs entrés apparaîtront ici." />
            )}
          </Card>

          <Card>
            <CardHeader title="Mes dernières opérations" description="Aujourd'hui" />
            {panel && panel.activity.length > 0 ? (
              <ul className="divide-y divide-line">
                {panel.activity.map((a, i) => (
                  <li key={`${a.matricule}-${a.occurred_at}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full",
                        a.kind === "entry" ? "bg-success-50 text-success-700" : "bg-info-50 text-info-700",
                      )}
                    >
                      {a.kind === "entry" ? <ArrowRight className="size-3.5" aria-hidden="true" /> : <LogOut className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className="font-semibold tracking-[0.04em] text-ink">{formatMatricule(a.matricule)}</span>
                    <span className="text-ink-muted">{a.kind === "entry" ? "Entrée" : "Sortie"}</span>
                    <span className="tabular ml-auto text-ink-muted">{formatTime(a.occurred_at, timezone)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<CheckCircle2 />} title="Aucune opération" description="Vos entrées et sorties du jour s'afficheront ici." />
            )}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingExit !== null}
        onOpenChange={(o) => !o && setPendingExit(null)}
        title="Enregistrer la sortie ?"
        description={
          <>
            Le sportif <strong className="font-semibold text-ink">{pendingExit ? formatMatricule(pendingExit) : ""}</strong> sera
            enregistré comme sorti à l&apos;heure actuelle.
          </>
        }
        confirmLabel="Enregistrer la sortie"
        loading={recording}
        onConfirm={() => pendingExit && doExit(pendingExit, true)}
      />
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number | undefined; icon: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <dt className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-pitch-200 [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold leading-none">{value ?? "—"}</dd>
    </div>
  );
}
