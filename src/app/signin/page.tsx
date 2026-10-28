import type { Metadata } from "next";
import { SignInButton } from "./signin-button";

export const metadata: Metadata = { title: "Anmelden – Unternehmensdaten Berlin" };

/** The sign-in page next-auth sends to (`pages.signIn`), in the app's design instead of next-auth's. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl, error } = await searchParams;
  // Only paths on this site; next-auth's redirect check is the second line of defence.
  const target = typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/";
  return (
    <div className="mx-auto mt-16 max-w-sm border-t-2 border-zinc-900 pt-6">
      <h1>Anmelden</h1>
      <p className="mt-2 mb-6 text-sm text-zinc-500">
        Die Unternehmensdaten sind nur für angemeldete Nutzerinnen und Nutzer des Berlin Data Hub
        sichtbar.
      </p>
      {error && (
        <p role="alert" className="mb-4 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">
          Die Anmeldung hat nicht geklappt. Bitte versuchen Sie es noch einmal.
        </p>
      )}
      <SignInButton callbackUrl={target} />
    </div>
  );
}
