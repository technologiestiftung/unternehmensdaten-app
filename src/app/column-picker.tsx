"use client";

import Form from "next/form";
import { type ChangeEvent, useId } from "react";
import { COLS_COOKIE, type ListParams } from "@/lib/query";
import { TABLE_TOOL } from "./table-tool";
import { KeepParams } from "./keep-params";
import { Switch } from "./switch";

/**
 * Show or hide table columns: an icon above the table that opens a popover (top layer, so the
 * scrolling table cannot clip it). Applies on every change and keeps filters, sort and page.
 */
export function ColumnPicker({
  params,
  columns,
  shown,
}: {
  params: ListParams;
  columns: { key: string; label: string }[];
  shown: Set<string>;
}) {
  const id = useId();
  const anchor = `--columns-${id.replace(/[^\w-]/g, "")}`;
  const handleChange = (event: ChangeEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    // The last column cannot be hidden: no columns would show them all, which would be confusing.
    if (!form.querySelector("input[name=cols]:checked") && event.target instanceof HTMLInputElement) {
      event.target.checked = true;
      return;
    }
    // Remembered for a year, so the next visit without `cols` in the URL shows the same columns.
    const cols = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=cols]:checked"), (box) => box.value);
    document.cookie = `${COLS_COOKIE}=${encodeURIComponent(cols.join(","))}; path=/; max-age=31536000; samesite=lax`;
    form.requestSubmit();
  };
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={`Spalten auswählen (${shown.size} von ${columns.length} angezeigt)`}
        title="Spalten auswählen"
        style={{ anchorName: anchor }}
        className={TABLE_TOOL}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path d="M3 4h14v12H3zM8 4v12M12 4v12" />
        </svg>
      </button>
      <div
        id={id}
        popover="auto"
        style={{ positionAnchor: anchor, positionArea: "bottom span-left", positionTryFallbacks: "flip-block, flip-inline" }}
        className="m-0 mt-1 w-60 border border-zinc-200 bg-white p-3 text-left shadow-sm"
      >
        <Form key={[...shown].join(",")} action="/" scroll={false} onChange={handleChange}>
          <KeepParams params={params} except={["cols"]} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs font-medium text-zinc-500">Angezeigte Spalten</legend>
            {columns.map((col) => (
              <Switch key={col.key} name="cols" value={col.key} isChecked={shown.has(col.key)}>
                {col.label}
              </Switch>
            ))}
          </fieldset>
          {/* Applies on change; this button is for when JavaScript is off. */}
          <noscript>
            <button type="submit" className="mt-3">Anwenden</button>
          </noscript>
        </Form>
      </div>
    </>
  );
}
