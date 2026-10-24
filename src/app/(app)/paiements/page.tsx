import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/server/queries/common";
import { listPayments } from "@/server/actions/lists";
import { startOfMonth } from "@/lib/domain/periods";
import { formatDate, formatMoney, formatNumber } from "@/lib/domain/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { PaymentsTable } from "@/components/payments/payments-table";

export const metadata: Metadata = { title: "Paiements" };

export default async function PaymentsPage() {
  await requireAdmin();
  const today = await getToday();
  const monthStart = startOfMonth(today);
  const supabase = await createClient();
  const [initial, revenue] = await Promise.all([
    listPayments({ status: "recorded" }),
    supabase.rpc("stats_revenue", { p_from: monthStart, p_to: today }),
  ]);
  const rows = revenue.data ?? [];
  const byCurrency = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const cur = byCurrency.get(r.currency) ?? { total: 0, count: 0 };
    byCurrency.set(r.currency, { total: cur.total + Number(r.total), count: cur.count + r.payments });
  }

  return (
    <>
      <PageHeader eyebrow="Gestion" title="Paiements" description="Enregistrement des paiements reçus en dehors de l'application. Les données financières ne sont jamais visibles par les agents." />

      <InlineAlert tone="info" icon={<Info />} className="mb-6">
        Aucune intégration bancaire ou mobile money n&apos;est active : chaque paiement est saisi manuellement par l&apos;administration, sur la base d&apos;un justificatif.
      </InlineAlert>

      <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="bg-pitch-900 p-5 text-white">
          <p className="eyebrow text-gold-300">Ce mois-ci</p>
          <p className="mt-2 text-3xl font-semibold">
            {byCurrency.size ? [...byCurrency.entries()].map(([c, v]) => formatMoney(v.total, c)).join(" · ") : formatMoney(0, "XOF")}
          </p>
          <p className="mt-1 text-sm text-pitch-200">
            {formatNumber([...byCurrency.values()].reduce((s, v) => s + v.count, 0))} paiement(s) depuis le {formatDate(monthStart)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="eyebrow text-ink-faint">Par formule · ce mois-ci</p>
          {rows.length ? (
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {rows.map((r) => (
                <li key={`${r.currency}-${r.plan_name}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-soft">
                    {r.plan_name} <span className="text-xs text-ink-faint">× {r.payments}</span>
                  </span>
                  <span className="tabular font-semibold text-ink">{formatMoney(r.total, r.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Aucun paiement enregistré ce mois-ci.</p>
          )}
        </Card>
      </div>

      <PaymentsTable initial={initial.ok ? initial.data : null} initialFilters={{ search: "", method: "all", status: "recorded", from: "", to: "", page: 1 }} />
    </>
  );
}
