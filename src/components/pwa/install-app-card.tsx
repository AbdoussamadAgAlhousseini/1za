"use client";

import { CheckCircle2, Download, MonitorSmartphone, Share, SquarePlus, EllipsisVertical } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "./use-install-prompt";

/** Installation de l'application sur le bureau (ordinateur) ou l'écran d'accueil (téléphone). */
export function InstallAppCard() {
  const { canPrompt, install, installed, platform } = useInstallPrompt();

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-pitch-600" aria-hidden="true" />
            Application sur cet appareil
          </span>
        }
        description="Installez l'application pour l'ouvrir comme une application native, depuis le bureau ou l'écran d'accueil."
      />
      <CardBody className="space-y-4 text-sm">
        {installed ? (
          <p className="flex items-center gap-2 font-semibold text-success-700">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            L&apos;application est installée sur cet appareil.
          </p>
        ) : canPrompt ? (
          <Button size="lg" onClick={() => void install()}>
            <Download />
            Installer l&apos;application
          </Button>
        ) : (
          <ol className="space-y-2.5 text-ink-soft">
            {(platform === "ios"
              ? [
                  <>Dans Safari, touchez <Share className="mx-0.5 inline size-4 align-[-3px]" aria-hidden="true" /> <strong>Partager</strong>.</>,
                  <>Choisissez <SquarePlus className="mx-0.5 inline size-4 align-[-3px]" aria-hidden="true" /> <strong>Sur l&apos;écran d&apos;accueil</strong>, puis <strong>Ajouter</strong>.</>,
                ]
              : platform === "android"
                ? [
                    <>Ouvrez le menu <EllipsisVertical className="inline size-4 align-[-3px]" aria-hidden="true" /> de Chrome.</>,
                    <>Touchez <strong>Installer l&apos;application</strong> (ou « Ajouter à l&apos;écran d&apos;accueil »).</>,
                  ]
                : [
                    <>Dans Chrome ou Edge, cliquez sur l&apos;icône d&apos;installation à droite de la barre d&apos;adresse.</>,
                    <>À défaut : menu <EllipsisVertical className="inline size-4 align-[-3px]" aria-hidden="true" /> → <strong>Installer Stade 26 Mars…</strong></>,
                  ]
            ).map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pitch-50 text-xs font-bold text-pitch-700">{i + 1}</span>
                <p className="pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-ink-muted">
          Une connexion Internet reste nécessaire : les abonnements sont toujours vérifiés en temps réel et aucune donnée n&apos;est conservée sur l&apos;appareil.
        </p>
      </CardBody>
    </Card>
  );
}

/** Bouton compact affiché dans la barre latérale quand l'installation est proposée par le navigateur. */
export function InstallAppButton() {
  const { canPrompt, install, installed } = useInstallPrompt();
  if (installed || !canPrompt) return null;
  return (
    <button
      type="button"
      onClick={() => void install()}
      className="flex w-full items-center gap-2.5 rounded-md border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-[13px] font-semibold text-gold-100 transition-colors hover:bg-gold-400/20"
    >
      <Download className="size-4 text-gold-300" aria-hidden="true" />
      Installer l&apos;application
    </button>
  );
}
