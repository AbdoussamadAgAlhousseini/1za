"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { ChipGroup, DateRange } from "@/components/ui/filter-bar";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listAudit, type AuditListInput, type AuditRow, type Paged } from "@/server/actions/lists";
import { useServerList } from "@/lib/use-server-list";
import { AUDIT_ACTIONS, describeAuditDetails } from "@/lib/domain/audit";
import { formatDateTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { cn } from "@/lib/cn";

const CATEGORIES = [
  { value: "all", label: "Tout" },
  { value: "athlete", label: "Sportifs" },
  { value: "subscription", label: "Abonnements" },
  { value: "payment", label: "Paiements" },
  { value: "visit", label: "Passages" },
  { value: "profile", label: "Personnel" },
  { value: "plan", label: "Formules" },
  { value: "settings", label: "Paramètres" },
  { value: "export", label: "Exports" },
] as const;

export function AuditTable({ initial, timezone }: { initial: Paged<AuditRow> | null; timezone: string }) {
  const list = useServerList<AuditListInput & { page: number }, Paged<AuditRow>>(listAudit, { category: "all", from: "", to: "", page: 1 }, initial);
  const f = list.filters;
  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <ChipGroup label="Catégorie" options={[...CATEGORIES]} value={(f.category ?? "all") as (typeof CATEGORIES)[number]["value"]} onChange={(category) => list.update({ category })} />
        <DateRange from={f.from ?? ""} to={f.to ?? ""} onChange={({ from, to }) => list.update({ from, to })} />
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
                    <Th>Action</Th>
                    <Th>Concerne</Th>
                    <Th>Détails</Th>
                    <Th>Auteur</Th>
                  </tr>
                </THead>
                <TBody>
                  {list.data.rows.map((r) => {
                    const meta = AUDIT_ACTIONS[r.action ?? ""] ?? { label: r.action ?? "", tone: "neutral" as const };
                    const details = describeAuditDetails(r.action ?? "", r.details as Record<string, unknown> | null);
                    return (
                      <Tr key={r.id}>
                        <Td className="tabular whitespace-nowrap">{formatDateTime(r.occurred_at, timezone)}</Td>
                        <Td>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {r.matricule ? (
                            <span className="font-display text-base font-semibold tracking-[0.08em] text-ink">{formatMatricule(r.matricule)}</span>
                          ) : r.target_staff_name ? (
                            <span className="font-medium text-ink">{r.target_staff_name}</span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </Td>
                        <Td className="max-w-md text-[13px]">
                          {r.action === "settings.updated" ? (
                            <details>
                              <summary className="cursor-pointer text-pitch-700">Avant / après</summary>
                              <pre className="mt-1 whitespace-pre-wrap rounded bg-surface-sunken p-2 text-[11px]">{JSON.stringify(r.details, null, 2)}</pre>
                            </details>
                          ) : (
                            details || <span className="text-ink-faint">—</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">{r.actor_name ?? <span className="text-ink-faint">Système</span>}</Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={list.setPage} disabled={list.pending} itemLabel="événements" />
          </>
        ) : (
          <EmptyState icon={<ScrollText />} title="Aucun événement" description="Les opérations sensibles apparaîtront ici." />
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-muted">
        Le journal est en lecture seule : il ne peut être ni modifié ni supprimé, y compris par l&apos;administrateur.{" "}
        <Link href="/frequentation" className="font-semibold text-pitch-700 hover:underline">
          Les entrées et sorties
        </Link>{" "}
        sont tracées dans l&apos;historique de fréquentation.
      </p>
    </>
  );
}
