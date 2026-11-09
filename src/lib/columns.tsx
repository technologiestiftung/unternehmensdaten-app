import Link from "next/link";
import type { ReactNode } from "react";
import { CLASSIFICATIONS_PATH, technologyFieldAnchor, wzAnchor } from "./classifications";
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
  /** A WZ division ("62") our text model estimated from the website (unternehmensdatenbank #158); never the official wz_code. */
  wz_division_estimated: string | null;
  established_at: string | null;
  /** The year of established_at, else a founding year a source gave without a date (unternehmensdatenbank V6). */
  established_year: number | null;
  address: string | null;
  legal_form: string | null;
  technology_field: string | null;
  website: string | null;
  management: string | null;
  business_purpose: string | null;
  /** What the company's own homepage says it does (unternehmensdatenbank #152); never the register's purpose. */
  activity_description: string | null;
  deeptech_class: string | null;
  deeptech_confidence: number | null;
  is_ai: boolean | null;
  register_status: string | null;
  /** The newest register number with its court, e.g. "Amtsgericht Berlin (Charlottenburg) HRB 121291 B". */
  registration_number: string | null;
  updated_at: string | null;
  /** The newest comment only; the detail page loads all of them. */
  comments?: { body: string }[];
  emails?: { email: string }[];
};

/** The GraphQL selection for every column below. */
export const PROFILE_FIELDS = `
  id name employee_count revenue funding_count funding_total_eur wz_code wz_division_estimated established_at established_year
  address legal_form technology_field website management business_purpose activity_description
  deeptech_class deeptech_confidence is_ai register_status registration_number updated_at`;

export const text = (value: string | null) => value ?? "–";

/** "12.05.2010" when the date is known and in the shown year, else "2010", else "–". */
export const foundingText = (c: Pick<CompanyProfile, "established_at" | "established_year">) =>
  c.established_at && Number(c.established_at.slice(0, 4)) === c.established_year
    ? formatDate(c.established_at)
    : c.established_year == null ? "–" : String(c.established_year);

/** A classification value linked to its entry on the classifications page, which says what it means. */
const explained = (value: string | null, anchor: string | null | undefined) =>
  value && anchor ? <Link href={`${CLASSIFICATIONS_PATH}#${anchor}`}>{value}</Link> : text(value);

/**
 * "HRB 121291 B" from "Amtsgericht Berlin (Charlottenburg) HRB 121291 B": the court is left out while
 * every company is in Berlin. Anything that does not look like a register number is shown whole.
 */
export const shortRegisterNumber = (value: string) =>
  /\b(?:HRA|HRB|GnR|PR|VR|GsR)\s*\d+(?:\s+[A-Z]{1,2})?\b/.exec(value)?.[0] ?? value;

export type Column = {
  key: string;
  label: string;
  render: (c: CompanyProfile) => ReactNode;
  /** Long free text: clamped to a few lines in the table. */
  long?: boolean;
  numeric?: boolean;
  /** Off until the user picks it in the column picker. */
  hidden?: boolean;
  /** Several values per company (one per manager name): provenance is matched per value. */
  multiValue?: boolean;
  /**
   * The values users vote on in this cell; `[MISSING]` when the field is empty. Several values get
   * a vote each (one per manager name). Absent: the cell has no vote (grants are voted on one by
   * one in the detail page's table; comments and the date are not data to judge).
   */
  votes?: (c: CompanyProfile) => string[];
  /** The feedback and provenance field of the shown value, when it is not the key (the WZ row shows one of two). */
  field?: (c: CompanyProfile) => string;
  /** A guess shown at any confidence: the cell shows its confidence with a color (#183). */
  confidence?: boolean;
};

/** The four DeepTech classes as stored (#183), written for people. */
const DEEPTECH_CLASSES: Record<string, string> = { "non-tech": "Non-Tech", tech: "Tech", hybrid: "Hybrid", "deep tech": "Deep Tech" };

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

