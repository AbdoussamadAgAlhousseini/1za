import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionLookup } from "@/server/auth";
import { buildExport, EXPORT_KINDS, type ExportKind } from "@/server/exports";
import { validatePeriod } from "@/lib/domain/periods";
import { extractErrorCode, ERROR_MESSAGES } from "@/lib/domain/errors";

const schema = z.object({
  kind: z.enum(Object.keys(EXPORT_KINDS) as [ExportKind, ...ExportKind[]]),
  from: z.string(),
  to: z.string(),
});

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function plain(status: number, message: string) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

/**
 * Export CSV (POST uniquement : aucun paramètre dans les URL ni les journaux
 * d'accès). Réservé aux administrateurs, limité en débit et journalisé.
 */
export async function POST(request: NextRequest) {
  // Protection CSRF : la requête doit provenir de l'application elle-même.
  if (!isSameOrigin(request)) return plain(403, "Origine refusée.");

  const lookup = await getSessionLookup();
  if (lookup.status !== "ok" || lookup.staff.role !== "admin") return plain(403, ERROR_MESSAGES.ERR_FORBIDDEN);

  const form = await request.formData();
  const parsed = schema.safeParse({ kind: form.get("kind"), from: form.get("from"), to: form.get("to") });
  const period = parsed.success ? validatePeriod(parsed.data.from, parsed.data.to) : null;
  if (!parsed.success || !period) return plain(400, "Paramètres d'export invalides.");

  const supabase = await createClient();
  // Journalisation + limitation de débit AVANT la génération.
  const { error } = await supabase.rpc("admin_log_export", { p_kind: parsed.data.kind, p_params: { from: period.from, to: period.to } });
  if (error) {
    const code = extractErrorCode(error);
    return plain(code === "ERR_RATE_LIMITED" ? 429 : 403, code ? ERROR_MESSAGES[code] : "Export impossible.");
  }

  const csv = await buildExport(supabase, parsed.data.kind, period, lookup.staff.timezone);
  const filename = `stade26-${parsed.data.kind}-${period.from}_${period.to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
