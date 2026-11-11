"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { REVIEW_PATH, verdictInput } from "@/lib/review";
import {
  DELETE_ROUND, isManager, MANAGER, RENAME_ROUND, REQUEST_ROUND, requestInput, titleInput,
} from "@/lib/review-manage";

// One verdict per task: answering again changes it. Hasura sets author_id from the token and lets a
// person update or delete only their own verdict.
const SAVE = `
  mutation SaveReviewVerdict($task_id: uuid!, $verdict: String!, $reason: String, $correction: String) {
    insert_review_verdicts_one(
      object: { task_id: $task_id, verdict: $verdict, reason: $reason, correction: $correction }
      on_conflict: { constraint: review_verdicts_pkey, update_columns: [verdict, reason, correction] }
    ) { task_id }
  }`;

const REMOVE = `
  mutation RemoveReviewVerdict($task_id: uuid!) {
    delete_review_verdicts_by_pk(task_id: $task_id) { task_id }
  }`;

/** Saves an answer at once (no send button). Returns false when it was not stored. */
export async function saveVerdict(
  taskId: string,
  verdict: string,
  reason: string | null,
  correction: string | null,
): Promise<boolean> {
  const session = await requireSession();
  const input = verdictInput(verdict, reason, correction);
  if (!UUID.test(taskId) || !input) return false;
  const data = await hasura<{ insert_review_verdicts_one: { task_id: string } | null }>(
    SAVE,
    { task_id: taskId, ...input },
    session.accessToken,
  );
  // null: the verdict is someone else's (one person per round), so it was not changed.
  return data.insert_review_verdicts_one !== null;
}

/** Takes an answer back: the active button clicked again. */
export async function removeVerdict(taskId: string): Promise<boolean> {
  const session = await requireSession();
  if (!UUID.test(taskId)) return false;
  await hasura(REMOVE, { task_id: taskId }, session.accessToken);
  return true;
}

/** Back to the list with a message for the person: the forms work without JavaScript. */
function back(message: string): never {
  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?meldung=${encodeURIComponent(message)}`);
}

/** A manager asks for a round; the DAG `review_round_requests` draws it within 5 minutes. */
export async function requestRound(form: FormData): Promise<void> {
  const session = await requireSession();
  if (!isManager(session.accessToken)) back("Nur für die Rolle „manager“.");
  const input = requestInput(form);
  if ("error" in input) back(input.error);
  await hasura(REQUEST_ROUND, { object: input }, session.accessToken, MANAGER);
  back("Runde angefragt. Sie erscheint hier innerhalb von 5 Minuten.");
}

/** A manager renames a round: its title only. */
export async function renameRound(form: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(form.get("id") ?? "");
  const title = titleInput(form.get("title"));
  if (!isManager(session.accessToken)) back("Nur für die Rolle „manager“.");
  if (!UUID.test(id) || !title) back("Titel: 1 bis 200 Zeichen.");
  await hasura(RENAME_ROUND, { id, title }, session.accessToken, MANAGER);
  back("Runde umbenannt.");
}

/** A manager deletes a round. The database takes back the votes its verdicts wrote (V11). */
export async function deleteRound(form: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!isManager(session.accessToken)) back("Nur für die Rolle „manager“.");
  if (!UUID.test(id)) back("Unbekannte Runde.");
  await hasura(DELETE_ROUND, { id }, session.accessToken, MANAGER);
  back("Runde gelöscht, ihre Stimmen zurückgenommen.");
}
