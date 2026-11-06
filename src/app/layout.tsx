import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { REVIEW_PATH, reviewEnabled } from "@/lib/review";
import "./globals.css";

// Every page needs the signed-in user, so nothing can be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unternehmensdaten Berlin",
  description: "Unternehmensdatenbank auf dem Berlin Data Hub",
};

/** The "Prüfen" entry shows only while the review queue is on (read per request, #30). */
async function showReview(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions());
    return Boolean(session?.accessToken && !session.error) && (await reviewEnabled(session!.accessToken!));
  } catch {
    return false;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const review = await showReview();
  return (
    <html lang="de">
      <body>
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-2" href="#main">
          Zum Inhalt springen
        </a>
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex min-h-14 max-w-[1920px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2">
            <Link href="/" className="font-semibold tracking-tight text-zinc-900 hover:no-underline">
              Unternehmensdaten Berlin
            </Link>
            <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <Link href="/sources" className="text-sm text-zinc-600 hover:text-zinc-900">
                Quellen
              </Link>
              <Link href="/classifications" className="text-sm text-zinc-600 hover:text-zinc-900">
                Klassifikationen
              </Link>
              {review && (
                <Link href={REVIEW_PATH} className="text-sm text-zinc-600 hover:text-zinc-900">
                  Prüfen
                </Link>
              )}
              <Link href="/api/auth/signout" prefetch={false} className="text-sm text-zinc-600 hover:text-zinc-900">
                Abmelden
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1920px] px-6 pt-8 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
