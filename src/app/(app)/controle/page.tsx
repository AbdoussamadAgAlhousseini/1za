import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { loadControlPanel } from "@/server/actions/control";
import { ControlStation } from "./control-station";

export const metadata: Metadata = { title: "Contrôle d'accès" };

export default async function ControlPage() {
  const staff = await requireStaff();
  const panel = await loadControlPanel();

  return (
    <ControlStation
      timezone={staff.timezone}
      agentId={staff.userId}
      agentName={staff.displayName}
      initialPanel={panel.ok ? panel.data : null}
    />
  );
}
