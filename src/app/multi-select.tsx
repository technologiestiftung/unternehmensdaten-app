"use client";

import { useEffect, useId, useRef, useState } from "react";

export type MultiSelectOption = { value: string; label: string };

/** Lists longer than this get a box to narrow them down. */
const SEARCHABLE_FROM = 10;

/**
 * A filter of several values: a button like a select that opens a popover of checkboxes with
 * "Alle auswählen" (top layer, so nothing clips it). Nothing chosen in the URL means all, and all
 * checked submits nothing, so the URL stays short. Applies on every change, like the other filters;
 * the surrounding form's own handlers skip it (`data-multi-select`), since it submits itself after
 * its checkboxes are named. Remount it (`key`) when the URL changes.
 */
export function MultiSelect({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: MultiSelectOption[];
  selected: string[];
}) {
  const id = useId();
  const anchor = `--multi-${id.replace(/[^\w-]/g, "")}`;
  const root = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState(
    () => new Set(selected.length ? selected : options.map((o) => o.value)),
  );
  const [filter, setFilter] = useState("");
  const isChanged = useRef(false);

  const isAll = options.every((o) => chosen.has(o.value));
  // Submits after React has named the checkboxes: none named when all are chosen.
  useEffect(() => {
    if (isChanged.current && chosen.size > 0)
      root.current?.closest("form")?.requestSubmit();
    isChanged.current = false;
  }, [chosen]);

  const update = (next: Set<string>) => {
    isChanged.current = true;
    setChosen(next);
  };
  const toggle = (value: string) => {
    const next = new Set(chosen);
    if (!next.delete(value)) next.add(value);
    update(next);
  };

  const summary =
    isAll || chosen.size === 0
      ? "alle"
      : chosen.size === 1
        ? (options.find((o) => chosen.has(o.value))?.label ?? "1 ausgewählt")
        : `${chosen.size} ausgewählt`;
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <div ref={root} data-multi-select className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-xs font-medium text-zinc-500">
        {label}
      </span>
      <button
        type="button"
        popoverTarget={`${id}-popover`}
        aria-labelledby={`${id}-label ${id}-summary`}
        style={{ anchorName: anchor }}
        className="flex w-full items-center justify-between gap-2 border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-normal text-zinc-900 hover:bg-zinc-50"
      >
        <span id={`${id}-summary`} className="truncate">
          {summary}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div
        id={`${id}-popover`}
        popover="auto"
        style={{
          positionAnchor: anchor,
          positionArea: "bottom span-right",
          positionTryFallbacks: "flip-block, flip-inline",
        }}
        className="m-0 mt-1 max-h-96 w-72 overflow-y-auto border border-zinc-200 bg-white p-3 text-left text-sm shadow-sm"
      >
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-zinc-500">
            {label}
          </legend>
          {options.length > SEARCHABLE_FROM && (
            <input
              type="search"
              aria-label={`${label} durchsuchen`}
              placeholder="Suchen …"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="mb-1 w-full"
            />
          )}
          <label className="flex items-center gap-2 border-b border-zinc-100 pb-1.5 font-medium">
            <input
              type="checkbox"
              checked={isAll}
              onChange={() =>
                update(new Set(isAll ? [] : options.map((o) => o.value)))
              }
            />
            Alle auswählen
          </label>
          {chosen.size === 0 && (
            <p className="m-0 text-xs text-zinc-500">
              Mindestens einen Wert auswählen.
            </p>
          )}
          {shown.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={isAll ? undefined : name}
                value={option.value}
                checked={chosen.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {shown.length === 0 && (
            <p className="m-0 text-xs text-zinc-500">Keine Treffer.</p>
          )}
        </fieldset>
      </div>
    </div>
  );
}
