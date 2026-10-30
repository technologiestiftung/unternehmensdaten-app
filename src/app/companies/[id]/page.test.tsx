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
const detail = { companies: [{ ...company({ id: ID, name: "Mitte AG" }), fundings: [], comments: [], feedback: [], provenance: [], history: [] }] };
const around = (...names: string[]) => ({
  companies: names.map((name, i) => ({ id: name === "Mitte AG" ? ID : `00000000-0000-4000-8000-00000000001${i}`, name })),
});
const render = async (search: Record<string, string>, id = ID) =>
  renderToStaticMarkup(await CompanyPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(search) }));
const link = (html: string, text: string) => new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${text}</a>`).exec(html)?.[1];

describe("company page", () => {
  it("links to the previous and next company of the list it came from", async () => {
    const requests = stubHasura({ Company: detail, Neighbours: around("Erste GmbH", "Mitte AG", "Letzte KG") });
    const html = await render({ legal_form: "AG", sort: "revenue", pos: "60" });
    expect(requests.find((r) => r.operation === "Neighbours")?.variables).toMatchObject({
      where: { _and: [{ legal_form: { _eq: "AG" } }] },
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

  it("lets every claim of a votable field be marked wrong, and none of a field without votes", async () => {
    const wrong = forms(await html(), "Falsch");
    expect(wrong).toHaveLength(3); // employee count, address and DeepTech class; the postcode has no vote
    expect(wrong.every((f) => !f.includes('name="correction"'))).toBe(true);
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
    expect(forms(page, "Falsch")).toHaveLength(1);
    expect(votes).toContainEqual([ID, "business_purpose", "Software"]);
  });

  it("offers no vote on a value longer than the vote action accepts", async () => {
    const long = "x".repeat(501);
    stubHasura({
      Company: { companies: [{ ...base, history: [{ ...replaced, previous_value: long }] }] },
      Claims: { company_claims: [{ ...claims[1], value: long }] },
    });
    const page = await render({ claims: "1" });
    for (const label of ["Wiederherstellen", "Übernehmen", "Falsch"]) expect(forms(page, label)).toHaveLength(0);
  });
});
