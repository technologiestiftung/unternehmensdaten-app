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
  funding_total_eur: null, wz_code: null, established_at: null, address: "Weg 1", legal_form: "GmbH",
  cluster: null, technologiefeld: null, website: "https://a.de",
  management: "Anna A; Bert B; Cora C; Dirk D; Emil E",
  business_purpose: null, deeptech_class: null, deeptech_confidence: null, is_ai: false,
  amazon_effect: null, register_status: "aktiv", updated_at: null,
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

  it("shows every manager with ✓/✗ in review mode", () => {
    const html = render("management", { votes: tally([], "u") });
    expect(html).toContain("Emil E");
    expect(html).not.toContain("weitere");
    expect(html).toContain('aria-label="falsch: Emil E"');
  });

  it("matches a manager's provenance on the name, not on the field", () => {
    const html = render("management");
    expect(html.match(/popover="auto"/g)).toHaveLength(1);
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

  it("shows no ⓘ when there is no provenance", () => {
    expect(render("legal_form")).not.toContain("popover");
  });

  it("lets an empty field be reported as missing, with a required value", () => {
    const html = render("cluster", { votes: tally([], "u"), corrections: true });
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
