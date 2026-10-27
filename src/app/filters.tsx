import Link from "next/link";
import type { ListParams } from "@/lib/query";

export type FilterOptions = Record<
  "legal_form" | "register_status" | "technologiefeld",
  string[]
>;

const SELECTS: { name: keyof FilterOptions; label: string }[] = [
  { name: "legal_form", label: "Rechtsform" },
  { name: "register_status", label: "Registerstatus" },
  { name: "technologiefeld", label: "Technologiefeld" },
];

/** A plain GET form: the filters live in the URL, so a filtered list can be shared as a link. */
export function Filters({
  params,
  options,
}: {
  params: ListParams;
  options: FilterOptions;
}) {
  return (
    <form
      role="search"
      action="/"
      className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* Sorting survives a new search; the page does not. */}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {params.dir && <input type="hidden" name="dir" value={params.dir} />}
      <label className="flex flex-col gap-1">
        Name enthält
        <input name="q" type="search" defaultValue={params.q ?? ""} />
      </label>
      {SELECTS.map(({ name, label }) => (
        <label key={name} className="flex flex-col gap-1">
          {label}
          <select
            name={name}
            defaultValue={params[name] ?? ""}
            className="rounded border border-neutral-500 px-2.5 py-1.5"
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
      <label className="flex flex-col gap-1">
        WZ beginnt mit
        <input
          name="wz"
          inputMode="decimal"
          placeholder="z. B. 62"
          defaultValue={params.wz ?? ""}
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">Nur Unternehmen</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="website"
            value="1"
            defaultChecked={params.website === "1"}
          />{" "}
          mit Website
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="fundings"
            value="1"
            defaultChecked={params.fundings === "1"}
          />{" "}
          mit Förderungen
        </label>
      </fieldset>
      <label className="flex items-center gap-2 self-end">
        <input
          type="checkbox"
          name="review"
          value="1"
          defaultChecked={params.review === "1"}
        />{" "}
        Werte bewerten (✓/✗ in der Tabelle)
      </label>
      <div className="flex items-end gap-3">
        <button type="submit">Filtern</button>
        <Link href="/">Zurücksetzen</Link>
      </div>
    </form>
  );
}
