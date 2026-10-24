import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlans, getSettings, getToday } from "@/server/queries/common";
import { listSubscriptions } from "@/server/actions/lists";
import { addDays } from "@/lib/domain/periods";
import { PageHeader } from "@/components/ui/page-header";
import { RenewalsBoard, type RenewalRow } from "@/components/subscriptions/renewals-board";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Abonnements" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const view = params.vue === "tous" ? "tous" : "renouveler";
  const [today, plans, settings] = await Promise.all([getToday(), getPlans(), getSettings()]);
  const currency = settings?.default_currency ?? "XOF";

  let content: React.ReactNode;
  if (view === "renouveler") {
    const supabase = await createClient();
    const cols = "id, matricule, subscription_id, plan_id, plan_name, ends_on, days_remaining";
    const [expiring, expired] = await Promise.all([
      supabase.from("athlete_overview").select(cols).eq("expiring_soon", true).order("ends_on").limit(100),
      supabase
        .from("athlete_overview")
        .select(cols)
        .eq("status", "expired")
        .gte("ends_on", addDays(today, -60))
        .order("ends_on", { ascending: false })
        .limit(100),
    ]);
    const toRow = (r: NonNullable<typeof expiring.data>[number]): RenewalRow => ({
      id: r.id ?? "",
      matricule: r.matricule ?? "",
      subscription_id: r.subscription_id ?? "",
      plan_id: r.plan_id,
      plan_name: r.plan_name,
      ends_on: r.ends_on ?? today,
      days_remaining: r.days_remaining ?? 0,
    });
    content = (
      <RenewalsBoard
        expiring={(expiring.data ?? []).map(toRow)}
        expired={(expired.data ?? []).map(toRow)}
        plans={plans}
        today={today}
        defaultCurrency={currency}
        expiringDays={settings?.expiring_soon_days ?? 7}
      />
    );
  } else {
    const initial = await listSubscriptions({});
    content = <SubscriptionsTable initial={initial.ok ? initial.data : null} plans={plans} currency={currency} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestion"
        title="Abonnements"
        description="Validité calculée par le serveur selon les dates (fin incluse, fuseau du stade). Un renouvellement crée un nouvel abonnement et conserve l'historique."
      />
      <nav className="mb-6 flex gap-6 border-b border-line" aria-label="Vues des abonnements">
        {[
          { key: "renouveler", label: "À renouveler", href: "/abonnements" },
          { key: "tous", label: "Tous les abonnements", href: "/abonnements?vue=tous" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={view === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors",
              view === t.key ? "border-pitch-700 text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}
