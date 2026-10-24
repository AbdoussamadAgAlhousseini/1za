#!/usr/bin/env node
/**
 * Génère supabase/installation/partie-N.sql : toutes les migrations découpées en
 * fichiers de moins de 90 000 caractères (l'éditeur SQL de Supabase refuse les
 * requêtes de plus de 100 000 caractères), à exécuter DANS L'ORDRE.
 * Les migrations sont enregistrées comme appliquées : un futur
 * « supabase db push » ne les rejouera pas.
 *
 * Usage : npm run sql:bundle
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const MAX_CHARS = 90_000;
const dir = "supabase/migrations";
const outDir = "supabase/installation";
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
const quote = (s) => `'${s.replace(/'/g, "''")}'`;

const registration = (list) => `
-- >>>>> Enregistrement des migrations appliquées (compatibilité « supabase db push »)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
${list.map((f) => `  (${quote(f.split("_")[0])}, ${quote(f.replace(/^\d+_/, "").replace(/\.sql$/, ""))})`).join(",\n")}
on conflict (version) do nothing;
`;

// Regroupement des migrations (jamais coupées en deux) sous la limite.
const parts = [];
let current = [];
let size = 0;
for (const f of files) {
  const content = `\n-- >>>>> ${f}\n${readFileSync(`${dir}/${f}`, "utf8").trim()}\n`;
  const extra = content.length + registration([f]).length;
  if (current.length && size + extra > MAX_CHARS) {
    parts.push(current);
    current = [];
    size = 0;
  }
  current.push({ f, content });
  size += extra;
}
if (current.length) parts.push(current);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
parts.forEach((part, i) => {
  const header = `-- =============================================================================
-- Stade du 26 Mars — installation de la base : PARTIE ${i + 1} SUR ${parts.length}
--
-- Supabase → SQL Editor → New query → coller tout ce fichier → Run.
-- Exécuter les parties DANS L'ORDRE (1, puis 2…), une seule fois, sur un projet vide.
-- Fichier généré par « npm run sql:bundle ». Ne pas modifier à la main.
-- =============================================================================
`;
  const body = header + part.map((p) => p.content).join("") + registration(part.map((p) => p.f));
  if (body.length >= 100_000) throw new Error(`Partie ${i + 1} trop longue (${body.length})`);
  writeFileSync(`${outDir}/partie-${i + 1}-sur-${parts.length}.sql`, body);
  console.log(`${outDir}/partie-${i + 1}-sur-${parts.length}.sql : ${part.length} migration(s), ${body.length} caractères`);
});
