import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { company, stubHasura } from "@/test/hasura-stub";
import CompanyPage from "./page";

// Integration: URL → Hasura variables → rendered company page. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
// The votes each button would cast: [company id, field, value] as bound to setVote.
const votes = vi.hoisted(() => [] as unknown[][]);
vi.mock("./actions", () => ({
  setVote: { bind: (_: unknown, ...args: unknown[]) => (votes.push(args), async () => {}) },
  addComment: async () => {},
}));
afterEach(() => {
  votes.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ID = "00000000-0000-4000-8000-000000000002";
const detail = { companies: [{ ...company({ id: ID, name: "Mitte AG" }), fundings: [], emails: [], successor: null, comments: [], feedback: [], provenance: [], history: [] }] };
const around = (...names: string[]) => ({
  companies: names.map((name, i) => ({ id: name === "Mitte AG" ? ID : `00000000-0000-4000-8000-00000000001${i}`, name })),
});
const render = async (search: Record<string, string>, id = ID) =>
  renderToStaticMarkup(await CompanyPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(search) }));
const link = (html: string, text: string) => new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${text}</a>`).exec(html)?.[1];

describe("company page", () => {
  it("pages through a search in the search's own order", async () => {
    const requests = stubHasura({ Company: detail, Neighbours: around("Erste GmbH", "Mitte AG", "Letzte KG") });
    await render({ q: "berghian", pos: "3" });
    const neighbours = requests.find((r) => r.operation === "Neighbours");
    expect(neighbours?.query).toContain("companies: search_companies(args: { search: $search }");
    expect(neighbours?.variables).toMatchObject({ search: "berghian", order_by: [], offset: 2 });
  });

  it("links to the previous and next company of the list it came from", async () => {
    const requests = stubHasura({ Company: detail, Neighbours: around("Erste GmbH", "Mitte AG", "Letzte KG") });
    const html = await render({ legal_form: "AG", sort: "revenue", pos: "60" });
    expect(requests.find((r) => r.operation === "Neighbours")?.variables).toMatchObject({
      where: { _and: [{ register_status: { _eq: "active" } }, { legal_form: { _in: ["AG"] } }] },
      order_by: [{ revenue: "asc_nulls_last" }, { name: "asc" }, { id: "asc" }],
      offset: 59,
    });
    expect(link(html, "‹ Vorheriges")).toBe("/companies/00000000-0000-4000-8000-000000000010?legal_form=AG&amp;sort=revenue&amp;pos=59");
    expect(link(html, "Nächstes ›")).toBe("/companies/00000000-0000-4000-8000-000000000012?legal_form=AG&amp;sort=revenue&amp;pos=61");
    expect(link(html, "← Alle Unternehmen")).toBe("/?legal_form=AG&amp;sort=revenue&amp;page=2");
  });

  it("has no previous link for the first company", async () => {
    stubHasura({ Company: detail, Neighbours: around("Mitte AG", "Zweite GmbH") });
    const html = await render({ pos: "0" });
    expect(html).not.toContain("Vorheriges");
    expect(link(html, "Nächstes ›")).toContain("pos=1");
  });

  it("shows no prev/next when the list changed and the company moved", async () => {
    stubHasura({ Company: detail, Neighbours: around("Erste GmbH", "Andere AG", "Letzte KG") });
    const html = await render({ pos: "5" });
    expect(html).not.toMatch(/Vorheriges|Nächstes/);
  });

  it("does not look for neighbours without a list position, or with a broken one", async () => {
    for (const search of [{}, { pos: "-1" }, { pos: "abc" }] as Record<string, string>[]) {
      const requests = stubHasura({ Company: detail });
      const html = await render(search);
      expect(requests.map((r) => r.operation)).toEqual(["Company"]);
      expect(link(html, "← Alle Unternehmen")).toBe("/");
    }
  });

  it("shows the short register number before the legal form, with the court as tooltip and no votes", async () => {
    const full = "Amtsgericht Berlin (Charlottenburg) HRB 121291 B";
    stubHasura({ Company: { companies: [{ ...detail.companies[0], registration_number: full, legal_form: "GmbH" }] } });
    const html = await render({});
    expect(html).toContain(`<span title="${full}" class="whitespace-nowrap">HRB 121291 B</span>`);
    expect(html.indexOf("Registernummer")).toBeGreaterThan(-1);
    expect(html.indexOf("Registernummer")).toBeLessThan(html.indexOf("Rechtsform"));
    expect(votes.some(([, field]) => field === "registration_number")).toBe(false);
    expect(votes.some(([, field]) => field === "legal_form")).toBe(true);
  });

  it("is not found for an id that is not a UUID, without asking Hasura", async () => {
    const requests = stubHasura({});
    await expect(render({}, "1 OR 1=1")).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });

  it("is not found when Hasura returns no company", async () => {
    stubHasura({ Company: { companies: [] } });
    await expect(render({})).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NOT_FOUND/);
  });

  it("pages through all grants, 25 at a time, keeping the list context", async () => {
    const grant = (i: number) => ({ fkz: `FKZ${i}`, amount_eur: 1000, period_from: null, period_to: null, topic: null, ministry: null });
    const many = { companies: [{ ...detail.companies[0], funding_count: 60, fundings: [50, 51].map(grant) }] };
    const requests = stubHasura({ Company: many });
    const html = await render({ q: "bei", fpage: "3" });
    expect(requests[0].variables).toMatchObject({ id: ID, fundings_offset: 50 });
    expect(html).toContain("51–52 von 60, neueste zuerst.");
    expect(html).toContain('aria-label="Förderungen, Seiten"');
    expect(link(html, "‹")).toBe(`/companies/${ID}?q=bei&amp;fpage=2#foerderungen`);
    expect(link(html, "1")).toBe(`/companies/${ID}?q=bei#foerderungen`);
    expect(html).not.toContain('aria-label="Nächste Seite"'); // page 3 of 3
  });

  it("shows the last grants page for a page number past the end", async () => {
    const grant = (i: number) => ({ fkz: `FKZ${i}`, amount_eur: 1000, period_from: null, period_to: null, topic: null, ministry: null });
    const many = { companies: [{ ...detail.companies[0], funding_count: 60, fundings: [50, 51].map(grant) }] };
    const requests = stubHasura({ Company: many });
    const html = await render({ fpage: "99" });
    expect(requests.map((r) => r.variables.fundings_offset)).toEqual([2450, 50]);
    expect(html).toContain("51–52 von 60, neueste zuerst.");
    expect(html).toContain('aria-current="page"');
    expect(link(html, "‹")).toBe(`/companies/${ID}?fpage=2#foerderungen`);
  });

  it("has no grants pager when they fit on one page", async () => {
    stubHasura({ Company: detail });
    expect(await render({})).not.toContain("Förderungen, Seiten");
  });
});

