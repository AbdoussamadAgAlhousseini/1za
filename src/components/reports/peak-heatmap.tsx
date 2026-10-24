import { formatNumber } from "@/lib/domain/format";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5 h → 23 h

/** Rampe séquentielle à une seule teinte (vert pelouse), du plus clair au plus foncé. */
const RAMP = ["#f0ede5", "#d6eadf", "#aed4c0", "#7db89b", "#4d9a77", "#0d7a55", "#0f4a37"];

function shade(value: number, max: number) {
  if (value === 0 || max === 0) return RAMP[0];
  const idx = Math.min(RAMP.length - 1, 1 + Math.floor((value / max) * (RAMP.length - 1.0001)));
  return RAMP[idx];
}

/** Carte de chaleur jour × heure des entrées (périodes de forte fréquentation). */
export function PeakHeatmap({ data }: { data: { iso_dow: number; hour: number; entries: number }[] }) {
  const map = new Map(data.map((d) => [`${d.iso_dow}-${d.hour}`, d.entries]));
  const max = Math.max(0, ...data.map((d) => d.entries));
  const outside = data.filter((d) => d.hour < 5).reduce((s, d) => s + d.entries, 0);
  const top = [...data].sort((a, b) => b.entries - a.entries).slice(0, 3);

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-[11px]">
          <caption className="sr-only">Nombre d&apos;entrées par jour de la semaine et par heure</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10" />
              {HOURS.map((h) => (
                <th key={h} scope="col" className="pb-1 text-center font-medium text-ink-muted">
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, i) => (
              <tr key={day}>
                <th scope="row" className="pr-2 text-left text-xs font-semibold text-ink-soft">
                  {day}
                </th>
                {HOURS.map((h) => {
                  const v = map.get(`${i + 1}-${h}`) ?? 0;
                  return (
                    <td
                      key={h}
                      title={`${day} ${h}h–${h + 1}h : ${formatNumber(v)} entrée(s)`}
                      className="h-7 rounded-[4px] transition-transform hover:scale-110"
                      style={{ background: shade(v, max) }}
                    >
                      <span className="sr-only">{v}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <span>Moins</span>
          {RAMP.map((c) => (
            <span key={c} className="size-3.5 rounded-[3px]" style={{ background: c }} aria-hidden="true" />
          ))}
          <span>Plus</span>
          <span className="ml-2">(max. {formatNumber(max)} entrées / créneau)</span>
        </div>
        {top.length && max > 0 ? (
          <p>
            Créneaux les plus chargés :{" "}
            <span className="font-semibold text-ink-soft">
              {top.map((t) => `${DAYS[t.iso_dow - 1]} ${t.hour}h (${t.entries})`).join(" · ")}
            </span>
          </p>
        ) : null}
      </div>
      {outside > 0 ? <p className="mt-2 text-xs text-ink-muted">{formatNumber(outside)} entrée(s) entre minuit et 5 h ne sont pas représentées.</p> : null}
    </div>
  );
}
