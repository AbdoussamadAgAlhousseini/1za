"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LogOut, Menu, X } from "lucide-react";
import { BrandLockup, BrandMark, TrackLines } from "@/components/brand/brand";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, type AppRole } from "@/lib/domain/status";
import { signOut } from "@/server/actions/auth";
import { navigationFor } from "./navigation";

interface ShellUser {
  displayName: string;
  role: AppRole;
  stadiumName: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="space-y-6">
      {navigationFor(role).map((section) => (
        <div key={section.title}>
          <p className="eyebrow mb-2 px-3 text-[0.72rem] text-pitch-300/80">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                      active ? "bg-white/10 text-white" : "text-pitch-100/85 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-gold-400 transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <Icon className={cn("size-[18px]", active ? "text-gold-300" : "text-pitch-300 group-hover:text-pitch-100")} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserPanel({ user }: { user: ShellUser }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.06] p-2.5 ring-1 ring-white/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-400 text-sm font-bold text-pitch-950" aria-hidden="true">
        {initials(user.displayName)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
        <p className="truncate text-xs text-pitch-200">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="grid size-9 place-items-center rounded-md text-pitch-200 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function SidebarContent({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-pitch-900">
      <TrackLines className="absolute -bottom-40 -left-24 w-[640px] max-w-none text-pitch-400 opacity-50" />
      <div className="relative px-5 pb-6 pt-6">
        <BrandLockup tone="light" stadiumName={user.stadiumName} />
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 pb-6">
        <NavLinks role={user.role} onNavigate={onNavigate} />
      </div>
      <div className="relative border-t border-white/10 p-3">
        <UserPanel user={user} />
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#contenu"
        className="sr-only z-[60] rounded-md bg-pitch-800 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>

      <div className="no-print hidden bg-pitch-900 lg:block">
        <aside className="sticky top-0 h-dvh">
          <SidebarContent user={user} />
        </aside>
      </div>

      <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-pitch-950/40 bg-pitch-900 px-4 text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Accueil">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold uppercase tracking-[0.06em]">{user.stadiumName}</span>
        </Link>
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
            <button type="button" className="grid size-10 place-items-center rounded-md hover:bg-white/10" aria-label="Ouvrir le menu">
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-pitch-950/50 data-[state=open]:animate-fade-in" />
            <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[min(86vw,300px)] shadow-overlay data-[state=open]:animate-slide-up focus:outline-none">
              <DialogPrimitive.Title className="sr-only">Menu de navigation</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">Accès aux différentes sections de l&apos;application</DialogPrimitive.Description>
              <SidebarContent user={user} onNavigate={() => setOpen(false)} />
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="absolute right-3 top-6 grid size-9 place-items-center rounded-md text-pitch-100 hover:bg-white/10"
                  aria-label="Fermer le menu"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      <main id="contenu" className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
        <div className="mx-auto w-full max-w-[1320px]">{children}</div>
      </main>
    </div>
  );
}
