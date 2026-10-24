"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { normalizeMatricule, MATRICULE_EXAMPLE } from "@/lib/domain/matricule";
import { cn } from "@/lib/cn";

/** Champ de saisie d'un matricule : normalisation à la frappe, police d'affichage. */
export const MatriculeInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onValueChange: (v: string) => void }
>(function MatriculeInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onValueChange(normalizeMatricule(e.target.value).slice(0, 7))}
      autoComplete="off"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      placeholder={MATRICULE_EXAMPLE}
      maxLength={12}
      className={cn(
        "block h-14 w-full rounded-md border border-line-strong bg-surface px-4 font-display text-3xl font-semibold uppercase tracking-[0.2em] text-ink shadow-xs",
        "placeholder:text-ink-faint/50 hover:border-ink-faint focus:border-pitch-600 focus:outline-none focus:ring-[3px] focus:ring-pitch-600/15",
        "aria-[invalid=true]:border-danger-600",
        className,
      )}
      {...props}
    />
  );
});
