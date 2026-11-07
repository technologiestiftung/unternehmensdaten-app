"use client";

import { type ToggleEvent, useId, useRef, useState } from "react";

export type MultiSelectOption = { value: string; label: string };

/** Lists longer than this get a box to narrow them down. */
const SEARCHABLE_FROM = 10;

/**
 * A filter of several values: a button like a select that opens a popover of checkboxes with
 * "Alle auswählen" (top layer, so nothing clips it). Nothing chosen in the URL means all, and all
 * checked submits nothing, so the URL stays short. Applies when the popover closes, so several
 * values can be picked in one go; the surrounding form's own handlers skip it (`data-multi-select`).
 * Remount it (`key`) when the URL changes.
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
  const chosenOnOpen = useRef(chosen);

  const isAll = options.every((o) => chosen.has(o.value));
  const handleToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const before = chosenOnOpen.current;
    if (event.newState === "open") chosenOnOpen.current = chosen;
    else if (chosen.size === 0) setChosen(before);
    else if (chosen.size !== before.size || [...chosen].some((v) => !before.has(v)))
      root.current?.closest("form")?.requestSubmit();
  };
  const toggle = (value: string) => {
    const next = new Set(chosen);
    if (!next.delete(value)) next.add(value);
    setChosen(next);
  };

  const summary = isAll
    ? "alle"
    : chosen.size === 0
      ? "keine"
      : chosen.size === 1
        ? (options.find((o) => chosen.has(o.value))?.label ?? "1 ausgewählt")
        : `${chosen.size} ausgewählt`;
  const needle = filter.trim().toLowerCase();
  const matches = (option: MultiSelectOption) =>
    option.label.toLowerCase().includes(needle);
  const shownCount = options.filter(matches).length;
  const status =
    chosen.size === 0
      ? "Mindestens einen Wert auswählen."
      : !needle
        ? ""
        : shownCount === 0
          ? "Keine Treffer."
          : `${shownCount} Treffer`;

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
        className="flex w-full items-center justify-between gap-2 border border-zinc-500 bg-white px-3 py-2 text-left text-sm font-normal text-zinc-900 hover:bg-zinc-50"
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
        onToggle={handleToggle}
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
              ref={(el) => {
                if (el) el.indeterminate = !isAll && chosen.size > 0;
              }}
              onChange={() =>
                setChosen(new Set(isAll ? [] : options.map((o) => o.value)))
              }
            />
            Alle auswählen
          </label>
          <p role="status" className="m-0 text-xs text-zinc-500">
            {status}
          </p>
          {options.map((option) => (
            <label
              key={option.value}
              hidden={!matches(option)}
              className="flex items-center gap-2"
            >
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
        </fieldset>
      </div>
    </div>
  );
}
