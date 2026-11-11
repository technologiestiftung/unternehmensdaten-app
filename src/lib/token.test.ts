import { describe, expect, it } from "vitest";
import { needsRefresh, realmRoles, REFRESH_MARGIN_S } from "./token";

describe("needsRefresh", () => {
  it("keeps a token with time left", () => {
    expect(needsRefresh(1000, 1000 - REFRESH_MARGIN_S - 1)).toBe(false);
  });
  it("refreshes inside the margin and after expiry", () => {
    expect(needsRefresh(1000, 1000 - REFRESH_MARGIN_S)).toBe(true);
    expect(needsRefresh(1000, 2000)).toBe(true);
  });
  it("refreshes when the expiry is unknown", () => {
    expect(needsRefresh(undefined, 0)).toBe(true);
  });
});

describe("realmRoles", () => {
  const token = (payload: unknown) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
  it("reads Keycloak's realm roles", () => {
    expect(realmRoles(token({ realm_access: { roles: ["user", "manager"] } }))).toEqual(["user", "manager"]);
  });
  it("gives none for a token without roles or one that is not a JWT", () => {
    expect(realmRoles(token({ sub: "u1" }))).toEqual([]);
    expect(realmRoles("not-a-jwt")).toEqual([]);
  });
});
