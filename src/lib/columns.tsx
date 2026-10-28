import type { ReactNode } from "react";
import { MANAGEMENT_SEPARATOR, MISSING } from "./feedback";
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
  /**
   * The values users vote on in this cell; `[MISSING]` when the field is empty. Several values get
   * a vote each (one per manager name). Absent: the cell has no vote (grants are voted on one by
   * one in the detail page's table; comments and the date are not data to judge).
   */
  votes?: (c: CompanyProfile) => string[];
};

/** One vote on the field's raw value, or on its absence. */
const one = (value: string | number | boolean | null) =>
  [value == null ? MISSING : String(value)];

/** The company name, shown as the heading rather than as a column, but voted on like one. */
export const NAME_COLUMN: Column = {
  key: "name",
  label: "Name",
  render: (c) => c.name,
  votes: (c) => one(c.name),
};

/** The target columns in the order the project defined them (docs/target-columns.md). */
export const COLUMNS: Column[] = [
  { key: "employee_count", label: "Mitarbeiter", render: (c) => formatNumber(c.employee_count), numeric: true, votes: (c) => one(c.employee_count) },
  { key: "revenue", label: "Umsatz", render: (c) => formatEuro(c.revenue), numeric: true, votes: (c) => one(c.revenue) },
  {
    key: "fundings",
    label: "Förderungen",
    render: (c) => (c.funding_count > 0 ? `${c.funding_count} · ${formatEuro(c.funding_total_eur)}` : "–"),
    numeric: true,
  },
  { key: "wz_code", label: "WZ-Nummer", render: (c) => text(c.wz_code), votes: (c) => one(c.wz_code) },
  { key: "established_at", label: "Gründungsdatum", render: (c) => formatDate(c.established_at), votes: (c) => one(c.established_at) },
  { key: "address", label: "Adresse", render: (c) => text(c.address), long: true, votes: (c) => one(c.address) },
  { key: "legal_form", label: "Rechtsform", render: (c) => text(c.legal_form), votes: (c) => one(c.legal_form) },
  { key: "cluster", label: "Cluster", render: (c) => text(c.cluster), votes: (c) => one(c.cluster) },
  { key: "technologiefeld", label: "Technologiefeld", render: (c) => text(c.technologiefeld), votes: (c) => one(c.technologiefeld) },
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
    votes: (c) => one(c.website),
  },
  { key: "management", label: "Geschäftsführung", render: (c) => text(c.management), long: true, votes: (c) => c.management ? c.management.split(MANAGEMENT_SEPARATOR) : [MISSING] },
  { key: "business_purpose", label: "Tätigkeitsbeschreibung", render: (c) => text(c.business_purpose), long: true, votes: (c) => one(c.business_purpose) },
  { key: "comment", label: "Kommentar", render: (c) => c.comments?.[0]?.body ?? "–", long: true },
  {
    key: "deeptech",
    label: "DeepTech",
    render: (c) =>
      c.deeptech_class ? `${c.deeptech_class} (Konfidenz ${formatNumber(c.deeptech_confidence)})` : "–",
    votes: (c) => one(c.deeptech_class),
  },
  { key: "is_ai", label: "KI-Unternehmen", render: (c) => (c.is_ai == null ? "–" : c.is_ai ? "ja" : "nein"), votes: (c) => one(c.is_ai) },
  { key: "amazon_effect", label: "Amazon-Effekt", render: (c) => text(c.amazon_effect), votes: (c) => one(c.amazon_effect) },
  { key: "register_status", label: "Registerstatus", render: (c) => text(c.register_status), votes: (c) => one(c.register_status) },
  { key: "updated_at", label: "Stand", render: (c) => formatDate(c.updated_at) },
];
