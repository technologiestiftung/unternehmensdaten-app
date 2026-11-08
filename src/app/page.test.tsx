import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COLUMNS } from "@/lib/columns";
import { company, stubHasura } from "@/test/hasura-stub";
import CompaniesPage from "./page";

// Integration: URL → Hasura variables → rendered list. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
// Records the props the server page hands to client components; they must cross the RSC boundary.
const clientProps = vi.hoisted(() => [] as unknown[]);
vi.mock("./column-picker", async (importOriginal) => {
  const { ColumnPicker } = await importOriginal<typeof import("./column-picker")>();
  return { ColumnPicker: (props: Parameters<typeof ColumnPicker>[0]) => (clientProps.push(props), ColumnPicker(props)) };
});
vi.mock("./filters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./filters")>();
  return { ...actual, Filters: (props: Parameters<typeof actual.Filters>[0]) => (clientProps.push(props), actual.Filters(props)) };
});
// The browser's cookies, as next/headers would read them from the request.
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined) }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  cookieJar.clear();
});

const list = (total: number, companies = [company()]) => ({
  Companies: {
    companies: companies.map((c) => ({ ...c, comments: [], provenance: [] })),
    companies_aggregate: { aggregate: { count: total } },
    legal_form_options: [{ legal_form: "GmbH" }, { legal_form: "AG" }],
    register_status_options: [],
    technology_field_options: [],
    sources: [],
    website_tlds: [{ tld: "de", company_count: 9006 }],
  },
});
const renderParams = async (search: Record<string, string | string[]>) =>
  renderToStaticMarkup(await CompaniesPage({ searchParams: Promise.resolve(search) }));
const render = (search: Record<string, string>) => renderParams(search);
const headers = (html: string) => [...html.matchAll(/<th scope="col"[^>]*>.*?<\/th>/g)].length;

describe("company list", () => {
  it("queries Hasura as the user with the filters, sort and page from the URL", async () => {
    const requests = stubHasura(list(120));
    await render({ legal_form: "GmbH", sort: "revenue", dir: "desc", page: "3" });
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBe("Bearer token");
    expect(requests[0].variables).toMatchObject({
      where: { _and: [{ register_status: { _eq: "active" } }, { legal_form: { _in: ["GmbH"] } }] },
      order_by: [{ revenue: "desc_nulls_last" }, { name: "asc" }, { id: "asc" }],
      limit: 50,
      offset: 100,
      review: false,
    });
  });

  it("offers \"Filter zurücksetzen\" next to the hit count only while a filter is set, keeping the view settings", async () => {
    stubHasura(list(120));
    expect(await render({ sort: "revenue", page: "2", cols: "revenue" })).not.toContain("Filter zurücksetzen");
    stubHasura(list(120));
    const html = await render({ fund: "any", cols: "revenue", review: "1" });
    expect(html).toMatch(/<a [^>]*href="\/\?cols=revenue&amp;review=1"[^>]*>Filter zurücksetzen<\/a>/);
  });

  it("shows the hit count and the filter options from the database", async () => {
    stubHasura(list(120));
    const html = await render({});
    expect(html).toContain("120 Treffer, Seite 1 von 3");
    expect(html).toMatch(/<input type="checkbox" checked="" value="AG"\/>/);
    expect(html).toContain(".de (9.006)");
  });

  it("searches with the fuzzy search function, by relevance, and shows its hit count", async () => {
    const requests = stubHasura({ Companies: { ...list(7).Companies } });
    const html = await render({ q: "berghian" });
    expect(requests[0].query).toContain("companies: search_companies(args: { search: $search }");
    expect(requests[0].query).toContain("companies_aggregate: search_companies_aggregate(args: { search: $search }");
    expect(requests[0].variables).toMatchObject({ search: "berghian", order_by: [] });
    expect(html).toContain("7 Treffer");
  });

  it("filters by several values of a multi-select", async () => {
    const requests = stubHasura(list(1));
    await renderParams({ legal_form: ["GmbH", "AG"], tld: ["de"] });
    expect(requests[0].variables.where).toMatchObject({
      _and: expect.arrayContaining([{ legal_form: { _in: ["GmbH", "AG"] } }]),
    });
  });

  it("links each company with the list it came from and its position", async () => {
    stubHasura(list(120));
    const html = await render({ q: "bei", page: "2" });
    expect(html).toContain('href="/companies/00000000-0000-4000-8000-000000000001?q=bei&amp;pos=50"');
  });

  it("shows only the chosen columns, and the picker says how many", async () => {
    stubHasura(list(1));
    const html = await render({ cols: "revenue,website" });
    expect(headers(html)).toBe(3); // name + two
    expect(html).toContain(`Spalten auswählen (2 von ${COLUMNS.length} angezeigt)`);
    expect(html).not.toMatch(/<th scope="col"[^>]*>(<a[^>]*>)?Rechtsform/);
  });

  it("shows every column when cols names none that exist", async () => {
    stubHasura(list(1));
    expect(headers(await render({ cols: "salary" }))).toBe(COLUMNS.length + 1);
  });

  it("offers a page number field that keeps the filters", async () => {
    stubHasura(list(120));
    const html = await render({ q: "bei", page: "2" });
    const form = /<form[^>]*>(?:(?!<\/form>).)*page-jump.*?<\/form>/.exec(html)?.[0] ?? "";
    expect(form).toContain('<input type="hidden" name="q" value="bei"/>');
    const field = /<input id="page-jump"[^>]*>/.exec(form)?.[0] ?? "";
    for (const attr of ['type="number"', 'min="1"', 'max="3"', 'name="page"', 'value="2"']) expect(field).toContain(attr);
    expect(form).not.toContain('type="hidden" name="page"'); // the old page is not sent twice
  });

  it("has no page number field for a single page", async () => {
    stubHasura(list(3));
    expect(await render({})).not.toContain("page-jump");
  });

  it("passes client components only serializable props (no functions)", async () => {
    clientProps.length = 0;
    stubHasura(list(120));
    await render({ cols: "revenue" });
    expect(clientProps).toHaveLength(2);
    for (const props of clientProps) expect(() => structuredClone(props)).not.toThrow();
  });

  it("fails rather than showing an empty list when Hasura reports an error", async () => {
    stubHasura({});
    await expect(render({})).rejects.toThrow("Hasura request failed: no stub for Companies");
  });

  it("switches review mode with the pencil above the table, keeping the other params", async () => {
    stubHasura(list(1));
    const pencil = (html: string) => /<a[^>]*Werte bewerten[^>]*>/.exec(html)?.[0] ?? "";
    const off = pencil(await render({ q: "bei" }));
    expect(off).toContain('href="/?q=bei&amp;review=1"');
    expect(off).toContain('aria-label="Werte bewerten (✓/✗ in der Tabelle)"');
    stubHasura(list(1));
    const html = await render({ q: "bei", review: "1" });
    const on = pencil(html);
    expect(on).toContain('href="/?q=bei"');
    expect(on).toContain('aria-label="Werte bewerten beenden"');
    expect(html).toContain('<input type="hidden" name="review" value="1"/>'); // a new search stays in review mode
  });

  it("shows the columns this browser chose last time when the URL names none", async () => {
    cookieJar.set("cols", "revenue,website");
    stubHasura(list(1));
    expect(headers(await render({}))).toBe(3);
  });

  it("lets a shared link's columns win over the remembered ones", async () => {
    cookieJar.set("cols", "revenue,website");
    stubHasura(list(1));
    expect(headers(await render({ cols: "revenue" }))).toBe(2);
  });

  it("shows the register number and finds a company by it", async () => {
    const full = "Amtsgericht Berlin (Charlottenburg) HRB 121291 B";
    const requests = stubHasura(list(1, [company({ registration_number: full })]));
    const html = await render({ q: "HRB 121291" });
    expect(requests[0].variables.where).toEqual({
      _and: [{ _or: [{ name: { _ilike: "%HRB 121291%" } }, { registration_number: { _iregex: "HRB\\s*121291(\\D|$)" } }] }],
    });
    expect(html).toMatch(/<th scope="col"[^>]*><a[^>]*href="[^"]*sort=registration_number[^"]*">Registernummer /);
    expect(html).toContain(`<span title="${full}" class="whitespace-nowrap">HRB 121291 B</span>`);
  });
});

