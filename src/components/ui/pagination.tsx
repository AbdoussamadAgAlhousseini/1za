"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { formatNumber } from "@/lib/domain/format";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
  itemLabel = "résultats",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  itemLabel?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row" aria-label="Pagination">
      <p className="tabular text-[13px] text-ink-muted">
        {formatNumber(from)}–{formatNumber(to)} sur <span className="font-semibold text-ink">{formatNumber(total)}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
          <ChevronLeft />
          Précédent
        </Button>
        <span className="tabular px-2 text-[13px] text-ink-muted">
          Page {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= pages}>
          Suivant
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
