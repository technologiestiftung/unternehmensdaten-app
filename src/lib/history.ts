import { COLUMNS, NAME_COLUMN } from "./columns";

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
};

/** The German label of a field key, as the profile table names it; the key itself if unknown. */
export function fieldLabel(key: string): string {
  return [NAME_COLUMN, ...COLUMNS].find((c) => c.key === key)?.label ?? EXTRA_LABELS[key] ?? key;
}

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
