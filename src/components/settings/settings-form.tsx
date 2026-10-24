"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { updateSettings } from "@/server/actions/settings";
import { safeAction } from "@/lib/safe-action";

const TIMEZONES = ["Africa/Bamako", "Africa/Abidjan", "Africa/Dakar", "Africa/Ouagadougou", "Africa/Niamey", "Africa/Conakry", "Africa/Lagos", "Europe/Paris", "UTC"];

export interface SettingsValues {
  stadiumName: string;
  timezone: string;
  expiringSoonDays: number;
  longVisitHours: number;
  defaultCurrency: string;
  offlineSnapshotHours: number;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [v, setV] = useState({
    ...initial,
    expiringSoonDays: String(initial.expiringSoonDays),
    longVisitHours: String(initial.longVisitHours),
    offlineSnapshotHours: String(initial.offlineSnapshotHours),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const zones = TIMEZONES.includes(v.timezone) ? TIMEZONES : [v.timezone, ...TIMEZONES];

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await safeAction(() => updateSettings(v));
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.message);
            return;
          }
          setErrors({});
          setFormError(null);
          toast.success(res.message ?? "Enregistré.");
        });
      }}
    >
      {formError ? <InlineAlert tone="danger" icon={<AlertCircle />}>{formError}</InlineAlert> : null}
      <Field label="Nom du stade" error={errors.stadiumName} hint="Affiché dans l'en-tête de l'application.">
        {(p) => <Input {...p} value={v.stadiumName} maxLength={80} onChange={(e) => set({ stadiumName: e.target.value })} className="h-11" />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fuseau horaire du stade" error={errors.timezone} hint="Détermine « aujourd'hui », la fin des abonnements et les statistiques.">
          {(p) => (
            <Select {...p} value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} className="h-11">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Devise par défaut" error={errors.defaultCurrency} hint="XOF = franc CFA (BCEAO).">
          {(p) => <Input {...p} value={v.defaultCurrency} maxLength={3} onChange={(e) => set({ defaultCurrency: e.target.value.toUpperCase() })} className="h-11 w-28" />}
        </Field>
        <Field label="Alerte « expire bientôt » (jours)" error={errors.expiringSoonDays} hint="Abonnements signalés à renouveler.">
          {(p) => <Input {...p} type="number" min={1} max={60} value={v.expiringSoonDays} onChange={(e) => set({ expiringSoonDays: e.target.value })} className="h-11 w-28" />}
        </Field>
        <Field label="Entrée ouverte anormalement longue (heures)" error={errors.longVisitHours} hint="Au-delà, l'entrée est signalée pour vérification.">
          {(p) => <Input {...p} type="number" min={1} max={24} value={v.longVisitHours} onChange={(e) => set({ longVisitHours: e.target.value })} className="h-11 w-28" />}
        </Field>
        <Field
          label="Validité des données hors ligne (heures)"
          error={errors.offlineSnapshotHours}
          hint="Durée pendant laquelle un téléphone d'agent peut contrôler sans réseau avec les données téléchargées."
          className="sm:col-span-2"
        >
          {(p) => <Input {...p} type="number" min={1} max={72} value={v.offlineSnapshotHours} onChange={(e) => set({ offlineSnapshotHours: e.target.value })} className="h-11 w-28" />}
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        {pending ? null : <Save />}
        Enregistrer les paramètres
      </Button>
    </form>
  );
}
