import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 text-center", compact ? "py-8" : "py-14", className)}>
      <div className="relative mb-4 grid size-14 place-items-center rounded-full bg-pitch-50 text-pitch-700 ring-8 ring-pitch-50/50 [&_svg]:size-6">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold uppercase tracking-[0.04em] text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info-600/20 bg-info-50 text-info-700",
    warning: "border-warning-600/25 bg-warning-50 text-warning-700",
    danger: "border-danger-600/20 bg-danger-50 text-danger-700",
    success: "border-success-600/20 bg-success-50 text-success-700",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", tones[tone], className)}>
      {icon}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && "mt-0.5", "text-[13px] leading-relaxed opacity-95")}>{children}</div>
      </div>
    </div>
  );
}
