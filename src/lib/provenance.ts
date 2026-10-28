/** One row of `v_field_provenance` (Hasura: `companies.provenance`): where a shown value came from. */
export type Provenance = {
  field_name: string;
  value: string | null;
  source_key: string;
  source_name: string | null;
  method: string | null;
  confidence: number | null;
  evidence: unknown;
  link: string | null;
  observed_at: string | null;
};

/** The GraphQL selection for `Provenance`. */
export const PROVENANCE_FIELDS =
  "field_name value source_key source_name method confidence evidence link observed_at";

/** The database's method codes in plain German; anything unknown is shown as it is. */
const METHODS: Record<string, string> = {
  register_number_match: "Registernummer auf der Website",
  page_content_match: "Firmenname oder Ort auf der Website",
  keywords: "Schlagwörter auf der Website",
  textcat: "Textklassifikator, trainiert auf Schlagwörter und Bewertungen",
  register: "Handelsregister",
  "read from the end of the registered name": "aus dem Firmennamen abgelesen",
  "linked by recipient name and city": "über Empfängername und Ort zugeordnet",
};

export function methodLabel(row: Provenance): string | null {
  if (!row.method) return null;
  if (row.source_key === "spacy_ner") return `aus dem Impressum gelesen (spaCy, ${row.method})`;
  return METHODS[row.method] ?? row.method;
}

/** Register facts carry the date the register was read, which is old: say so. */
export const isRegisterDate = (row: Provenance) => row.method === "register" ||
  row.method === "read from the end of the registered name";

/**
 * The provenance of one shown value. A field with several values (one per manager name, one per
 * grant) matches on the value; a field with one value matches on the field alone, because a number
 * or date may be written differently in the view than in the cell.
 */
export function provenanceFor(
  rows: Provenance[],
  field: string,
  value: string,
  severalValues: boolean,
): Provenance[] {
  return rows.filter(
    (row) => row.field_name === field && (!severalValues || row.value === value),
  );
}

/** Keywords or evidence names, as a short list for display. */
export function evidenceList(evidence: unknown, max = 6): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.filter((e): e is string => typeof e === "string").slice(0, max);
}

/** One row per source and method, without per-value details: for a cell that sums several values. */
export function sourcesOf(rows: Provenance[]): Provenance[] {
  const bySource = new Map<string, Provenance>();
  for (const row of rows) {
    const key = `${row.source_key}|${row.method}`;
    if (!bySource.has(key)) {
      bySource.set(key, { ...row, value: null, confidence: null, evidence: null, link: null, observed_at: null });
    }
  }
  return [...bySource.values()];
}
