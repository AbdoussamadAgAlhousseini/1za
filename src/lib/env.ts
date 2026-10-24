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
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    });
    if (!parsed.success) {
      throw new Error(
        "Configuration Supabase manquante ou invalide : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.example).",
      );
    }
    cached = parsed.data;
  }
  return cached;
}
