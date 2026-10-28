import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { type FeedbackRow, tally } from "@/lib/feedback";
import {
  COLUMNS,
  type CompanyProfile,
  PROFILE_FIELDS,
  text,
} from "@/lib/columns";
import { formatDate, formatEuro, MAX_COMMENT_LENGTH, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { addComment } from "./actions";
import { votableCells } from "./feedback-buttons";

const COMPANY = `
  query Company($id: uuid!) {
    companies(where: { id: { _eq: $id } }) {
      ${PROFILE_FIELDS}
      fundings(order_by: { period_from: desc }, limit: 25) {
        fkz amount_eur period_from period_to topic ministry
      }
      comments(order_by: { created_at: desc }) { id body author_id created_at }
      feedback { field_name value verdict correction author_id }
    }
  }`;

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
};

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { companies } = await hasura<{ companies: Company[] }>(
    COMPANY,
    { id },
    session.accessToken,
  );
  const c = companies[0];
  if (!c) notFound();

  const votes = tally(c.feedback, session.userId);
  const withVotes: Partial<Record<string, React.ReactNode>> = votableCells(
    c,
    votes,
    COLUMNS.find((col) => col.key === "website")!.render(c),
    { corrections: true },
  );
  const fields = COLUMNS.filter((col) => col.key !== "comment").map(
    (col) => [col.label, withVotes[col.key] ?? col.render(c)] as const,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <p>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Alle Unternehmen
        </Link>
      </p>
      <h1 className="mt-3 mb-6">{c.name}</h1>
      <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] border-t border-zinc-200 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="contents [&:last-child>*]:border-0">
            <dt className="border-b border-zinc-100 py-2.5 pr-4 text-zinc-500">{label}</dt>
            <dd className="m-0 border-b border-zinc-100 py-2.5 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 mb-3">Förderungen</h2>
      {c.fundings.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Keine Förderungen im Förderkatalog des Bundes zugeordnet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="caption-bottom px-3 py-2.5 text-left text-xs text-zinc-500">
              Neueste {c.fundings.length} von {c.funding_count}, Quelle:
              Förderkatalog des Bundes
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
