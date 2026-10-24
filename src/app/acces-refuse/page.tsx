import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Accès refusé" };

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="Erreur 403"
      title="Accès refusé"
      icon={<ShieldOff />}
      description="Cette page est réservée aux administrateurs. Si vous pensez qu'il s'agit d'une erreur, contactez l'administration du stade."
      actions={
        <Link href="/controle" className={buttonVariants()}>
          Retour au contrôle d&apos;accès
        </Link>
      }
    />
  );
}
