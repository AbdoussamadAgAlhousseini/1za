/**
 * Génération CSV compatible Excel (séparateur « ; », BOM UTF-8, CRLF) avec
 * neutralisation des injections de formules (=, +, -, @, tabulation, retour
 * chariot en tête de cellule).
 */

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvValue;
}

const SEPARATOR = ";";
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  if (typeof value === "string" && FORMULA_TRIGGERS.test(text)) {
    text = `'${text}`;
  }
  if (/[";\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(SEPARATOR));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
