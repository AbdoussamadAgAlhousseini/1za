import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { ReloadButton } from "@/components/pwa/reload-button";

export const metadata: Metadata = { title: "Hors ligne" };

export default function OfflinePage() {
  return (
    <StatusPage
      title="Pas de connexion"
      icon={<WifiOff />}
      description="L'application a besoin d'Internet pour vérifier les abonnements en temps réel : aucune donnée n'est conservée sur l'appareil. Vérifiez le Wi-Fi ou les données mobiles, puis réessayez."
      actions={<ReloadButton />}
    />
  );
}
