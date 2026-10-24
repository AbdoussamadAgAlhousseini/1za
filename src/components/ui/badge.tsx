import type { ReactNode } from "react";
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock3, Info, PauseCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/domain/status";
import { VALIDITY_PRESENTATION, VISIT_STATUS_PRESENTATION, type SubscriptionValidity } from "@/lib/domain/status";

export const toneClasses: Record<Tone, string> = {
  success: "bg-success-50 text-success-700 ring-success-600/20",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/20",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/25",
  info: "bg-info-50 text-info-700 ring-info-600/20",
  neutral: "bg-surface-sunken text-ink-soft ring-line-strong",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset [&_svg]:size-3.5",
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const VALIDITY_ICONS = {
  active: <CheckCircle2 aria-hidden="true" />,
  expired: <XCircle aria-hidden="true" />,
  upcoming: <Clock3 aria-hidden="true" />,
  suspended: <PauseCircle aria-hidden="true" />,
  cancelled: <Ban aria-hidden="true" />,
  none: <CircleDashed aria-hidden="true" />,
};

/** Statut d'abonnement : libellé + icône + couleur (jamais la couleur seule). */
export function ValidityBadge({ status, expiringSoon }: { status: SubscriptionValidity | "none"; expiringSoon?: boolean }) {
  if (status === "active" && expiringSoon) {
    return (
      <Badge tone="warning" icon={<AlertTriangle aria-hidden="true" />}>
        Expire bientôt
      </Badge>
    );
  }
  const p = VALIDITY_PRESENTATION[status];
  return (
    <Badge tone={p.tone} icon={VALIDITY_ICONS[status]}>
      {p.label}
    </Badge>
  );
}

export function VisitStatusBadge({ status, corrected }: { status: "open" | "closed" | "cancelled"; corrected?: boolean }) {
  const p = VISIT_STATUS_PRESENTATION[status];
  const icon = status === "open" ? <Clock3 aria-hidden="true" /> : status === "closed" ? <CheckCircle2 aria-hidden="true" /> : <Ban aria-hidden="true" />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={p.tone} icon={icon}>
        {p.label}
      </Badge>
      {corrected ? (
        <Badge tone="warning" icon={<Info aria-hidden="true" />}>
          Corrigée
        </Badge>
      ) : null}
    </span>
  );
}
