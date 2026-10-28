import Form from "next/form";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { type Column, COLUMNS, NAME_COLUMN, type CompanyProfile, PROFILE_FIELDS } from "@/lib/columns";
import { type FeedbackRow, tally } from "@/lib/feedback";
import { formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import {
  isSortKey,
  listParams,
  orderBy,
  PAGE_SIZE,
  pageNumbers,
  sortOf,
  visibleColumns,
  where,
  withParams,
} from "@/lib/query";
import { FieldCell } from "./companies/[id]/feedback-buttons";
import { type Provenance, PROVENANCE_FIELDS } from "@/lib/provenance";
import { ColumnPicker } from "./column-picker";
import { Filters, type FilterOptions, type SourceOption } from "./filters";
import { KeepParams } from "./keep-params";

const PAGER =
  "block min-w-9 border border-transparent px-2 py-1.5 text-center text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 hover:no-underline";

/** Long single-valued text is clamped; the ⓘ and ✓/✗ stay outside the clamp so they are not cut off. */
const LIST_COLUMNS: Column[] = COLUMNS.map((col) =>
  col.long && !col.multiValue
    ? { ...col, render: (c) => <div className="line-clamp-2 w-64">{col.render(c)}</div> }
    : col,
);

const distinct = (field: string) =>
  `${field}_options: companies(distinct_on: ${field}, order_by: { ${field}: asc }, where: { ${field}: { _is_null: false } }) { ${field} }`;

const COMPANIES = `
  query Companies(
    $where: companies_bool_exp!
    $order_by: [companies_order_by!]
    $limit: Int!
    $offset: Int!
    $review: Boolean!
  ) {
    companies(where: $where, order_by: $order_by, limit: $limit, offset: $offset) {
      ${PROFILE_FIELDS}
      comments(limit: 1, order_by: { created_at: desc }) { body }
      feedback @include(if: $review) { field_name value verdict author_id }
      provenance { ${PROVENANCE_FIELDS} }
    }
    companies_aggregate(where: $where) { aggregate { count } }
    ${distinct("legal_form")}
    ${distinct("register_status")}
    ${distinct("technologiefeld")}
    sources(order_by: { name: asc }) { key name }
  }`;

type Result = {
  companies: (CompanyProfile & { feedback?: FeedbackRow[]; provenance: Provenance[] })[];
  companies_aggregate: { aggregate: { count: number } };
  sources: SourceOption[];
} & Record<`${keyof FilterOptions}_options`, Record<string, string>[]>;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = listParams(await searchParams);
  const pageNo = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort = sortOf(params);
  // Review mode loads the votes and shows the ✓/✗ buttons; off by default to keep the list light.
  // The ⓘ (provenance) is always shown.
  const review = params.review === "1";

  const data = await hasura<Result>(
    COMPANIES,
    {
      where: where(params),
      order_by: orderBy(params),
      limit: PAGE_SIZE,
      offset: (pageNo - 1) * PAGE_SIZE,
      review,
    },
    session.accessToken,
  );
  const total = data.companies_aggregate.aggregate.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const options = Object.fromEntries(
    (["legal_form", "register_status", "technologiefeld"] as const).map((f) => [
      f,
      data[`${f}_options`].map((row) => row[f]),
    ]),
  ) as FilterOptions;


  const columns = visibleColumns(COLUMNS, params.cols);
  const listColumns = visibleColumns(LIST_COLUMNS, params.cols);

  /** A header that sorts by its column; clicking the active one reverses the direction. */
  const header = (key: string, label: string) => {
    if (!isSortKey(key)) return label;
    const active = sort.key === key;
    const dir = active && sort.dir === "asc" ? "desc" : "asc";
    return (
      <Link
        href={withParams(params, { sort: key, dir, page: undefined })}
        className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 hover:no-underline"
      >
        {label}{" "}
        <span aria-hidden="true" className={active ? "text-zinc-900" : "text-zinc-500"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    );
  };
  const ariaSort = (key: string) =>
    sort.key === key
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : undefined;

  return (
    <>
      <h1 className="mb-6">Unternehmen</h1>
      <Filters params={params} options={options} sources={data.sources} />
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500 tabular-nums" aria-live="polite">
          {formatNumber(total)} Treffer, Seite {pageNo} von {pages}
        </p>
        <ColumnPicker params={params} columns={COLUMNS.map(({ key, label }) => ({ key, label }))} shown={new Set(columns.map((col) => col.key))} />
      </div>
      <div className="max-h-[75vh] overflow-auto border-y border-zinc-200">
        <table className="w-max min-w-full border-collapse text-sm">
          <caption className="sr-only">
            Unternehmen mit allen Zielfeldern
          </caption>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                aria-sort={ariaSort("name")}
                className="sticky left-0 z-30 w-64 min-w-64"
              >
                {header("name", "Name")}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort(col.key)}
                  className={`whitespace-nowrap ${col.numeric ? "text-right" : ""}`}
                >
                  {header(col.key, col.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.companies.map((c, index) => {
              const votes = review ? tally(c.feedback ?? [], session.userId) : undefined;
              return (
                <tr key={c.id} className="group hover:bg-zinc-50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-64 min-w-64 bg-white font-medium group-hover:bg-zinc-50"
                  >
                    <Link
                      href={withParams(
                        params,
                        { page: undefined, pos: String((pageNo - 1) * PAGE_SIZE + index) },
                        `/companies/${c.id}`,
                      )}
                    >
                      {c.name}
                    </Link>
                    <FieldCell company={c} column={NAME_COLUMN} votes={votes} provenance={c.provenance} withValue={false} />
                  </th>
                  {listColumns.map((col) => (
                    <td
                      key={col.key}
                      className={
                        col.numeric ? "text-right whitespace-nowrap tabular-nums" : undefined
                      }
                    >
                      <FieldCell
                        company={c}
                        column={col}
                        votes={votes}
                        provenance={c.provenance}
                        max={review ? undefined : 3}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav aria-label="Seiten" className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
          {pageNo > 1 && (
            <li>
              <Link
                href={withParams(params, { page: String(pageNo - 1) })}
                className={PAGER}
                aria-label="Vorherige Seite"
              >
                ‹
              </Link>
            </li>
          )}
          {pageNumbers(pageNo, pages).map((n, i) => (
            <li key={n === "…" ? `gap-${i}` : n}>
              {n === "…" ? (
                <span className="px-2 text-zinc-500">…</span>
              ) : n === pageNo ? (
                <span aria-current="page" className="block min-w-9 border border-zinc-900 px-2 py-1.5 text-center font-medium">
                  {n}
                </span>
              ) : (
                <Link
                  href={withParams(params, { page: String(n) })}
                  className={PAGER}
                  aria-label={`Seite ${n}`}
                >
                  {n}
                </Link>
              )}
            </li>
          ))}
          {pageNo < pages && (
            <li>
              <Link
                href={withParams(params, { page: String(pageNo + 1) })}
                className={PAGER}
                aria-label="Nächste Seite"
              >
                ›
              </Link>
            </li>
          )}
        </ul>
        {pages > 1 && (
          <Form action="/" scroll={false} className="flex items-center gap-2 text-sm text-zinc-500">
            <KeepParams params={params} except={["page"]} />
            <label htmlFor="page-jump">Seite</label>
            {/* Keyed by page, so it shows the current page again after a pager link was used. */}
            <input
              key={pageNo}
              id="page-jump"
              name="page"
              type="number"
              min={1}
              max={pages}
              defaultValue={pageNo}
              className="w-20 px-2 py-1.5 tabular-nums"
            />
            <span className="tabular-nums">von {pages}</span>
          </Form>
        )}
      </nav>
    </>
  );
}
