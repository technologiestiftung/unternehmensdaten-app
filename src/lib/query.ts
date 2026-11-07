/**
 * URL search params → Hasura `where` and `order_by` for the company list.
 *
 * The URL is user input. Only the fields and directions listed here reach the query; values are
 * passed as GraphQL variables, never spliced into the query text.
 */

/** Columns the list can be sorted by: URL value → view column. */
export const SORTABLE = {
  name: "name",
  // shortcut: sorts as text, so HRB 121291 comes before HRB 92123; a numeric order needs a number column in the Data Hub.
  registration_number: "registration_number",
  employee_count: "employee_count",
  revenue: "revenue",
  fundings: "funding_total_eur",
  wz_code: "wz_code",
  wz_division_estimated: "wz_division_estimated",
  established_year: "established_year",
  address: "address",
  legal_form: "legal_form",
  technology_field: "technology_field",
  website: "website",
  deeptech: "deeptech_confidence",
  is_ai: "is_ai",
  register_status: "register_status",
  updated_at: "updated_at",
} as const;
export type SortKey = keyof typeof SORTABLE;
export type Direction = "asc" | "desc";

export const PAGE_SIZE = 50;

/** The cookie that remembers the chosen columns; `cols` in the URL wins over it. */
export const COLS_COOKIE = "cols";

/**
 * The register status the list shows when the URL names none. Dissolved companies often share a name
 * with an active one (a successor, a new registration), and side by side they look like duplicates.
 */
export const DEFAULT_STATUS = "active";
/** The status dropdown's "alle": a value, not the empty string, because `withParams` drops empty ones. */
export const ALL_STATUSES = "all";

/**
 * The status the list filters by, as the dropdown shows it: the chosen one, else "active", except for a
 * search by register number, which names one entry and so finds it whatever its status.
 */
export function statusFilter(params: ListParams): string {
  const chosen = params.register_status?.trim();
  if (chosen) return chosen;
  return params.q && registerNumberPattern(params.q)
    ? ALL_STATUSES
    : DEFAULT_STATUS;
}

/** Multi-select filters: URL param (repeated, one per chosen value) → view column, matched exactly. */
export const MULTI_FILTERS = {
  legal_form: "legal_form",
  technology_field: "technology_field",
} as const;
/** Every param that can repeat in the URL; `listParams` keeps all their values. */
const MULTI_PARAMS = [
  "legal_form",
  "technology_field",
  "source",
  "tld",
] as const;
type MultiParam = (typeof MULTI_PARAMS)[number];
const isMultiParam = (key: string): key is MultiParam =>
  (MULTI_PARAMS as readonly string[]).includes(key);

export type ListParams = {
  q?: string;
  page?: string;
  sort?: string;
  dir?: string;
  wz?: string;
  website?: string;
  fundings?: string;
  /** "1" shows the ✓/✗ buttons in the table. */
  review?: string;
  register_status?: string;
  /** Lowest / highest total of grants in €. */
  fund_min?: string;
  fund_max?: string;
  /** On a company page: its 0-based position in the list it was opened from, for prev/next. */
  pos?: string;
  /** On a company page: the page of its grants table. */
  fpage?: string;
  /** On a company page: "1" also loads every claim of every source into the history. */
  claims?: string;
  /** Comma-separated keys of the columns to show; absent (or none valid) shows all. */
  cols?: string;
} & Partial<Record<MultiParam, string[]>>;
/* Multi params: Rechtsform and Technologiefeld; `source` (source keys: companies with a value from any of
   them) and `tld` (website top-level domains). Repeated in the URL, since a value may contain a comma. */

/**
 * Next.js search params → ListParams: the first value of a repeated key, non-strings dropped. The
 * exceptions: multi-select params keep every non-empty value, and the column checkboxes' `cols` are
 * joined with commas.
 */
