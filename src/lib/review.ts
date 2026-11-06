/**
 * The "Prüfen" page (#30): a person judges ~200 results of one source and field, and the verdicts
 * flow back into the collection. Rounds, tasks and verdicts live in the database
 * (unternehmensdatenbank #153, V4__review_queue.sql); a trigger copies each verdict into the app's
 * votes. A research-phase tool: switched by `review_settings.enabled`, removed later with /pruefen.
 */
import { hasura } from "./hasura";

export const REVIEW_PATH = "/pruefen";
/** What a classifier or the LLM answers when no Technologiefeld fits. */
export const NONE = "NONE";

export type Kind = "shown" | "refused" | "gap";
export type Mode = "measure" | "teach";
export type ReviewVerdict = "correct" | "wrong" | "unsure";
export const REVIEW_VERDICTS: readonly ReviewVerdict[] = ["correct", "wrong", "unsure"];

export type RoundResults = {
  tasks: number;
  judged: number;
  correct: number;
  wrong: number;
  unsure: number;
  corrected: number;
  suggestion_judged: number;
  suggestion_taken: number;
  precision: number | null;
};

export type Round = {
  id: string;
  source_key: string | null;
  field_name: string;
  feedback_field: string | null;
  kind: Kind;
  mode: Mode;
  version: string | null;
  title: string;
  size: number;
  created_at: string;
  closed_at: string | null;
  results: RoundResults | null;
};

export type Task = {
  id: string;
  position: number;
  company_id: string;
  value: string;
  confidence: number | null;
  evidence: string[];
  method: string | null;
  suggestion: string | null;
  company: { name: string | null; website: string | null } | null;
  verdict: { verdict: ReviewVerdict; reason: string | null; correction: string | null; author_id: string } | null;
};

export type Breakdown = { dimension: "reason" | "confidence" | "evidence"; bucket: string | null; correct: number; wrong: number };

const ROUND_FIELDS = `
  id source_key field_name feedback_field kind mode version title size created_at closed_at
  results { tasks judged correct wrong unsure corrected suggestion_judged suggestion_taken precision }`;

export const SETTINGS = `query ReviewSettings { review_settings { enabled } }`;

export const ROUNDS = `
  query ReviewRounds {
    review_rounds(order_by: { created_at: desc }) { ${ROUND_FIELDS} }
  }`;

export const ROUND = `
  query ReviewRound($id: uuid!) {
    review_rounds(where: { id: { _eq: $id } }) {
      ${ROUND_FIELDS}
      tasks(order_by: { position: asc }) {
        id position company_id value confidence evidence method suggestion
        company { name website }
        verdict { verdict reason correction author_id }
      }
    }
  }`;

// The round itself, its breakdown, and the earlier rounds of the same source, field and kind: the
// newest one with another version is the "before" of a before/after.
export const ROUND_RESULTS = `
  query ReviewRoundResults($id: uuid!) {
    review_rounds(where: { id: { _eq: $id } }) {
      ${ROUND_FIELDS}
      breakdown(order_by: [{ dimension: asc }, { wrong: desc }]) { dimension bucket correct wrong }
    }
  }`;

export const EARLIER_ROUNDS = `
  query EarlierReviewRounds($field: String!, $kind: String!, $before: timestamptz!) {
    review_rounds(
      where: { field_name: { _eq: $field }, kind: { _eq: $kind }, mode: { _eq: "measure" }, created_at: { _lt: $before } }
      order_by: { created_at: desc }
    ) { ${ROUND_FIELDS} }
  }`;

/**
 * Is the review queue on? Read per request from the database, never at build time, so it is
 * switched off without a deploy. A failed read counts as off: the page then simply is not offered.
 */
export async function reviewEnabled(accessToken: string): Promise<boolean> {
  try {
    const data = await hasura<{ review_settings: { enabled: boolean }[] }>(SETTINGS, {}, accessToken);
    return data.review_settings[0]?.enabled === true;
  } catch {
    return false;
  }
}

export const KIND_LABELS: Record<Kind, string> = {
  shown: "angezeigte Werte prüfen",
  refused: "verworfene Werte prüfen",
  gap: "Lücken füllen",
};
export const MODE_LABELS: Record<Mode, string> = { measure: "messen", teach: "lehren" };
export const VERDICT_LABELS: Record<ReviewVerdict, string> = { correct: "richtig", wrong: "falsch", unsure: "?" };

