import type { ReactNode } from "react";
import { formatDate, formatEuro, formatNumber } from "./format";

/** One row of `v_company_profile` (Hasura: `companies`), the target record per company. */
export type CompanyProfile = {
  id: string;
  name: string;
  employee_count: number | null;
  revenue: number | null;
  funding_count: number;
  funding_total_eur: number | null;
  wz_code: string | null;
  established_at: string | null;
  address: string | null;
  legal_form: string | null;
  cluster: string | null;
  technologiefeld: string | null;
  website: string | null;
  management: string | null;
  business_purpose: string | null;
  deeptech_class: string | null;
  deeptech_confidence: number | null;
  is_ai: boolean | null;
  amazon_effect: string | null;
  register_status: string | null;
  updated_at: string | null;
  /** The newest comment only; the detail page loads all of them. */
  comments?: { body: string }[];
};

/** The GraphQL selection for every column below. */
export const PROFILE_FIELDS = `
  id name employee_count revenue funding_count funding_total_eur wz_code established_at
  address legal_form cluster technologiefeld website management business_purpose
  deeptech_class deeptech_confidence is_ai amazon_effect register_status updated_at`;

export const text = (value: string | null) => value ?? "–";

export type Column = {
  key: string;
  label: string;
  render: (c: CompanyProfile) => ReactNode;
  /** Long free text: clamped to a few lines in the table. */
  long?: boolean;
  numeric?: boolean;
};

/** The target columns in the order the project defined them (docs/target-columns.md). */
export const COLUMNS: Column[] = [
  { key: "employee_count", label: "Mitarbeiter", render: (c) => formatNumber(c.employee_count), numeric: true },
  { key: "revenue", label: "Umsatz", render: (c) => formatEuro(c.revenue), numeric: true },
  {
    key: "fundings",
    label: "Förderungen",
    render: (c) => (c.funding_count > 0 ? `${c.funding_count} · ${formatEuro(c.funding_total_eur)}` : "–"),
    numeric: true,
  },
  { key: "wz_code", label: "WZ-Nummer", render: (c) => text(c.wz_code) },
  { key: "established_at", label: "Gründungsdatum", render: (c) => formatDate(c.established_at) },
  { key: "address", label: "Adresse", render: (c) => text(c.address), long: true },
  { key: "legal_form", label: "Rechtsform", render: (c) => text(c.legal_form) },
  { key: "cluster", label: "Cluster", render: (c) => text(c.cluster) },
  { key: "technologiefeld", label: "Technologiefeld", render: (c) => text(c.technologiefeld) },
  {
    key: "website",
    label: "Website",
    render: (c) =>
      c.website ? (
        <a href={c.website} rel="noopener noreferrer nofollow" target="_blank">
          {c.website}
        </a>
      ) : (
        "–"
      ),
  },
  { key: "management", label: "Geschäftsführung", render: (c) => text(c.management), long: true },
  { key: "business_purpose", label: "Tätigkeitsbeschreibung", render: (c) => text(c.business_purpose), long: true },
  { key: "comment", label: "Kommentar", render: (c) => c.comments?.[0]?.body ?? "–", long: true },
  {
    key: "deeptech",
    label: "DeepTech",
    render: (c) =>
      c.deeptech_class ? `${c.deeptech_class} (Konfidenz ${formatNumber(c.deeptech_confidence)})` : "–",
  },
  { key: "is_ai", label: "KI-Unternehmen", render: (c) => (c.is_ai == null ? "–" : c.is_ai ? "ja" : "nein") },
  { key: "amazon_effect", label: "Amazon-Effekt", render: (c) => text(c.amazon_effect) },
  { key: "register_status", label: "Registerstatus", render: (c) => text(c.register_status) },
  { key: "updated_at", label: "Stand", render: (c) => formatDate(c.updated_at) },
];
