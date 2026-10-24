import { ShieldCheck, Timer, BarChart3 } from "lucide-react";
import { BrandLockup, BrandMark, TrackLines } from "@/components/brand/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-pitch-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <TrackLines className="absolute -bottom-[34%] left-[16%] w-[150%] max-w-none text-pitch-300" />
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(14_148_102/0.35),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <BrandLockup tone="light" subtitle="Bamako · Gestion des sportifs" />
        </div>

        <div className="relative max-w-lg">
          <p className="eyebrow text-gold-300">Espace réservé au personnel</p>
          <h1 className="mt-3 font-display text-5xl font-semibold uppercase leading-[0.95] tracking-[0.01em] xl:text-6xl">
            Chaque entrée,
            <br />
            contrôlée en
            <br />
            quelques secondes.
          </h1>
          <ul className="mt-10 space-y-4 text-[15px] text-pitch-100">
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <ShieldCheck className="size-[18px] text-gold-300" aria-hidden="true" />
              </span>
              Vérification immédiate des abonnements par matricule
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <Timer className="size-[18px] text-gold-300" aria-hidden="true" />
              </span>
              Entrées et sorties horodatées par le serveur
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <BarChart3 className="size-[18px] text-gold-300" aria-hidden="true" />
              </span>
              Fréquentation et statistiques en temps réel
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-pitch-300">
          Identité visuelle provisoire — en attente de la charte officielle du stade.
        </p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold uppercase tracking-[0.06em]">Stade du 26 Mars</p>
              <p className="text-xs text-ink-muted">Gestion des sportifs</p>
            </div>
          </div>
          {children}
          <p className="mt-12 text-center text-xs text-ink-faint">
            Accès strictement réservé au personnel autorisé. Toutes les opérations sont journalisées.
          </p>
        </div>
      </main>
    </div>
  );
}
