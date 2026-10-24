import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { listAudit } from "@/server/actions/lists";
import { PageHeader } from "@/components/ui/page-header";
import { AuditTable } from "@/components/settings/audit-table";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function AuditPage() {
  const staff = await requireAdmin();
  const initial = await listAudit({});
  return (
    <>
      <PageHeader eyebrow="Analyse" title="Journal d'audit" description="Qui a fait quoi, et quand : opérations administratives sensibles, corrections et exports." />
      <AuditTable initial={initial.ok ? initial.data : null} timezone={staff.timezone} />
    </>
  );
}