describe("company history", () => {
  const change = {
    id: 2, field_key: "address", event: "replaced", value: "Neue Straße 1", previous_value: "Weg 1, Berlin",
    confidence: 0.8, previous_confidence: 1, source_name: "Testquelle", changed_at: "2026-10-30T09:00:00Z",
  };
  const withHistory = { companies: [{ ...detail.companies[0], history: [change] }] };

  it("shows each change of a shown value with old and new value and confidence", async () => {
    const requests = stubHasura({ Company: withHistory });
    const html = await render({});
    expect(html).toContain("Verlauf");
    expect(html).toContain("Adresse");
    expect(html).toContain("Weg 1, Berlin → Neue Straße 1");
    expect(html).toMatch(/100\s%\s→\s80\s%/); // de-DE puts a no-break space before %
    expect(requests.map((r) => r.operation)).not.toContain("Claims");
  });

  it("loads every claim only when the toggle asks for it, and the toggle goes back", async () => {
    const claim = {
      id: "c1", field_key: "website", value: "https://kandidat.de", confidence: 0.2, is_shown: false,
      method: null, source_name: "Website-Suche", read_at: "2026-10-01T00:00:00Z",
    };
    const requests = stubHasura({ Company: withHistory, Claims: { company_claims: [claim] } });
    const html = await render({ claims: "1" });
    expect(requests.find((r) => r.operation === "Claims")?.variables).toEqual({ id: ID });
    expect(html).toContain("https://kandidat.de");
    expect(link(html, "Nur angezeigte Werte")).toBe(`/companies/${ID}#verlauf`);
  });

  it("does not carry the toggle to the next company or back to the list", async () => {
    stubHasura({ Company: withHistory, Claims: { company_claims: [] }, Neighbours: around("Mitte AG", "Zweite GmbH") });
    const html = await render({ claims: "1", pos: "0" });
    expect(link(html, "Nächstes ›")).not.toContain("claims");
    expect(link(html, "← Alle Unternehmen")).not.toContain("claims");
  });
});

