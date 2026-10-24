import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, DoorOpen, Footprints, History, Timer } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAthleteDetail } from "@/server/queries/athletes";
import { getPlans, getSettings, getToday } from "@/server/queries/common";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ValidityBadge, VisitStatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AttendancePanel } from "@/components/charts/attendance-panel";
import { SubscriptionHistory } from "@/components/athletes/subscription-history";
import { AthleteHeaderActions } from "@/components/athletes/athlete-header-actions";
import { formatDate, formatDateTime, formatDuration, formatNumber, formatRelativeDays, formatTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import type { SubscriptionValidity } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Fiche sportif" };

export default async function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAdmin();
  const { id } = await params;
  const today = await getToday();
  const [detail, plans, settings] = await Promise.all([getAthleteDetail(id, today), getPlans(), getSettings()]);
  if (!detail) notFound();
  const { athlete, stats, attendance, subscriptions, payments, visits } = detail;
  const tz = staff.timezone;
  const status = (athlete.status ?? "none") as SubscriptionValidity | "none";
  const current = subscriptions.find((s) => s.validity === "active" || s.validity === "suspended");
  const latest = subscriptions.filter((s) => s.state !== "cancelled").sort((a, b) => (b.ends_on ?? "").localeCompare(a.ends_on ?? ""))[0];

  return (
    <>
      <Link href="/sportifs" className="no-print mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tous les sportifs
      </Link>

      <header className="mb-7 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="eyebrow text-gold-600">Fiche de suivi</p>
            <h1 className="mt-1 font-display text-5xl font-semibold uppercase tracking-[0.1em] text-ink">{formatMatricule(athlete.matricule ?? "")}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <ValidityBadge status={status} expiringSoon={athlete.expiring_soon ?? false} />
              {stats?.is_inside ? <Badge tone="info" icon={<DoorOpen aria-hidden="true" />}>Dans le stade</Badge> : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                Inscrit le {formatDate(athlete.registered_on, "long")}
              </span>
            </div>
          </div>
          <AthleteHeaderActions
            athleteId={athlete.id ?? ""}
            matricule={athlete.matricule ?? ""}
            renewal={latest ? { id: latest.id ?? "", endsOn: latest.ends_on ?? today, planId: latest.plan_id } : null}
            plans={plans}
            today={today}
            defaultCurrency={settings?.default_currency ?? "XOF"}
          />
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          <StatTile className="bg-surface px-5 py-4" label="Aujourd'hui" value={formatNumber(stats?.visits_today ?? 0)} hint="visite(s)" />
          <StatTile className="bg-surface px-5 py-4" label="Cette semaine" value={formatNumber(stats?.visits_week ?? 0)} hint="visite(s)" />
          <StatTile className="bg-surface px-5 py-4" label="Ce mois-ci" value={formatNumber(stats?.visits_month ?? 0)} hint="visite(s)" />
          <StatTile className="bg-surface px-5 py-4" label="Depuis l'inscription" value={formatNumber(stats?.visits_total ?? 0)} hint={`${formatNumber(stats?.completed_total ?? 0)} terminée(s)`} icon={<Footprints />} />
          <StatTile className="bg-surface px-5 py-4" label="Durée cumulée" value={formatDuration(stats?.total_duration_seconds ?? 0)} hint={`moyenne ${formatDuration(stats?.avg_duration_seconds)}`} icon={<Timer />} />
          <StatTile
            className="bg-surface px-5 py-4"
            label="Dernière visite"
            value={<span className="text-xl">{stats?.last_visit_at ? formatDate(stats.last_visit_at.slice(0, 10)) : "—"}</span>}
            hint={stats?.last_visit_at ? `à ${formatTime(stats.last_visit_at, tz)}` : "aucune visite"}
            icon={<Clock3 />}
          />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Fréquentation" title="60 derniers jours" description="Nombre de visites par jour" />
            <CardBody className="pt-5">
              <AttendancePanel data={attendance} granularity="day" height={220} showUnique={false} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Passages"
              title="Historique des visites"
              description="30 derniers passages"
              action={
                <Link href={`/frequentation?sportif=${athlete.id}`} className="text-sm font-semibold text-pitch-700 hover:underline">
                  Historique complet
                </Link>
              }
            />
            {visits.length ? (
              <TableContainer>
                <Table>
                  <THead>
                    <tr>
                      <Th>Entrée</Th>
                      <Th>Sortie</Th>
                      <Th>Durée</Th>
                      <Th>Statut</Th>
                      <Th>Agent</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {visits.map((v) => (
                      <Tr key={v.id}>
                        <Td className="tabular whitespace-nowrap">{formatDateTime(v.entered_at, tz)}</Td>
                        <Td className="tabular whitespace-nowrap">{v.exited_at ? formatTime(v.exited_at, tz) : "—"}</Td>
                        <Td className="tabular">{formatDuration(v.duration_seconds)}</Td>
                        <Td>
                          <VisitStatusBadge status={v.status ?? "open"} corrected={Boolean(v.corrected_at)} />
                        </Td>
                        <Td className="whitespace-nowrap">{v.entry_agent_name ?? "—"}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState compact icon={<History />} title="Aucun passage" description="Les entrées et sorties de ce sportif apparaîtront ici." />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {current ? (
            <Card className="border-pitch-200 bg-pitch-50/40">
              <CardBody>
                <p className="eyebrow text-pitch-700">Abonnement en cours</p>
                <p className="mt-1 text-lg font-semibold text-ink">{current.plan_name ?? "Formule personnalisée"}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Du {formatDate(current.starts_on)} au {formatDate(current.ends_on)} · fin {formatRelativeDays(current.days_remaining)}
                </p>
              </CardBody>
            </Card>
          ) : null}
          <SubscriptionHistory
            athleteId={athlete.id ?? ""}
            matricule={athlete.matricule ?? ""}
            subscriptions={subscriptions}
            payments={payments}
            defaultCurrency={settings?.default_currency ?? "XOF"}
            today={today}
          />
        </div>
      </div>
    </>
  );
}
