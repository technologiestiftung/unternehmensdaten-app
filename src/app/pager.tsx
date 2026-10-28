import Link from "next/link";
import { pageNumbers } from "@/lib/query";

const PAGE_LINK =
  "block min-w-9 border border-transparent px-2 py-1.5 text-center text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 hover:no-underline";

/** Numbered page links with ‹ and ›; `href` builds the link for a page number. */
export function Pager({ current, pages, href }: { current: number; pages: number; href: (page: number) => string }) {
  return (
    <ul className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
      {current > 1 && (
        <li>
          <Link href={href(current - 1)} className={PAGE_LINK} aria-label="Vorherige Seite">
            ‹
          </Link>
        </li>
      )}
      {pageNumbers(current, pages).map((n, i) => (
        <li key={n === "…" ? `gap-${i}` : n}>
          {n === "…" ? (
            <span className="px-2 text-zinc-500">…</span>
          ) : n === current ? (
            <span aria-current="page" className="block min-w-9 border border-zinc-900 px-2 py-1.5 text-center font-medium">
              {n}
            </span>
          ) : (
            <Link href={href(n)} className={PAGE_LINK} aria-label={`Seite ${n}`}>
              {n}
            </Link>
          )}
        </li>
      ))}
      {current < pages && (
        <li>
          <Link href={href(current + 1)} className={PAGE_LINK} aria-label="Nächste Seite">
            ›
          </Link>
        </li>
      )}
    </ul>
  );
}
