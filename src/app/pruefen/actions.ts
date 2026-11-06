"use server";

import { requireSession } from "@/lib/auth";
import { UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { verdictInput } from "@/lib/review";

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
