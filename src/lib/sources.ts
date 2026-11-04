import { fieldLabel as profileFieldLabel } from "@/lib/history";

/** One row of `v_source_overview` (Hasura: `source_overview`) with its fields. Counts only, never a value. */
export type SourceOverview = {
  source_key: string;
  name: string;
  source_type: string;
  records: number;
  companies: number;
  companies_created: number;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_status: string | null;
  last_run_seen: number | null;
  last_run_failed: number | null;
  runs: number;
  runs_interrupted: number;
  counts_as_of: string | null;
  fields: SourceField[];
};

/** One row of `v_source_fields`: values a source stored for one field, and how many the app shows. */
export type SourceField = {
  field_name: string;
  observations: number;
  companies: number;
  companies_shown: number;
};

/** One source with everything its own page shows (`/sources/<key>`). Counts only, never a value. */
export type SourceDetail = Omit<SourceOverview, "fields"> & {
  base_url: string | null;
  description: string | null;
  terms: string | null;
  terms_url: string | null;
  schedule: string | null;
  priority: number;
  records_by_identifier: number;
  records_by_name: number;
  records_by_hand: number;
  avg_match_confidence: number | null;
  fields: SourceFieldDetail[];
  recent_runs: SourceRun[];
};

/** A field with how confident its values are and how often another source's different value won. */
export type SourceFieldDetail = SourceField & {
  companies_beaten: number;
  avg_confidence: number | null;
  confidence_zero: number;
  confidence_below_035: number;
  confidence_035_060: number;
  confidence_060_080: number;
  confidence_080_up: number;
  last_observed_at: string | null;
};

/** One run of `v_source_runs` (the last 20 per source). */
export type SourceRun = {
  started_at: string;
  finished_at: string | null;
  status: string;
  records_seen: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  interrupted: boolean;
};

/** The confidence ranges `v_source_fields` counts, lowest first, with their German heading. */
export const CONFIDENCE_RANGES = [
  ["confidence_zero", "0"],
  ["confidence_below_035", "unter 0,35"],
  ["confidence_035_060", "0,35–0,6"],
  ["confidence_060_080", "0,6–0,8"],
  ["confidence_080_up", "ab 0,8"],
] as const satisfies readonly (readonly [keyof SourceFieldDetail, string])[];

export const SOURCE_DETAIL = `
  query SourceDetail($key: String!) {
    source_overview(where: { source_key: { _eq: $key } }) {
      source_key name source_type base_url description terms terms_url schedule priority
      records companies companies_created records_by_identifier records_by_name records_by_hand
      avg_match_confidence last_run_started_at last_run_finished_at last_run_status last_run_seen
      last_run_failed runs runs_interrupted counts_as_of
      fields(order_by: { companies: desc }) {
        field_name observations companies companies_shown companies_beaten avg_confidence
        confidence_zero confidence_below_035 confidence_035_060 confidence_060_080 confidence_080_up
        last_observed_at
      }
      recent_runs(order_by: { started_at: desc }) {
        started_at finished_at status records_seen records_created records_updated records_failed interrupted
      }
    }
  }`;

export const SOURCE_OVERVIEW = `
  query SourceOverview {
    source_overview(order_by: { name: asc }) {
      source_key name source_type records companies companies_created
      last_run_started_at last_run_finished_at last_run_status last_run_seen last_run_failed
      runs runs_interrupted counts_as_of
      fields(order_by: { observations: desc }) { field_name observations companies companies_shown }
    }
  }`;

/** The database's field names in plain German; anything unknown is shown as it is. */
const FIELDS: Record<string, string> = {
  website: "Website",
  candidate_url: "Website-Kandidat (nicht bestätigt)",
  directory_url: "Seite über das Unternehmen (Verzeichnis)",
  discovery_tier: "Suchschritt",
  search_query: "Suchanfrage",
  osm_id: "OpenStreetMap-Objekt",
  technology_field: "Technologiefeld",
  technology_field_withheld: "Technologiefeld (zurückgehalten)",
  purpose_field: "Feld laut Unternehmensgegenstand",
  purpose_field_withheld: "Feld laut Unternehmensgegenstand (zurückgehalten)",
  ceo_name_or_contact: "Geschäftsführung",
  email: "E-Mail",
  phone: "Telefon",
  activity_keywords: "Stichworte zur Tätigkeit",
  register_announcement: "Registerbekanntmachung",
  fundings: "Förderungen",
  revenue: "Umsatz",
  employee_count: "Mitarbeitende",
};

/** A field's German name: the sources' own words first, then the company page's (name, address ...). */
export const fieldLabel = (field: string) => FIELDS[field] ?? profileFieldLabel(field);

/** Working values of the website search that the app never shows; listed on a source's own page only. */
const INTERNAL_FIELDS = new Set(["candidate_url", "directory_url", "discovery_tier", "search_query", "osm_id"]);

export const isInternalField = (field: string) => INTERNAL_FIELDS.has(field);

/** The stored run status in plain German. */
const RUN_STATUS: Record<string, string> = {
  success: "erfolgreich",
  partial: "mit Fehlern",
  failed: "fehlgeschlagen",
  running: "läuft",
  pending: "wartet",
  cancelled: "abgebrochen",
};

export const runStatusLabel = (status: string | null) =>
  status ? (RUN_STATUS[status] ?? status) : "noch kein Lauf";
