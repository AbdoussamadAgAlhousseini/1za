import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CloudOff,
  Clock3,
  DoorOpen,
  Hourglass,
  PauseCircle,
  ScanLine,
  Timer,
  UserPlus,
  Users,
  XCircle,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getDashboardData } from "@/server/queries/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { VisitStatusBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AttendancePanel } from "@/components/charts/attendance-panel";
import { StatusDistribution } from "@/components/charts/status-distribution";
import { formatDate, formatDuration, formatMoney, formatNumber, formatRelativeDays, formatTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireAdmin();
  const { stats, attendance, expiring, expired, recent, offlineIssues } = await getDashboardData();
  const params = await searchParams;
  const tz = staff.timezone;

  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${stats.today}T12:00:00Z`));

  const revenue = stats.revenue_month.length
    ? stats.revenue_month.map((r) => formatMoney(r.total, r.currency)).join(" · ")
    : formatMoney(0, "XOF");

  return (
    <>
      <PageHeader
        eyebrow={todayLabel}
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité du stade, calculée en temps réel à partir des données enregistrées."
        actions={
          <>
            <Link href="/controle" className={buttonVariants({ variant: "secondary" })}>
              <ScanLine />
              Contrôle d&apos;accès
            </Link>
            <Link href="/sportifs?nouveau=1" className={buttonVariants()}>
              <UserPlus />
              Enregistrer un sportif
            </Link>
          </>
        }
      />

      {params["mot-de-passe"] === "modifie" ? (
        <InlineAlert tone="success" icon={<CheckCircle2 />} className="mb-6">
          Votre mot de passe a été modifié.
        </InlineAlert>
      ) : null}

      {offlineIssues > 0 ? (
        <InlineAlert tone="warning" icon={<CloudOff />} title="Opérations hors ligne à vérifier" className="mb-6">
          {offlineIssues} entrée(s) ou sortie(s) enregistrée(s) sans réseau n&apos;ont pas pu être appliquées.{" "}
          <Link href="/frequentation" className="font-semibold underline underline-offset-2">
            Vérifier
          </Link>
        </InlineAlert>
      ) : null}

      {stats.long_open_visits > 0 ? (
        <InlineAlert tone="warning" icon={<Clock3 />} title="Entrées ouvertes depuis longtemps" className="mb-6">
          {stats.long_open_visits} passage(s) sans sortie depuis plusieurs heures.{" "}
          <Link href="/frequentation?statut=open" className="font-semibold underline underline-offset-2">
            Vérifier et corriger
          </Link>
        </InlineAlert>
      ) : null}

      {/* Aujourd'hui */}
      <section aria-labelledby="today-title" className="mb-6 overflow-hidden rounded-xl bg-pitch-900 text-white shadow-raised">
        <div className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-[1.25fr_repeat(3,1fr)]">
          <div className="col-span-2 bg-pitch-900 px-5 py-5 sm:px-7 sm:py-6 lg:col-span-1">
            <p id="today-title" className="eyebrow text-gold-300">Aujourd&apos;hui</p>
            <p className="mt-2 text-5xl font-semibold leading-none tracking-[-0.02em] sm:mt-3 sm:text-[3.5rem]">{formatNumber(stats.entries_today)}</p>
            <p className="mt-2 text-sm text-pitch-100">
              entrée{stats.entries_today > 1 ? "s" : ""} enregistrée{stats.entries_today > 1 ? "s" : ""}
            </p>
          </div>
          {[
            { label: "Sportifs uniques", value: stats.unique_today, hint: "matricules distincts", icon: Users },
            { label: "Présents maintenant", value: stats.present_now, hint: "entrées sans sortie", icon: DoorOpen },
            { label: "Visites terminées", value: stats.completed_today, hint: "avec sortie enregistrée", icon: CheckCircle2 },
          ].map(({ label, value, hint, icon: Icon }) => (
            <div key={label} className="bg-pitch-900 px-5 py-4 last:col-span-2 sm:px-6 sm:py-6 lg:last:col-span-1">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-pitch-200">
                <Icon className="size-4 text-pitch-300" aria-hidden="true" />
                {label}
              </p>
              <p className="mt-2 text-3xl font-semibold leading-none sm:mt-3 sm:text-4xl">{formatNumber(value)}</p>
              <p className="mt-2 text-xs text-pitch-300">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            eyebrow="Fréquentation"
            title="30 derniers jours"
            description="Entrées par jour et nombre de sportifs distincts"
            action={
              <Link href="/rapports" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Rapports détaillés
                <ArrowRight />
              </Link>
            }
          />
          <CardBody className="pt-5">
            <AttendancePanel data={attendance} granularity="day" />
          </CardBody>
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
            <StatTile className="bg-surface px-5 py-4" label="Entrées cette semaine" value={formatNumber(stats.entries_week)} hint={`${formatNumber(stats.unique_week)} sportifs uniques`} />
            <StatTile className="bg-surface px-5 py-4" label="Entrées ce mois-ci" value={formatNumber(stats.entries_month)} hint={`${formatNumber(stats.unique_month)} sportifs uniques`} />
            <StatTile className="bg-surface px-5 py-4" label="Visites terminées" value={formatNumber(stats.completed_month)} hint="ce mois-ci" />
            <StatTile className="bg-surface px-5 py-4" label="Durée moyenne" value={formatDuration(stats.avg_duration_month_seconds)} hint="visites du mois" icon={<Timer />} />
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Abonnements"
            title={`${formatNumber(stats.athletes_total)} sportifs enregistrés`}
            description={`dont ${formatNumber(stats.athletes_new_month)} inscrits ce mois-ci`}
          />
          <CardBody>
            <StatusDistribution
              total={stats.athletes_total}
              items={[
                { key: "active", label: "Actifs", value: stats.status_active - stats.status_expiring_soon, swatch: "bg-success-600", icon: <CheckCircle2 /> },
                { key: "soon", label: "Expirent bientôt", value: stats.status_expiring_soon, swatch: "bg-warning-600", icon: <AlertTriangle /> },
                { key: "expired", label: "Expirés", value: stats.status_expired, swatch: "bg-danger-600", icon: <XCircle /> },
                { key: "upcoming", label: "Pas encore valides", value: stats.status_upcoming, swatch: "bg-info-600", icon: <Hourglass /> },
                { key: "suspended", label: "Suspendus", value: stats.status_suspended, swatch: "bg-ink-soft", icon: <PauseCircle /> },
                { key: "none", label: "Sans abonnement", value: stats.status_none, swatch: "bg-line-strong", icon: <CircleDashed /> },
              ]}
            />
          </CardBody>
          <div className="border-t border-line px-5 py-3">
            <Link href="/abonnements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pitch-700 hover:underline">
              Gérer les abonnements
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            eyebrow="À traiter"
            title="Renouvellements à prévoir"
            description="Abonnements actifs se terminant bientôt, sans renouvellement"
            action={
              <Link href="/abonnements?vue=renouveler" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Tout voir
              </Link>
            }
          />
          {expiring.length ? (
            <ul className="divide-y divide-line">
              {expiring.map((a) => (
                <li key={a.id}>
                  <Link href={`/sportifs/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted">
                    <span className="grid size-8 place-items-center rounded-full bg-warning-50 text-warning-700">
                      <CalendarClock className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold tracking-[0.06em] text-ink">{formatMatricule(a.matricule ?? "")}</span>
                      <span className="block text-xs text-ink-muted">{a.plan_name ?? "Formule personnalisée"}</span>
                    </span>
                    <span className="ml-auto text-right text-[13px]">
                      <span className="block font-semibold text-warning-700">Fin {formatRelativeDays(a.days_remaining)}</span>
                      <span className="block text-xs text-ink-muted">{formatDate(a.ends_on)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="Rien à renouveler" description="Aucun abonnement ne se termine dans les prochains jours." />
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Relance"
            title="Expirés récemment"
            description="Abonnements terminés au cours des 30 derniers jours"
            action={
              <Link href="/sportifs?statut=expired" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Tout voir
              </Link>
            }
          />
          {expired.length ? (
            <ul className="divide-y divide-line">
              {expired.map((a) => (
                <li key={a.id}>
                  <Link href={`/sportifs/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted">
                    <span className="grid size-8 place-items-center rounded-full bg-danger-50 text-danger-700">
                      <XCircle className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold tracking-[0.06em] text-ink">{formatMatricule(a.matricule ?? "")}</span>
                      <span className="block text-xs text-ink-muted">{a.plan_name ?? "Formule personnalisée"}</span>
                    </span>
                    <span className="ml-auto text-right text-[13px]">
                      <span className="block font-semibold text-danger-700">Expiré {formatRelativeDays(a.days_remaining)}</span>
                      <span className="block text-xs text-ink-muted">{formatDate(a.ends_on)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="Aucune expiration récente" description="Aucun abonnement n'a expiré ces 30 derniers jours." />
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          <Card>
            <CardHeader eyebrow="Ce mois-ci" title="Ventes et recettes" />
            <div className="grid grid-cols-2 gap-px bg-line">
              <StatTile className="bg-surface px-5 py-4" label="Nouveaux abonnements" value={formatNumber(stats.new_subscriptions_month)} icon={<Wallet />} />
              <StatTile className="bg-surface px-5 py-4" label="Renouvellements" value={formatNumber(stats.renewals_month)} icon={<RefreshCw />} />
            </div>
            <div className="border-t border-line px-5 py-4">
              <p className="text-[13px] font-medium text-ink-muted">Paiements enregistrés</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{revenue}</p>
              <p className="mt-1 text-xs text-ink-muted">Saisis manuellement, hors intégration bancaire.</p>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="En direct"
              title="Derniers passages"
              action={
                <Link href="/frequentation" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Historique
                </Link>
              }
            />
            {recent.length ? (
              <ul className="divide-y divide-line">
                {recent.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="tabular w-11 shrink-0 text-ink-muted">{formatTime(v.entered_at, tz)}</span>
                    <Link href={`/sportifs/${v.athlete_id}`} className="font-semibold tracking-[0.04em] text-ink hover:underline">
                      {formatMatricule(v.matricule ?? "")}
                    </Link>
                    <span className={cn("ml-auto")}>
                      {v.status === "open" ? (
                        <VisitStatusBadge status="open" />
                      ) : (
                        <span className="tabular text-[13px] text-ink-muted">{formatDuration(v.duration_seconds)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<ScanLine />} title="Aucun passage" description="Les entrées apparaîtront ici dès le premier contrôle." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
