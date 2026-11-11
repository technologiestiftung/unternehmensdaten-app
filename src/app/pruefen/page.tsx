import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { formatPrecision, KIND_LABELS, MODE_LABELS, REVIEW_PATH, reviewEnabled, ROUNDS, type Round } from "@/lib/review";
import { isManager, MANAGER, messageText, REQUESTS, type RoundRequest } from "@/lib/review-manage";
import { fieldLabel } from "@/lib/sources";
import { NewRoundForm, RequestList, RoundActions } from "./manage";

/** The review rounds: one row each, with progress and, for measure rounds, the precision so far. */
export default async function ReviewRoundsPage({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const session = await requireSession();
  if (!(await reviewEnabled(session.accessToken))) notFound();
  const manager = isManager(session.accessToken);
  const [{ review_rounds: rounds }, requests] = await Promise.all([
    hasura<{ review_rounds: Round[] }>(ROUNDS, {}, session.accessToken),
    manager
      ? hasura<{ review_round_requests: RoundRequest[] }>(REQUESTS, {}, session.accessToken, MANAGER).then((d) => d.review_round_requests)
      : [],
  ]);
  const message = messageText((await searchParams)?.meldung);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Prüfen</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Je Runde etwa 200 Werte einer Quelle und eines Felds, zufällig gezogen. Jede Antwort wird sofort
        gespeichert und fließt als Stimme in die Daten zurück. Bei „messen“ zeigt die Runde, wie oft die
        Quelle richtig liegt.
      </p>
      {message && (
        <p role="status" className="mt-4 max-w-3xl border-l-4 border-accent pl-3 text-sm">
          {message}
        </p>
      )}
      {manager && <NewRoundForm />}
      {manager && <RequestList requests={requests} />}
      {rounds.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">Noch keine Runde gezogen.</p>
      ) : (
        <div className="mt-6 overflow-x-auto border-y border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Prüfrunden mit Fortschritt und Trefferquote</caption>
            <thead>
              <tr>
                <th scope="col">Runde</th>
                <th scope="col">Quelle</th>
                <th scope="col">Feld</th>
                <th scope="col">Art</th>
                <th scope="col">Version</th>
                <th scope="col">Fortschritt</th>
                <th scope="col" className="text-right">Trefferquote</th>
                {manager && <th scope="col">Verwalten</th>}
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => {
                const judged = r.results?.judged ?? 0;
                const tasks = r.results?.tasks ?? r.size;
                return (
                  <tr key={r.id} className="align-top">
                    <th scope="row" className="font-medium">
                      <Link href={`${REVIEW_PATH}/${r.id}`}>{r.title}</Link>
                      <div className="font-normal text-zinc-600">
                        {formatDate(r.created_at)}
                        {judged > 0 && (
                          <>
                            {" · "}
                            <Link href={`${REVIEW_PATH}/${r.id}/ergebnis`}>Ergebnis</Link>
                          </>
                        )}
                      </div>
                    </th>
                    <td>{r.source_key ?? "–"}</td>
                    <td>{fieldLabel(r.field_name)}</td>
                    <td>
                      {KIND_LABELS[r.kind]} · {MODE_LABELS[r.mode]}
                    </td>
                    <td>{r.version ?? "–"}</td>
                    <td>
                      {formatNumber(judged)} von {formatNumber(tasks)}
                    </td>
                    <td className="text-right">
                      {r.results?.precision == null ? "–" : formatPrecision(r.results.precision)}
                    </td>
                    {manager && (
                      <td>
                        <RoundActions round={r} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
