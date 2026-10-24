import type { Metadata } from "next";
import { UserX } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Accès suspendu" };

export default function SuspendedPage() {
  return (
    <StatusPage
      title="Accès suspendu"
      icon={<UserX />}
      description="Votre compte n'est pas, ou plus, autorisé à utiliser l'application. L'historique de vos opérations est conservé. Contactez l'administrateur pour rétablir votre accès."
      actions={
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Se déconnecter
          </Button>
        </form>
      }
    />
  );
}
