import { describe, expect, it } from "vitest";
import { COLUMNS, type CompanyProfile, NAME_COLUMN } from "./columns";
import { FEEDBACK_FIELDS, MISSING } from "./feedback";
import { evidenceList, methodLabel, type Provenance, provenanceFor, sourcesOf } from "./provenance";

const row = (over: Partial<Provenance>): Provenance => ({
  field_name: "website",
  value: "https://a.de",
  source_key: "combined_discovery",
  source_name: "Combined discovery",
  method: "register_number_match",
  confidence: 0.9,
  evidence: null,
  link: null,
  observed_at: null,
  ...over,
});

describe("provenanceFor", () => {
  const rows = [
    row({ field_name: "management", value: "Erika Muster" }),
    row({ field_name: "management", value: "Max Beispiel" }),
    row({ field_name: "employee_count", value: "12.0" }),
  ];

  it("matches a field with several values on the value", () => {
    expect(provenanceFor(rows, "management", "Max Beispiel", true)).toHaveLength(1);
  });

  it("matches a single-valued field on the field alone, whatever the number's spelling", () => {
    expect(provenanceFor(rows, "employee_count", "12", false)).toHaveLength(1);
  });

  it("finds nothing for a field without provenance", () => {
    expect(provenanceFor(rows, "cluster", "x", false)).toEqual([]);
  });
});

describe("methodLabel", () => {
  it("translates known codes and keeps unknown ones", () => {
    expect(methodLabel(row({}))).toBe("Registernummer auf der Website");
    expect(methodLabel(row({ method: "something_new" }))).toBe("something_new");
    expect(methodLabel(row({ method: null }))).toBeNull();
  });

  it("names the model for spaCy", () => {
    expect(methodLabel(row({ source_key: "spacy_ner", method: "de_core_news_md" }))).toContain("spaCy");
  });
});

describe("evidenceList", () => {
  it("keeps strings only, and only a few", () => {
    expect(evidenceList(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(evidenceList("a")).toEqual([]);
    expect(evidenceList(Array.from({ length: 10 }, (_, i) => `k${i}`), 3)).toHaveLength(3);
  });
});

describe("column votes", () => {
  const company = {
    id: "x", name: "Beispiel GmbH", employee_count: null, revenue: 1000, funding_count: 0,
    funding_total_eur: null, wz_code: null, established_at: null, address: "Weg 1", legal_form: "GmbH",
    technology_field: null, website: "https://a.de", management: "Erika Muster; Max Beispiel",
    business_purpose: null, deeptech_class: null, deeptech_confidence: null, is_ai: false,
    register_status: "aktiv", updated_at: null,
  } satisfies CompanyProfile;
  const votesOf = (key: string) => COLUMNS.find((c) => c.key === key)?.votes?.(company);

  it("votes on every field the database accepts, and only those", () => {
    const voted = [NAME_COLUMN, ...COLUMNS].filter((c) => c.votes).map((c) => c.key);
    // Grants are voted on one by one in the detail table, not in the cell.
    expect([...voted, "fundings"].sort()).toEqual([...FEEDBACK_FIELDS].sort());
  });

  it("gives each manager a vote of their own", () => {
    expect(votesOf("management")).toEqual(["Erika Muster", "Max Beispiel"]);
  });

  it("turns an empty field into a missing vote, and false into a value", () => {
    expect(votesOf("employee_count")).toEqual([MISSING]);
    expect(votesOf("is_ai")).toEqual(["false"]);
    expect(votesOf("revenue")).toEqual(["1000"]);
  });
});

describe("sourcesOf", () => {
  it("keeps one row per source and method, without the per-grant details", () => {
    const grant = (fkz: string, method = "linked by recipient name and city") =>
      row({ field_name: "fundings", value: fkz, source_key: "foerderkatalog", source_name: "Förderkatalog", method, link: `https://f.de/${fkz}`, observed_at: "2025-01-01" });
    const sources = sourcesOf([grant("01A"), grant("02B"), grant("03C", "manual")]);
    expect(sources.map((s) => s.method)).toEqual(["linked by recipient name and city", "manual"]);
    expect(sources[0]).toMatchObject({ source_name: "Förderkatalog", value: null, link: null, observed_at: null, confidence: null });
  });
});
