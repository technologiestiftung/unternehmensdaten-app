import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Round, Task } from "@/lib/review";
import { stubHasura } from "@/test/hasura-stub";
import { deleteRound, removeVerdict, renameRound, requestRound, saveVerdict } from "./actions";
import ReviewRoundsPage from "./page";
import ReviewRoundPage from "./[round]/page";
import ReviewResultsPage from "./[round]/ergebnis/page";

// Integration: Hasura's answer → rendered page or mutation. Only the session and the network are stubbed.
const session = vi.hoisted(() => ({ accessToken: "token" }));
vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({ accessToken: session.accessToken, userId: "u1" }),
  authOptions: () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
/** An access token carrying Keycloak realm roles; its signature is Hasura's to check, never the app's. */
const tokenWith = (...roles: string[]) =>
  `h.${Buffer.from(JSON.stringify({ realm_access: { roles } })).toString("base64url")}.s`;
afterEach(() => {
  session.accessToken = "token";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe("managing rounds (#190)", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  /** Where a server action sent the person: Next's redirect throws with the target in its digest. */
  const redirectTo = async (action: Promise<void>) => {
    const error = await action.then(() => null, (e: { digest?: string }) => e);
    return error?.digest?.split(";")[2];
  };

  it("offers the form, the requests and delete only to a manager", async () => {
    stubHasura({ ...ON, ReviewRounds: { review_rounds: [round()] } });
    const plain = text(renderToStaticMarkup(await ReviewRoundsPage()));
    expect(plain).not.toContain("Neue Runde");
    expect(plain).not.toContain("Löschen");

    session.accessToken = tokenWith("user", "manager");
    const requests = stubHasura({
      ...ON,
      ReviewRounds: { review_rounds: [round()] },
      ReviewRoundRequests: { review_round_requests: [{ id: "r1", field_name: "website", kind: "gap", source_key: null, size: 200, mode: "measure", title: null, status: "failed", error: "nothing to draw for website · gap · None", requested_at: "2026-11-11T10:00:00Z" }] },
    });
    const page = text(renderToStaticMarkup(await ReviewRoundsPage({ searchParams: Promise.resolve({ meldung: "deleted" }) })));
    expect(page).toContain("Neue Runde");
    expect(page).toContain("Grund: nothing to draw for website · gap · None");
    expect(page).toContain("Löscht die Runde mit 34 Antworten. Ihre Stimmen werden zurückgenommen");
    expect(page).toContain("Runde gelöscht, ihre Stimmen zurückgenommen.");
    expect(requests.find((r) => r.operation === "ReviewRoundRequests")?.role).toBe("manager");
    expect(requests.find((r) => r.operation === "ReviewRounds")?.role).toBeNull();
  });

  it("asks for a round as manager, with a gap's source dropped", async () => {
    session.accessToken = tokenWith("manager");
    const requests = stubHasura({ RequestReviewRound: { insert_review_round_requests_one: { id: "r1" } } });
    await expect(requestRound(form({ field_name: "website", kind: "gap", source_key: "website_discovery", size: "200", mode: "measure", title: "" })))
      .rejects.toThrow(/NEXT_REDIRECT/);
    expect(requests[0].role).toBe("manager");
    expect(requests[0].variables).toEqual({ object: { field_name: "website", kind: "gap", source_key: null, size: 200, mode: "measure", title: null } });
  });

  it("sends nothing for a person without the role or for an invalid request", async () => {
    const requests = stubHasura({});
    await expect(deleteRound(form({ id: ROUND_ID }))).rejects.toThrow(/NEXT_REDIRECT/);
    session.accessToken = tokenWith("manager");
    await expect(requestRound(form({ field_name: "website", kind: "shown", size: "5000" }))).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(requestRound(form({ field_name: "website", kind: "shown", size: "10" }))).rejects.toThrow(/NEXT_REDIRECT/); // no source
    expect(requests).toEqual([]);
  });

  it("deletes a round as manager", async () => {
    session.accessToken = tokenWith("manager");
    const requests = stubHasura({ DeleteReviewRound: { delete_review_rounds_by_pk: { id: ROUND_ID } } });
    expect(await redirectTo(deleteRound(form({ id: ROUND_ID })))).toBe("/pruefen?meldung=deleted");
    expect(requests.map((r) => [r.operation, r.role, r.variables])).toEqual([["DeleteReviewRound", "manager", { id: ROUND_ID }]]);
  });

  it("shows only its own messages, never text from the link", async () => {
    stubHasura({ ...ON, ReviewRounds: { review_rounds: [] } });
    const page = text(renderToStaticMarkup(await ReviewRoundsPage({ searchParams: Promise.resolve({ meldung: "Bitte neu anmelden unter evil.example" }) })));
    expect(page).not.toContain("evil.example");
    const proto = text(renderToStaticMarkup(await ReviewRoundsPage({ searchParams: Promise.resolve({ meldung: "toString" }) })));
    expect(proto).not.toContain("function");
  });

  it("refuses a kind or mode that is only an object's built-in name", async () => {
    session.accessToken = tokenWith("manager");
    const requests = stubHasura({});
    expect(await redirectTo(requestRound(form({ field_name: "website", kind: "constructor", source_key: "s" })))).toBe("/pruefen?meldung=kind");
    expect(await redirectTo(requestRound(form({ field_name: "website", kind: "shown", source_key: "s", mode: "toString" })))).toBe("/pruefen?meldung=mode");
    expect(requests).toEqual([]);
  });

  it("comes back with a message when Hasura refuses, and says when the round is gone", async () => {
    session.accessToken = tokenWith("manager");
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubHasura({}); // every mutation answers with a GraphQL error
    expect(await redirectTo(requestRound(form({ field_name: "website", kind: "shown", source_key: "unknown" })))).toBe("/pruefen?meldung=failed");
    expect(await redirectTo(renameRound(form({ id: ROUND_ID, title: "Neu" })))).toBe("/pruefen?meldung=failed");
    expect(await redirectTo(deleteRound(form({ id: ROUND_ID })))).toBe("/pruefen?meldung=failed");

    stubHasura({ RenameReviewRound: { update_review_rounds_by_pk: null }, DeleteReviewRound: { delete_review_rounds_by_pk: null } });
    expect(await redirectTo(renameRound(form({ id: ROUND_ID, title: "Neu" })))).toBe("/pruefen?meldung=gone");
    expect(await redirectTo(deleteRound(form({ id: ROUND_ID })))).toBe("/pruefen?meldung=gone");
  });
});
