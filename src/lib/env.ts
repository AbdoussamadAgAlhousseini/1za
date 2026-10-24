import { z } from "zod";

/**
 * Variables publiques (incluses dans le bundle navigateur). Les variables
 * serveur sont lues uniquement dans `src/lib/supabase/admin.ts`.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

let cached: z.infer<typeof publicEnvSchema> | null = null;

export function publicEnv() {
  if (!cached) {
    const parsed = publicEnvSchema.safeParse({
      // Noms classiques ou noms créés par l'intégration Supabase de Vercel. Ces
      // valeurs ne sont lues que côté serveur : le navigateur ne contacte jamais Supabase.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    });
    if (!parsed.success) {
      throw new Error(
        "Configuration Supabase manquante ou invalide : renseignez NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) et NEXT_PUBLIC_SUPABASE_ANON_KEY (ou SUPABASE_ANON_KEY), voir .env.example.",
      );
    }
    cached = parsed.data;
  }
  return cached;
}
