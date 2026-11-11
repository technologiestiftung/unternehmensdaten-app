import { env } from "./env";

/**
 * One GraphQL request to Hasura as the signed-in user. Hasura's permissions decide what is allowed.
 * `role`: one of the user's Keycloak realm roles to act as (default `user`), e.g. `manager` for the
 * review rounds' management; Hasura refuses a role the token does not carry.
 */
export async function hasura<T>(
  query: string,
  variables: Record<string, unknown>,
  accessToken: string,
  role?: string,
): Promise<T> {
  const response = await fetch(env("HASURA_GRAPHQL_URL"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      ...(role ? { "x-hasura-role": role } : {}),
    },
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
