import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = new Set(["/reinitialiser-mot-de-passe"]);
const OTP_TYPES = new Set<EmailOtpType>(["recovery", "invite", "email", "magiclink", "signup", "email_change"]);

/**
 * Retour des liens envoyés par e-mail (réinitialisation de mot de passe).
 * Accepte le flux PKCE (`code`) et le flux `token_hash`. La destination est
 * restreinte à une liste blanche (pas de redirection ouverte).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "";
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : "/";
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = new URL(ok ? next : "/connexion", origin);
  if (!ok) target.searchParams.set("lien", "expire");
  return NextResponse.redirect(target);
}
