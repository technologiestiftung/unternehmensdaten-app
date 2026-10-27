"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { MAX_COMMENT_LENGTH, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";

const ADD_COMMENT = `
  mutation AddComment($company_id: uuid!, $body: String!) {
    insert_comments_one(object: { company_id: $company_id, body: $body }) { id }
  }`;

export async function addComment(companyId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID.test(companyId) || !body || body.length > MAX_COMMENT_LENGTH) return;
  await hasura(ADD_COMMENT, { company_id: companyId, body }, session.accessToken);
  revalidatePath(`/companies/${companyId}`);
}
