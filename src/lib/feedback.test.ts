import { describe, expect, it } from "vitest";
import { isField, isValidValue, isVerdict, MAX_VALUE_LENGTH, tally, tallyKey } from "./feedback";

const vote = (value: string, verdict: string, author_id: string, field_name = "website") => ({
  field_name,
  value,
  verdict,
  author_id,
});

describe("tally", () => {
  it("counts votes per field and value and marks the user's own", () => {
    const result = tally(
      [vote("a.de", "correct", "u1"), vote("a.de", "wrong", "u2"), vote("a.de", "correct", "u3"), vote("b.de", "wrong", "u1")],
      "u2",
    );
    expect(result.get(tallyKey("website", "a.de"))).toEqual({ correct: 2, wrong: 1, mine: "wrong" });
    expect(result.get(tallyKey("website", "b.de"))).toEqual({ correct: 0, wrong: 1 });
  });

  it("keeps the same value in different fields apart", () => {
    const result = tally([vote("X", "correct", "u1", "management"), vote("X", "wrong", "u1", "technologiefeld")], "u1");
    expect(result.get(tallyKey("management", "X"))?.mine).toBe("correct");
    expect(result.get(tallyKey("technologiefeld", "X"))?.mine).toBe("wrong");
  });

  it("ignores unknown verdicts", () => {
    expect(tally([vote("a.de", "maybe", "u1")], "u1").size).toBe(0);
  });
});

describe("validation", () => {
  it("accepts only the fields and verdicts the database accepts", () => {
    expect(isField("management")).toBe(true);
    expect(isField("legal_form")).toBe(false);
    expect(isVerdict("wrong")).toBe(true);
    expect(isVerdict("unsure")).toBe(false);
  });

  it("bounds the value length like the database CHECK", () => {
    expect(isValidValue("")).toBe(false);
    expect(isValidValue("x".repeat(MAX_VALUE_LENGTH))).toBe(true);
    expect(isValidValue("x".repeat(MAX_VALUE_LENGTH + 1))).toBe(false);
  });
});
