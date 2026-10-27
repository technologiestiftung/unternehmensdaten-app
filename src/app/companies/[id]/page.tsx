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
        <Link href="/">← Alle Unternehmen</Link>
      </p>
      <h1 className="mt-2 mb-4 text-2xl font-bold">{c.name}</h1>
      <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] gap-x-4 gap-y-1">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-600">{label}</dt>
            <dd className="m-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 mb-2 text-xl font-bold">Förderungen</h2>
      {c.fundings.length === 0 ? (
        <p className="text-neutral-600">
          Keine Förderungen im Förderkatalog des Bundes zugeordnet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="text-neutral-600">
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
                  <td className="text-right">{formatEuro(f.amount_eur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-2 text-xl font-bold">Kommentare</h2>
      <form
        action={addComment.bind(null, c.id)}
        className="mb-6 flex flex-col items-start gap-2"
      >
        <label htmlFor="body">Neuer Kommentar</label>
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
        <p className="text-neutral-600">Noch keine Kommentare.</p>
      ) : (
        <ul className="list-none p-0">
          {c.comments.map((comment) => (
            <li
              key={comment.id}
              className="mb-3 border-l-4 border-neutral-300 py-1 pl-3 whitespace-pre-wrap"
            >
              <span className="text-neutral-600">
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
