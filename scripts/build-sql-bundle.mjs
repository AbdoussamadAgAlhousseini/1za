#!/usr/bin/env node
/**
 * Génère supabase/installation-complete.sql : toutes les migrations dans un seul
 * fichier, à coller dans l'éditeur SQL de Supabase (installation sans terminal).
 * Les migrations sont enregistrées comme appliquées : un futur
 * « supabase db push » ne les rejouera pas.
 *
 * Usage : npm run sql:bundle
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const quote = (s) => `'${s.replace(/'/g, "''")}'`;
let out = `-- =============================================================================
-- Stade du 26 Mars — installation complète de la base de données
--
-- À exécuter UNE SEULE FOIS sur un projet Supabase VIDE :
-- Supabase → SQL Editor → New query → coller tout ce fichier → Run.
--
-- Fichier généré par « npm run sql:bundle » à partir de supabase/migrations.
-- Ne pas modifier à la main.
-- =============================================================================

`;
for (const f of files) {
  out += `\n-- >>>>> ${f}\n${readFileSync(`${dir}/${f}`, "utf8").trim()}\n`;
}
out += `
-- >>>>> Enregistrement des migrations appliquées (compatibilité « supabase db push »)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values
${files.map((f) => `  (${quote(f.split("_")[0])}, ${quote(f.replace(/^\d+_/, "").replace(/\.sql$/, ""))})`).join(",\n")}
on conflict (version) do nothing;
`;
writeFileSync("supabase/installation-complete.sql", out);
console.log(`supabase/installation-complete.sql : ${files.length} migrations.`);
