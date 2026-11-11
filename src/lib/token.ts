/** Refresh this many seconds before Keycloak's access token expires (Keycloak default lifetime: 300 s). */
export const REFRESH_MARGIN_S = 30;

export function needsRefresh(expiresAt: number | undefined, nowS = Date.now() / 1000): boolean {
  return expiresAt === undefined || nowS >= expiresAt - REFRESH_MARGIN_S;
}
