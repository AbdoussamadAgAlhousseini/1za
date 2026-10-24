"use client";

import Link from "next/link";
import { useState } from "react";
import { Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { ChipGroup, DateRange, SearchInput } from "@/components/ui/filter-bar";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { ReasonDialog } from "@/components/subscriptions/reason-dialog";
import { listPayments, type Paged, type PaymentListInput, type PaymentRow } from "@/server/actions/lists";
import { cancelPayment } from "@/server/actions/subscriptions";
import { useServerList } from "@/lib/use-server-list";
import { formatDate, formatMoney } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/status";
import { cn } from "@/lib/cn";

export function PaymentsTable({ initial, initialFilters }: { initial: Paged<PaymentRow> | null; initialFilters: PaymentListInput & { page: number } }) {
  const list = useServerList<PaymentListInput & { page: number }, Paged<PaymentRow>>(listPayments, initialFilters, initial);
  const f = list.filters;
  const [toCancel, setToCancel] = useState<PaymentRow | null>(null);

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={f.search ?? ""} onChange={(search) => list.update({ search })} />
        <Select aria-label="Mode de paiement" value={f.method} onChange={(e) => list.update({ method: e.target.value })} className="h-10 w-auto">
          <option value="all">Tous les modes</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <DateRange from={f.from ?? ""} to={f.to ?? ""} onChange={({ from, to }) => list.update({ from, to })} />
      </div>
      <div className="mb-4">
        <ChipGroup
          label="Statut du paiement"
          options={[
            { value: "recorded", label: "Enregistrés" },
            { value: "cancelled", label: "Annulés" },
            { value: "all", label: "Tous" },
          ]}
          value={(f.status ?? "recorded") as "recorded" | "cancelled" | "all"}
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
                    <Th>Formule</Th>
                    <Th>Mode</Th>
                    <Th>Référence</Th>
                    <Th className="text-right">Montant</Th>
                    <Th>Saisi par</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {list.data.rows.map((p) => (
                    <Tr key={p.id} className={cn(p.status === "cancelled" && "bg-surface-muted/70")}>
                      <Td className="tabular whitespace-nowrap">{formatDate(p.paid_on)}</Td>
                      <Td>
                        <Link href={`/sportifs/${p.athlete_id}`} className="font-display text-lg font-semibold tracking-[0.08em] text-ink hover:underline">
                          {formatMatricule(p.matricule ?? "")}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{p.plan_name ?? <span className="text-ink-faint">—</span>}</Td>
                      <Td className="whitespace-nowrap">{PAYMENT_METHOD_LABELS[(p.method ?? "other") as PaymentMethod]}</Td>
                      <Td className="max-w-40 truncate">{p.reference ?? <span className="text-ink-faint">—</span>}</Td>
                      <Td className={cn("tabular whitespace-nowrap text-right font-semibold text-ink", p.status === "cancelled" && "text-ink-faint line-through")}>
                        {formatMoney(p.amount, p.currency ?? "XOF")}
                      </Td>
                      <Td className="whitespace-nowrap">{p.recorded_by_name ?? "—"}</Td>
                      <Td className="text-right">
                        {p.status === "cancelled" ? (
                          <Badge tone="neutral">Annulé</Badge>
                        ) : (
                          <button type="button" onClick={() => setToCancel(p)} className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-danger-700 hover:underline">
                            Annuler
                          </button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={list.setPage} disabled={list.pending} itemLabel="paiements" />
          </>
        ) : (
          <EmptyState icon={<Receipt />} title="Aucun paiement" description="Les paiements s'enregistrent depuis la fiche d'un sportif ou lors de la création d'un abonnement." />
        )}
      </Card>
      {toCancel ? (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setToCancel(null)}
          title="Annuler le paiement"
          description={`${formatMoney(toCancel.amount, toCancel.currency ?? "XOF")} du ${formatDate(toCancel.paid_on)} · ${formatMatricule(toCancel.matricule ?? "")}. Il restera visible comme annulé.`}
          confirmLabel="Annuler le paiement"
          tone="danger"
          onSubmit={async (reason) => {
            const res = await cancelPayment({ paymentId: toCancel.id ?? "", reason });
            if (res.ok) list.reload();
            return res;
          }}
        >
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Wallet className="size-4" aria-hidden="true" />À utiliser pour corriger une erreur de saisie.
          </p>
        </ReasonDialog>
      ) : null}
    </>
  );
}
