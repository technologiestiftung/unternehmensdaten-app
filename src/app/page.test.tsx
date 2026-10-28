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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const list = (total: number, companies = [company()]) => ({
  Companies: {
    companies: companies.map((c) => ({ ...c, comments: [], provenance: [] })),
    companies_aggregate: { aggregate: { count: total } },
    legal_form_options: [{ legal_form: "GmbH" }, { legal_form: "AG" }],
    register_status_options: [],
    technologiefeld_options: [],
    sources: [],
  },
});
const render = async (search: Record<string, string>) =>
  renderToStaticMarkup(await CompaniesPage({ searchParams: Promise.resolve(search) }));
const headers = (html: string) => [...html.matchAll(/<th scope="col"[^>]*>.*?<\/th>/g)].length;

describe("company list", () => {
  it("queries Hasura as the user with the filters, sort and page from the URL", async () => {
    const requests = stubHasura(list(120));
    await render({ legal_form: "GmbH", sort: "revenue", dir: "desc", page: "3" });
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBe("Bearer token");
    expect(requests[0].variables).toMatchObject({
      where: { _and: [{ legal_form: { _eq: "GmbH" } }] },
      order_by: [{ revenue: "desc_nulls_last" }, { name: "asc" }, { id: "asc" }],
      limit: 50,
      offset: 100,
      review: false,
    });
  });

  it("shows the hit count and the filter options from the database", async () => {
    stubHasura(list(120));
    const html = await render({});
    expect(html).toContain("120 Treffer, Seite 1 von 3");
    expect(html).toContain('<option value="AG">AG</option>');
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
    expect(html).toContain(`Spalten (2 von ${COLUMNS.length})`);
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
});
