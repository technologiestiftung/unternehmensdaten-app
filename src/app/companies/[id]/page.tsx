import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatDate, formatEuro, formatNumber, MAX_COMMENT_LENGTH, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { addComment } from "./actions";

const COMPANY = `
  query Company($id: uuid!) {
    companies(where: { id: { _eq: $id } }) {
      id name employee_count revenue funding_count funding_total_eur wz_code established_at
      address legal_form cluster technologiefeld website management business_purpose
      deeptech_class deeptech_confidence is_ai amazon_effect register_status updated_at
      fundings(order_by: { period_from: desc }, limit: 25) {
        fkz amount_eur period_from period_to topic ministry
      }
      comments(order_by: { created_at: desc }) { id body author_id created_at }
    }
  }`;

type Company = {
  id: string;
  name: string;
  employee_count: number | null;
  revenue: number | null;
  funding_count: number;
  funding_total_eur: number | null;
  wz_code: string | null;
  established_at: string | null;
  address: string | null;
  legal_form: string | null;
  cluster: string | null;
  technologiefeld: string | null;
  website: string | null;
  management: string | null;
  business_purpose: string | null;
  deeptech_class: string | null;
  deeptech_confidence: number | null;
  is_ai: boolean | null;
  amazon_effect: string | null;
  register_status: string | null;
  updated_at: string | null;
  fundings: {
    fkz: string;
    amount_eur: number | null;
    period_from: string | null;
    period_to: string | null;
    topic: string | null;
    ministry: string | null;
  }[];
  comments: { id: string; body: string; author_id: string; created_at: string }[];
};

const text = (value: string | null) => value ?? "–";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { companies } = await hasura<{ companies: Company[] }>(COMPANY, { id }, session.accessToken);
  const c = companies[0];
  if (!c) notFound();

  const fields: [string, React.ReactNode][] = [
    ["Mitarbeiter", formatNumber(c.employee_count)],
    ["Umsatz", formatEuro(c.revenue)],
    ["Förderungen", c.funding_count > 0 ? `${c.funding_count} · ${formatEuro(c.funding_total_eur)}` : "–"],
    ["WZ-Nummer", text(c.wz_code)],
    ["Gründungsdatum", formatDate(c.established_at)],
    ["Adresse", text(c.address)],
    ["Rechtsform", text(c.legal_form)],
    ["Cluster", text(c.cluster)],
    ["Technologiefeld", text(c.technologiefeld)],
    [
      "Website",
      c.website ? (
        <a href={c.website} rel="noopener noreferrer nofollow" target="_blank">
          {c.website}
        </a>
      ) : (
        "–"
      ),
    ],
    ["Geschäftsführung", text(c.management)],
    ["Tätigkeitsbeschreibung", text(c.business_purpose)],
    [
      "DeepTech",
      c.deeptech_class
        ? `${c.deeptech_class} (Konfidenz ${formatNumber(c.deeptech_confidence)})`
        : "–",
    ],
    ["KI-Unternehmen", c.is_ai == null ? "–" : c.is_ai ? "ja" : "nein"],
    ["Amazon-Effekt", text(c.amazon_effect)],
    ["Registerstatus", text(c.register_status)],
    ["Stand", formatDate(c.updated_at)],
  ];

  return (
    <>
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
        <p className="text-neutral-600">Keine Förderungen im Förderkatalog des Bundes zugeordnet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="text-neutral-600">
              Neueste {c.fundings.length} von {c.funding_count}, Quelle: Förderkatalog des Bundes
            </caption>
            <thead>
              <tr>
                <th scope="col">FKZ</th>
                <th scope="col">Laufzeit</th>
                <th scope="col">Thema</th>
                <th scope="col">Ressort</th>
                <th scope="col" className="text-right">Betrag</th>
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
      <form action={addComment.bind(null, c.id)} className="mb-6 flex flex-col items-start gap-2">
        <label htmlFor="body">Neuer Kommentar</label>
        <textarea id="body" name="body" required maxLength={MAX_COMMENT_LENGTH} className="min-h-24 w-full" />
        <button type="submit">Speichern</button>
      </form>
      {c.comments.length === 0 ? (
        <p className="text-neutral-600">Noch keine Kommentare.</p>
      ) : (
        <ul className="list-none p-0">
          {c.comments.map((comment) => (
            <li key={comment.id} className="mb-3 border-l-4 border-neutral-300 py-1 pl-3 whitespace-pre-wrap">
              <span className="text-neutral-600">
                {comment.author_id === session.userId ? "Sie" : "Kolleg:in"} · {formatDate(comment.created_at)}
              </span>
              <br />
              {comment.body}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
