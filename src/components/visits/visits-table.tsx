"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Ban, Clock3, CloudOff, Footprints, LogOut, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, VisitStatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { ChipGroup, DateRange, SearchInput } from "@/components/ui/filter-bar";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listVisits, type Paged, type VisitListInput, type VisitRow } from "@/server/actions/lists";
import { correctVisit } from "@/server/actions/visits";
import { useServerList } from "@/lib/use-server-list";
import { safeAction } from "@/lib/safe-action";
import { formatDate, formatDateTime, formatDuration, formatTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { utcIsoToZonedLocal } from "@/lib/domain/timezone";
import { cn } from "@/lib/cn";

type Filters = VisitListInput & { page: number };

export function VisitsTable({
  initial,
  initialFilters,
  agents,
  timezone,
  athleteLabel,
}: {
  initial: Paged<VisitRow> | null;
  initialFilters: Filters;
  agents: { id: string; display_name: string }[];
  timezone: string;
  athleteLabel: string | null;
}) {
  const list = useServerList<Filters, Paged<VisitRow>>(listVisits, initialFilters, initial);
  const f = list.filters;
  const [target, setTarget] = useState<VisitRow | null>(null);

  return (
    <>
      {f.athleteId ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-pitch-200 bg-pitch-50 px-4 py-2.5 text-sm">
          <span>
            Passages du sportif <strong className="font-display text-lg tracking-[0.08em]">{athleteLabel ? formatMatricule(athleteLabel) : ""}</strong>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => list.update({ athleteId: "" })}>
            Voir tous les passages
          </Button>
        </div>
      ) : null}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        {!f.athleteId ? <SearchInput value={f.search ?? ""} onChange={(search) => list.update({ search })} /> : null}
        <Select aria-label="Agent" value={f.agentId} onChange={(e) => list.update({ agentId: e.target.value })} className="h-10 w-auto">
          <option value="">Tous les agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </Select>
        <DateRange from={f.from ?? ""} to={f.to ?? ""} onChange={({ from, to }) => list.update({ from, to })} />
      </div>
      <div className="mb-4">
        <ChipGroup
          label="Statut du passage"
          options={[
            { value: "all", label: "Tous" },
            { value: "open", label: "En cours" },
            { value: "closed", label: "Terminés" },
            { value: "cancelled", label: "Annulés" },
          ]}
          value={(f.status ?? "all") as "all" | "open" | "closed" | "cancelled"}
          onChange={(status) => list.update({ status })}
        />
      </div>
      {list.error ? <InlineAlert tone="danger" className="mb-4">{list.error}</InlineAlert> : null}
      <Card className={cn("overflow-hidden transition-opacity", list.pending && "opacity-60")} aria-busy={list.pending}>
        {list.data && list.data.rows.length ? (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Matricule</Th>
                    <Th>Entrée</Th>
                    <Th>Sortie</Th>
                    <Th>Durée</Th>
                    <Th>Statut</Th>
                    <Th>Agents</Th>
                    <Th>
                      <span className="sr-only">Correction</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {list.data.rows.map((v) => (
                    <Tr key={v.id}>
                      <Td className="tabular whitespace-nowrap">{formatDate(v.visit_date)}</Td>
                      <Td>
                        <Link href={`/sportifs/${v.athlete_id}`} className="font-display text-lg font-semibold tracking-[0.08em] text-ink hover:underline">
                          {formatMatricule(v.matricule ?? "")}
                        </Link>
                      </Td>
                      <Td className="tabular">{formatTime(v.entered_at, timezone)}</Td>
                      <Td className="tabular">{v.exited_at ? formatTime(v.exited_at, timezone) : <span className="text-ink-faint">—</span>}</Td>
                      <Td className="tabular whitespace-nowrap">{formatDuration(v.duration_seconds)}</Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <VisitStatusBadge status={v.status ?? "open"} corrected={Boolean(v.corrected_at)} />
                          {v.entry_offline || v.exit_offline ? (
                            <Badge tone="neutral" icon={<CloudOff aria-hidden="true" />}>
                              Hors ligne
                            </Badge>
                          ) : null}
                        </span>
                        {v.correction_reason ? (
                          <span className="mt-1 block max-w-56 truncate text-xs text-ink-muted" title={v.correction_reason}>
                            {v.correction_reason}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-[13px]">
                        <span className="block">
                          <span className="text-ink-faint">Entrée :</span> {v.entry_agent_name ?? "—"}
                        </span>
                        {v.exit_agent_name ? (
                          <span className="block">
                            <span className="text-ink-faint">Sortie :</span> {v.exit_agent_name}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-right">
                        {v.status !== "cancelled" ? (
                          <Button variant="ghost" size="sm" onClick={() => setTarget(v)}>
                            <Wrench />
                            Corriger
                          </Button>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={list.setPage} disabled={list.pending} itemLabel="passages" />
          </>
        ) : (
          <EmptyState icon={<Footprints />} title="Aucun passage" description="Aucun passage ne correspond à ces critères." />
        )}
      </Card>
      {target ? (
        <CorrectionDialog
          visit={target}
          timezone={timezone}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            list.reload();
          }}
        />
      ) : null}
    </>
  );
}

function CorrectionDialog({ visit, timezone, onClose, onDone }: { visit: VisitRow; timezone: string; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<"close" | "cancel">(visit.status === "open" ? "close" : "close");
  const [exitedAtLocal, setExitedAtLocal] = useState(() => (visit.exited_at ? utcIsoToZonedLocal(visit.exited_at, timezone) : ""));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const minLocal = visit.entered_at ? utcIsoToZonedLocal(visit.entered_at, timezone) : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Corriger un passage"
        description={`${formatMatricule(visit.matricule ?? "")} · entrée le ${formatDateTime(visit.entered_at, timezone)}. Toute correction est motivée et journalisée.`}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await safeAction(() =>
                correctVisit(action === "close" ? { action, visitId: visit.id ?? "", exitedAtLocal, reason } : { action, visitId: visit.id ?? "", reason }),
              );
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                setFormError(res.message);
                return;
              }
              toast.success(res.message ?? "Correction enregistrée.");
              onDone();
            });
          }}
        >
          {formError ? <InlineAlert tone="danger" icon={<AlertCircle />}>{formError}</InlineAlert> : null}
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type de correction">
            {(
              [
                ["close", visit.status === "open" ? "Enregistrer la sortie oubliée" : "Corriger l'heure de sortie", LogOut],
                ["cancel", "Annuler ce passage (saisie erronée)", Ban],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={action === key}
                onClick={() => setAction(key)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm font-semibold transition-colors",
                  action === key ? "border-pitch-700 bg-pitch-50 text-ink ring-1 ring-pitch-700" : "border-line-strong text-ink-soft hover:border-ink-faint",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {action === "close" ? (
            <Field label="Heure de sortie (heure du stade)" error={errors.exitedAtLocal}>
              {(p) => <Input {...p} type="datetime-local" min={minLocal} value={exitedAtLocal} onChange={(e) => setExitedAtLocal(e.target.value)} className="h-11" />}
            </Field>
          ) : (
            <InlineAlert tone="warning" icon={<Clock3 />}>
              Le passage sera exclu des statistiques mais restera visible dans l&apos;historique, marqué comme annulé.
            </InlineAlert>
          )}
          <Field label="Motif" error={errors.reason} hint="Obligatoire (5 caractères minimum). Conservé dans le journal d'audit.">
            {(p) => <Textarea {...p} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Fermer
            </Button>
            <Button type="submit" variant={action === "cancel" ? "danger" : "primary"} loading={pending}>
              Enregistrer la correction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
