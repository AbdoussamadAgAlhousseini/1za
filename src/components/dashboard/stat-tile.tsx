import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted [&_svg]:size-4 [&_svg]:text-ink-faint">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.01em] text-ink">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
