/** Refresh this many seconds before Keycloak's access token expires (Keycloak default lifetime: 300 s). */
export const REFRESH_MARGIN_S = 30;

export function needsRefresh(expiresAt: number | undefined, nowS = Date.now() / 1000): boolean {
  return expiresAt === undefined || nowS >= expiresAt - REFRESH_MARGIN_S;
}

/**
 * The Keycloak realm roles in an access token, read without checking its signature: only to decide what
 * the page offers. Hasura checks the signature and refuses a role the token does not carry.
 */
export function realmRoles(accessToken: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    const roles = payload?.realm_access?.roles;
    return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
  } catch {
    return [];
  }
}
