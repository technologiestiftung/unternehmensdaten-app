import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatEuro, formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";

const PAGE_SIZE = 50;

const COMPANIES = `
  query Companies($where: companies_bool_exp!, $limit: Int!, $offset: Int!) {
    companies(where: $where, limit: $limit, offset: $offset, order_by: { name: asc }) {
      id name city legal_form wz_code technologiefeld register_status funding_count funding_total_eur
    }
    companies_aggregate(where: $where) { aggregate { count } }
  }`;

type Row = {
  id: string;
  name: string;
  city: string | null;
  legal_form: string | null;
  wz_code: string | null;
  technologiefeld: string | null;
  register_status: string | null;
  funding_count: number;
  funding_total_eur: number | null;
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireSession();
  const { q = "", page = "1" } = await searchParams;
  const pageNo = Math.max(1, Number.parseInt(page, 10) || 1);
  const where = q.trim() ? { name: { _ilike: `%${q.trim()}%` } } : {};

  const data = await hasura<{ companies: Row[]; companies_aggregate: { aggregate: { count: number } } }>(
    COMPANIES,
    { where, limit: PAGE_SIZE, offset: (pageNo - 1) * PAGE_SIZE },
    session.accessToken,
  );
  const total = data.companies_aggregate.aggregate.count;
  const pageLink = (n: number) => `/?${new URLSearchParams({ ...(q && { q }), page: String(n) })}`;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Unternehmen</h1>
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search" action="/">
        <label htmlFor="q">Name enthält</label>
        <input id="q" name="q" type="search" defaultValue={q} className="min-w-64 flex-1" />
        <button type="submit">Suchen</button>
      </form>
      <p className="mb-2 text-neutral-600" aria-live="polite">
        {formatNumber(total)} Treffer, Seite {pageNo} von {Math.max(1, Math.ceil(total / PAGE_SIZE))}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="text-neutral-600">Sortiert nach Name</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Ort</th>
              <th scope="col">Rechtsform</th>
              <th scope="col">WZ</th>
              <th scope="col">Technologiefeld</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">Förderungen</th>
            </tr>
          </thead>
          <tbody>
            {data.companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/companies/${c.id}`}>{c.name}</Link>
                </td>
                <td>{c.city ?? "–"}</td>
                <td>{c.legal_form ?? "–"}</td>
                <td>{c.wz_code ?? "–"}</td>
                <td>{c.technologiefeld ?? "–"}</td>
                <td>{c.register_status ?? "–"}</td>
                <td className="text-right">
                  {c.funding_count > 0 ? `${c.funding_count} · ${formatEuro(c.funding_total_eur)}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex gap-4" aria-label="Seiten">
        {pageNo > 1 && <Link href={pageLink(pageNo - 1)}>← Zurück</Link>}
        {pageNo * PAGE_SIZE < total && <Link href={pageLink(pageNo + 1)}>Weiter →</Link>}
      </nav>
    </>
  );
}
