import { describe, expect, it } from "vitest";
import {
  isField,
  isValidValue,
  isVerdict,
  MAX_VALUE_LENGTH,
  MISSING,
  tally,
  tallyKey,
  voteChange,
} from "./feedback";

const vote = (
  value: string,
  verdict: string,
  author_id: string,
  field_name = "website",
) => ({
  field_name,
  value,
  verdict,
  author_id,
});

describe("tally", () => {
  it("counts votes per field and value and marks the user's own", () => {
    const result = tally(
      [
        vote("a.de", "correct", "u1"),
        vote("a.de", "wrong", "u2"),
        vote("a.de", "correct", "u3"),
        vote("b.de", "wrong", "u1"),
      ],
      "u2",
    );
    expect(result.get(tallyKey("website", "a.de"))).toEqual({
      correct: 2,
      wrong: 1,
      mine: "wrong",
    });
    expect(result.get(tallyKey("website", "b.de"))).toEqual({
      correct: 0,
      wrong: 1,
    });
  });

  it("returns the user's own correction", () => {
    const row = { ...vote("a.de", "wrong", "u1"), correction: "b.de" };
    expect(
      tally([row], "u1").get(tallyKey("website", "a.de"))?.mineCorrection,
    ).toBe("b.de");
    expect(
      tally([row], "u2").get(tallyKey("website", "a.de"))?.mineCorrection,
    ).toBeUndefined();
  });

  it("keeps the same value in different fields apart", () => {
    const result = tally(
      [
        vote("X", "correct", "u1", "management"),
        vote("X", "wrong", "u1", "technologiefeld"),
      ],
      "u1",
    );
    expect(result.get(tallyKey("management", "X"))?.mine).toBe("correct");
    expect(result.get(tallyKey("technologiefeld", "X"))?.mine).toBe("wrong");
  });

  it("ignores unknown verdicts", () => {
    expect(tally([vote("a.de", "maybe", "u1")], "u1").size).toBe(0);
  });
});

describe("voteChange", () => {
  it("clears the correction on a correct vote", () => {
    expect(voteChange("correct", "anything")).toEqual({
      correction: null,
      updateColumns: ["verdict", "correction"],
    });
  });

  it("keeps a saved correction when a wrong vote comes from the icon buttons", () => {
    expect(voteChange("wrong", null)).toEqual({
      correction: null,
      updateColumns: ["verdict"],
    });
  });

  it("sets, trims and removes a correction from the form", () => {
    expect(voteChange("wrong", "  Erika Muster ")).toEqual({
      correction: "Erika Muster",
      updateColumns: ["verdict", "correction"],
    });
    expect(voteChange("wrong", "   ")).toEqual({
      correction: null,
      updateColumns: ["verdict", "correction"],
    });
    expect(voteChange("wrong", "x".repeat(MAX_VALUE_LENGTH + 1))).toBeNull();
  });
});

describe("validation", () => {
  it("accepts only the fields and verdicts the database accepts", () => {
    expect(isField("management")).toBe(true);
    expect(isField("legal_form")).toBe(true);
    // Not data to judge: the comment is user input, the date is the system's.
    expect(isField("comment")).toBe(false);
    expect(isField("updated_at")).toBe(false);
    expect(isVerdict("wrong")).toBe(true);
    expect(isVerdict("unsure")).toBe(false);
  });

  it("bounds the value length like the database CHECK", () => {
    // Empty is a vote on a field that showed nothing.
    expect(isValidValue(MISSING)).toBe(true);
    expect(isValidValue("x".repeat(MAX_VALUE_LENGTH))).toBe(true);
    expect(isValidValue("x".repeat(MAX_VALUE_LENGTH + 1))).toBe(false);
  });
});

describe("voteChange on a missing value", () => {
  it("needs a wrong vote with a correction", () => {
    expect(voteChange("wrong", "beispiel.de", MISSING)).toEqual({
      correction: "beispiel.de",
      updateColumns: ["verdict", "correction"],
    });
  });

  it("refuses a correct vote, and a wrong vote that does not say what is missing", () => {
    expect(voteChange("correct", null, MISSING)).toBeNull();
    expect(voteChange("wrong", null, MISSING)).toBeNull();
    expect(voteChange("wrong", "   ", MISSING)).toBeNull();
    expect(voteChange("wrong", "x".repeat(MAX_VALUE_LENGTH + 1), MISSING)).toBeNull();
  });

  it("leaves votes on shown values as they were", () => {
    expect(voteChange("wrong", null, "a.de")).toEqual({ correction: null, updateColumns: ["verdict"] });
  });
});
