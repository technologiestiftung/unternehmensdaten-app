/**
 * Managing review rounds from the app (unternehmensdatenbank #190): any signed-in person asks for a round,
 * renames one or deletes one (no separate role yet, decided 2026-11-11). A request is a row in
 * `review_round_requests`; the DAG `review_round_requests` draws it within 5 minutes. The app never talks
 * to Airflow.
 */
import { KIND_LABELS, MODE_LABELS, type Kind, type Mode } from "./review";

/** Same limits as the draw (`review_round.draw.MAX_SIZE`) and the CHECKs on review_round_requests. */
export const MAX_SIZE = 1000;
export const DEFAULT_SIZE = 200;
const MAX_TEXT = 200;

/** Fields a round is usually drawn for; the form suggests them and accepts any other. */
export const KNOWN_FIELDS = [
  "technology_field", "wz_division_estimated", "deeptech_class", "is_ai", "website", "candidate_url",
  "wz_code", "email", "phone",
];

export type RequestStatus = "pending" | "drawn" | "failed";
export type RoundRequest = {
  id: string;
  field_name: string;
  kind: Kind;
  source_key: string | null;
  size: number;
  mode: Mode;
  title: string | null;
  status: RequestStatus;
  error: string | null;
  requested_at: string;
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "wird gezogen (bis zu 5 Minuten)",
  drawn: "gezogen",
  failed: "fehlgeschlagen",
};

// Open and failed requests only: a drawn one is in the list of rounds.
export const REQUESTS = `
  query ReviewRoundRequests {
    review_round_requests(where: { status: { _neq: "drawn" } }, order_by: { requested_at: desc }, limit: 20) {
      id field_name kind source_key size mode title status error requested_at
    }
  }`;

export const REQUEST_ROUND = `
  mutation RequestReviewRound($object: review_round_requests_insert_input!) {
    insert_review_round_requests_one(object: $object) { id }
  }`;

export const RENAME_ROUND = `
  mutation RenameReviewRound($id: uuid!, $title: String!) {
    update_review_rounds_by_pk(pk_columns: { id: $id }, _set: { title: $title }) { id }
  }`;

export const DELETE_ROUND = `
  mutation DeleteReviewRound($id: uuid!) {
    delete_review_rounds_by_pk(id: $id) { id }
  }`;

/** What a form says back (`?meldung=<key>`): fixed texts only, so a link cannot put words in the app's mouth. */
export const MESSAGES = {
  field: "Feld: Kleinbuchstaben und _, z. B. technology_field.",
  kind: "Art fehlt.",
  mode: "Modus fehlt.",
  size: `Größe: 1 bis ${MAX_SIZE}.`,
  source: "Quelle fehlt: angezeigte und verworfene Werte gehören zu einer Quelle.",
  gapTeach: "Lücken haben keine Sicherheit: nur „messen“.",
  length: `Quelle und Titel: höchstens ${MAX_TEXT} Zeichen.`,
  title: `Titel: 1 bis ${MAX_TEXT} Zeichen.`,
  unknownRound: "Unbekannte Runde.",
  requested: "Runde angefragt. Sie erscheint hier innerhalb von 5 Minuten.",
  renamed: "Runde umbenannt.",
  deleted: "Runde gelöscht, ihre Stimmen zurückgenommen.",
  gone: "Runde nicht mehr vorhanden.",
  failed: "Konnte nicht gespeichert werden.",
};
export type MessageKey = keyof typeof MESSAGES;

/** The text for a `?meldung=` key, or null for anything else. */
export const messageText = (key: unknown) =>
  typeof key === "string" && Object.hasOwn(MESSAGES, key) ? MESSAGES[key as MessageKey] : null;

export type RequestInput = {
  field_name: string;
  kind: Kind;
  source_key: string | null;
  size: number;
  mode: Mode;
  title: string | null;
};

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

/**
 * The request a submitted form asks for, or the message key of an error to show. Checks what the database would refuse;
 * the draw itself decides whether there is anything to draw and says so in the request's error.
 */
export function requestInput(form: FormData): RequestInput | { error: MessageKey } {
  const field = text(form.get("field_name"));
  const kind = text(form.get("kind"));
  const mode = text(form.get("mode")) || "measure";
  const source = text(form.get("source_key"));
  const title = text(form.get("title"));
  const size = Number(text(form.get("size")) || DEFAULT_SIZE);
  if (!/^[a-z_]{1,64}$/.test(field)) return { error: "field" };
  if (!Object.hasOwn(KIND_LABELS, kind)) return { error: "kind" };
  if (!Object.hasOwn(MODE_LABELS, mode)) return { error: "mode" };
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) return { error: "size" };
  if (kind !== "gap" && !source) return { error: "source" };
  if (kind === "gap" && mode === "teach") return { error: "gapTeach" };
  if (source.length > MAX_TEXT || title.length > MAX_TEXT) return { error: "length" };
  return { field_name: field, kind: kind as Kind, source_key: kind === "gap" ? null : source, size, mode: mode as Mode, title: title || null };
}

/** A round's new title, or null when it is empty or too long. */
export function titleInput(value: FormDataEntryValue | null): string | null {
  const title = text(value);
  return title && title.length <= MAX_TEXT ? title : null;
}
