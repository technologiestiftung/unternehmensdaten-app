import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubHasura } from "@/test/hasura-stub";
import ClassificationsPage from "./page";

// Integration: Hasura → rendered page. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const answer = {
  Classifications: {
    technology_fields: [
      {
        name: "Künstliche Intelligenz", name_en: "Artificial Intelligence", senweb_unit: "SenWiEnBe II A", related: ["Data Science"],
        keywords: [
          { keyword: "KI", removed_at: null, removed_reason: null },
          { keyword: "Modell", removed_at: "2026-10-20T00:00:00Z", removed_reason: "fired on 40 fashion sites" },
        ],
      },
    ],
    wz_divisions: [
      { division: "62", title: "Erbringung von Dienstleistungen der Informationstechnologie", section: "J", section_title: "Information und Kommunikation" },
    ],
  },
};
const render = async () => renderToStaticMarkup(await ClassificationsPage());

describe("classifications page", () => {
  it("asks Hasura as the user", async () => {
    const requests = stubHasura(answer);
    await render();
    expect(requests).toMatchObject([{ operation: "Classifications", authorization: "Bearer token" }]);
  });

  it("shows each Technologiefeld under the name companies show, with its German name and keywords", async () => {
    stubHasura(answer);
    const html = await render();
    expect(html).toContain('id="tf-artificial-intelligence"');
    expect(html).toContain("Künstliche Intelligenz · zuständig: SenWiEnBe II A");
    expect(html).toContain("Verwandt: Data Science");
    expect(html).toMatch(/Schlagwörter: <\/span>KI</);
  });

  it("lists removed keywords apart, with the reason", async () => {
    stubHasura(answer);
    const html = await render();
    expect(html).toContain("1 entferntes Schlagwort");
    expect(html).toContain('<span class="line-through">Modell</span>');
    expect(html).toContain("fired on 40 fashion sites");
    expect(html).not.toMatch(/Schlagwörter: <\/span>[^<]*Modell/);
  });

  it("shows the WZ sections with their divisions, each with an anchor", async () => {
    stubHasura(answer);
    const html = await render();
    expect(html).toContain("J – Information und Kommunikation");
    expect(html).toMatch(/id="wz-62"[^>]*>.*62<\/span>Erbringung von Dienstleistungen/);
  });
});
