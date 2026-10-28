import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceOverview } from "@/lib/sources";
import { stubHasura } from "@/test/hasura-stub";
import SourcesPage from "./page";

// Integration: Hasura's answer → rendered page. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const source = (over: Partial<SourceOverview> = {}): SourceOverview => ({
  source_key: "impressum_contacts", name: "Impressum contacts", source_type: "website",
  records: 150, companies: 150, companies_created: 0,
  last_run_started_at: "2026-10-28T20:00:00Z", last_run_finished_at: "2026-10-28T20:07:00Z",
  last_run_status: "success", last_run_seen: 50, last_run_failed: 0,
  runs: 3, runs_interrupted: 0, counts_as_of: "2026-10-28T20:10:00Z",
  fields: [
    { field_name: "email", observations: 87, companies: 87, companies_shown: 0 },
    { field_name: "phone", observations: 110, companies: 110, companies_shown: 0 },
  ],
  ...over,
});
const render = async () => renderToStaticMarkup(await SourcesPage());
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("sources page", () => {
  it("asks Hasura as the signed-in user", async () => {
    const requests = stubHasura({ SourceOverview: { source_overview: [source()] } });
    await render();
    expect(requests).toEqual([expect.objectContaining({ operation: "SourceOverview", authorization: "Bearer token" })]);
  });

  it("shows stored and shown per field, in German, so a withheld field reads as stored but not shown", async () => {
    stubHasura({ SourceOverview: { source_overview: [source()] } });
    const page = text(await render());
    expect(page).toContain("E-Mail: 87 / 0");
    expect(page).toContain("Telefon: 110 / 0");
    expect(page).toContain("erfolgreich");
  });

  it("links each source to the company list filtered by it", async () => {
    stubHasura({ SourceOverview: { source_overview: [source()] } });
    expect(await render()).toContain('href="/?source=impressum_contacts"');
  });

  it("says how many companies a source created and how many runs were interrupted", async () => {
    stubHasura({
      SourceOverview: {
        source_overview: [
          source({ source_key: "registerbekanntmachungen", name: "Registerbekanntmachungen", companies: 854, companies_created: 411, fields: [] }),
          source({ source_key: "website_discovery", name: "Website discovery", last_run_status: "running", runs: 35, runs_interrupted: 11 }),
        ],
      },
    });
    const page = text(await render());
    expect(page).toContain("davon 411 neu angelegt");
    expect(page).toContain("11 von 35 Läufen unterbrochen");
    expect(page).toContain("läuft");
  });

  it("tells a register source apart from a source that has delivered nothing yet", async () => {
    stubHasura({
      SourceOverview: {
        source_overview: [
          source({ source_key: "offeneregister", name: "OffeneRegister", source_type: "register", fields: [] }),
          source({ source_key: "new_source", name: "Neue Quelle", fields: [], last_run_status: null, last_run_started_at: null }),
        ],
      },
    });
    const page = text(await render());
    expect(page).toContain("Registerdaten: Name, Adresse, Rechtsform, Status");
    expect(page).toContain("noch keine Werte");
    expect(page).toContain("noch kein Lauf");
  });

  it("is a table with a caption, column headers and one row header per source", async () => {
    stubHasura({ SourceOverview: { source_overview: [source(), source({ source_key: "b", name: "B" })] } });
    const html = await render();
    expect(html).toContain("<caption");
    expect([...html.matchAll(/<th scope="col"/g)]).toHaveLength(4);
    expect([...html.matchAll(/<th scope="row"/g)]).toHaveLength(2);
  });
});
