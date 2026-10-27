/** Fields users can vote on. Must match the CHECK on extraction_feedback.field_name (V23). */
export const FEEDBACK_FIELDS = [
  "management",
  "website",
  "technologiefeld",
] as const;
export type FeedbackField = (typeof FEEDBACK_FIELDS)[number];

export const VERDICTS = ["correct", "wrong"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Same limit as the CHECK on extraction_feedback.value. */
export const MAX_VALUE_LENGTH = 500;

/** `v_company_profile.management` joins the current managers with this separator. */
export const MANAGEMENT_SEPARATOR = "; ";

export type FeedbackRow = {
  field_name: string;
  value: string;
  verdict: string;
  author_id: string;
  correction?: string | null;
};
export type Tally = {
  correct: number;
  wrong: number;
  mine?: Verdict;
  mineCorrection?: string;
};

export const tallyKey = (field: string, value: string) =>
  `${field}\u0000${value}`;

/** Votes per (field, value), and which one the signed-in user cast. */
export function tally(
  rows: FeedbackRow[],
  userId: string | undefined,
): Map<string, Tally> {
  const result = new Map<string, Tally>();
  for (const row of rows) {
    if (!isVerdict(row.verdict)) continue;
    const key = tallyKey(row.field_name, row.value);
    const entry = result.get(key) ?? { correct: 0, wrong: 0 };
    entry[row.verdict] += 1;
    if (userId && row.author_id === userId) {
      entry.mine = row.verdict;
      if (row.correction) entry.mineCorrection = row.correction;
    }
    result.set(key, entry);
  }
  return result;
}

export const isField = (value: string): value is FeedbackField =>
  (FEEDBACK_FIELDS as readonly string[]).includes(value);

export const isVerdict = (value: string): value is Verdict =>
  (VERDICTS as readonly string[]).includes(value);

export const isValidValue = (value: string) =>
  value.length > 0 && value.length <= MAX_VALUE_LENGTH;

/**
 * What to write for a vote, given the form. A ✓ always clears the correction (the database allows
 * one only on a ✗). A ✗ from the icon buttons carries no correction field and keeps whatever was
 * saved before; a ✗ from the correction form sets it, and an empty field removes it.
 */
export function voteChange(
  verdict: Verdict,
  correctionField: string | null,
): {
  correction: string | null;
  updateColumns: ("verdict" | "correction")[];
} | null {
  if (verdict === "correct")
    return { correction: null, updateColumns: ["verdict", "correction"] };
  if (correctionField === null)
    return { correction: null, updateColumns: ["verdict"] };
  const correction = correctionField.trim();
  if (correction.length > MAX_VALUE_LENGTH) return null;
  return {
    correction: correction || null,
    updateColumns: ["verdict", "correction"],
  };
}
