"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code="Erreur"
      title="Un problème est survenu"
      icon={<TriangleAlert />}
      description="L'opération n'a pas pu aboutir. Aucune donnée n'a été perdue. Réessayez ; si le problème persiste, contactez l'administrateur."
      actions={
        <>
          <Button onClick={reset}>
            <RotateCcw />
            Réessayer
          </Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            Accueil
          </Link>
        </>
      }
    />
  );
}