describe("restoring from the history", () => {
  const base = { ...detail.companies[0], address: "Neue Straße 1", employee_count: 12, deeptech_class: "A" };
  const replaced = {
    id: 3, field_key: "address", event: "replaced", value: "Neue Straße 1", previous_value: "Weg 1, Berlin",
    confidence: 0.8, previous_confidence: 1, source_name: "Testquelle", changed_at: "2026-10-30T09:00:00Z",
  };
  const claims = [
    { id: "a", field_key: "employee_count", value: "12.0", confidence: 1, is_shown: true, method: null, source_name: "Register", read_at: null },
    { id: "b", field_key: "address", value: "Weg 1, Berlin", confidence: 0.3, is_shown: false, method: null, source_name: "Register", read_at: null },
    { id: "c", field_key: "postcode", value: "10115", confidence: 1, is_shown: true, method: null, source_name: "Register", read_at: null },
    { id: "d", field_key: "deeptech", value: "A", confidence: 1, is_shown: true, method: null, source_name: "Modell", read_at: null },
  ];
  const html = async () => {
    stubHasura({ Company: { companies: [{ ...base, history: [replaced] }] }, Claims: { company_claims: claims } });
    return render({ claims: "1" });
  };
  // The ✗ buttons of the claims table (the profile above has its own ✓/✗ for the shown values).
  const wrongs = (page: string) =>
    [...page.slice(page.indexOf("Jede Angabe")).matchAll(/aria-label="falsch: ([^"]*)"/g)].map((m) => m[1]);
  const forms = (page: string, label: string) =>
    [...page.matchAll(new RegExp(`<form[^>]*>(?:(?!</form>).)*>${label}</button></form>`, "g"))].map((m) => m[0]);

  it("offers the former value back as a correction of the shown one", async () => {
    const restore = forms(await html(), "Wiederherstellen");
    expect(restore).toHaveLength(1);
    expect(restore[0]).toContain('name="verdict" value="wrong"');
    expect(restore[0]).toContain('name="correction" value="Weg 1, Berlin"');
  });

  it("offers to adopt a claim that is not shown, never one equal to the shown value", async () => {
    const adopt = forms(await html(), "Übernehmen");
    expect(adopt).toHaveLength(1); // the address, not the employee count shown as 12 ("12.0") nor the shown DeepTech class
    expect(adopt[0]).toContain('value="Weg 1, Berlin"');
  });

  it("gives every claim of a votable field the usual ✓/✗, and none of a field without votes", async () => {
    const page = await html();
    expect(wrongs(page)).toEqual(["12", "Weg 1, Berlin", "A"]); // the postcode has no vote
    expect(page).not.toContain(">Falsch</button>");
  });

  it("shows your own vote on a claim like everywhere else, ready to be taken back", async () => {
    const feedback = [{ field_name: "address", value: "Weg 1, Berlin", verdict: "wrong", correction: null, author_id: "u1" }];
    stubHasura({ Company: { companies: [{ ...base, feedback, history: [] }] }, Claims: { company_claims: [claims[1]] } });
    const page = await render({ claims: "1" });
    const claimsTable = page.slice(page.indexOf("Jede Angabe"));
    expect(claimsTable).toMatch(/<button[^>]*value="remove"[^>]*aria-pressed="true"[^>]*aria-label="falsch: Weg 1, Berlin"/);
  });

  it("marks a number claim wrong on the value the profile shows, not the claim's \"12.0\"", async () => {
    stubHasura({
      Company: { companies: [{ ...base, history: [] }] },
      Claims: { company_claims: [claims[0], { ...claims[0], id: "e", value: "13.0", is_shown: false }] },
    });
    const page = await render({ claims: "1" });
    expect(votes).toContainEqual([ID, "employee_count", "13"]);
    expect(votes.flat()).not.toContain("12.0");
    expect(votes.flat()).not.toContain("13.0");
    expect(forms(page, "Übernehmen")[0]).toContain('name="correction" value="13"');
  });

  it("lets a short claim be marked wrong even when the shown value is too long to vote on", async () => {
    const shown = "x".repeat(600);
    stubHasura({
      Company: { companies: [{ ...base, business_purpose: shown, history: [] }] },
      Claims: { company_claims: [{ ...claims[1], field_key: "business_purpose", value: "Software" }] },
    });
    const page = await render({ claims: "1" });
    expect(forms(page, "Übernehmen")).toHaveLength(0);
    expect(wrongs(page)).toEqual(["Software"]);
    expect(votes).toContainEqual([ID, "business_purpose", "Software"]);
  });

  it("offers no vote on a value longer than the vote action accepts", async () => {
    const long = "x".repeat(501);
    stubHasura({
      Company: { companies: [{ ...base, history: [{ ...replaced, previous_value: long }] }] },
      Claims: { company_claims: [{ ...claims[1], value: long }] },
    });
    const page = await render({ claims: "1" });
    for (const label of ["Wiederherstellen", "Übernehmen"]) expect(forms(page, label)).toHaveLength(0);
    expect(wrongs(page)).toEqual([]);
  });
});

