import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { fieldLabel, isInternalField, runStatusLabel, SOURCE_OVERVIEW, type SourceOverview } from "@/lib/sources";

/**
 * What each source has collected: one row per source, its latest run, and per field how many
 * companies it has a value for and how many of those the app shows. A source can store values the
 * app does not show yet (e-mail and phone wait for a privacy review), so both numbers are given.
 */
export default async function SourcesPage() {
  const session = await requireSession();
  const { source_overview: sources } = await hasura<{ source_overview: SourceOverview[] }>(
    SOURCE_OVERVIEW,
    {},
    session.accessToken,
  );
  const asOf = sources.find((s) => s.counts_as_of)?.counts_as_of ?? null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Quellen</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Was jede Quelle gesammelt hat. Je Feld: wie viele Unternehmen von dieser Quelle einen Wert haben,
        und bei wie vielen davon die App genau diesen Wert zeigt (sonst gewinnt eine andere Quelle, oder
        der Wert wird bewusst nicht gezeigt, wie E-Mail und Telefon). Arbeitswerte der Website-Suche stehen
        nur auf der Seite der Quelle. Zahlen vom{" "}
        {formatDate(asOf)}; der letzte Lauf ist immer aktuell.
      </p>
      <div className="mt-6 overflow-x-auto border-y border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Quellen mit letztem Lauf und gesammelten Feldern</caption>
          <thead>
            <tr>
              <th scope="col">Quelle</th>
              <th scope="col">Letzter Lauf</th>
              <th scope="col" className="text-right">Unternehmen</th>
              <th scope="col">Felder: Unternehmen mit Wert / davon angezeigt</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source_key} className="align-top">
                <th scope="row" className="font-medium">
                  <Link href={`/sources/${encodeURIComponent(s.source_key)}`}>{s.name}</Link>
                  <div className="mt-1 font-normal">
                    <Link href={`/?source=${encodeURIComponent(s.source_key)}`}>Unternehmen anzeigen</Link>
                  </div>
                </th>
                <td>
                  {s.last_run_status ? (
                    <>
                      {formatDate(s.last_run_started_at)}: {runStatusLabel(s.last_run_status)}
                      <div className="text-zinc-600">
                        {formatNumber(s.last_run_seen)} gelesen
                        {s.last_run_failed ? `, ${formatNumber(s.last_run_failed)} mit Fehlern` : ""}
                      </div>
                      {s.runs_interrupted > 0 && (
                        <div className="text-zinc-600">
                          {formatNumber(s.runs_interrupted)} von {formatNumber(s.runs)} Läufen unterbrochen
                        </div>
                      )}
                    </>
                  ) : (
                    runStatusLabel(null)
                  )}
                </td>
                <td className="text-right">
                  {formatNumber(s.companies)}
                  {s.companies_created > 0 && (
                    <div className="text-zinc-600">davon {formatNumber(s.companies_created)} neu angelegt</div>
                  )}
                </td>
                <td>
                  {s.fields.some((f) => !isInternalField(f.field_name)) ? (
                    <ul>
                      {s.fields.filter((f) => !isInternalField(f.field_name)).map((f) => (
                        <li key={f.field_name}>
                          {fieldLabel(f.field_name)}: {formatNumber(f.companies)} / {formatNumber(f.companies_shown)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-zinc-600">
                      {s.source_type === "register"
                        ? "Registerdaten: Name, Adresse, Rechtsform, Status"
                        : "noch keine Werte"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
