import { env } from "./env";

/** One GraphQL request to Hasura as the signed-in user. Hasura's permissions decide what is allowed. */
export async function hasura<T>(
  query: string,
  variables: Record<string, unknown>,
  accessToken: string,
): Promise<T> {
  const response = await fetch(env("HASURA_GRAPHQL_URL"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    // Server-side only; production Next.js shows the user a generic error page.
    throw new Error(`Hasura request failed: ${body.errors?.[0]?.message ?? response.status}`);
  }
  return body.data as T;
}
