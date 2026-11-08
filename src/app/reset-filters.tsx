"use client";

import Link from "next/link";
import { clearFilterFields } from "./filters";

/** "Filter zurücksetzen" in the hits row: clears the form's fields and loads the unfiltered list. */
export function ResetFilters({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={clearFilterFields}
      className="text-zinc-500 hover:text-zinc-900"
    >
      Filter zurücksetzen
    </Link>
  );
}
