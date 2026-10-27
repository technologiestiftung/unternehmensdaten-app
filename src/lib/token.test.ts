import { describe, expect, it } from "vitest";
import { needsRefresh, REFRESH_MARGIN_S } from "./token";

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
