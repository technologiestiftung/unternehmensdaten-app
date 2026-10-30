import Link from "next/link";
import { formatDate } from "@/lib/format";
import {
  type ClaimRow,
  describeChange,
  EVENT_LABELS,
  fieldLabel,
  formatConfidence,
  HISTORY_LIMIT,
  type HistoryRow,
} from "@/lib/history";

/**
 * The company's history: every change of a shown value, newest first. With `claims`, also every
 * claim any source made, shown or not; the page loads those only when the toggle asks for them.
 */
export function History({
  rows,
  claims,
  toggleHref,
}: {
  rows: HistoryRow[];
  claims?: ClaimRow[];
  toggleHref: string;
}) {
  return (
    <>
      <h2 id="verlauf" className="mt-10 mb-3 scroll-mt-4">Verlauf</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Änderungen aufgezeichnet.</p>
      ) : (
        <div className="overflow-x-auto border-t border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="caption-bottom px-3 py-2.5 text-left text-xs text-zinc-500">
              Änderungen der angezeigten Werte, neueste zuerst
              {rows.length >= HISTORY_LIMIT ? ` (die letzten ${HISTORY_LIMIT})` : ""}. Aufgezeichnet seit
              dem 30.10.2026; ältere Änderungen sind nicht bekannt.
            </caption>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Feld</th>
                <th scope="col">Änderung</th>
                <th scope="col">Wert</th>
                <th scope="col">Quelle</th>
                <th scope="col" className="text-right">Konfidenz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">{formatDate(row.changed_at)}</td>
                  <td>{fieldLabel(row.field_key)}</td>
                  <td className="whitespace-nowrap">{EVENT_LABELS[row.event]}</td>
                  <td className="break-words">{describeChange(row)}</td>
                  <td>{row.source_name ?? "–"}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {row.event === "confidence_changed" || row.event === "replaced"
                      ? `${formatConfidence(row.previous_confidence)} → ${formatConfidence(row.confidence)}`
                      : formatConfidence(row.confidence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-sm">
        <Link href={toggleHref} scroll={false}>
          {claims ? "Nur angezeigte Werte" : "Alle Angaben der Quellen anzeigen"}
        </Link>
      </p>
      {claims && (
        <div className="mt-2 overflow-x-auto border-t border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="caption-bottom px-3 py-2.5 text-left text-xs text-zinc-500">
              Jede Angabe, die eine Quelle zu diesem Unternehmen gemacht hat, auch nicht angezeigte. E-Mail,
              Telefon und zurückgehaltene Werte erscheinen nie.
            </caption>
            <thead>
              <tr>
                <th scope="col">Feld</th>
                <th scope="col">Wert</th>
                <th scope="col">Quelle</th>
                <th scope="col">Gelesen</th>
                <th scope="col" className="text-right">Konfidenz</th>
                <th scope="col">Angezeigt</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td>{fieldLabel(claim.field_key)}</td>
                  <td className="break-words">{claim.value ?? "–"}</td>
                  <td>
                    {claim.source_name ?? "–"}
                    {claim.method ? <span className="text-zinc-500"> · {claim.method}</span> : null}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(claim.read_at)}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">{formatConfidence(claim.confidence)}</td>
                  <td>{claim.is_shown ? "ja" : "nein"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
