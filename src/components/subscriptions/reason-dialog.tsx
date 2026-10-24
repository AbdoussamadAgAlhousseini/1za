"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { safeAction } from "@/lib/safe-action";
import type { ActionResult } from "@/lib/action-types";

/** Action sensible exigeant un motif (journalisé). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onSubmit: (reason: string) => Promise<ActionResult<unknown>>;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogContent size="sm" title={title} description={description}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 5) {
              setError("Le motif doit comporter au moins 5 caractères.");
              return;
            }
            startTransition(async () => {
              const res = await safeAction(() => onSubmit(reason.trim()));
              if (!res.ok) {
                setError(res.fieldErrors?.reason ?? res.message);
                return;
              }
              toast.success(res.message ?? "Opération enregistrée.");
              onOpenChange(false);
            });
          }}
        >
          {children}
          {error ? (
            <InlineAlert tone="danger" icon={<AlertCircle />}>
              {error}
            </InlineAlert>
          ) : null}
          <Field label="Motif" hint="Obligatoire. Il sera conservé dans le journal d'audit.">
            {(p) => <Textarea {...p} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus />}
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
