import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/domain/format";

export interface DistributionItem {
  key: string;
  label: string;
  value: number;
  /** Classe de fond Tailwind (couleur de statut réservée). */
  swatch: string;
  icon: React.ReactNode;
}

/**
 * Répartition des sportifs par statut : barre empilée (espacement de 2 px
 * entre segments) + liste détaillée qui porte l'identité (icône + libellé).
 */
export function StatusDistribution({ items, total }: { items: DistributionItem[]; total: number }) {
  const visible = items.filter((i) => i.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label="Répartition des sportifs par statut d'abonnement">
        {total > 0
          ? visible.map((i) => (
              <span key={i.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", i.swatch)} style={{ width: `${(i.value / total) * 100}%` }} title={`${i.label} : ${i.value}`} />
            ))
          : null}
      </div>
      <ul className="mt-4 space-y-0.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-md px-1 py-1.5 text-sm">
            <span className={cn("size-2.5 shrink-0 rounded-[3px]", i.swatch)} aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-ink-soft [&_svg]:size-3.5 [&_svg]:text-ink-faint">
              {i.icon}
              {i.label}
            </span>
            <span className="tabular ml-auto font-semibold text-ink">{formatNumber(i.value)}</span>
            <span className="tabular w-11 text-right text-xs text-ink-muted">
              {total > 0 ? `${Math.round((i.value / total) * 100)} %` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
