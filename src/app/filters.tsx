"use client";

import Form from "next/form";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, type MouseEvent, useRef } from "react";
import { type ListParams, withParams } from "@/lib/query";
import { Switch } from "./switch";

export type FilterOptions = Record<
  "legal_form" | "register_status" | "technology_field",
  string[]
>;

export type SourceOption = { key: string; name: string | null };

const SELECTS: { name: keyof FilterOptions; label: string }[] = [
  { name: "legal_form", label: "Rechtsform" },
  { name: "register_status", label: "Registerstatus" },
  { name: "technology_field", label: "Technologiefeld" },
];

// Pause after the last keystroke before a text field filters, so typing a word sends one request.
const TYPING_DELAY_MS = 400;

const isCheckbox = (el: EventTarget): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === "checkbox";

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
  // The form stays mounted across client navigation, so edited fields would keep their values after a reset.
  const clearFields = (event: MouseEvent<HTMLAnchorElement>) => {
    clearTimeout(typingTimer.current);
    for (const field of Array.from(event.currentTarget.closest("form")?.elements ?? [])) {
      if (isCheckbox(field)) field.checked = false;
      else if (field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && field.type !== "hidden")) {
        field.value = "";
      }
    }
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
      {/* Sorting, columns and review mode survive a new search; the page does not. */}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {params.dir && <input type="hidden" name="dir" value={params.dir} />}
      {params.cols && <input type="hidden" name="cols" value={params.cols} />}
      {params.review && <input type="hidden" name="review" value={params.review} />}
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium text-zinc-500">Nur Unternehmen</legend>
        <Switch name="website" isChecked={params.website === "1"}>
          mit Website
        </Switch>
        <Switch name="fundings" isChecked={params.fundings === "1"}>
          mit Förderungen
        </Switch>
      </fieldset>
      <div className="flex items-end justify-end">
        {/* Hidden, but lets Enter in a text field submit when JavaScript is off. */}
        <button type="submit" hidden>
          Filtern
        </button>
        {/* Clears the filters; columns and review mode are view settings and stay. */}
        <Link href={withParams({}, { cols: params.cols, review: params.review })} onClick={clearFields} className="py-2 text-sm text-zinc-500 hover:text-zinc-900">
          Zurücksetzen
        </Link>
      </div>
    </Form>
  );
}
