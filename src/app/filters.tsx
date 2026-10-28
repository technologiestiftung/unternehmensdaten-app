"use client";

import Form from "next/form";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, useRef } from "react";
import type { ListParams } from "@/lib/query";

export type FilterOptions = Record<
  "legal_form" | "register_status" | "technologiefeld",
  string[]
>;

export type SourceOption = { key: string; name: string | null };

const SELECTS: { name: keyof FilterOptions; label: string }[] = [
  { name: "legal_form", label: "Rechtsform" },
  { name: "register_status", label: "Registerstatus" },
  { name: "technologiefeld", label: "Technologiefeld" },
];

// Pause after the last keystroke before a text field filters, so typing a word sends one request.
const TYPING_DELAY_MS = 400;

const isCheckbox = (el: EventTarget) => el instanceof HTMLInputElement && el.type === "checkbox";

/** A GET form: the filters live in the URL, so a filtered list can be shared as a link. */
export function Filters({
  params,
  options,
  sources,
}: {
  params: ListParams;
  options: FilterOptions;
  sources: SourceOption[];
}) {
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Dropdowns and checkboxes apply at once; text fields after a pause in typing (or on Enter).
  const handleChange = (event: ChangeEvent<HTMLFormElement>) => {
    if (event.target instanceof HTMLSelectElement || isCheckbox(event.target)) {
      clearTimeout(typingTimer.current);
      event.currentTarget.requestSubmit();
    }
  };
  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    if (!(event.target instanceof HTMLInputElement) || isCheckbox(event.target)) return;
    const form = event.currentTarget;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => form.requestSubmit(), TYPING_DELAY_MS);
  };
  return (
    <Form
      role="search"
      action="/"
      scroll={false}
      onChange={handleChange}
      onInput={handleInput}
      onSubmit={() => clearTimeout(typingTimer.current)}
      className="mb-6 grid grid-cols-1 gap-4 border-b border-zinc-200 pb-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* Sorting survives a new search; the page does not. */}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {params.dir && <input type="hidden" name="dir" value={params.dir} />}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        Name enthält
        <input name="q" type="search" defaultValue={params.q ?? ""} />
      </label>
      {SELECTS.map(({ name, label }) => (
        <label key={name} className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
          {label}
          <select
            name={name}
            defaultValue={params[name] ?? ""}
          >
            <option value="">alle</option>
            {options[name].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        Quelle
        <select name="source" defaultValue={params.source ?? ""}>
          <option value="">alle</option>
          {sources.map(({ key, name }) => (
            <option key={key} value={key}>
              {name ?? key}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        WZ beginnt mit
        <input
          name="wz"
          inputMode="decimal"
          placeholder="z. B. 62"
          defaultValue={params.wz ?? ""}
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium text-zinc-500">Nur Unternehmen</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="website"
            value="1"
            defaultChecked={params.website === "1"}
          />{" "}
          mit Website
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="fundings"
            value="1"
            defaultChecked={params.fundings === "1"}
          />{" "}
          mit Förderungen
        </label>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-2.5 self-end text-sm">
        <input
          type="checkbox"
          role="switch"
          name="review"
          value="1"
          defaultChecked={params.review === "1"}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-5 w-9 shrink-0 border border-zinc-500 bg-white transition-colors peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-hover:border-zinc-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:bg-zinc-500 after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-white"
        />
        Werte bewerten (✓/✗ in der Tabelle)
      </label>
      <div className="flex items-end justify-end">
        {/* Hidden, but lets Enter in a text field submit when JavaScript is off. */}
        <button type="submit" hidden>
          Filtern
        </button>
        <Link href="/" className="py-2 text-sm text-zinc-500 hover:text-zinc-900">
          Zurücksetzen
        </Link>
      </div>
    </Form>
  );
}