export function listParams(
  raw: Record<string, string | string[] | undefined>,
): ListParams {
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isMultiParam(key)) {
      const values = (Array.isArray(value) ? value : [value]).filter(
        (v): v is string => !!v?.trim(),
      );
      if (values.length) params[key] = values;
      continue;
    }
    const first = Array.isArray(value)
      ? key === "cols"
        ? value.join(",")
        : value[0]
      : value;
    if (typeof first === "string") params[key] = first;
  }
  return params as ListParams;
}

/**
 * The search box's text when the list searches with the Data Hub's fuzzy `search_companies`: any
 * search except a register number, which keeps its exact match on the register number.
 */
export function searchTerm(params: ListParams): string | undefined {
  const q = params.q?.trim();
  return q && !registerNumberPattern(q) ? q : undefined;
}

/**
 * The list's GraphQL root field, `companies` or `companies_aggregate`, opened up to its arguments:
 * the fuzzy search function under the same name while searching (it takes `$search`), else the view.
 */
export const listField = (
  params: ListParams,
  field: "companies" | "companies_aggregate",
) =>
  searchTerm(params)
    ? `${field}: search_${field}(args: { search: $search }, `
    : `${field}(`;
/** The `$search` variable's declaration, needed only by `listField` while searching. */
export const searchVariable = (params: ListParams) =>
  searchTerm(params) ? "$search: String!, " : "";

/** Column keys that were renamed, so saved `cols` cookies, bookmarks and sort links keep working. */
const RENAMED_KEYS: Record<string, string> = {
  established_at: "established_year",
};
const currentKey = (key: string) =>
  Object.hasOwn(RENAMED_KEYS, key) ? RENAMED_KEYS[key] : key;

export const isSortKey = (value: string | undefined): value is SortKey =>
  !!value && Object.hasOwn(SORTABLE, value);

/** The sort column: the chosen one, else the name, except a search, whose default is relevance (no key). */
export function sortOf(params: ListParams): {
  key: SortKey | undefined;
  dir: Direction;
} {
  const sort = params.sort && currentKey(params.sort);
  const key = isSortKey(sort) ? sort : searchTerm(params) ? undefined : "name";
  return { key, dir: params.dir === "desc" ? "desc" : "asc" };
}

/**
 * Empty values sort last in either direction, so "Umsatz absteigend" starts with real numbers. Sorting
 * by relevance is no `order_by` at all: the rows keep the search function's order.
 */
export function orderBy(params: ListParams): Record<string, string>[] {
  const { key, dir } = sortOf(params);
  // shortcut: relies on Hasura adding no ORDER BY of its own, which Postgres then keeps; a score column would make it explicit.
  if (!key) return [];
  const primary = { [SORTABLE[key]]: `${dir}_nulls_last` };
  return key === "name"
    ? [primary, { id: "asc" }]
    : [primary, { name: "asc" }, { id: "asc" }];
}

/**
 * A search like "HRB 121291" or "121291" as a regex on the register number, matching whole numbers
 * only (121291 never finds 1212910). Built from the validated digits and prefix only, never from raw
 * input. Undefined when the search does not look like a register number.
 */
export function registerNumberPattern(q: string): string | undefined {
  const match =
    /^(?:(HRA|HRB|GnR|PR|VR|GsR)\s*(\d{1,7})(?:\s*[A-Z]{1,2})?|(\d{1,7}))$/i.exec(
      q.trim(),
    );
  if (!match) return undefined;
  const [, prefix, prefixedDigits, bareDigits] = match;
  return prefix
    ? `${prefix}\\s*${prefixedDigits}(\\D|$)`
    : `(^|\\D)${bareDigits}(\\D|$)`;
}