describe("Registernummer column placement", () => {
  it("comes right after the name, before every other column", async () => {
    stubHasura(list(1));
    const labels = [...(await render({})).matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map(([, th]) =>
      th.replace(/<[^>]+>/g, "").trim(),
    );
    expect(labels[0]).toMatch(/^Name/);
    expect(labels[1]).toMatch(/^Registernummer/);
  });
});

describe("WZ (geschätzt) column", () => {
  // Oracle: the intent — the estimate is its own sortable, votable column and "WZ beginnt mit" filters it, never wz_code.
  const estimated = company({ wz_code: "62.01", wz_division_estimated: "56" });

  it("filters and sorts by the estimate, never by the official wz_code", async () => {
    const requests = stubHasura(list(1, [estimated]));
    await render({ wz: "62.01", sort: "wz_division_estimated", dir: "asc" });
    const { where, order_by } = requests[0].variables;
    expect(where).toEqual({ _and: [{ register_status: { _eq: "active" } }, { wz_division_estimated: { _like: "62%" } }] });
    expect(JSON.stringify(where)).not.toContain("wz_code");
    expect((order_by as unknown[])[0]).toEqual({ wz_division_estimated: "asc_nulls_last" });
  });

  it("shows the estimate in its own sortable column, apart from the WZ-Nummer", async () => {
    stubHasura(list(1, [estimated]));
    const html = await render({});
    expect(html).toMatch(/<th scope="col"[^>]*><a[^>]*href="[^"]*sort=wz_division_estimated[^"]*">WZ \(geschätzt\)/);
    expect(html).toContain('<a href="/classifications#wz-56">56</a>');
    expect(html).toContain('<a href="/classifications#wz-62">62.01</a>');
  });

  it("offers ✓/✗ on the estimate in review mode, counting earlier votes", async () => {
    const withVotes = { ...estimated, feedback: [{ field_name: "wz_division_estimated", value: "56", verdict: "correct", author_id: "u2" }] };
    stubHasura({ Companies: { ...list(1).Companies, companies: [{ ...withVotes, comments: [], provenance: [] }] } });
    const html = await render({ review: "1" });
    const yes = /<button[^>]*aria-label="stimmt: 56"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(yes).not.toBe("");
    expect(yes).toContain("<span>1</span>");
    expect(html).toContain('aria-label="falsch: 56"');
  });
});

describe("activity description column (unternehmensdatenbank #152)", () => {
  it("asks Hasura for it and shows it as its own column", async () => {
    const own = "Wir entwickeln Software für Stadtwerke.";
    const requests = stubHasura(list(1, [company({ activity_description: own })]));
    const html = await render({ cols: "business_purpose,activity_description" });
    expect(requests[0].query).toMatch(/\bactivity_description\b/);
    expect(headers(html)).toBe(3);
    expect(html).toMatch(/<th scope="col"[^>]*>(<a[^>]*>)?Tätigkeit \(laut Website\)/);
    expect(html).toMatch(/<th scope="col"[^>]*>(<a[^>]*>)?Tätigkeitsbeschreibung/);
    expect(html).toContain(own);
  });
});
