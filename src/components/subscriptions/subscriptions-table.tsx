"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, ValidityBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { ChipGroup, DateRange, SearchInput } from "@/components/ui/filter-bar";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listSubscriptions, type Paged, type SubscriptionListInput, type SubscriptionRow } from "@/server/actions/lists";
import { useServerList } from "@/lib/use-server-list";
import { formatDate, formatMoney, pluralize } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import type { SubscriptionValidity } from "@/lib/domain/status";
import type { PlanOption } from "@/server/queries/common";
import { cn } from "@/lib/cn";

const VALIDITY_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "upcoming", label: "À venir" },
  { value: "expired", label: "Expirés" },
  { value: "suspended", label: "Suspendus" },
  { value: "cancelled", label: "Annulés" },
] as const;

export function SubscriptionsTable({ initial, plans, currency }: { initial: Paged<SubscriptionRow> | null; plans: PlanOption[]; currency: string }) {
  const list = useServerList<SubscriptionListInput & { page: number }, Paged<SubscriptionRow>>(
    listSubscriptions,
    { search: "", validity: "all", planId: "", createdFrom: "", createdTo: "", page: 1 },
    initial,
  );
  const f = list.filters;

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={f.search ?? ""} onChange={(search) => list.update({ search })} />
        <Select aria-label="Formule" value={f.planId} onChange={(e) => list.update({ planId: e.target.value })} className="h-10 w-auto">
          <option value="">Toutes les formules</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <DateRange labels={["Début du", "au"]} from={f.createdFrom ?? ""} to={f.createdTo ?? ""} onChange={({ from, to }) => list.update({ createdFrom: from, createdTo: to })} />
      </div>
      <div className="mb-4">
        <ChipGroup label="Filtrer par statut" options={[...VALIDITY_OPTIONS]} value={f.validity as (typeof VALIDITY_OPTIONS)[number]["value"]} onChange={(validity) => list.update({ validity })} />
      </div>
      {list.error ? <InlineAlert tone="danger" className="mb-4">{list.error}</InlineAlert> : null}
      <Card className={cn("overflow-hidden transition-opacity", list.pending && "opacity-60")} aria-busy={list.pending}>
        {list.data && list.data.rows.length ? (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <Th>Matricule</Th>
                    <Th>Formule</Th>
                    <Th>Période</Th>
                    <Th>Statut</Th>
                    <Th className="text-right">Payé</Th>
                    <Th>Créé par</Th>
                  </tr>
                </THead>
                <TBody>
                  {list.data.rows.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <Link href={`/sportifs/${s.athlete_id}`} className="font-display text-lg font-semibold tracking-[0.08em] text-ink hover:text-pitch-700 hover:underline">
                          {formatMatricule(s.matricule ?? "")}
                        </Link>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          {s.plan_name ?? "Personnalisée"}
                          {s.renewed_from_id ? <Badge tone="neutral">Renouv.</Badge> : null}
                        </span>
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {formatDate(s.starts_on)} → {formatDate(s.ends_on)}
                        <span className="block text-xs text-ink-muted">{pluralize(s.length_days ?? 0, "jour")}</span>
                      </Td>
                      <Td>
                        <ValidityBadge status={(s.validity ?? "none") as SubscriptionValidity} />
                      </Td>
                      <Td className="tabular whitespace-nowrap text-right">
                        {Number(s.paid_amount) > 0 ? formatMoney(s.paid_amount, currency) : <span className="text-ink-faint">—</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {s.created_by_name ?? "—"}
                        <span className="block text-xs text-ink-muted">{formatDate(s.created_at?.slice(0, 10))}</span>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={list.setPage} disabled={list.pending} itemLabel="abonnements" />
          </>
        ) : (
          <EmptyState icon={<CalendarX2 />} title="Aucun abonnement" description="Aucun abonnement ne correspond à ces critères." />
        )}
      </Card>
    </>
  );
}