describe("Gründung", () => {
  const founded = (over: Record<string, unknown>, history: unknown[] = []) => ({
    companies: [{ ...detail.companies[0], ...over, history }],
  });

  it("shows the year alone when a person corrected it away from the date, and votes on the year", async () => {
    stubHasura({ Company: founded({ established_at: "2010-05-12", established_year: 2012 }) });
    const html = await render({});
    expect(html).toContain("Gründung");
    expect(html).toContain("2012");
    expect(html).not.toContain("12.05.2010");
    expect(html).not.toContain("01.01.2012");
    expect(votes).toContainEqual([ID, "established_year", "2012"]);
  });

  it("names older history rows on the exact date Gründungsdatum", async () => {
    const change = {
      id: 3, field_key: "established_at", event: "replaced", value: "2011-03-01", previous_value: "2010-05-12",
      confidence: 0.9, previous_confidence: 1, source_name: "Testquelle", changed_at: "2026-10-30T09:00:00Z",
    };
    stubHasura({ Company: founded({ established_at: "2010-05-12", established_year: 2010 }, [change]) });
    const html = await render({});
    expect(html).toContain("12.05.2010");
    expect(html).toContain("Gründungsdatum");
  });

  it("lists every stored email as a mailto link, and a dash without one", async () => {
    stubHasura({ Company: { companies: [{ ...detail.companies[0], emails: [{ email: "info@mitte.example" }, { email: "kontakt@mitte.example" }] }] } });
    const html = await render({});
    expect(html).toContain('<dt class="border-b border-zinc-100 py-2.5 pr-4 text-zinc-500">E-Mail</dt>');
    expect(link(html, "info@mitte.example")).toBe("mailto:info@mitte.example");
    expect(link(html, "kontakt@mitte.example")).toBe("mailto:kontakt@mitte.example");
    stubHasura({ Company: detail });
    expect(await render({})).toMatch(/E-Mail<\/dt><dd[^>]*>–<\/dd>/);
  });

  it("links GLEIF's successor right after the register status, and shows no row without one", async () => {
    const successor = { successor_id: "22222222-2222-4222-8222-222222222222", successor_name: "Nachfolge e.V.", source: "GLEIF" };
    const requests = stubHasura({ Company: { companies: [{ ...detail.companies[0], successor }] } });
    const html = await render({});
    expect(requests.find((r) => r.operation === "Company")?.query).toMatch(/successor\s*\{/);
    expect(link(html, "Nachfolge e.V.")).toBe(`/companies/${successor.successor_id}`);
    expect(html).toContain("(laut GLEIF)");
    expect(html.indexOf("Nachfolger</dt>")).toBeGreaterThan(html.indexOf("Registerstatus</dt>"));
    stubHasura({ Company: detail });
    expect(await render({})).not.toContain("Nachfolger");
  });

  it("shows a person's email too, as the last field, with nothing to vote on", async () => {
    const person = "max.mustermann@mitte.example";
    const requests = stubHasura({ Company: { companies: [{ ...detail.companies[0], emails: [{ email: person }] }] } });
    const html = await render({});
    expect(requests.find((r) => r.operation === "Company")?.query).toMatch(/emails\s*\(/);
    const row = /E-Mail<\/dt><dd[^>]*>(.*?)<\/dd>/.exec(html)?.[1] ?? "";
    expect(link(row, person)).toBe(`mailto:${person}`);
    expect(row).not.toMatch(/<button|<form|ⓘ/);
    expect(html.slice(html.indexOf("E-Mail</dt>")).match(/<dt/g)).toBeNull(); // no field after it in the list
    expect(votes.some(([, field]) => String(field).includes("email"))).toBe(false);
  });

  it("labels each email with its kind and confidence, and an old one without a kind by its confidence only", async () => {
    const emails = [
      { email: "info@mitte.example", kind: "role", confidence: 0.6 },
      { email: "dsb@agentur.example", kind: "other_domain", confidence: 0.2 },
      { email: "alt@mitte.example", kind: null, confidence: 0.6 },
    ];
    const requests = stubHasura({ Company: { companies: [{ ...detail.companies[0], emails }] } });
    const html = await render({});
    expect(requests[0].query).toMatch(/emails\(order_by: \[\{ confidence: desc_nulls_last \}/);
    const row = /E-Mail<\/dt><dd[^>]*>(.*?)<\/dd>/.exec(html)?.[1] ?? "";
    expect(row).toContain("Firmenadresse · 60 %");
    expect(row).toContain("andere Domain · 20 %");
    expect(row).toMatch(/alt@mitte\.example<\/a><span[^>]*>60 %<\/span>/);
  });

  it("names a personal address, shows a kind without a confidence alone, and labels nothing it knows nothing about", async () => {
    const emails = [
      { email: "anna.schmidt@mitte.example", kind: "person", confidence: 0.4 },
      { email: "neu@mitte.example", kind: "role", confidence: null },
      { email: "leer@mitte.example", kind: null, confidence: null },
    ];
    stubHasura({ Company: { companies: [{ ...detail.companies[0], emails }] } });
    const row = /E-Mail<\/dt><dd[^>]*>(.*?)<\/dd>/.exec(await render({}))?.[1] ?? "";
    expect(row).toContain("Personenadresse · 40 %");
    expect(row).toMatch(/neu@mitte\.example<\/a><span[^>]*>Firmenadresse<\/span>/);
    expect(row).toMatch(/leer@mitte\.example<\/a><\/li>/);
    expect(row).not.toMatch(/vote|Prüf|Quelle/i);
  });
});
