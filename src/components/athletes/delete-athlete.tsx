"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { MatriculeInput } from "@/components/forms/matricule-input";
import { deleteAthlete } from "@/server/actions/athletes";
import { safeAction } from "@/lib/safe-action";
import { formatMatricule } from "@/lib/domain/matricule";
import { pluralize } from "@/lib/domain/format";

/** Suppression définitive d'un sportif (double confirmation : matricule + motif). */
export function DeleteAthlete({
  athleteId,
  matricule,
  counts,
}: {
  athleteId: string;
  matricule: string;
  counts: { subscriptions: number; payments: number; visits: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = confirmation === matricule;

  return (
    <Card className="no-print border-danger-600/25">
      <CardHeader title="Supprimer ce sportif" description="Action définitive, réservée aux erreurs d'enregistrement ou aux demandes d'effacement." />
      <CardBody>
        <Button variant="secondary" className="border-danger-600/40 text-danger-700 hover:bg-danger-50" onClick={() => setOpen(true)}>
          <Trash2 />
          Supprimer le sportif
        </Button>
      </CardBody>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setConfirmation("");
            setReason("");
            setErrors({});
            setFormError(null);
          }
        }}
      >
        <DialogContent title="Supprimer définitivement ?" description={`Sportif ${formatMatricule(matricule)}`}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await safeAction(() => deleteAthlete({ athleteId, matriculeConfirmation: confirmation, reason }));
                if (!res.ok) {
                  setErrors(res.fieldErrors ?? {});
                  setFormError(res.fieldErrors ? null : res.message);
                  return;
                }
                toast.success(`Sportif ${formatMatricule(matricule)} supprimé.`);
                setOpen(false);
                router.push("/sportifs");
                router.refresh();
              });
            }}
          >
            <InlineAlert tone="danger" icon={<AlertCircle />} title="Cette action est irréversible">
              Seront effacés : le matricule, {pluralize(counts.subscriptions, "abonnement")}, {pluralize(counts.payments, "paiement")} et{" "}
              {pluralize(counts.visits, "passage")}. Les statistiques passées seront recalculées sans ce sportif. Le journal d&apos;audit conserve
              la trace de la suppression (sans le matricule).
            </InlineAlert>
            {formError ? <InlineAlert tone="danger" icon={<AlertCircle />}>{formError}</InlineAlert> : null}
            <Field label={`Pour confirmer, saisissez le matricule ${matricule}`} error={errors.matriculeConfirmation}>
              {(p) => <MatriculeInput {...p} value={confirmation} onValueChange={setConfirmation} placeholder={matricule} className="h-12 text-2xl" />}
            </Field>
            <Field label="Motif" error={errors.reason} hint="Ex. « erreur d'enregistrement », « demande d'effacement du sportif ». Conservé dans le journal.">
              {(p) => <Textarea {...p} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="submit" variant="danger" loading={pending} disabled={!matches || reason.trim().length < 5}>
                {pending ? null : <Trash2 />}
                Supprimer définitivement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
