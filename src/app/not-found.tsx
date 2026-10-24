import Link from "next/link";
import { Compass } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatusPage
      code="Erreur 404"
      title="Page introuvable"
      icon={<Compass />}
      description="L'adresse demandée n'existe pas ou l'élément a été déplacé."
      actions={
        <Link href="/" className={buttonVariants()}>
          Revenir à l&apos;accueil
        </Link>
      }
    />
  );
}
