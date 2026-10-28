"use client";

import { signIn } from "next-auth/react";

/** Starts the Keycloak login; next-auth handles the CSRF token and the redirect. */
export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button type="button" onClick={() => signIn("keycloak", { callbackUrl })} className="w-full">
      Mit Data-Hub-Konto anmelden
    </button>
  );
}
