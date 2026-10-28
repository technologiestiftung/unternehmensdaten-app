import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

const signInButton = vi.hoisted(() => vi.fn<(props: { callbackUrl: string }) => null>(() => null));
vi.mock("./signin-button", () => ({ SignInButton: signInButton }));

const render = async (search: Record<string, string>) =>
  renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve(search) }));
const target = () => signInButton.mock.lastCall?.[0].callbackUrl;

describe("sign-in page", () => {
  it("returns to the page that asked for the login", async () => {
    await render({ callbackUrl: "/companies/1?pos=3" });
    expect(target()).toBe("/companies/1?pos=3");
  });

  it("never sends the user to another site after login", async () => {
    for (const callbackUrl of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "javascript:alert(1)"]) {
      await render({ callbackUrl });
      expect(target()).toBe("/");
    }
  });

  it("says when the login failed, without next-auth's error code", async () => {
    const html = await render({ error: "OAuthCallback" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Die Anmeldung hat nicht geklappt");
    expect(html).not.toContain("OAuthCallback");
  });

  it("shows no error on a normal visit", async () => {
    expect(await render({})).not.toContain('role="alert"');
  });
});
