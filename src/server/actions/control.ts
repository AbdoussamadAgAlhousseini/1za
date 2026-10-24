"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/server/auth";
import { matriculeSchema } from "@/lib/validation/common";
import { fail, fromDbError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import type { ControlCheck, ControlPanelData, EntryReceipt, ExitReceipt } from "@/lib/control-types";
import { explainMatriculeError } from "@/lib/domain/matricule";

function parseMatricule(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const parsed = matriculeSchema.safeParse(typeof raw === "string" ? raw : "");
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, message: explainMatriculeError(typeof raw === "string" ? raw : "") ?? "Matricule invalide." };
}

export async function checkMatricule(raw: string): Promise<ActionResult<ControlCheck>> {
  await requireStaff();
  const m = parseMatricule(raw);
  if (!m.ok) return fail(m.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("control_check", { p_matricule: m.value });
  if (error) return fromDbError(error, "control_check");
  return { ok: true, data: data as unknown as ControlCheck };
}

export async function recordEntry(raw: string): Promise<ActionResult<EntryReceipt>> {
  await requireStaff();
  const m = parseMatricule(raw);
  if (!m.ok) return fail(m.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("control_record_entry", { p_matricule: m.value });
  if (error) return fromDbError(error, "control_record_entry");
  return { ok: true, data: data as unknown as EntryReceipt };
}

export async function recordExit(raw: string): Promise<ActionResult<ExitReceipt>> {
  await requireStaff();
  const m = parseMatricule(raw);
  if (!m.ok) return fail(m.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("control_record_exit", { p_matricule: m.value });
  if (error) return fromDbError(error, "control_record_exit");
  return { ok: true, data: data as unknown as ExitReceipt };
}

export async function loadControlPanel(): Promise<ActionResult<ControlPanelData>> {
  await requireStaff();
  const supabase = await createClient();
  const [overview, present, activity] = await Promise.all([
    supabase.rpc("control_overview"),
    supabase.rpc("control_present", { p_limit: 50 }),
    supabase.rpc("control_my_activity", { p_limit: 12 }),
  ]);
  const error = overview.error ?? present.error ?? activity.error;
  if (error) return fromDbError(error, "control_panel");
  return {
    ok: true,
    data: {
      overview: overview.data as unknown as ControlPanelData["overview"],
      present: present.data ?? [],
      activity: (activity.data ?? []) as ControlPanelData["activity"],
    },
  };
}
