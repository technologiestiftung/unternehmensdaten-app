import type { ReactNode } from "react";
import type { CompanyProfile } from "@/lib/columns";
import {
  type FeedbackField,
  MANAGEMENT_SEPARATOR,
  MAX_VALUE_LENGTH,
  type Tally,
  tallyKey,
} from "@/lib/feedback";
import { setVote } from "./actions";

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

/** Shown under a value the user marked wrong: what it should be. Optional; empty removes it. */
function CorrectionForm({
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
  const id = `correction-${field}-${value}`;
  return (
    <form
      action={setVote.bind(null, companyId, field, value)}
      className="mt-1 flex flex-wrap items-center gap-1 text-sm"
    >
      <input type="hidden" name="verdict" value="wrong" />
      <label htmlFor={id} className="text-zinc-500">
        Richtiger Wert
      </label>
      <input
        id={id}
        name="correction"
        defaultValue={saved ?? ""}
        maxLength={MAX_VALUE_LENGTH}
        className="min-w-48 flex-1 py-0.5"
      />
      <button type="submit" className="px-2 py-1 text-xs">
        Speichern
      </button>
    </form>
  );
}

/**
 * The three votable fields rendered with their buttons, keyed like `COLUMNS`. List and detail page
 * both use this, so a field gets buttons in one place.
 */
export function votableCells(
  c: Pick<CompanyProfile, "id" | "technologiefeld" | "website" | "management">,
  votes: Map<string, Tally>,
  website: ReactNode,
  { corrections = false }: { corrections?: boolean } = {},
): Record<FeedbackField, ReactNode> {
  const withVote = (
    field: FeedbackField,
    value: string,
    shown: ReactNode = value,
  ) => {
    const tallyFor = votes.get(tallyKey(field, value));
    return (
      <span className="mr-2 inline-block">
        {shown}
        <FeedbackButtons
          companyId={c.id}
          field={field}
          value={value}
          tally={tallyFor}
        />
        {corrections && tallyFor?.mine === "wrong" && (
          <CorrectionForm
            companyId={c.id}
            field={field}
            value={value}
            saved={tallyFor.mineCorrection}
          />
        )}
      </span>
    );
  };
  return {
    technologiefeld: c.technologiefeld
      ? withVote("technologiefeld", c.technologiefeld)
      : "–",
    website: c.website ? withVote("website", c.website, website) : "–",
    management: c.management
      ? c.management
          .split(MANAGEMENT_SEPARATOR)
          .map((name) => <span key={name}>{withVote("management", name)}</span>)
      : "–",
  };
}
