import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { company, stubHasura } from "@/test/hasura-stub";
import CompanyPage from "./page";

// Integration: URL → Hasura variables → rendered company page. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ID = "00000000-0000-4000-8000-000000000002";
const detail = { companies: [{ ...company({ id: ID, name: "Mitte AG" }), fundings: [], comments: [], feedback: [], provenance: [] }] };
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
