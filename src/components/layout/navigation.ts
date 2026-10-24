import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck2,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  Settings2,
  UserCog,
  Users,
  Wallet,
  Footprints,
  KeyRound,
} from "lucide-react";
import type { AppRole } from "@/lib/domain/status";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_NAV: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/controle", label: "Contrôle d'accès", icon: ScanLine },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/sportifs", label: "Sportifs", icon: Users },
      { href: "/abonnements", label: "Abonnements", icon: CalendarCheck2 },
      { href: "/frequentation", label: "Fréquentation", icon: Footprints },
      { href: "/paiements", label: "Paiements", icon: Wallet },
    ],
  },
  {
    title: "Analyse",
    items: [
      { href: "/rapports", label: "Rapports", icon: BarChart3 },
      { href: "/journal", label: "Journal d'audit", icon: ScrollText },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/personnel", label: "Personnel", icon: UserCog },
      { href: "/parametres", label: "Paramètres", icon: Settings2 },
      { href: "/mon-compte", label: "Mon compte", icon: KeyRound },
    ],
  },
];

const AGENT_NAV: NavSection[] = [
  { title: "Service", items: [{ href: "/controle", label: "Contrôle d'accès", icon: ScanLine }] },
  { title: "Compte", items: [{ href: "/mon-compte", label: "Mon compte", icon: KeyRound }] },
];

export function navigationFor(role: AppRole): NavSection[] {
  return role === "admin" ? ADMIN_NAV : AGENT_NAV;
}
