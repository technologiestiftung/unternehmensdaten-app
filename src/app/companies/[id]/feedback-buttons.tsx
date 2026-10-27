import type { FeedbackField, Tally } from "@/lib/feedback";
import { setVote } from "./actions";

/** "stimmt" / "falsch" for one extracted value, with the vote counts so far. */
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
  const button = (verdict: "correct" | "wrong", label: string) => (
    <button
      type="submit"
      name="verdict"
      value={verdict}
      aria-pressed={tally?.mine === verdict}
      aria-label={`${label}: ${value}`}
      className={`px-2 py-0.5 text-sm ${tally?.mine === verdict ? "" : "border border-neutral-400 bg-white text-neutral-800"}`}
    >
      {label}
      {tally && tally[verdict] > 0 ? ` (${tally[verdict]})` : ""}
    </button>
  );

  return (
    <form action={setVote.bind(null, companyId, field, value)} className="ml-2 inline-flex gap-1 align-middle">
      {button("correct", "stimmt")}
      {button("wrong", "falsch")}
    </form>
  );
}
