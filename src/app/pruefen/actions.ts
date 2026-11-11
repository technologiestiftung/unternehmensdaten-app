"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { REVIEW_PATH, verdictInput } from "@/lib/review";
import {
  DELETE_ROUND, type MessageKey, RENAME_ROUND, REQUEST_ROUND, requestInput, titleInput,
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
function back(message: MessageKey): never {
  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?meldung=${message}`);
}

/** A mutation; null when Hasura refused it (a CHECK, a permission, the network). */
async function tryMutation<T>(query: string, variables: Record<string, unknown>, accessToken: string): Promise<T | null> {
  try {
    return await hasura<T>(query, variables, accessToken);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Asks for a round; the DAG `review_round_requests` draws it within 5 minutes. */
export async function requestRound(form: FormData): Promise<void> {
  const session = await requireSession();
  const input = requestInput(form);
  if ("error" in input) back(input.error);
  const data = await tryMutation<{ insert_review_round_requests_one: { id: string } | null }>(
    REQUEST_ROUND, { object: input }, session.accessToken,
  );
  if (!data?.insert_review_round_requests_one) back("failed");
  back("requested");
}

/** Renames a round: its title only. */
export async function renameRound(form: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(form.get("id") ?? "");
  const title = titleInput(form.get("title"));
  if (!UUID.test(id) || !title) back("title");
  const data = await tryMutation<{ update_review_rounds_by_pk: { id: string } | null }>(
    RENAME_ROUND, { id, title }, session.accessToken,
  );
  if (!data) back("failed");
  back(data.update_review_rounds_by_pk ? "renamed" : "gone");
}

/** Deletes a round. The database takes back the votes its verdicts wrote (V11). */
export async function deleteRound(form: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) back("unknownRound");
  const data = await tryMutation<{ delete_review_rounds_by_pk: { id: string } | null }>(
    DELETE_ROUND, { id }, session.accessToken,
  );
  if (!data) back("failed");
  back(data.delete_review_rounds_by_pk ? "deleted" : "gone");
}