/** Why a value is wrong, per field: the buckets the results page groups by. "andere" always last. */
const REASONS: Record<string, string[]> = {
  website: ["Verzeichnis", "Mutterfirma", "Namensvetter", "nicht erreichbar"],
  technology_field: ["anderes Feld", "kein Technologiefeld", "zu wenig Text"],
  wz_code: ["andere Abteilung", "veraltet"],
  wz_division_estimated: ["andere Abteilung", "zu wenig Text"],
  management: ["nicht mehr im Amt", "keine Person", "falsche Firma"],
  email: ["fremde Firma", "privat", "kaputt"],
  phone: ["fremde Firma", "Fax", "kaputt"],
};
const WEBSITE_FIELDS = new Set(["website", "candidate_url", "directory_url"]);

export function reasonsFor(field: string): string[] {
  const own = REASONS[WEBSITE_FIELDS.has(field) ? "website" : field] ?? ["falscher Wert", "veraltet"];
  return [...own, "andere"];
}

/** Which list the options panel shows for a field, if any. */
export function optionsFor(field: string): "technology_field" | "wz" | null {
  if (field === "technology_field") return "technology_field";
  if (field === "wz_code" || field === "wz_division_estimated") return "wz";
  return null;
}

/** Same limits as the CHECKs on review_verdicts. */
export const MAX_REASON_LENGTH = 100;
export const MAX_CORRECTION_LENGTH = 500;

export type VerdictInput = { verdict: ReviewVerdict; reason: string | null; correction: string | null };

/**
 * What to store for an answer, or null when the database would refuse it. A reason and a
 * correction belong only to "falsch" (CHECKs on review_verdicts). A gap task has no value: its
 * answer is the correction (stored as "falsch": "it was missing, it should be …"), "?" or
 * "richtig" ("there really is none").
 */
export function verdictInput(verdict: string, reason: string | null, correction: string | null): VerdictInput | null {
  if (!(REVIEW_VERDICTS as readonly string[]).includes(verdict)) return null;
  const r = reason?.trim() || null;
  const c = correction?.trim() || null;
  if (verdict !== "wrong") return { verdict: verdict as ReviewVerdict, reason: null, correction: null };
  if ((r && r.length > MAX_REASON_LENGTH) || (c && c.length > MAX_CORRECTION_LENGTH)) return null;
  return { verdict: "wrong", reason: r, correction: c };
}

/** A website as a link that opens in a new tab; bare hosts get https://. Anything else: none. */
export function websiteHref(value: string | null): string | null {
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value) ? `https://${value}` : null;
  if (!url) return null;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

/** "0.873" → "87 %"; nothing for a round that gives no precision. */
export const formatPrecision = (value: number | null | undefined) =>
  value == null ? "–" : `${Math.round(value * 100)} %`;

/**
 * The answer after a click. A verdict button alone (no reason, no correction given) toggles: the
 * active one clicked again takes the answer back (null). "falsch" keeps the reason and correction
 * already given. A reason or correction given explicitly replaces them.
 */
export function answerAfter(
  current: VerdictInput | null,
  verdict: ReviewVerdict,
  reason?: string | null,
  correction?: string | null,
): VerdictInput | null {
  const explicit = reason !== undefined || correction !== undefined;
  if (!explicit && current?.verdict === verdict) return null;
  if (verdict !== "wrong") return { verdict, reason: null, correction: null };
  return verdictInput(
    "wrong",
    reason === undefined ? (current?.reason ?? null) : reason,
    correction === undefined ? (current?.correction ?? null) : correction,
  );
}

/**
 * An option picked in the panel. Picking the value the source gave counts as "richtig"; any other
 * is "falsch" with that option as the correction. A gap has no value: the pick is the answer.
 */
export function pickAnswer(task: Pick<Task, "value">, gap: boolean, current: VerdictInput | null, option: string): VerdictInput | null {
  if (!gap && option === task.value) return { verdict: "correct", reason: null, correction: null };
  return answerAfter(current, "wrong", gap ? null : (current?.reason ?? null), option);
}
