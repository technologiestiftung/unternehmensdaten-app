import type { ReactNode } from "react";
import type { Column, CompanyProfile } from "@/lib/columns";
import {
  type FeedbackField,
  isField,
  MAX_VALUE_LENGTH,
  MISSING,
  type Tally,
  tallyKey,
} from "@/lib/feedback";
import { type Provenance, provenanceFor, sourcesOf } from "@/lib/provenance";
import { setVote } from "./actions";
import { ProvenanceInfo } from "./provenance-info";

const ICONS = {
  correct: <path d="M4 10.5l4 4 8-9" />,
  wrong: <path d="M5 5l10 10M15 5L5 15" />,
};
const LABELS = { correct: "stimmt", wrong: "falsch" };

/** ✓ / ✗ for one extracted value, with the vote counts so far. */
export function FeedbackButtons({
  companyId,
  field,
  value,
  tally,
}: {
  companyId: string;
  field: FeedbackField;
  value: string;
  tally?: Tally;
}) {
  const button = (verdict: "correct" | "wrong") => {
    const mine = tally?.mine === verdict;
    const count = tally?.[verdict] ?? 0;
    const tone = verdict === "correct" ? "text-green-700" : "text-red-700";
    return (
      <button
        type="submit"
        name="verdict"
        value={verdict}
        aria-pressed={mine}
        aria-label={`${LABELS[verdict]}: ${value}`}
        title={LABELS[verdict]}
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-xs ${
          mine
            ? verdict === "correct"
              ? "bg-green-700 hover:bg-green-800"
              : "bg-red-700 hover:bg-red-800"
            : `border border-zinc-200 bg-white hover:bg-zinc-100 ${tone}`
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          {ICONS[verdict]}
        </svg>
        {count > 0 && <span>{count}</span>}
      </button>
    );
  };

  return (
    <form
      action={setVote.bind(null, companyId, field, value)}
      className="ml-1.5 inline-flex gap-1 align-middle"
    >
      {button("correct")}
      {button("wrong")}
    </form>
  );
}

/**
 * Under a value the user marked wrong: what it should be (optional; empty removes it). Under a
 * MISSING value: what is missing (required, because a vote on nothing must say what it should be).
 */
export function CorrectionForm({
  companyId,
  field,
  value,
  saved,
}: {
  companyId: string;
  field: FeedbackField;
  value: string;
  saved?: string;
}) {
  const id = `correction-${field}-${value || "missing"}`;
  return (
    <form
      action={setVote.bind(null, companyId, field, value)}
      className="mt-2 flex w-full max-w-sm flex-col items-start gap-2"
    >
      <input type="hidden" name="verdict" value="wrong" />
      <label htmlFor={id} className="text-xs font-medium text-zinc-500">
        {value === MISSING ? "Fehlender Wert" : "Richtiger Wert"}
      </label>
      <input
        id={id}
        name="correction"
        defaultValue={saved ?? ""}
        required={value === MISSING}
        maxLength={MAX_VALUE_LENGTH}
        className="w-full"
      />
      <button type="submit">Speichern</button>
    </form>
  );
}

/**
 * One cell: the value(s), each with its origin (ⓘ) and, with `votes`, ✓/✗. Used by the list and the
 * detail page, so every field gets the same controls in one place. An empty field shows "–"; with
 * `corrections`, it offers a form to say what is missing. `withValue={false}` shows the controls only
 * (for the name, whose value is the page heading). `max` shows only the first values and counts the rest.
 */
export function FieldCell({
  company,
  column,
  votes,
  provenance,
  corrections = false,
  withValue = true,
  max,
}: {
  company: CompanyProfile;
  column: Column;
  votes?: Map<string, Tally>;
  provenance: Provenance[];
  corrections?: boolean;
  withValue?: boolean;
  max?: number;
}): ReactNode {
  const values = column.votes?.(company);
  if (!values || !isField(column.key)) {
    // A sum (Förderungen) has no single value to vote on; the ⓘ names where its parts came from.
    const sources = sourcesOf(provenance.filter((row) => row.field_name === column.key));
    return (
      <>
        {column.render(company)}
        <ProvenanceInfo label={column.label} rows={sources} />
      </>
    );
  }
  const field = column.key;
  const several = column.multiValue === true;
  const more = max === undefined ? 0 : Math.max(0, values.length - max);
  const cells = values.slice(0, values.length - more).map((value) => {
    if (value === MISSING) {
      const mine = votes?.get(tallyKey(field, MISSING));
      return (
        <span key="missing" className="block">
          –
          <ProvenanceInfo label={`${column.label}: kein Wert`} rows={provenanceFor(provenance, field, MISSING, false)} />
          {corrections && (
            <details className="ml-3 inline">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true">+</span> Wert ergänzen
              </summary>
              <CorrectionForm companyId={company.id} field={field} value={MISSING} saved={mine?.mineCorrection} />
            </details>
          )}
        </span>
      );
    }
    const tally = votes?.get(tallyKey(field, value));
    return (
      <span key={value} className="mr-2 inline-block">
        {withValue && (several ? value : column.render(company))}
        <ProvenanceInfo label={`${column.label}: ${value}`} rows={provenanceFor(provenance, field, value, several)} />
        {votes && <FeedbackButtons companyId={company.id} field={field} value={value} tally={tally} />}
        {corrections && tally?.mine === "wrong" && (
          <CorrectionForm companyId={company.id} field={field} value={value} saved={tally.mineCorrection} />
        )}
      </span>
    );
  });
  return more > 0 ? [...cells, <span key="more" className="text-zinc-500">+ {more} weitere</span>] : cells;
}
