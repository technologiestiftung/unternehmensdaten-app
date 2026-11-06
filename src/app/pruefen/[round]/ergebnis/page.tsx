import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatNumber, UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import {
  type Breakdown,
  EARLIER_ROUNDS,
  formatPrecision,
  KIND_LABELS,
  MODE_LABELS,
  REVIEW_PATH,
  reviewEnabled,
  ROUND_RESULTS,
  type Round,
} from "@/lib/review";
import { fieldLabel } from "@/lib/sources";

const DIMENSIONS: Record<Breakdown["dimension"], string> = {
  reason: "Falsch nach Grund",
  confidence: "Nach Sicherheit der Quelle",
  evidence: "Nach Beleg",
};

/** A round's results: counts only. Precision only for measure rounds of shown or refused values. */
export default async function ReviewResultsPage({ params }: { params: Promise<{ round: string }> }) {
  const { round: id } = await params;
  const session = await requireSession();
  if (!UUID.test(id) || !(await reviewEnabled(session.accessToken))) notFound();
  const { review_rounds } = await hasura<{ review_rounds: (Round & { breakdown: Breakdown[] })[] }>(
    ROUND_RESULTS,
    { id },
    session.accessToken,
  );
  const round = review_rounds[0];
  if (!round) notFound();
  const { review_rounds: earlier } = await hasura<{ review_rounds: Round[] }>(
    EARLIER_ROUNDS,
    { field: round.field_name, kind: round.kind, before: round.created_at },
    session.accessToken,
  );
  const before = earlier.find((r) => r.source_key === round.source_key && r.version !== round.version) ?? null;
  const r = round.results;

  return (
    <>
      <Link href={`${REVIEW_PATH}/${round.id}`} className="text-sm text-zinc-500 hover:text-zinc-900 hover:no-underline">
        ← zur Runde
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ergebnis: {round.title}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {fieldLabel(round.field_name)} · {round.source_key ?? "alle Quellen"} · {KIND_LABELS[round.kind]} ·{" "}
        {MODE_LABELS[round.mode]}
      </p>

      <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="beurteilt" value={`${formatNumber(r?.judged ?? 0)} von ${formatNumber(r?.tasks ?? round.size)}`} />
        <Stat label="richtig" value={formatNumber(r?.correct ?? 0)} />
        <Stat label="falsch" value={formatNumber(r?.wrong ?? 0)} />
        <Stat label="?" value={formatNumber(r?.unsure ?? 0)} />
        <Stat label="korrigiert" value={formatNumber(r?.corrected ?? 0)} />
        {round.kind === "gap" && (
          <Stat label="Vorschlag übernommen" value={`${formatNumber(r?.suggestion_taken ?? 0)} von ${formatNumber(r?.suggestion_judged ?? 0)}`} />
        )}
        <Stat
          label="Trefferquote"
          value={r?.precision == null ? "–" : formatPrecision(r.precision)}
          note={r?.precision == null ? "nur bei „messen“ für angezeigte oder verworfene Werte" : undefined}
        />
        {before && (
          <Stat
            label={`vorher (Version ${before.version ?? "–"})`}
            value={formatPrecision(before.results?.precision)}
            note={`${formatNumber(before.results?.judged ?? 0)} beurteilt`}
          />
        )}
      </dl>

      {(Object.keys(DIMENSIONS) as Breakdown["dimension"][]).map((dimension) => {
        const rows = round.breakdown.filter((b) => b.dimension === dimension);
        if (rows.length === 0) return null;
        return (
          <section key={dimension} className="mt-8 max-w-3xl">
            <h2 className="text-lg font-semibold">{DIMENSIONS[dimension]}</h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col">{dimension === "reason" ? "Grund" : dimension === "confidence" ? "Sicherheit ab" : "Beleg"}</th>
                  {dimension !== "reason" && <th scope="col" className="text-right">richtig</th>}
                  <th scope="col" className="text-right">falsch</th>
                  {dimension !== "reason" && <th scope="col" className="text-right">Trefferquote</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.bucket ?? "none"}>
                    <th scope="row" className="font-normal">{b.bucket ?? "ohne Grund"}</th>
                    {dimension !== "reason" && <td className="text-right">{formatNumber(b.correct)}</td>}
                    <td className="text-right">{formatNumber(b.wrong)}</td>
                    {dimension !== "reason" && (
                      <td className="text-right">{formatPrecision(b.correct + b.wrong ? b.correct / (b.correct + b.wrong) : null)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
      {note && <dd className="text-xs text-zinc-500">{note}</dd>}
    </div>
  );
}
