import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Round, Task } from "@/lib/review";
import { stubHasura } from "@/test/hasura-stub";
import { removeVerdict, saveVerdict } from "./actions";
import ReviewRoundsPage from "./page";
import ReviewRoundPage from "./[round]/page";
import ReviewResultsPage from "./[round]/ergebnis/page";

// Integration: Hasura's answer → rendered page or mutation. Only the session and the network are stubbed.
vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({ accessToken: "token", userId: "u1" }),
  authOptions: () => ({}),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ROUND_ID = "00000000-0000-4000-8000-0000000000aa";
const TASK_ID = "00000000-0000-4000-8000-0000000000bb";
const ON = { ReviewSettings: { review_settings: [{ enabled: true }] } };
const OFF = { ReviewSettings: { review_settings: [{ enabled: false }] } };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const round = (over: Partial<Round> = {}): Round => ({
  id: ROUND_ID, source_key: "website_discovery", field_name: "website", feedback_field: "website",
  kind: "shown", mode: "measure", version: "abc123", title: "website · shown · website_discovery", size: 200,
  created_at: "2026-11-06T10:00:00Z", closed_at: null,
  results: { tasks: 200, judged: 34, correct: 30, wrong: 4, unsure: 0, corrected: 2, suggestion_judged: 0, suggestion_taken: 0, precision: 0.882 },
  ...over,
});
const task = (over: Partial<Task> = {}): Task => ({
  id: TASK_ID, position: 1, company_id: "00000000-0000-4000-8000-000000000001", value: "https://beispiel.de",
  confidence: 0.9, evidence: ["register_match"], method: null, suggestion: null,
  company: { name: "Beispiel GmbH", website: "https://beispiel.de" }, verdict: null, ...over,
});

describe("rounds page", () => {
  it("lists rounds with progress and precision", async () => {
    stubHasura({ ...ON, ReviewRounds: { review_rounds: [round(), round({ id: "x", mode: "teach", results: { ...round().results!, precision: null } })] } });
    const page = text(renderToStaticMarkup(await ReviewRoundsPage()));
    expect(page).toContain("34 von 200");
    expect(page).toContain("88 %");
    expect(page).toContain("angezeigte Werte prüfen · lehren");
  });

  it("is not there while the review queue is switched off", async () => {
    stubHasura(OFF);
    await expect(ReviewRoundsPage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NOT_FOUND/);
  });

  it("counts a failed read of the switch as off", async () => {
    stubHasura({}); // ReviewSettings answers with a GraphQL error
    await expect(ReviewRoundsPage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NOT_FOUND/);
  });
});

describe("round page", () => {
  const render = async () => renderToStaticMarkup(await ReviewRoundPage({ params: Promise.resolve({ round: ROUND_ID }) }));

  it("opens websites in a new tab, never embedded", async () => {
    stubHasura({ ...ON, ReviewRound: { review_rounds: [{ ...round(), tasks: [task()] }] } });
    const html = await render();
    expect(html).toMatch(/<a href="https:\/\/beispiel.de\/" target="_blank" rel="noopener noreferrer"/);
    expect(html).not.toContain("<iframe");
    expect(text(html)).toContain("Beispiel GmbH");
  });

  it("shows the Technologiefelder in the options panel with the AI's value marked", async () => {
    stubHasura({
      ...ON,
      ReviewRound: { review_rounds: [{ ...round({ field_name: "technology_field", feedback_field: "technology_field" }), tasks: [task({ value: "Photonics" })] }] },
      Classifications: {
        technology_fields: [
          { name: "Photonik", name_en: "Photonics", senweb_unit: null, related: [], keywords: [{ keyword: "Laser", removed_at: null, removed_reason: null }] },
        ],
        wz_divisions: [],
      },
    });
    const page = text(await render());
    expect(page).toContain("Photonik");
    expect(page).toContain("Laser");
    expect(page).toContain("(Vorschlag)");
  });

  it("refuses a round id that is not a UUID", async () => {
    stubHasura(ON);
    await expect(ReviewRoundPage({ params: Promise.resolve({ round: "1 OR 1=1" }) })).rejects.toThrow();
  });
});

describe("results page", () => {
  it("groups wrong answers by reason and compares with the previous version", async () => {
    stubHasura({
      ...ON,
      ReviewRoundResults: {
        review_rounds: [{ ...round(), breakdown: [{ dimension: "reason", bucket: "Verzeichnis", correct: 0, wrong: 3 }] }],
      },
      EarlierReviewRounds: {
        review_rounds: [round({ id: "old", version: "old1", results: { ...round().results!, precision: 0.7, judged: 200 } })],
      },
    });
    const page = text(renderToStaticMarkup(await ReviewResultsPage({ params: Promise.resolve({ round: ROUND_ID }) })));
    expect(page).toContain("Falsch nach Grund");
    expect(page).toContain("Verzeichnis 3");
    expect(page).toContain("vorher (Version old1) 70 %");
  });
});

describe("actions", () => {
  it("saves a verdict as an upsert on the task", async () => {
    const requests = stubHasura({ SaveReviewVerdict: { insert_review_verdicts_one: { task_id: TASK_ID } } });
    expect(await saveVerdict(TASK_ID, "wrong", "Verzeichnis", "https://richtig.de")).toBe(true);
    expect(requests[0].variables).toEqual({ task_id: TASK_ID, verdict: "wrong", reason: "Verzeichnis", correction: "https://richtig.de" });
  });

  it("drops a reason on richtig and sends nothing for an invalid answer", async () => {
    const requests = stubHasura({ SaveReviewVerdict: { insert_review_verdicts_one: { task_id: TASK_ID } } });
    await saveVerdict(TASK_ID, "correct", "Verzeichnis", null);
    expect(requests[0].variables).toMatchObject({ verdict: "correct", reason: null, correction: null });
    expect(await saveVerdict("nope", "correct", null, null)).toBe(false);
    expect(await saveVerdict(TASK_ID, "maybe", null, null)).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("reports a verdict someone else owns as not saved", async () => {
    stubHasura({ SaveReviewVerdict: { insert_review_verdicts_one: null } });
    expect(await saveVerdict(TASK_ID, "correct", null, null)).toBe(false);
  });

  it("takes a verdict back", async () => {
    const requests = stubHasura({ RemoveReviewVerdict: { delete_review_verdicts_by_pk: { task_id: TASK_ID } } });
    expect(await removeVerdict(TASK_ID)).toBe(true);
    expect(requests[0]).toMatchObject({ operation: "RemoveReviewVerdict", variables: { task_id: TASK_ID } });
  });
});
