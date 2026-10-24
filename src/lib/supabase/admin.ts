import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client « service_role » : contourne la RLS. Réservé à la gestion des comptes
 * d'authentification du personnel (création, blocage). Ne jamais l'utiliser
 * pour lire ou écrire des données métier, et ne jamais l'importer dans un
 * composant client (`server-only` le garantit à la compilation).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur.");
  }
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
