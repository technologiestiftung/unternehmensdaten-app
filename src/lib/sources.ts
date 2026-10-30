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

export const fieldLabel = (field: string) => FIELDS[field] ?? field;

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
