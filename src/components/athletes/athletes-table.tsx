"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, Search, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ValidityBadge } from "@/components/ui/badge";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listAthletes, type AthleteListResult } from "@/server/actions/athletes";
import { safeAction } from "@/lib/safe-action";
import { ATHLETE_SORT_LABELS, ATHLETE_SORTS, type AthleteSort, type AthleteStatusFilter } from "@/lib/validation/athletes";
import { formatDate, formatDateTime, formatNumber, formatRelativeDays } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import type { SubscriptionValidity } from "@/lib/domain/status";
import { cn } from "@/lib/cn";
import { RegisterAthleteDialog } from "./register-athlete-dialog";
import type { PlanOption } from "@/server/queries/common";

const STATUS_FILTERS: { value: AthleteStatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "expiring", label: "Expirent bientôt" },
  { value: "expired", label: "Expirés" },
  { value: "upcoming", label: "Pas encore valides" },
  { value: "suspended", label: "Suspendus" },
  { value: "none", label: "Sans abonnement" },
];

interface Filters {
  search: string;
  status: AthleteStatusFilter;
  registeredFrom: string;
  registeredTo: string;
  sort: AthleteSort;
  page: number;
}

export function AthletesTable({
  initial,
  initialStatus,
  openRegister,
  plans,
  today,
  defaultCurrency,
  timezone,
}: {
  initial: AthleteListResult | null;
  initialStatus: AthleteStatusFilter;
  openRegister: boolean;
  plans: PlanOption[];
  today: string;
  defaultCurrency: string;
  timezone: string;
}) {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: initialStatus,
    registeredFrom: "",
    registeredTo: "",
    sort: "registered_desc",
    page: 1,
  });
  const [data, setData] = useState<AthleteListResult | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : "La liste n'a pas pu être chargée.");
  const [showFilters, setShowFilters] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(openRegister);
  const [pending, startTransition] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      startTransition(async () => {
        const res = await safeAction(() =>
          listAthletes({
            ...filters,
            registeredFrom: filters.registeredFrom || undefined,
            registeredTo: filters.registeredTo || undefined,
          }),
        );
        if (res.ok) {
          setData(res.data);
          setError(null);
        } else setError(res.message);
      });
    }, 220);
    return () => window.clearTimeout(id);
  }, [filters]);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const hasDateFilter = Boolean(filters.registeredFrom || filters.registeredTo);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Rechercher par matricule"
            placeholder="Rechercher un matricule…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value.toUpperCase() })}
            className="h-11 pl-9 font-semibold tracking-[0.06em]"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Trier par" value={filters.sort} onChange={(e) => update({ sort: e.target.value as AthleteSort })} className="h-11 w-auto">
            {ATHLETE_SORTS.map((s) => (
              <option key={s} value={s}>
                Tri : {ATHLETE_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="lg" className="h-11" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <SlidersHorizontal />
            Période d&apos;inscription
            {hasDateFilter ? <span className="size-2 rounded-full bg-gold-500" aria-label="filtre actif" /> : null}
          </Button>
          <Button size="lg" className="h-11 lg:ml-2" onClick={() => setRegisterOpen(true)}>
            <UserPlus />
            Enregistrer un sportif
          </Button>
        </div>
      </div>

      {showFilters ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 animate-slide-up">
          <label className="text-[13px] font-semibold text-ink-soft">
            Inscrits depuis le
            <Input type="date" className="mt-1.5 w-44" value={filters.registeredFrom} max={today} onChange={(e) => update({ registeredFrom: e.target.value })} />
          </label>
          <label className="text-[13px] font-semibold text-ink-soft">
            jusqu&apos;au
            <Input type="date" className="mt-1.5 w-44" value={filters.registeredTo} max={today} onChange={(e) => update({ registeredTo: e.target.value })} />
          </label>
          {hasDateFilter ? (
            <Button variant="ghost" onClick={() => update({ registeredFrom: "", registeredTo: "" })}>
              <X />
              Effacer
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrer par statut">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => update({ status: s.value })}
            aria-pressed={filters.status === s.value}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              filters.status === s.value
                ? "border-pitch-800 bg-pitch-800 text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <InlineAlert tone="danger" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {data && data.rows.length > 0 ? (
          <>
            <TableContainer className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <Th>Matricule</Th>
                    <Th>Statut</Th>
                    <Th>Abonnement</Th>
                    <Th>Inscription</Th>
                    <Th>Dernière visite</Th>
                    <Th className="text-right">Visites</Th>
                    <Th>
                      <span className="sr-only">Ouvrir</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {data.rows.map((a) => (
                    <Tr key={a.id} className="group relative">
                      <Td>
                        <Link href={`/sportifs/${a.id}`} className="font-display text-lg font-semibold tracking-[0.08em] text-ink after:absolute after:inset-0 hover:text-pitch-700">
                          {formatMatricule(a.matricule ?? "")}
                        </Link>
                      </Td>
                      <Td>
                        <ValidityBadge status={(a.status ?? "none") as SubscriptionValidity | "none"} expiringSoon={a.expiring_soon ?? false} />
                      </Td>
                      <Td>
                        {a.ends_on ? (
                          <span className="leading-tight">
                            <span className="block text-ink">{a.plan_name ?? "Personnalisée"}</span>
                            <span className="block text-xs text-ink-muted">
                              {a.status === "upcoming" ? `Début le ${formatDate(a.starts_on)}` : `Fin le ${formatDate(a.ends_on)}`}
                              {a.status === "active" ? ` · ${formatRelativeDays(a.days_remaining)}` : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                      <Td className="tabular">{formatDate(a.registered_on)}</Td>
                      <Td className="tabular">{a.last_visit_at ? formatDateTime(a.last_visit_at, timezone) : <span className="text-ink-faint">Jamais</span>}</Td>
                      <Td className="tabular text-right font-semibold text-ink">{formatNumber(a.visit_count)}</Td>
                      <Td className="relative w-10">
                        <ChevronRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>

            <ul className="divide-y divide-line md:hidden">
              {data.rows.map((a) => (
                <li key={a.id}>
                  <Link href={`/sportifs/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-muted">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl font-semibold tracking-[0.08em] text-ink">{formatMatricule(a.matricule ?? "")}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {a.ends_on ? `${a.plan_name ?? "Personnalisée"} · fin ${formatDate(a.ends_on)}` : "Aucun abonnement"}
                      </p>
                    </div>
                    <ValidityBadge status={(a.status ?? "none") as SubscriptionValidity | "none"} expiringSoon={a.expiring_soon ?? false} />
                    <ChevronRight className="size-4 text-ink-faint" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              disabled={pending}
              itemLabel="sportifs"
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        ) : (
          <EmptyState
            icon={<Users />}
            title={filters.search || filters.status !== "all" || hasDateFilter ? "Aucun résultat" : "Aucun sportif enregistré"}
            description={
              filters.search || filters.status !== "all" || hasDateFilter
                ? "Aucun sportif ne correspond à ces critères. Modifiez la recherche ou les filtres."
                : "Enregistrez le premier sportif à partir de son matricule."
            }
            action={
              filters.search || filters.status !== "all" || hasDateFilter ? (
                <Button variant="secondary" onClick={() => setFilters({ search: "", status: "all", registeredFrom: "", registeredTo: "", sort: filters.sort, page: 1 })}>
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Button onClick={() => setRegisterOpen(true)}>
                  <UserPlus />
                  Enregistrer un sportif
                </Button>
              )
            }
          />
        )}
      </Card>

      <RegisterAthleteDialog open={registerOpen} onOpenChange={setRegisterOpen} plans={plans} today={today} defaultCurrency={defaultCurrency} />
    </>
  );
}
