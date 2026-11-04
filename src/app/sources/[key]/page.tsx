import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import {
  CONFIDENCE_RANGES,
  fieldLabel,
  runStatusLabel,
  SOURCE_DETAIL,
  type SourceDetail,
} from "@/lib/sources";

const SOURCE_KEY = /^[a-z0-9_]{1,64}$/;
const confidence = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moment = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
const formatConfidence = (value: number | null) => (value == null ? "–" : confidence.format(value));

/**
 * One source: what it is, where it comes from and under which terms, how its records found their
 * company, how confident its values are, and its last runs. Counts only, never a value.
 */
export default async function SourcePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!SOURCE_KEY.test(key)) notFound();
  const session = await requireSession();
  const {
    source_overview: [s],
  } = await hasura<{ source_overview: SourceDetail[] }>(SOURCE_DETAIL, { key }, session.accessToken);
  if (!s) notFound();

  const facts: [string, ReactNode][] = [
    ["Herkunft", s.base_url ? <a href={s.base_url} rel="noreferrer">{s.base_url}</a> : "–"],
    [
      "Nutzungsbedingungen",
      <>
        {s.terms ?? "nicht geprüft"}
        {s.terms_url && (
          <div>
            <a href={s.terms_url} rel="noreferrer">{s.terms_url}</a>
          </div>
        )}
      </>,
    ],
    ["Läuft", s.schedule ?? "–"],
    ["Rang", `${s.priority} (niedriger gewinnt, vor der Konfidenz)`],
    ["Datensätze", formatNumber(s.records)],
    [
      "Unternehmen",
      <>
        {formatNumber(s.companies)}{" "}
        <Link href={`/?source=${encodeURIComponent(s.source_key)}`}>anzeigen</Link>
      </>,
    ],
    [
      "Zuordnung",
      s.records ? (
        <ul>
          <li>über eine Kennung (z. B. Registernummer): {formatNumber(s.records_by_identifier)}</li>
          <li>über den Namen: {formatNumber(s.records_by_name)}</li>
          <li>von dieser Quelle neu angelegt: {formatNumber(s.companies_created)}</li>
          {s.records_by_hand > 0 && <li>von Hand: {formatNumber(s.records_by_hand)}</li>}
          <li>Ø Sicherheit der Zuordnung: {formatConfidence(s.avg_match_confidence)}</li>
        </ul>
      ) : (
        "–"
      ),
    ],
  ];

  return (
    <>
      <p className="text-sm">
        <Link href="/sources">Alle Quellen</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{s.name}</h1>
      {s.description && <p className="mt-2 max-w-3xl text-sm text-zinc-700">{s.description}</p>}

      <dl className="mt-6 grid grid-cols-[minmax(10rem,max-content)_1fr] border-t border-zinc-200 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="border-b border-zinc-100 py-2.5 pr-4 text-zinc-500">{label}</dt>
            <dd className="m-0 border-b border-zinc-100 py-2.5 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 mb-3">Felder</h2>
      <p className="max-w-3xl text-sm text-zinc-600">
        Die Konfidenz ist unsere eigene Schätzung, keine gemessene Trefferquote; ob Werte stimmen, zeigt
        erst die Prüfung an der Stichprobe. Jedes Feld hat eine eigene Schwelle, ab der ein Wert angezeigt
        wird. Zahlen vom {formatDate(s.counts_as_of)}.
      </p>
      {s.fields.length ? (
        <div className="mt-3 overflow-x-auto border-y border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Felder dieser Quelle: Unternehmen, angezeigte Werte und Konfidenz</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>Feld</th>
                <th scope="col" rowSpan={2} className="text-right">Unternehmen</th>
                <th scope="col" rowSpan={2} className="text-right">angezeigt</th>
                <th scope="col" rowSpan={2} className="text-right">anderer Wert angezeigt</th>
                <th scope="col" rowSpan={2} className="text-right">Ø Konfidenz</th>
                <th scope="colgroup" colSpan={CONFIDENCE_RANGES.length} className="text-center">
                  Werte nach Konfidenz
                </th>
              </tr>
              <tr>
                {CONFIDENCE_RANGES.map(([column, label]) => (
                  <th key={column} scope="col" className="text-right">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.fields.map((f) => (
                <tr key={f.field_name}>
                  <th scope="row" className="font-medium">{fieldLabel(f.field_name)}</th>
                  <td className="text-right">{formatNumber(f.companies)}</td>
                  <td className="text-right">{formatNumber(f.companies_shown)}</td>
                  <td className="text-right">{formatNumber(f.companies_beaten)}</td>
                  <td className="text-right">{formatConfidence(f.avg_confidence)}</td>
                  {CONFIDENCE_RANGES.map(([column]) => (
                    <td key={column} className="text-right">{formatNumber(f[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Noch keine Werte.</p>
      )}

      <h2 className="mt-10 mb-3">Letzte Läufe</h2>
      {s.recent_runs.length ? (
        <div className="overflow-x-auto border-y border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Die letzten Läufe dieser Quelle</caption>
            <thead>
              <tr>
                <th scope="col">Start</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">gelesen</th>
                <th scope="col" className="text-right">neu</th>
                <th scope="col" className="text-right">aktualisiert</th>
                <th scope="col" className="text-right">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {s.recent_runs.map((r) => (
                <tr key={r.started_at}>
                  <th scope="row" className="font-normal">{moment.format(new Date(r.started_at))}</th>
                  <td>{r.interrupted ? "unterbrochen" : runStatusLabel(r.status)}</td>
                  <td className="text-right">{formatNumber(r.records_seen)}</td>
                  <td className="text-right">{formatNumber(r.records_created)}</td>
                  <td className="text-right">{formatNumber(r.records_updated)}</td>
                  <td className="text-right">{formatNumber(r.records_failed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">{runStatusLabel(null)}</p>
      )}
    </>
  );
}
