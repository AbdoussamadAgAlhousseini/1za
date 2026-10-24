"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/server/auth";
import { fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import type { OfflineSnapshot, SyncResult } from "@/lib/offline/types";
import { reasonSchema, uuidSchema } from "@/lib/validation/common";

export async function getOfflineSnapshot(): Promise<ActionResult<OfflineSnapshot>> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("control_offline_snapshot");
  if (error || !data) return fromDbError(error, "control_offline_snapshot");
  return { ok: true, data: data as unknown as OfflineSnapshot };
}

const opsSchema = z
  .array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["entry", "exit"]),
      matricule: z.string().max(16),
      occurredAt: z.iso.datetime(),
    }),
  )
  .max(500);

export async function syncOfflineOperations(ops: unknown): Promise<ActionResult<SyncResult[]>> {
  await requireStaff();
  const parsed = opsSchema.safeParse(ops);
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.length === 0) return { ok: true, data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("control_sync_offline", {
    p_ops: parsed.data.map((o) => ({ id: o.id, kind: o.kind, matricule: o.matricule, occurred_at: o.occurredAt })),
  });
  if (error) return fromDbError(error, "control_sync_offline");
  revalidatePath("/frequentation");
  revalidatePath("/tableau-de-bord");
  return { ok: true, data: (data ?? []) as unknown as SyncResult[] };
}

export async function reviewOfflineOperation(input: { id: string; note: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: uuidSchema, note: reasonSchema }).safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_offline_operation", { p_id: parsed.data.id, p_note: parsed.data.note });
  if (error) return fromDbError(error, "admin_review_offline_operation");
  revalidatePath("/frequentation");
  revalidatePath("/tableau-de-bord");
  return { ok: true, data: undefined, message: "Opération marquée comme vérifiée." };
}
