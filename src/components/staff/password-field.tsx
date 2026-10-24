"use client";

import { useState } from "react";
import { Copy, Check, Wand2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { generatePassword } from "@/lib/password";

/** Mot de passe initial / réinitialisé : génération sûre et copie. */
export function PasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label="Mot de passe" error={error} hint="10 caractères minimum, avec minuscule, majuscule et chiffre. À communiquer à l'agent en main propre ; il pourra le modifier dans « Mon compte ».">
      {(p) => (
        <div className="flex gap-2">
          <Input {...p} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="h-11 font-semibold tracking-[0.06em]" />
          <Button type="button" variant="secondary" className="h-11" onClick={() => onChange(generatePassword())} title="Générer un mot de passe">
            <Wand2 />
            <span className="hidden sm:inline">Générer</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            disabled={!value}
            aria-label="Copier le mot de passe"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              } catch {
                /* presse-papiers indisponible */
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      )}
    </Field>
  );
}
