import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { COLUMNS, type CompanyProfile, NAME_COLUMN } from "@/lib/columns";
import { tally } from "@/lib/feedback";
import type { Provenance } from "@/lib/provenance";
import { FieldCell } from "./feedback-buttons";

// The server action needs a session and Hasura; the cell only binds it to the forms.
vi.mock("./actions", () => ({ setVote: async () => {} }));

const company = {
  id: "c1", name: "Beispiel GmbH", employee_count: null, revenue: 1000, funding_count: 0,
  funding_total_eur: null, wz_code: null, wz_division_estimated: null, established_at: null, established_year: null, address: "Weg 1", legal_form: "GmbH",
  technology_field: null, website: "https://a.de",
  management: "Anna A; Bert B; Cora C; Dirk D; Emil E",
  business_purpose: null, activity_description: null, deeptech_class: null, deeptech_confidence: null, is_ai: false,
  register_status: "aktiv", registration_number: null, updated_at: null,
} satisfies CompanyProfile;

const prov = (over: Partial<Provenance>): Provenance => ({
  field_name: "management", value: "Anna A", source_key: "register", source_name: "Handelsregister",
  method: "register", confidence: 0.95, evidence: ["Impressum"], link: "https://a.de/impressum",
  observed_at: "2024-03-01", ...over,
});
const provenance = [
  prov({}),
  prov({ value: "Ehemalige Person" }),
  prov({ field_name: "website", value: "https://a.de", source_name: "Combined discovery", method: "register_number_match", observed_at: "2026-10-01" }),
];

const column = (key: string) => COLUMNS.find((c) => c.key === key)!;
const render = (key: string, props: Partial<Parameters<typeof FieldCell>[0]> = {}) =>
  renderToStaticMarkup(<>{FieldCell({ company, column: column(key), provenance, ...props })}</>);

describe("FieldCell", () => {
  it("shows the first three managers and counts the rest in the list's normal mode", () => {
    const html = render("management", { max: 3 });
    expect(html).toContain("Cora C");
    expect(html).not.toContain("Dirk D");
    expect(html).toContain("+ 2 weitere");
    expect(html).not.toContain("<form");
  });

  it("lets the active ✓ take the vote back, while ✗ still changes it", () => {
    const votes = tally([{ field_name: "legal_form", value: "GmbH", verdict: "correct", correction: null, author_id: "u" }], "u");
    const html = render("legal_form", { votes });
    expect(html).toMatch(/<button[^>]*value="remove"[^>]*aria-pressed="true"[^>]*aria-label="stimmt: GmbH"/);
    expect(html).toMatch(/<button[^>]*value="wrong"[^>]*aria-pressed="false"/);
  });

  it("shows every manager with ✓/✗ in review mode", () => {
    const html = render("management", { votes: tally([], "u") });
    expect(html).toContain("Emil E");
    expect(html).not.toContain("weitere");
    expect(html).toContain('aria-label="falsch: Emil E"');
  });

  it("matches a manager's provenance on the name, not on the field", () => {
    const html = render("management");
    expect(html.match(/popover="auto"/g)).toHaveLength(5);
    expect(html.match(/Keine Quelle erfasst/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Herkunft: Geschäftsführung: Anna A"');
    expect(html).not.toContain("Ehemalige Person");
  });

  it("shows source, German method, confidence, register date and page in the ⓘ", () => {
    const html = render("management");
    expect(html).toContain("Handelsregister");
    expect(html).toContain("Konfidenz");
    expect(html).toContain("95 %");
    expect(html).toContain("Registerstand");
    expect(html).toContain("Geprüft an");
  });

  it("shows an ⓘ saying so when a value has no provenance", () => {
    expect(render("legal_form")).toContain("Keine Quelle erfasst.");
  });

  it("shows an ⓘ on an empty field too", () => {
    const html = render("technology_field");
    expect(html).toContain('aria-label="Herkunft: Technologiefeld: kein Wert"');
    expect(html).toContain("Keine Quelle erfasst.");
  });

  it("lets an empty field be reported as missing, with a required value", () => {
    const html = render("technology_field", { votes: tally([], "u"), corrections: true });
    expect(html).toContain("Wert ergänzen");
    expect(html).toMatch(/<input[^>]*required/);
  });

  it("shows only the controls for the name, whose value is the heading", () => {
    const html = renderToStaticMarkup(
      <>{FieldCell({ company, column: NAME_COLUMN, provenance, votes: tally([], "u"), withValue: false })}</>,
    );
    expect(html).not.toContain(">Beispiel GmbH<");
    expect(html).toContain('aria-label="stimmt: Beispiel GmbH"');
  });
});

describe("confidence of a guess (unternehmensdatenbank #183)", () => {
  const cell = (key: string, over: Partial<CompanyProfile>, rows: Provenance[]) =>
    renderToStaticMarkup(<>{FieldCell({ company: { ...company, ...over }, column: COLUMNS.find((c) => c.key === key)!, provenance: rows })}</>);
  const tf = (confidence: number) => prov({ field_name: "technology_field", value: "Artificial Intelligence", confidence });

  it("colors each band and keeps the percent as text, also below 50 %", () => {
    const value = { technology_field: "Artificial Intelligence" };
    expect(cell("technology_field", value, [tf(0.85)])).toMatch(/class="[^"]*bg-green-100[^"]*">85 %</);
    expect(cell("technology_field", value, [tf(0.6)])).toMatch(/class="[^"]*bg-yellow-100[^"]*">60 %</);
    expect(cell("technology_field", value, [tf(0.31)])).toMatch(/class="[^"]*bg-red-100[^"]*">31 %</);
  });

  it("shows the official WZ number as certain, the estimate with its source's confidence", () => {
    const official = cell("wz_division_estimated", { wz_code: "62.01", wz_division_estimated: "56" }, []);
    expect(official).toContain(">62.01<");
    expect(official).toMatch(/bg-green-100[^"]*">100 %</);
    const estimate = cell("wz_division_estimated", { wz_division_estimated: "56" },
      [prov({ field_name: "wz_division_estimated", value: "56", confidence: 0.4 })]);
    expect(estimate).toMatch(/bg-red-100[^"]*">40 %</);
  });

  it("shows the four DeepTech classes for people, with the observation's confidence", () => {
    const html = cell("deeptech", { deeptech_class: "deep tech", deeptech_confidence: 0.9 }, []);
    expect(html).toContain("Deep Tech");
    expect(html).toMatch(/bg-green-100[^"]*">90 %</);
    expect(cell("deeptech", { deeptech_class: "non-tech", deeptech_confidence: 0.35 }, [])).toMatch(/Non-Tech.*bg-red-100[^"]*">35 %</);
  });

  it("shows no badge on the Tätigkeit, on fields that are not guesses, or without a value", () => {
    expect(cell("activity_description", { activity_description: "Software" },
      [prov({ field_name: "activity_description", value: "Software", confidence: 0.4 })])).not.toMatch(/bg-(green|yellow|red)-100/);
    expect(cell("technology_field", {}, [])).not.toContain(" %<");
    expect(cell("legal_form", {}, [prov({ field_name: "legal_form", value: "GmbH", confidence: 0.3 })])).not.toContain("bg-red-100");
  });
});
