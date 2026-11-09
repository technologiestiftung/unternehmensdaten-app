import { type Column, COLUMNS, type CompanyProfile, NAME_COLUMN } from "./columns";
import { isField, MISSING } from "./feedback";

/** One change of a shown value (`v_company_history`, Hasura: the profile's `history`). */
export type HistoryRow = {
  id: number;
  field_key: string;
  event: "shown" | "replaced" | "confidence_changed" | "removed";
  value: string | null;
  previous_value: string | null;
  confidence: number | null;
  previous_confidence: number | null;
  source_name: string | null;
  changed_at: string;
};

/** One claim a source made, shown or not (`v_company_claims`), for the "all claims" toggle. */
export type ClaimRow = {
  id: string;
  field_key: string;
  value: string | null;
  confidence: number | null;
  is_shown: boolean;
  method: string | null;
  source_name: string | null;
  read_at: string | null;
};

export const HISTORY_FIELDS =
  "id field_key event value previous_value confidence previous_confidence source_name changed_at";
export const CLAIM_FIELDS = "id field_key value confidence is_shown method source_name read_at";

/** The newest changes shown on the company page; older ones are rarely what anyone looks for. */
export const HISTORY_LIMIT = 200;

/** Fields the history knows that are not columns of the profile table. */
const EXTRA_LABELS: Record<string, string> = {
  postcode: "PLZ",
  city: "Ort",
  technology_field: "Technologiefeld",
  purpose_field: "Technologiefeld laut Unternehmenszweck",
  activity_keywords: "Tätigkeit (Stichworte)",
  register_announcement: "Registerbekanntmachung",
  // Older votes and claims on the exact date, from before the one "Gründung" column.
  established_at: "Gründungsdatum",
};

/** Fields shown inside a merged row (#183): their history and claims stay per field. */
const MERGED: Record<string, string> = { wz_code: "wz_division_estimated", business_purpose: "activity_description" };

/** The column of a field; for a field of a merged row, that row voting on the field's own value. */
const column = (key: string): Column | undefined => {
  const row = [NAME_COLUMN, ...COLUMNS].find((c) => c.key === (MERGED[key] ?? key));
  if (!row?.field) return row;
  return { ...row, key, votes: (c) => { const value = c[key as keyof CompanyProfile]; return [value == null ? MISSING : String(value)]; } };
};

/** The German label of a field key, as the profile table names it; the key itself if unknown. */
export function fieldLabel(key: string): string {
  return column(key)?.label ?? EXTRA_LABELS[key] ?? key;
}

/** The values the company page shows for a field right now, as its column votes on them; none when empty. */
export const shownValues = (field: string, company: CompanyProfile): string[] =>
  (column(field)?.votes?.(company) ?? []).filter((value) => value !== MISSING);

export const EVENT_LABELS: Record<HistoryRow["event"], string> = {
  shown: "angezeigt",
  replaced: "ersetzt",
  confidence_changed: "neue Konfidenz",
  removed: "entfernt",
};

const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
export const formatConfidence = (value: number | null) => (value == null ? "–" : percent.format(value));

/** What changed, in one line: "alt → neu", or the value that appeared or went away. */
export function describeChange(row: HistoryRow): string {
  if (row.event === "replaced") return `${row.previous_value ?? "–"} → ${row.value ?? "–"}`;
  if (row.event === "removed") return row.value ?? row.previous_value ?? "–";
  return row.value ?? "–";
}

/**
 * The value a restore or a "wrong" vote is cast on for a field, or undefined when users cannot vote
 * on it. Restoring X is the vote "the shown value is wrong, it should be X" (#45 rules: one person's
 * correction is shown only once a second agrees, or when the field is empty). A field with several
 * values (management) gets X added: the vote is cast on the missing value, so no shown name is
 * voted against.
 */
export function voteTarget(field: string, company: CompanyProfile): string | undefined {
  const votable = column(field);
  if (!votable?.votes || !isField(field)) return undefined;
  return votable.multiValue ? MISSING : votable.votes(company)[0];
}
