import { Download, FileSpreadsheet } from "lucide-react";
import { EXPORT_KINDS, type ExportKind } from "@/server/exports";
import { formatDate } from "@/lib/domain/format";

/** Exports CSV (compatibles Excel) envoyés en POST : aucun paramètre dans l'URL. */
export function ExportPanel({ from, to }: { from: string; to: string }) {
  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(Object.entries(EXPORT_KINDS) as [ExportKind, string][]).map(([kind, label]) => (
          <li key={kind}>
            <form method="post" action="/api/exports">
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-3 text-left text-sm transition-colors hover:border-pitch-300 hover:bg-pitch-50/50"
              >
                <FileSpreadsheet className="size-5 shrink-0 text-pitch-600" aria-hidden="true" />
                <span className="flex-1 font-medium text-ink">{label}</span>
                <Download className="size-4 text-ink-faint group-hover:text-pitch-700" aria-hidden="true" />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Période : du {formatDate(from)} au {formatDate(to)}. Fichiers CSV (séparateur « ; », UTF-8) lisibles dans Excel. Chaque export est journalisé ;
        conservez ces fichiers dans un emplacement protégé.
      </p>
    </div>
  );
}
