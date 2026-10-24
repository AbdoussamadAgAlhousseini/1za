import type { Metadata } from "next";
import { Timer, Users, LogIn, CheckCircle2, UserPlus, RefreshCw, CalendarPlus, Hourglass } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/server/queries/common";
import { defaultGranularity, resolvePreset, validatePeriod, type Granularity } from "@/lib/domain/periods";
import { formatDate, formatDateTime, formatDuration, formatMoney, formatNumber } from "@/lib/domain/format";
import type { AttendancePoint } from "@/lib/stats-types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AttendancePanel } from "@/components/charts/attendance-panel";
import { PeriodPicker } from "@/components/reports/period-picker";
import { PeakHeatmap } from "@/components/reports/peak-heatmap";
import { ExportPanel } from "@/components/reports/export-panel";

export const metadata: Metadata = { title: "Rapports" };

interface Summary {
  entries: number;
  unique_athletes: number;
  completed: number;
  open: number;
  avg_duration_seconds: number | null;
  total_duration_seconds: number;
  new_athletes: number;
  subscriptions_new: number;
  subscriptions_renewed: number;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const today = await getToday();
  const period = validatePeriod(params.du, params.au) ?? resolvePreset("30d", today);
  const granularity: Granularity = ["day", "week", "month"].includes(params.pas ?? "") ? (params.pas as Granularity) : defaultGranularity(period);

  const supabase = await createClient();
  const [summaryRes, attendanceRes, peaksRes, agentsRes, revenueRes] = await Promise.all([
    supabase.rpc("stats_period_summary", { p_from: period.from, p_to: period.to }),
    supabase.rpc("stats_attendance", { p_from: period.from, p_to: period.to, p_granularity: granularity }),
    supabase.rpc("stats_peak_hours", { p_from: period.from, p_to: period.to }),
    supabase.rpc("stats_agents", { p_from: period.from, p_to: period.to }),
    supabase.rpc("stats_revenue", { p_from: period.from, p_to: period.to }),
  ]);
  const summary = (summaryRes.data ?? {}) as unknown as Summary;
  const attendance = (attendanceRes.data ?? []) as AttendancePoint[];
  const agents = (agentsRes.data ?? []).filter((a) => a.entries_recorded + a.exits_recorded > 0 || (a.role === "agent" && a.is_active));
  const revenue = revenueRes.data ?? [];
  const totals = new Map<string, number>();
  for (const r of revenue) totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.total));

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Rapports"
        description={`Du ${formatDate(period.from, "long")} au ${formatDate(period.to, "long")} · calculs effectués dans PostgreSQL à partir des passages enregistrés (heure du stade).`}
      />
      <PeriodPicker from={period.from} to={period.to} granularity={granularity} today={today} />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          <StatTile className="bg-surface px-5 py-5" icon={<LogIn />} label="Entrées" value={formatNumber(summary.entries)} hint="passages non annulés" />
          <StatTile className="bg-surface px-5 py-5" icon={<Users />} label="Sportifs uniques" value={formatNumber(summary.unique_athletes)} hint="matricules distincts sur la période" />
          <StatTile className="bg-surface px-5 py-5" icon={<CheckCircle2 />} label="Visites terminées" value={formatNumber(summary.completed)} hint={`${formatNumber(summary.open)} encore ouverte(s)`} />
          <StatTile className="bg-surface px-5 py-5" icon={<Timer />} label="Durée moyenne" value={formatDuration(summary.avg_duration_seconds)} hint={`cumul ${formatDuration(summary.total_duration_seconds)}`} />
          <StatTile className="bg-surface px-5 py-5" icon={<UserPlus />} label="Nouveaux sportifs" value={formatNumber(summary.new_athletes)} hint="inscrits sur la période" />
          <StatTile className="bg-surface px-5 py-5" icon={<CalendarPlus />} label="Nouveaux abonnements" value={formatNumber(summary.subscriptions_new)} hint="débutant sur la période" />
          <StatTile className="bg-surface px-5 py-5" icon={<RefreshCw />} label="Renouvellements" value={formatNumber(summary.subscriptions_renewed)} hint="débutant sur la période" />
          <StatTile
            className="bg-surface px-5 py-5"
            icon={<Hourglass />}
            label="Paiements enregistrés"
            value={<span className="text-xl">{totals.size ? [...totals.entries()].map(([c, t]) => formatMoney(t, c)).join(" · ") : formatMoney(0, "XOF")}</span>}
            hint="saisis manuellement"
          />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader eyebrow="Fréquentation" title="Évolution sur la période" description="Entrées et sportifs distincts par période de regroupement" />
        <CardBody className="pt-5">
          <AttendancePanel data={attendance} granularity={granularity} height={300} />
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader eyebrow="Affluence" title="Périodes de forte fréquentation" description="Entrées par jour de la semaine et par heure d'arrivée" />
        <CardBody>
          <PeakHeatmap data={peaksRes.data ?? []} />
        </CardBody>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Supervision" title="Activité des agents" description="Opérations enregistrées sur la période" />
          {agents.length ? (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <Th>Agent</Th>
                    <Th className="text-right">Entrées</Th>
                    <Th className="text-right">Sorties</Th>
                    <Th>Dernière opération</Th>
                  </tr>
                </THead>
                <TBody>
                  {agents.map((a) => (
                    <Tr key={a.profile_id}>
                      <Td className="font-semibold text-ink">
                        {a.display_name}
                        {!a.is_active ? <Badge tone="neutral" className="ml-2">Désactivé</Badge> : null}
                        {a.role === "admin" ? <Badge tone="info" className="ml-2">Admin</Badge> : null}
                      </Td>
                      <Td className="tabular text-right">{formatNumber(a.entries_recorded)}</Td>
                      <Td className="tabular text-right">{formatNumber(a.exits_recorded)}</Td>
                      <Td className="tabular whitespace-nowrap">{a.last_activity_at ? formatDateTime(a.last_activity_at, staff.timezone) : "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState compact icon={<Users />} title="Aucune activité" description="Aucune opération sur cette période." />
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader eyebrow="Recettes" title="Paiements par formule" description="Paiements enregistrés (non annulés) sur la période" />
            {revenue.length ? (
              <ul className="divide-y divide-line">
                {revenue.map((r) => (
                  <li key={`${r.currency}-${r.plan_name}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="text-ink-soft">
                      {r.plan_name} <span className="text-xs text-ink-faint">· {r.payments} paiement(s)</span>
                    </span>
                    <span className="tabular font-semibold text-ink">{formatMoney(r.total, r.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Hourglass />} title="Aucun paiement" description="Aucun paiement enregistré sur cette période." />
            )}
          </Card>
          <Card className="no-print">
            <CardHeader eyebrow="Exports" title="Télécharger les données" />
            <CardBody>
              <ExportPanel from={period.from} to={period.to} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
