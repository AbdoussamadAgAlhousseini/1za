import { AppShell } from "@/components/layout/app-shell";
import { requireStaff } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <AppShell user={{ displayName: staff.displayName, role: staff.role, stadiumName: staff.stadiumName }}>{children}</AppShell>
  );
}
