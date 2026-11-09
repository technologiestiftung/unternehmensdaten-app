import type { Column, CompanyProfile } from "./columns";
import type { Provenance } from "./provenance";

/** Guesses (unternehmensdatenbank #183) are shown at any confidence; the band says how sure. */
export const confidenceBand = (value: number) => (value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low");

const BAND_CLASS = {
  high: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-red-100 text-red-900",
} as const;

/** The shown value's confidence: an official WZ code is certain, else its source's confidence. */
export function confidenceOf(company: CompanyProfile, column: Column, rows: Provenance[]): number | null {
  if (column.key === "wz_division_estimated" && company.wz_code) return 1;
  const field = column.field?.(company) ?? column.key;
  const found = rows.filter((row) => row.field_name === field && row.confidence != null).map((row) => row.confidence!);
  if (found.length) return Math.max(...found);
  return column.key === "deeptech" ? company.deeptech_confidence : null;
}

/** The percent as text next to the color, so the color is never the only signal (BITV). */
export function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span title="Wie sicher dieser Wert ist" className={`ml-1 rounded px-1 text-xs whitespace-nowrap ${BAND_CLASS[confidenceBand(value)]}`}>
      {Math.round(value * 100)} %
    </span>
  );
}

export function ConfidenceLegend() {
  return (
    <p className="mt-2 text-xs text-zinc-500">
      Wie sicher: <span className={`rounded px-1 ${BAND_CLASS.high}`}>grün ≥ 80 %</span>,{" "}
      <span className={`rounded px-1 ${BAND_CLASS.medium}`}>gelb 50–79 %</span>,{" "}
      <span className={`rounded px-1 ${BAND_CLASS.low}`}>rot &lt; 50 %</span>. Technologiefeld, WZ, DeepTech und
      KI-Unternehmen sind Schätzungen; die Prozentzahl ist die Konfidenz der Quelle, keine gemessene Trefferquote.
    </p>
  );
}
