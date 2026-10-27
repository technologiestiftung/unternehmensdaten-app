"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { isField, isValidValue, isVerdict } from "@/lib/feedback";
import { MAX_COMMENT_LENGTH, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";

const ADD_COMMENT = `
  mutation AddComment($company_id: uuid!, $body: String!) {
    insert_comments_one(object: { company_id: $company_id, body: $body }) { id }
  }`;

const SET_VOTE = `
  mutation SetVote($company_id: uuid!, $field_name: String!, $value: String!, $verdict: String!) {
    insert_feedback_one(
      object: { company_id: $company_id, field_name: $field_name, value: $value, verdict: $verdict }
      on_conflict: { constraint: extraction_feedback_one_vote, update_columns: [verdict] }
    ) { verdict }
  }`;

/** One vote per user and value; voting again changes it (upsert). */
export async function setVote(
  companyId: string,
  field: string,
  value: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const verdict = String(formData.get("verdict") ?? "");
  if (!UUID.test(companyId) || !isField(field) || !isValidValue(value) || !isVerdict(verdict)) return;
  await hasura(SET_VOTE, { company_id: companyId, field_name: field, value, verdict }, session.accessToken);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/"); // the list can vote too, in review mode
}

export async function addComment(companyId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID.test(companyId) || !body || body.length > MAX_COMMENT_LENGTH) return;
  await hasura(ADD_COMMENT, { company_id: companyId, body }, session.accessToken);
  revalidatePath(`/companies/${companyId}`);
}
