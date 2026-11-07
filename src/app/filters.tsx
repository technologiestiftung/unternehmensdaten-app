"use client";

import Form from "next/form";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useRef,
} from "react";
import {
  ALL_STATUSES,
  DEFAULT_STATUS,
  FUNDING_RANGES,
  type ListParams,
  NO_WEBSITE,
  statusFilter,
  withParams,
} from "@/lib/query";
import { formatNumber } from "@/lib/format";
import { MultiSelect, type MultiSelectOption } from "./multi-select";

export type FilterOptions = Record<
  "legal_form" | "register_status" | "technology_field",
  string[]
>;

export type SourceOption = { key: string; name: string | null };
export type TldOption = { tld: string; company_count: number };

const asOptions = (values: string[]): MultiSelectOption[] =>
  values.map((value) => ({ value, label: value }));

// Pause after the last keystroke before a text field filters, so typing a word sends one request.
const TYPING_DELAY_MS = 400;

// A multi-select submits itself, after its own state has settled.
const isInMultiSelect = (el: EventTarget) =>
  el instanceof Element && el.closest("[data-multi-select]") !== null;

const isCheckbox = (el: EventTarget): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === "checkbox";

/** A GET form: the filters live in the URL, so a filtered list can be shared as a link. */
export function Filters({
  params,
  options,
  sources,
  tlds,
}: {
  params: ListParams;
  options: FilterOptions;
  sources: SourceOption[];
  tlds: TldOption[];
}) {
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Dropdowns and checkboxes apply at once; text fields after a pause in typing (or on Enter).
  const handleChange = (event: ChangeEvent<HTMLFormElement>) => {
    if (isInMultiSelect(event.target)) return;
    if (event.target instanceof HTMLSelectElement || isCheckbox(event.target)) {
      clearTimeout(typingTimer.current);
      event.currentTarget.requestSubmit();
    }
  };
  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    if (
      !(event.target instanceof HTMLInputElement) ||
      isCheckbox(event.target) ||
      isInMultiSelect(event.target)
    )
      return;
    const form = event.currentTarget;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => form.requestSubmit(),
      TYPING_DELAY_MS,
    );
  };
  // The form stays mounted across client navigation, so edited fields would keep their values after a reset.
  const clearFields = (event: MouseEvent<HTMLAnchorElement>) => {
    clearTimeout(typingTimer.current);
    for (const field of Array.from(
      event.currentTarget.closest("form")?.elements ?? [],
    )) {
      // Multi-selects are controlled and remount with the new URL.
      if (isInMultiSelect(field)) continue;
      if (isCheckbox(field)) field.checked = false;
      else if (
        field instanceof HTMLSelectElement ||
        (field instanceof HTMLInputElement && field.type !== "hidden")
      ) {
        field.value = "";
      }
    }
  };
  const multiSelect = (
    name: "legal_form" | "technology_field" | "source" | "tld",
    label: string,
    choices: MultiSelectOption[],
  ) => (
    // Remounted when the URL changes, so it shows what the list now filters by.
    <MultiSelect
      key={`${name}:${(params[name] ?? []).join("|")}`}
      name={name}
      label={label}
      options={choices}
      selected={params[name] ?? []}
    />
  );
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
      {params.review && (
        <input type="hidden" name="review" value={params.review} />
      )}
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
          Suche
          <input
            name="q"
            type="search"
            placeholder="Name, Registernummer, Website, Adresse"
            aria-describedby="search-hint"
            defaultValue={params.q ?? ""}
          />
        </label>
        <span id="search-hint" className="text-xs text-zinc-500">
          Name, Registernummer, Website oder Adresse.
        </span>
      </div>
      {multiSelect("legal_form", "Rechtsform", asOptions(options.legal_form))}
      {multiSelect(
        "technology_field",
        "Technologiefeld",
        asOptions(options.technology_field),
      )}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        Registerstatus
        <select
          name="register_status"
          defaultValue={params.register_status ?? ""}
        >
          {/* Empty means the default, labelled with what the list then filters by (`statusFilter`). */}
          <option value="">
            {statusFilter({ q: params.q }) === ALL_STATUSES
              ? "alle"
              : DEFAULT_STATUS}
          </option>
          <option value={ALL_STATUSES}>alle</option>
          {options.register_status
            // "active" is the default's label; listed again only for a link that names it explicitly.
            .filter(
              (value) =>
                value !== DEFAULT_STATUS ||
                params.register_status === DEFAULT_STATUS,
            )
            .map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
        </select>
      </label>
      {multiSelect(
        "source",
        "Quelle",
        sources.map(({ key, name }) => ({ value: key, label: name ?? key })),
      )}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        WZ (geschätzt) beginnt mit
        <input
          name="wz"
          inputMode="decimal"
          placeholder="z. B. 62"
          defaultValue={params.wz ?? ""}
        />
      </label>
      {multiSelect("tld", "Website-Endung", [
        ...tlds.map(({ tld, company_count }) => ({
          value: tld,
          label: `.${tld} (${formatNumber(company_count)})`,
        })),
        { value: NO_WEBSITE, label: "keine Website" },
      ])}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
        Förderungen gesamt
        <select name="fund" defaultValue={params.fund ?? ""}>
          <option value="">alle</option>
          {FUNDING_RANGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end justify-end">
        {/* Hidden, but lets Enter in a text field submit when JavaScript is off. */}
        <button type="submit" hidden>
          Filtern
        </button>
        {/* Clears the filters; columns and review mode are view settings and stay. */}
        <Link
          href={withParams({}, { cols: params.cols, review: params.review })}
          onClick={clearFields}
          className="py-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          Zurücksetzen
        </Link>
      </div>
    </Form>
  );
}