export function where(params: ListParams): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const q = params.q?.trim();
  const register = q && registerNumberPattern(q);
  // Any other search goes to `search_companies` (`listField`), which does the matching.
  if (register)
    and.push({
      _or: [
        { name: { _ilike: `%${q}%` } },
        { registration_number: { _iregex: register } },
      ],
    });
  const status = statusFilter(params);
  if (status !== ALL_STATUSES) and.push({ register_status: { _eq: status } });
  for (const [param, column] of Object.entries(MULTI_FILTERS)) {
    const values = params[param as keyof typeof MULTI_FILTERS];
    if (values?.length) and.push({ [column]: { _in: values } });
  }
  const wz = params.wz?.trim();
  // The estimate, not the official wz_code: no source gives that yet (unternehmensdatenbank #158).
  // It holds a division only, so "62.01" filters by "62".
  if (wz && /^[0-9.]{1,7}$/.test(wz))
    and.push({ wz_division_estimated: { _like: `${wz.slice(0, 2)}%` } });
  if (params.website === "1") and.push({ website: { _is_null: false } });
  if (params.fundings === "1") and.push({ funding_count: { _gt: 0 } });
  const sources = params.source?.filter((key) => /^[a-z0-9_]{1,64}$/.test(key));
  if (sources?.length)
    and.push({
      _or: sources.map((key) => ({ source_keys: { _contains: [key] } })),
    });
  // The host's last label, the same pattern as the Data Hub's `v_website_tlds`; only validated labels reach it.
  const tlds = params.tld
    ?.map((t) => t.toLowerCase())
    .filter((t) => /^[a-z]{2,24}$/.test(t));
  if (tlds?.length)
    and.push({
      website: {
        _iregex: `^([a-z]+://)?[^/:?#]*\\.(${tlds.join("|")})([:/?#]|$)`,
      },
    });
  // Accepts how people write amounts: "1.000", "50 000", "2000 €".
  const euro = (value: string | undefined) => {
    const amount = value?.replace(/[\s€]/g, "");
    const digits = amount && /^\d{1,3}(\.\d{3})+$/.test(amount) ? amount.replace(/\./g, "") : amount;
    return digits && /^\d{1,12}$/.test(digits) ? Number(digits) : undefined;
  };
  const [fundMin, fundMax] = [euro(params.fund_min), euro(params.fund_max)];
  if (fundMin !== undefined) and.push({ funding_total_eur: { _gte: fundMin } });
  if (fundMax !== undefined) and.push({ funding_total_eur: { _lte: fundMax } });
  return and.length ? { _and: and } : {};
}

/** The current params with some replaced; empty values are dropped. For links that keep the filters. */
export function withParams(
  params: ListParams,
  changes: Partial<ListParams>,
  path = "/",
): string {
  const merged = { ...params, ...changes };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    for (const v of Array.isArray(value) ? value : [value])
      if (v) search.append(key, v);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Page links for the pager: first, last and two either side of the current one. A gap of more than
 * one page becomes "…"; a gap of exactly one shows that page, since "…" would not be shorter.
 */
export function pageNumbers(current: number, total: number): (number | "…")[] {
  const shown = [
    ...new Set([
      1,
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2,
      total,
    ]),
  ]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  return shown.flatMap((n, i) => {
    const gap = i > 0 ? n - shown[i - 1] - 1 : 0;
    return gap === 0 ? [n] : gap === 1 ? [n - 1, n] : ["…" as const, n];
  });
}

type Neighbour = { id: string; name: string; pos: number };

/**
 * The companies before and after `id`, from a slice of the list starting at `offset`. None when `id`
 * is not in the slice (the list changed since the link was made), so prev/next never jump wrongly.
 */
export function neighbours(
  slice: { id: string; name: string }[],
  id: string,
  offset: number,
): { prev?: Neighbour; next?: Neighbour } {
  const index = slice.findIndex((c) => c.id === id);
  if (index < 0) return {};
  const at = (i: number) => slice[i] && { ...slice[i], pos: offset + i };
  return { prev: at(index - 1), next: at(index + 1) };
}

/** The columns `cols` asks for, in their usual order; all of them when it names none that exist. */
export function visibleColumns<T extends { key: string }>(
  columns: T[],
  cols: string | undefined,
): T[] {
  const wanted = new Set(cols?.split(",").map(currentKey));
  const shown = columns.filter((col) => wanted.has(col.key));
  return shown.length > 0 ? shown : columns;
}
