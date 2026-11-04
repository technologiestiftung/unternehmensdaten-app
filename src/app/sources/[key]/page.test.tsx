import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceDetail } from "@/lib/sources";
import { stubHasura } from "@/test/hasura-stub";
import SourcePage from "./page";

// Integration: Hasura's answer → rendered page. Only the session, the network and notFound are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const source = (over: Partial<SourceDetail> = {}): SourceDetail => ({
  source_key: "wirtschaftsatlas", name: "Wirtschaftsatlas Berlin (Berlin Partner)", source_type: "directory",
  base_url: "https://www.businesslocationcenter.de/wirtschaftsatlas-berlin/",
  description: "Unternehmen mit Website aus den Branchenebenen des Wirtschaftsatlas.",
  terms: "Laut Impressum braucht jede Verwendung die vorherige Zustimmung von Berlin Partner.",
  terms_url: "https://www.businesslocationcenter.de/impressum", schedule: "nur von Hand", priority: 100,
  records: 2253, companies: 2253, companies_created: 0,
  records_by_identifier: 0, records_by_name: 2253, records_by_hand: 0, avg_match_confidence: 0.85,
  last_run_started_at: "2026-11-04T10:20:49Z", last_run_finished_at: "2026-11-04T10:21:15Z",
  last_run_status: "success", last_run_seen: 50, last_run_failed: 0,
  runs: 2, runs_interrupted: 0, counts_as_of: "2026-11-04T11:00:00Z",
  fields: [{
    field_name: "website", observations: 21, companies: 21, companies_shown: 15, companies_beaten: 2,
    avg_confidence: 0.99, confidence_zero: 0, confidence_below_035: 0, confidence_035_060: 0,
    confidence_060_080: 1, confidence_080_up: 20, last_observed_at: "2026-11-04T10:21:15Z",
  }],
  recent_runs: [
    { started_at: "2026-11-04T10:20:49Z", finished_at: "2026-11-04T10:21:15Z", status: "success",
      records_seen: 50, records_created: 21, records_updated: 0, records_failed: 0, interrupted: false },
    { started_at: "2026-11-03T08:00:00Z", finished_at: null, status: "running",
      records_seen: 0, records_created: 0, records_updated: 0, records_failed: 0, interrupted: true },
  ],
  ...over,
});
const render = async (key = "wirtschaftsatlas") =>
  renderToStaticMarkup(await SourcePage({ params: Promise.resolve({ key }) }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("source page", () => {
  it("asks Hasura for this one source as the signed-in user", async () => {
    const requests = stubHasura({ SourceDetail: { source_overview: [source()] } });
    await render();
    expect(requests).toEqual([expect.objectContaining({
      operation: "SourceDetail", variables: { key: "wirtschaftsatlas" }, authorization: "Bearer token",
    })]);
  });

  it("says what the source is, where it comes from and under which terms", async () => {
    stubHasura({ SourceDetail: { source_overview: [source()] } });
    const html = await render();
    expect(text(html)).toContain("Branchenebenen des Wirtschaftsatlas");
    expect(text(html)).toContain("vorherige Zustimmung von Berlin Partner");
    expect(text(html)).toContain("nur von Hand");
    expect(html).toContain('href="https://www.businesslocationcenter.de/impressum"');
  });

  it("says terms nobody checked are not checked, never that they are fine", async () => {
    stubHasura({ SourceDetail: { source_overview: [source({ terms: null, terms_url: null })] } });
    expect(text(await render())).toContain("Nutzungsbedingungen nicht geprüft");
  });

  it("shows how records found their company, with the match confidence in German", async () => {
    stubHasura({ SourceDetail: { source_overview: [source()] } });
    const page = text(await render());
    expect(page).toContain("über den Namen: 2.253");
    expect(page).toContain("Ø Sicherheit der Zuordnung: 0,85");
  });

  it("shows per field the companies, how often another value won, and values per confidence range", async () => {
    stubHasura({ SourceDetail: { source_overview: [source()] } });
    const page = text(await render());
    expect(page).toContain("Website 21 15 2 0,99 0 0 0 1 20");
    expect(page).toContain("keine gemessene Trefferquote");
  });

  it("lists the last runs and marks an interrupted one", async () => {
    stubHasura({ SourceDetail: { source_overview: [source()] } });
    const page = text(await render());
    expect(page).toContain("erfolgreich 50 21 0 0");
    expect(page).toContain("unterbrochen");
  });

  it("is not found for an unknown source, without asking Hasura for a malformed key", async () => {
    const requests = stubHasura({ SourceDetail: { source_overview: [] } });
    await expect(render("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render("../companies")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(requests).toHaveLength(1);
  });

  it("has tables with captions and row headers", async () => {
    stubHasura({ SourceDetail: { source_overview: [source()] } });
    const html = await render();
    expect(html.match(/<caption/g)).toHaveLength(2);
    expect(html).toContain('<th scope="row" class="font-medium">Website</th>');
  });
});
