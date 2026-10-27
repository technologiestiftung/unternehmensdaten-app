import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { COLUMNS, type CompanyProfile, PROFILE_FIELDS } from "@/lib/columns";
import { type FeedbackRow, tally } from "@/lib/feedback";
import { formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import {
  isSortKey,
  listParams,
  orderBy,
  sortOf,
  where,
  withParams,
} from "@/lib/query";
import { votableCells } from "./companies/[id]/feedback-buttons";
import { Filters, type FilterOptions } from "./filters";

const PAGE_SIZE = 50;

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
    }
    companies_aggregate(where: $where) { aggregate { count } }
    ${distinct("legal_form")}
    ${distinct("register_status")}
    ${distinct("technologiefeld")}
  }`;

type Result = {
  companies: (CompanyProfile & { feedback?: FeedbackRow[] })[];
  companies_aggregate: { aggregate: { count: number } };
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

  const websiteOf = COLUMNS.find((col) => col.key === "website")!.render;

  /** A header that sorts by its column; clicking the active one reverses the direction. */
  const header = (key: string, label: string) => {
    if (!isSortKey(key)) return label;
    const active = sort.key === key;
    const dir = active && sort.dir === "asc" ? "desc" : "asc";
    return (
      <Link
        href={withParams(params, { sort: key, dir, page: undefined })}
        className="text-neutral-900 no-underline"
      >
        {label}{" "}
        <span aria-hidden="true">
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
      <h1 className="mb-4 text-2xl font-bold">Unternehmen</h1>
      <Filters params={params} options={options} />
      <p className="mb-2 text-neutral-600" aria-live="polite">
        {formatNumber(total)} Treffer, Seite {pageNo} von {pages}
      </p>
      <div className="max-h-[75vh] overflow-auto rounded border border-neutral-300">
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
              {COLUMNS.map((col) => (
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
            {data.companies.map((c) => {
              const cells: Partial<Record<string, React.ReactNode>> = review
                ? votableCells(
                    c,
                    tally(c.feedback ?? [], session.userId),
                    websiteOf(c),
                  )
                : {};
              return (
                <tr key={c.id} className="group even:bg-neutral-50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-64 min-w-64 bg-white font-normal group-even:bg-neutral-50"
                  >
                    <Link href={`/companies/${c.id}`}>{c.name}</Link>
                  </th>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={
                        col.numeric ? "text-right whitespace-nowrap" : undefined
                      }
                    >
                      {cells[col.key] ??
                        (col.long ? (
                          <div className="line-clamp-2 w-64">
                            {col.render(c)}
                          </div>
                        ) : (
                          col.render(c)
                        ))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex gap-4" aria-label="Seiten">
        {pageNo > 1 && (
          <Link href={withParams(params, { page: String(pageNo - 1) })}>
            ← Zurück
          </Link>
        )}
        {pageNo < pages && (
          <Link href={withParams(params, { page: String(pageNo + 1) })}>
            Weiter →
          </Link>
        )}
      </nav>
    </>
  );
}
