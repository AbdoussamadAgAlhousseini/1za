#!/usr/bin/env node
/**
 * Compte administrateur (connexion par mot de passe seul).
 *
 *   npm run admin:create            Crée le compte administrateur (une seule fois)
 *   npm run admin:reset-password    Définit un nouveau mot de passe (récupération)
 *
 * Variables requises (dans .env.local ou l'environnement) :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Le mot de passe est demandé de façon masquée (ou lu dans ADMIN_PASSWORD pour
 * une exécution automatisée). Il n'est jamais affiché ni enregistré dans un fichier.
 * ⚠ Domaine technique identique à src/lib/auth/identity.ts.
 */
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const ADMIN_LOGIN_EMAIL = "administration@stade26.invalid";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");

const command = process.argv[2];
if (!["create", "reset-password"].includes(command)) {
  console.error("Usage : node scripts/admin-account.mjs <create|reset-password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write("*".repeat(s.length ? 1 : 0));
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function checkPolicy(pw) {
  const problems = [];
  if (pw.length < 12) problems.push("12 caractères minimum");
  if (!/[a-z]/.test(pw)) problems.push("une minuscule");
  if (!/[A-Z]/.test(pw)) problems.push("une majuscule");
  if (!/[0-9]/.test(pw)) problems.push("un chiffre");
  return problems;
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const pw = await askHidden("Mot de passe administrateur : ");
  const confirm = await askHidden("Confirmez le mot de passe : ");
  if (pw !== confirm) {
    console.error("Les deux saisies ne correspondent pas.");
    process.exit(1);
  }
  return pw;
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findAdminUser() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === ADMIN_LOGIN_EMAIL);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  return null;
}

const password = await readPassword();
const problems = checkPolicy(password);
if (problems.length) {
  console.error(`Mot de passe refusé : ${problems.join(", ")}.`);
  process.exit(1);
}

const existing = await findAdminUser();

if (command === "create") {
  if (existing) {
    console.error("Le compte administrateur existe déjà. Utilisez « npm run admin:reset-password » pour changer son mot de passe.");
    process.exit(1);
  }
  const { data, error } = await db.auth.admin.createUser({ email: ADMIN_LOGIN_EMAIL, password, email_confirm: true });
  if (error) {
    console.error("Création impossible :", error.message);
    process.exit(1);
  }
  const { error: profileError } = await db.from("profiles").insert({ id: data.user.id, role: "admin", display_name: "Administration du stade" });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id);
    console.error("Création du profil impossible :", profileError.message);
    process.exit(1);
  }
  await db.from("audit_logs").insert({ action: "staff.bootstrap_admin", entity_type: "profile", entity_id: data.user.id });
  console.log("✔ Compte administrateur créé. Connectez-vous avec l'onglet « Administration ».");
} else {
  if (!existing) {
    console.error("Aucun compte administrateur. Lancez d'abord « npm run admin:create ».");
    process.exit(1);
  }
  const { error } = await db.auth.admin.updateUserById(existing.id, { password, ban_duration: "none" });
  if (error) {
    console.error("Mise à jour impossible :", error.message);
    process.exit(1);
  }
  await db.from("profiles").update({ is_active: true, deactivated_at: null }).eq("id", existing.id);
  await db.from("audit_logs").insert({ action: "staff.password_recovered", entity_type: "profile", entity_id: existing.id });
  console.log("✔ Mot de passe administrateur réinitialisé.");
}
