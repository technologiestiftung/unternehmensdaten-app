import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// Every page needs the signed-in user, so nothing can be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unternehmensdaten Berlin",
  description: "Unternehmensdatenbank auf dem Berlin Data Hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-white focus:p-2" href="#main">
          Zum Inhalt springen
        </a>
        <header className="flex items-center justify-between border-b border-neutral-300 bg-neutral-100 px-4 py-3">
          <Link href="/" className="font-bold text-neutral-900 no-underline">
            Unternehmensdaten Berlin
          </Link>
          <Link href="/api/auth/signout" prefetch={false}>
            Abmelden
          </Link>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
