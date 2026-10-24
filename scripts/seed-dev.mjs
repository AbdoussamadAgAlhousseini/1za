#!/usr/bin/env node
/**
 * Données de démonstration — DÉVELOPPEMENT LOCAL UNIQUEMENT.
 *
 * Crée un administrateur et deux agents de test, des formules, des sportifs
 * aux matricules FICTIFS et un historique de passages réaliste sur 75 jours.
 * Le script refuse de s'exécuter si l'URL Supabase n'est pas locale.
 *
 * Usage : npm run seed:dev
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error("Refus : ce script ne s'exécute que contre une instance Supabase locale.");
  process.exit(1);
}
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ⚠ Domaine technique identique à src/lib/auth/identity.ts.
const ACCOUNTS = [
  { key: "admin", email: "administration@stade26.invalid", password: "Admin-Stade-2026", role: "admin", name: "Direction du stade", phone: null, login: "onglet Administration" },
  { key: "agent1", email: "agent.22370000001@stade26.invalid", password: "Agent-Stade-2026", role: "agent", name: "Agent de démonstration 1", phone: "22370000001", login: "70 00 00 01" },
  { key: "agent2", email: "agent.22370000002@stade26.invalid", password: "Agent-Stade-2026", role: "agent", name: "Agent de démonstration 2", phone: "22370000002", login: "70 00 00 02" },
];

let seed = 26032026;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) {
    console.error(`Échec : ${label}`, error.message);
    process.exit(1);
  }
  return data;
}

async function main() {
  const { count } = await db.from("athletes").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !process.argv.includes("--force")) {
    console.log(`La base contient déjà ${count} sportif(s). Relancez avec --force après « npx supabase db reset » si besoin.`);
    return;
  }

  // Comptes
  const ids = {};
  for (const acc of ACCOUNTS) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    let user = list?.users.find((u) => u.email === acc.email);
    if (!user) {
      const created = await must(
        db.auth.admin.createUser({ email: acc.email, password: acc.password, email_confirm: true }),
        `compte ${acc.email}`,
      );
      user = created.user;
    }
    ids[acc.key] = user.id;
    await db.from("profiles").upsert({ id: user.id, role: acc.role, display_name: acc.name, login_phone: acc.phone, is_active: true });
  }

  const today = await must(db.rpc("app_today"), "app_today");

  // Formules
  let plans = await must(db.from("subscription_plans").select("id, name, duration_days, price"), "formules");
  if (plans.length === 0) {
    plans = await must(
      db
        .from("subscription_plans")
        .insert([
          { name: "Hebdomadaire", duration_days: 7, price: 2500, currency: "XOF", created_by: ids.admin },
          { name: "Mensuel", duration_days: 30, price: 7500, currency: "XOF", created_by: ids.admin },
          { name: "Trimestriel", duration_days: 90, price: 20000, currency: "XOF", created_by: ids.admin },
          { name: "Annuel", duration_days: 365, price: 70000, currency: "XOF", created_by: ids.admin },
        ])
        .select("id, name, duration_days, price"),
      "formules",
    );
  }

  // Sportifs (matricules fictifs)
  const athletes = [];
  const used = new Set();
  while (athletes.length < 140) {
    const m = `${pick(LETTERS)}${pick(LETTERS)}${String(Math.floor(rand() * 100000)).padStart(5, "0")}`;
    if (used.has(m)) continue;
    used.add(m);
    athletes.push({ matricule: m, registered_on: addDays(today, -Math.floor(rand() * 200)), created_by: ids.admin });
  }
  const insertedAthletes = await must(db.from("athletes").insert(athletes).select("id, matricule, registered_on"), "sportifs");

  // Abonnements
  const subs = [];
  const payments = [];
  for (const a of insertedAthletes) {
    const r = rand();
    if (r < 0.06) continue; // sans abonnement
    const plan = pick(plans.filter((p) => p.duration_days >= 30));
    let start;
    if (r < 0.7) start = addDays(today, -Math.floor(rand() * (plan.duration_days - 1))); // actif
    else if (r < 0.9) start = addDays(today, -plan.duration_days - 1 - Math.floor(rand() * 40)); // expiré
    else start = addDays(today, 1 + Math.floor(rand() * 10)); // à venir
    if (start < a.registered_on) start = a.registered_on > today ? today : a.registered_on;
    const end = addDays(start, plan.duration_days - 1);
    subs.push({ athlete_id: a.id, plan_id: plan.id, starts_on: start, ends_on: end, created_by: ids.admin });
  }
  const insertedSubs = await must(db.from("subscriptions").insert(subs).select("id, athlete_id, plan_id, starts_on, ends_on"), "abonnements");
  for (const s of insertedSubs) {
    const plan = plans.find((p) => p.id === s.plan_id);
    if (rand() < 0.92 && s.starts_on <= today) {
      payments.push({
        athlete_id: s.athlete_id,
        subscription_id: s.id,
        amount: plan.price,
        currency: "XOF",
        paid_on: s.starts_on,
        method: pick(["cash", "cash", "mobile_money", "mobile_money", "bank_transfer"]),
        recorded_by: ids.admin,
      });
    }
  }
  if (payments.length) await must(db.from("payments").insert(payments), "paiements");

  // Quelques suspensions
  const toSuspend = insertedSubs.filter((s) => s.starts_on <= today && s.ends_on >= today).slice(0, 3);
  for (const s of toSuspend) {
    await db
      .from("subscriptions")
      .update({ state: "suspended", state_reason: "Suspension de démonstration", state_changed_at: new Date().toISOString(), state_changed_by: ids.admin })
      .eq("id", s.id);
  }

  // Passages historiques (75 jours) : uniquement pendant la validité des abonnements
  const visits = [];
  const tzOffsetHours = 0; // Africa/Bamako = UTC+0
  const now = Date.now();
  for (const s of insertedSubs) {
    const intensity = 0.15 + rand() * 0.45;
    for (let d = -75; d <= 0; d++) {
      const day = addDays(today, d);
      if (day < s.starts_on || day > s.ends_on) continue;
      if (rand() > intensity) continue;
      const hour = pick([6, 6, 7, 7, 7, 8, 9, 10, 16, 17, 17, 18, 18, 18, 19, 19, 20]);
      const minute = Math.floor(rand() * 60);
      const entered = new Date(`${day}T${String(hour - tzOffsetHours).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
      if (entered.getTime() > now - 5 * 60_000) continue;
      const durationMin = 35 + Math.floor(rand() * 110);
      const exited = new Date(entered.getTime() + durationMin * 60_000);
      const stillInside = d === 0 && exited.getTime() > now;
      visits.push({
        athlete_id: s.athlete_id,
        subscription_id: s.id,
        entered_at: entered.toISOString(),
        exited_at: stillInside ? null : exited.toISOString(),
        status: stillInside ? "open" : "closed",
        entry_agent_id: rand() < 0.55 ? ids.agent1 : ids.agent2,
        exit_agent_id: stillInside ? null : rand() < 0.5 ? ids.agent1 : ids.agent2,
      });
    }
  }
  // Une seule visite ouverte par sportif.
  const openSeen = new Set();
  const cleaned = visits.filter((v) => {
    if (v.status !== "open") return true;
    if (openSeen.has(v.athlete_id)) return false;
    openSeen.add(v.athlete_id);
    return true;
  });
  for (let i = 0; i < cleaned.length; i += 500) {
    await must(db.from("visits").insert(cleaned.slice(i, i + 500)), "passages");
  }

  console.log(`✔ ${insertedAthletes.length} sportifs, ${insertedSubs.length} abonnements, ${payments.length} paiements, ${cleaned.length} passages.`);
  console.log("Comptes de démonstration (locaux uniquement) :");
  for (const acc of ACCOUNTS) console.log(`  ${acc.role.padEnd(5)}  ${acc.login.padEnd(22)}  mot de passe : ${acc.password}`);
}

main();
