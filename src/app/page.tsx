import { redirect } from "next/navigation";
import { homePathFor, requireStaff } from "@/server/auth";

export default async function HomePage() {
  const staff = await requireStaff();
  redirect(homePathFor(staff.role));
}
