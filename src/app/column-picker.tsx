"use client";

import Form from "next/form";
import type { ChangeEvent } from "react";
import type { ListParams } from "@/lib/query";
import { KeepParams } from "./keep-params";

/** Show or hide table columns; applies on every change and keeps filters, sort and page. */
export function ColumnPicker({
  params,
  columns,
  shown,
}: {
  params: ListParams;
  columns: { key: string; label: string }[];
  shown: Set<string>;
}) {
  const handleChange = (event: ChangeEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    // The last column cannot be hidden: no columns would show them all, which would be confusing.
    if (!form.querySelector("input[name=cols]:checked") && event.target instanceof HTMLInputElement) {
      event.target.checked = true;
      return;
    }
    form.requestSubmit();
  };
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-sm text-zinc-500 hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
        Spalten ({shown.size} von {columns.length}) <span aria-hidden="true">▾</span>
      </summary>
      <Form
        action="/"
        scroll={false}
        onChange={handleChange}
        className="absolute right-0 z-40 mt-2 w-60 border border-zinc-200 bg-white p-3 shadow-sm"
      >
        <KeepParams params={params} except={["cols"]} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-zinc-500">Angezeigte Spalten</legend>
          {columns.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="cols" value={col.key} defaultChecked={shown.has(col.key)} />
              {col.label}
            </label>
          ))}
        </fieldset>
        {/* Applies on change; this button is for when JavaScript is off. */}
        <noscript>
          <button type="submit" className="mt-3">Anwenden</button>
        </noscript>
      </Form>
    </details>
  );
}
