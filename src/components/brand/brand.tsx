import { cn } from "@/lib/cn";

/**
 * Identité PROVISOIRE : aucun logo officiel du Stade du 26 Mars n'a été fourni.
 * Pour intégrer le logo officiel, déposez-le dans `public/brand/` et remplacez
 * le contenu de <BrandMark> par une balise <img src="/brand/logo.svg" … />.
 */
export function BrandMark({ className, title = "Stade du 26 Mars (identité provisoire)" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title} className={cn("size-10 shrink-0", className)}>
      <rect width="48" height="48" rx="12" fill="var(--color-pitch-800)" />
      <rect x="5.5" y="9.5" width="37" height="29" rx="14.5" fill="none" stroke="var(--color-gold-400)" strokeWidth="1.5" />
      <rect x="9.5" y="13.5" width="29" height="21" rx="10.5" fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth="1" />
      <text
        x="24"
        y="30.5"
        textAnchor="middle"
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
        fontWeight="700"
        fontSize="17"
        letterSpacing="0.5"
        fill="#ffffff"
      >
        26
      </text>
    </svg>
  );
}

export function BrandLockup({
  stadiumName = "Stade du 26 Mars",
  tone = "dark",
  subtitle = "Gestion des sportifs",
  className,
}: {
  stadiumName?: string;
  tone?: "dark" | "light";
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            "truncate font-display text-[1.15rem] font-semibold uppercase tracking-[0.06em]",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          {stadiumName}
        </p>
        <p className={cn("truncate text-xs", tone === "light" ? "text-pitch-200" : "text-ink-muted")}>{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Motif signature : piste d'athlétisme ovale (8 couloirs), en filigrane.
 * Le conteneur choisit la taille et la position pour laisser apparaître un virage.
 */
export function TrackLines({ className }: { className?: string }) {
  const lanes = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg viewBox="0 0 1000 560" fill="none" aria-hidden="true" className={cn("pointer-events-none", className)}>
      {lanes.map((i) => {
        const inset = i * 26;
        const h = 520 - inset * 2;
        return (
          <rect
            key={i}
            x={20 + inset}
            y={20 + inset}
            width={960 - inset * 2}
            height={h}
            rx={h / 2}
            stroke="currentColor"
            strokeWidth={i === 0 || i === 7 ? 1.6 : 1}
            opacity={i === 0 ? 0.6 : i === 7 ? 0.45 : 0.22}
          />
        );
      })}
      <line x1="500" y1="20" x2="500" y2="202" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
    </svg>
  );
}
