import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/connexion", "/hors-ligne", "/manifest.webmanifest", "/sw.js"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Rafraîchit la session Supabase à chaque requête et redirige les visiteurs non
 * connectés vers la page de connexion. Les autorisations par rôle sont
 * vérifiées ensuite dans chaque page / action serveur, puis par la base.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [hKey, hValue] of Object.entries(headers ?? {})) response.headers.set(hKey, hValue);
      },
    },
  });

  // Ne rien exécuter entre la création du client et getClaims().
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/connexion";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
