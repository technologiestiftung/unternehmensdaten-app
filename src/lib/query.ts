/**
 * URL search params → Hasura `where` and `order_by` for the company list.
 *
 * The URL is user input. Only the fields and directions listed here reach the query; values are
 * passed as GraphQL variables, never spliced into the query text.
 */

/** Columns the list can be sorted by: URL value → view column. */
export const SORTABLE = {
  name: "name",
  employee_count: "employee_count",
  revenue: "revenue",
  fundings: "funding_total_eur",
  wz_code: "wz_code",
  established_at: "established_at",
  address: "address",
  legal_form: "legal_form",
  cluster: "cluster",
  technologiefeld: "technologiefeld",
  website: "website",
  deeptech: "deeptech_confidence",
  is_ai: "is_ai",
  register_status: "register_status",
  updated_at: "updated_at",
} as const;
export type SortKey = keyof typeof SORTABLE;
export type Direction = "asc" | "desc";

export const PAGE_SIZE = 50;

/** Dropdown filters: URL param → view column, matched exactly. */
export const SELECT_FILTERS = {
  legal_form: "legal_form",
  register_status: "register_status",
  technologiefeld: "technologiefeld",
} as const;

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
  /** On a company page: its 0-based position in the list it was opened from, for prev/next. */
  pos?: string;
} & Partial<Record<keyof typeof SELECT_FILTERS, string>>;

/** Next.js search params → ListParams: the first value of a repeated key, non-strings dropped. */
export function listParams(raw: Record<string, string | string[] | undefined>): ListParams {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params[key] = first;
  }
  return params;
}

export const isSortKey = (value: string | undefined): value is SortKey => !!value && Object.hasOwn(SORTABLE, value);

export function sortOf(params: ListParams): { key: SortKey; dir: Direction } {
  const key = isSortKey(params.sort) ? params.sort : "name";
  return { key, dir: params.dir === "desc" ? "desc" : "asc" };
}

/** Empty values sort last in either direction, so "Umsatz absteigend" starts with real numbers. */
export function orderBy(params: ListParams): Record<string, string>[] {
  const { key, dir } = sortOf(params);
  const primary = { [SORTABLE[key]]: `${dir}_nulls_last` };
  return key === "name" ? [primary] : [primary, { name: "asc" }];
}

export function where(params: ListParams): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const q = params.q?.trim();
  if (q) and.push({ name: { _ilike: `%${q}%` } });
  for (const [param, column] of Object.entries(SELECT_FILTERS)) {
    const value = params[param as keyof typeof SELECT_FILTERS]?.trim();
    if (value) and.push({ [column]: { _eq: value } });
  }
  const wz = params.wz?.trim();
  if (wz && /^[0-9.]{1,7}$/.test(wz)) and.push({ wz_code: { _like: `${wz}%` } });
  if (params.website === "1") and.push({ website: { _is_null: false } });
  if (params.fundings === "1") and.push({ funding_count: { _gt: 0 } });
  return and.length ? { _and: and } : {};
}

/** The current params with some replaced; empty values are dropped. For links that keep the filters. */
export function withParams(params: ListParams, changes: Partial<ListParams>, path = "/"): string {
  const merged = { ...params, ...changes };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Page links for the pager: first, last and two either side of the current one. A gap of more than
 * one page becomes "…"; a gap of exactly one shows that page, since "…" would not be shorter.
 */
export function pageNumbers(current: number, total: number): (number | "…")[] {
  const shown = [...new Set([1, current - 2, current - 1, current, current + 1, current + 2, total])]
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
