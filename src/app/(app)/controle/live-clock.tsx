"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

/** Horloge d'affichage uniquement : les horodatages enregistrés viennent du serveur. */
export function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const date = now
    ? new Intl.DateTimeFormat("fr-FR", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now)
    : "";
  const time = now ? new Intl.DateTimeFormat("fr-FR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(now) : "--:--";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 shadow-card">
      <Clock3 className="size-5 text-pitch-600" aria-hidden="true" />
      <div className="leading-tight">
        <p className="tabular font-display text-2xl font-semibold tracking-[0.04em]">{time}</p>
        <p className="text-xs capitalize text-ink-muted">{date}</p>
      </div>
    </div>
  );
}
