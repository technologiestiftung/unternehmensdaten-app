/** Fields users can vote on. Must match the CHECK on extraction_feedback.field_name (V23). */
export const FEEDBACK_FIELDS = ["management", "website", "technologiefeld"] as const;
export type FeedbackField = (typeof FEEDBACK_FIELDS)[number];

export const VERDICTS = ["correct", "wrong"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Same limit as the CHECK on extraction_feedback.value. */
export const MAX_VALUE_LENGTH = 500;

/** `v_company_profile.management` joins the current managers with this separator. */
export const MANAGEMENT_SEPARATOR = "; ";

export type FeedbackRow = { field_name: string; value: string; verdict: string; author_id: string };
export type Tally = { correct: number; wrong: number; mine?: Verdict };

export const tallyKey = (field: string, value: string) => `${field}\u0000${value}`;

/** Votes per (field, value), and which one the signed-in user cast. */
export function tally(rows: FeedbackRow[], userId: string | undefined): Map<string, Tally> {
  const result = new Map<string, Tally>();
  for (const row of rows) {
    if (!isVerdict(row.verdict)) continue;
    const key = tallyKey(row.field_name, row.value);
    const entry = result.get(key) ?? { correct: 0, wrong: 0 };
    entry[row.verdict] += 1;
    if (userId && row.author_id === userId) entry.mine = row.verdict;
    result.set(key, entry);
  }
  return result;
}

export const isField = (value: string): value is FeedbackField =>
  (FEEDBACK_FIELDS as readonly string[]).includes(value);

export const isVerdict = (value: string): value is Verdict =>
  (VERDICTS as readonly string[]).includes(value);

export const isValidValue = (value: string) => value.length > 0 && value.length <= MAX_VALUE_LENGTH;