/** The register number first, then the target columns in the order the project defined them (docs/target-columns.md). */
export const COLUMNS: Column[] = [
  {
    key: "registration_number",
    label: "Registernummer",
    // First, next to the name: it tells same-named companies apart. An identifier, not a claim: no vote.
    // The full form with the court is the tooltip.
    render: (c) =>
      c.registration_number ? (
        <span title={c.registration_number} className="whitespace-nowrap">{shortRegisterNumber(c.registration_number)}</span>
      ) : (
        "–"
      ),
  },
  { key: "employee_count", label: "Mitarbeiter", render: (c) => formatNumber(c.employee_count), numeric: true, votes: (c) => one(c.employee_count) },
  { key: "revenue", label: "Umsatz", render: (c) => formatEuro(c.revenue), numeric: true, votes: (c) => one(c.revenue) },
  {
    key: "fundings",
    label: "Förderungen",
    // Sum first (the column sorts by it), then how many grants it adds up.
    render: (c) =>
      c.funding_count > 0 ? (
        <>
          {formatEuro(c.funding_total_eur)}{" "}
          <span className="text-zinc-500">
            ({c.funding_count} {c.funding_count === 1 ? "Förderung" : "Förderungen"})
          </span>
        </>
      ) : (
        "–"
      ),
    numeric: true,
  },
  // One row (#183): the official number when a source ever gives one (certain), else the estimate with its confidence.
  // shortcut: keyed, sorted and filtered by the estimate, since no source gives an official number for Berlin yet.
  {
    key: "wz_division_estimated",
    label: "WZ",
    render: (c) => {
      const value = c.wz_code ?? c.wz_division_estimated;
      return explained(value, value && wzAnchor(value));
    },
    votes: (c) => one(c.wz_code ?? c.wz_division_estimated),
    field: (c) => (c.wz_code ? "wz_code" : "wz_division_estimated"),
    confidence: true,
  },
  // One column for date and year: the date when it is known and agrees with the year, else the year alone.
  {
    key: "established_year",
    label: "Gründung",
    render: (c) => foundingText(c),
    numeric: true,
    votes: (c) => one(c.established_year),
  },
  { key: "address", label: "Adresse", render: (c) => text(c.address), long: true, votes: (c) => one(c.address) },
  { key: "legal_form", label: "Rechtsform", render: (c) => text(c.legal_form), votes: (c) => one(c.legal_form) },
  {
    key: "technology_field",
    label: "Technologiefeld",
    render: (c) => explained(c.technology_field, c.technology_field && technologyFieldAnchor(c.technology_field)),
    votes: (c) => one(c.technology_field),
    confidence: true,
  },
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
  { key: "management", label: "Geschäftsführung", render: (c) => text(c.management), long: true, multiValue: true, votes: (c) => c.management ? c.management.split(MANAGEMENT_SEPARATOR) : [MISSING] },
  // One row (#183): the company's own words from its homepage, else the register's business purpose.
  // shortcut: sorted by the homepage text only; a combined sort needs a view column in the Data Hub.
  {
    key: "activity_description",
    label: "Tätigkeit",
    render: (c) => text(c.activity_description ?? c.business_purpose),
    long: true,
    votes: (c) => one(c.activity_description ?? c.business_purpose),
    field: (c) => (c.activity_description ? "activity_description" : "business_purpose"),
  },
  // Stored, never resolved: no votes, no provenance. Off by default: a list shows many companies' addresses at once.
  {
    key: "emails",
    label: "E-Mail",
    render: (c) => (c.emails?.length ? c.emails.map(({ email }) => email).join(", ") : "–"),
    long: true,
    hidden: true,
  },
  { key: "comment", label: "Kommentar", render: (c) => c.comments?.[0]?.body ?? "–", long: true },
  {
    key: "deeptech",
    label: "DeepTech",
    render: (c) => (c.deeptech_class ? (DEEPTECH_CLASSES[c.deeptech_class] ?? c.deeptech_class) : "–"),
    votes: (c) => one(c.deeptech_class),
    confidence: true,
  },
  { key: "is_ai", label: "KI-Unternehmen", render: (c) => (c.is_ai == null ? "–" : c.is_ai ? "ja" : "nein"), votes: (c) => one(c.is_ai), confidence: true },
  { key: "register_status", label: "Registerstatus", render: (c) => text(c.register_status), votes: (c) => one(c.register_status) },
  { key: "updated_at", label: "Stand", render: (c) => formatDate(c.updated_at) },
];
