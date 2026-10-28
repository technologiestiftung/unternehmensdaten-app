import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { type FeedbackRow, tally, tallyKey } from "@/lib/feedback";
import {
  COLUMNS,
  type CompanyProfile,
  NAME_COLUMN,
  PROFILE_FIELDS,
  text,
} from "@/lib/columns";
import { formatDate, formatEuro, MAX_COMMENT_LENGTH, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { type Provenance, PROVENANCE_FIELDS, provenanceFor } from "@/lib/provenance";
import { listParams, neighbours, orderBy, PAGE_SIZE, where, withParams } from "@/lib/query";
import { Pager } from "@/app/pager";
import { addComment } from "./actions";
import { FeedbackButtons, FieldCell } from "./feedback-buttons";
import { ProvenanceInfo } from "./provenance-info";

const FUNDINGS_PAGE_SIZE = 25;

const COMPANY = `
  query Company($id: uuid!, $fundings_offset: Int!) {
    companies(where: { id: { _eq: $id } }) {
      ${PROFILE_FIELDS}
      fundings(order_by: [{ period_from: desc_nulls_last }, { fkz: asc }], limit: ${FUNDINGS_PAGE_SIZE}, offset: $fundings_offset) {
        fkz amount_eur period_from period_to topic ministry
      }
      comments(order_by: { created_at: desc }) { id body author_id created_at }
      feedback { field_name value verdict correction author_id }
      provenance { ${PROVENANCE_FIELDS} }
    }
  }`;

// The list around this company, with the filters and sort it was opened from.
const NEIGHBOURS = `
  query Neighbours($where: companies_bool_exp!, $order_by: [companies_order_by!], $offset: Int!) {
    companies(where: $where, order_by: $order_by, offset: $offset, limit: 3) { id name }
  }`;

const NAV = "text-sm text-zinc-500 hover:text-zinc-900 hover:no-underline";

type Company = Omit<CompanyProfile, "comments"> & {
  fundings: {
    fkz: string;
    amount_eur: number | null;
    period_from: string | null;
    period_to: string | null;
    topic: string | null;
    ministry: string | null;
  }[];
  comments: {
    id: string;
    body: string;
    author_id: string;
    created_at: string;
  }[];
  feedback: FeedbackRow[];
  provenance: Provenance[];
};

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const list = listParams(await searchParams);
  const pos = /^\d{1,9}$/.test(list.pos ?? "") ? Number(list.pos) : undefined;
  const offset = Math.max(0, (pos ?? 0) - 1);
  let fundingsPage = Math.max(1, Number.parseInt(list.fpage ?? "1", 10) || 1);
  const loadCompany = async (page: number) =>
    (
      await hasura<{ companies: Company[] }>(
        COMPANY,
        { id, fundings_offset: (page - 1) * FUNDINGS_PAGE_SIZE },
        session.accessToken,
      )
    ).companies[0];

  const [first, around] = await Promise.all([
    loadCompany(fundingsPage),
    pos === undefined
      ? undefined
      : hasura<{ companies: { id: string; name: string }[] }>(
          NEIGHBOURS,
          { where: where(list), order_by: orderBy(list), offset },
          session.accessToken,
        ),
  ]);
  let c = first;
  if (!c) notFound();
  const fundingPages = Math.max(1, Math.ceil(c.funding_count / FUNDINGS_PAGE_SIZE));
  if (fundingsPage > fundingPages) {
    fundingsPage = fundingPages;
    c = await loadCompany(fundingsPage);
    if (!c) notFound();
  }
  const { prev, next } = around ? neighbours(around.companies, id, offset) : {};
  const href = (n: { id: string; pos: number }) =>
    withParams(list, { pos: String(n.pos), fpage: undefined }, `/companies/${n.id}`);
  const firstFunding = (fundingsPage - 1) * FUNDINGS_PAGE_SIZE + 1;

  const votes = tally(c.feedback, session.userId);
  const cell = (column: (typeof COLUMNS)[number], withValue = true) => (
    <FieldCell company={c} column={column} votes={votes} provenance={c.provenance} corrections withValue={withValue} />
  );
  const fields = COLUMNS.filter((col) => col.key !== "comment").map(
    (col) => [col.label, cell(col)] as const,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Unternehmen blättern" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link
          href={withParams(list, { pos: undefined, fpage: undefined, page: pos === undefined ? undefined : String(Math.floor(pos / PAGE_SIZE) + 1) })}
          className={NAV}
        >
          ← Alle Unternehmen
        </Link>
        {(prev || next) && (
          <span className="flex gap-6">
            {prev && (
              <Link href={href(prev)} className={NAV} rel="prev" title={prev.name}>
                ‹ Vorheriges
              </Link>
            )}
            {next && (
              <Link href={href(next)} className={NAV} rel="next" title={next.name}>
                Nächstes ›
              </Link>
            )}
          </span>
        )}
      </nav>
      <div className="mt-3 mb-6">
        <h1 className="mr-1 inline">{c.name}</h1>
        {cell(NAME_COLUMN, false)}
      </div>
      <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] border-t border-zinc-200 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="contents [&:last-child>*]:border-0">
            <dt className="border-b border-zinc-100 py-2.5 pr-4 text-zinc-500">{label}</dt>
            <dd className="m-0 border-b border-zinc-100 py-2.5 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 id="foerderungen" className="mt-10 mb-3 scroll-mt-4">Förderungen</h2>
      {c.funding_count === 0 ? (
        <p className="text-sm text-zinc-500">
          Keine Förderungen im Förderkatalog des Bundes zugeordnet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="caption-bottom px-3 py-2.5 text-left text-xs text-zinc-500">
              {firstFunding}–{firstFunding + c.fundings.length - 1} von {c.funding_count}, neueste zuerst.
              Quelle: Förderkatalog des Bundes
            </caption>
            <thead>
              <tr>
                <th scope="col">FKZ</th>
                <th scope="col">Laufzeit</th>
                <th scope="col">Thema</th>
                <th scope="col">Ressort</th>
                <th scope="col" className="text-right">
                  Betrag
                </th>
                <th scope="col">
                  <span className="sr-only">Herkunft und Bewertung</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {c.fundings.map((f) => (
                <tr key={f.fkz}>
                  <td>{f.fkz}</td>
                  <td>
                    {formatDate(f.period_from)} – {formatDate(f.period_to)}
                  </td>
                  <td>{text(f.topic)}</td>
                  <td>{text(f.ministry)}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {formatEuro(f.amount_eur)}
                  </td>
                  <td className="whitespace-nowrap">
                    <ProvenanceInfo
                      label={`Förderung ${f.fkz}`}
                      rows={provenanceFor(c.provenance, "fundings", f.fkz, true)}
                    />
                    <FeedbackButtons
                      companyId={c.id}
                      field="fundings"
                      value={f.fkz}
                      tally={votes.get(tallyKey("fundings", f.fkz))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fundingPages > 1 && (
        <nav aria-label="Förderungen, Seiten" className="mt-3">
          <Pager
            current={fundingsPage}
            pages={fundingPages}
            href={(n) => `${withParams(list, { fpage: n > 1 ? String(n) : undefined }, `/companies/${id}`)}#foerderungen`}
          />
        </nav>
      )}

      <h2 className="mt-10 mb-3">Kommentare</h2>
      <form
        action={addComment.bind(null, c.id)}
        className="mb-6 flex flex-col items-start gap-2"
      >
        <label htmlFor="body" className="text-xs font-medium text-zinc-500">
          Neuer Kommentar
        </label>
        <textarea
          id="body"
          name="body"
          required
          maxLength={MAX_COMMENT_LENGTH}
          className="min-h-24 w-full"
        />
        <button type="submit">Speichern</button>
      </form>
      {c.comments.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Kommentare.</p>
      ) : (
        <ul className="list-none divide-y divide-zinc-100 border-t border-zinc-200 p-0">
          {c.comments.map((comment) => (
            <li
              key={comment.id}
              className="py-4 text-sm whitespace-pre-wrap"
            >
              <span className="text-xs text-zinc-500">
                {comment.author_id === session.userId ? "Sie" : "Kolleg:in"} ·{" "}
                {formatDate(comment.created_at)}
              </span>
              <br />
              {comment.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
