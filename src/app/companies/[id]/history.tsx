import Link from "next/link";
import type { CompanyProfile } from "@/lib/columns";
import { MANAGEMENT_SEPARATOR } from "@/lib/feedback";
import { formatDate } from "@/lib/format";
import {
  type ClaimRow,
  describeChange,
  EVENT_LABELS,
  fieldLabel,
  formatConfidence,
  HISTORY_LIMIT,
  type HistoryRow,
  voteTarget,
} from "@/lib/history";
import { setVote } from "./actions";

/** The value a history row is about that might be wanted back: the old one, not the new one. */
const formerValue = (row: HistoryRow) =>
  row.event === "replaced" ? row.previous_value : row.event === "removed" ? (row.value ?? row.previous_value) : row.value;

/** Numbers compared as numbers: a claim stores 12 as "12.0", the profile shows 12. */
const sameValue = (a: string, b: string) => a === b || (a.trim() !== "" && b.trim() !== "" && Number(a) === Number(b));

/** The values the company page shows for a field right now (several for management). */
function shownValues(field: string, company: CompanyProfile): string[] {
  const shown = (company as Record<string, unknown>)[field];
  if (shown == null) return [];
  return field === "management" ? String(shown).split(MANAGEMENT_SEPARATOR) : [String(shown)];
}

/**
 * A vote through the same action as the ✓/✗ buttons. "Wiederherstellen" and "Übernehmen" say the shown
 * value is wrong and should be `value`; "Falsch" votes against `value` itself.
 */
function VoteButton({ companyId, field, target, correction, label }: {
  companyId: string; field: string; target: string; correction?: string; label: string;
}) {
  return (
    <form action={setVote.bind(null, companyId, field, target)} className="inline">
      <input type="hidden" name="verdict" value="wrong" />
      {correction !== undefined && <input type="hidden" name="correction" value={correction} />}
      <button type="submit" className="text-xs">{label}</button>
    </form>
  );
}

/**
 * The company's history: every change of a shown value, newest first. With `claims`, also every
 * claim any source made, shown or not; the page loads those only when the toggle asks for them.
 */
export function History({
  company,
  rows,
  claims,
  toggleHref,
}: {
  company: CompanyProfile;
  rows: HistoryRow[];
  claims?: ClaimRow[];
  toggleHref: string;
}) {
  // A value can be voted back only on a votable field, and only when it is not what is shown now.
  const restorable = (field: string, value: string | null) =>
    value != null && voteTarget(field, company) !== undefined && !shownValues(field, company).some((shown) => sameValue(shown, value));
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
                <th scope="col"><span className="sr-only">Wiederherstellen</span></th>
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
                  <td className="whitespace-nowrap">
                    {restorable(row.field_key, formerValue(row)) && (
                      <VoteButton companyId={company.id} field={row.field_key}
                        target={voteTarget(row.field_key, company) ?? ""} correction={formerValue(row) ?? ""}
                        label="Wiederherstellen" />
                    )}
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
              Telefon und zurückgehaltene Werte erscheinen nie. „Übernehmen“ und „Wiederherstellen“ sind
              Korrekturen wie jede andere: angezeigt wird ein Wert, sobald eine zweite Person zustimmt.
            </caption>
            <thead>
              <tr>
                <th scope="col">Feld</th>
                <th scope="col">Wert</th>
                <th scope="col">Quelle</th>
                <th scope="col">Gelesen</th>
                <th scope="col" className="text-right">Konfidenz</th>
                <th scope="col">Angezeigt</th>
                <th scope="col"><span className="sr-only">Bewerten</span></th>
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
                  <td className="whitespace-nowrap">
                    {restorable(claim.field_key, claim.value) && (
                      <VoteButton companyId={company.id} field={claim.field_key}
                        target={voteTarget(claim.field_key, company) ?? ""} correction={claim.value ?? ""} label="Übernehmen" />
                    )}{" "}
                    {claim.value != null && voteTarget(claim.field_key, company) !== undefined && (
                      <VoteButton companyId={company.id} field={claim.field_key} target={claim.value} label="Falsch" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
