import { describe, expect, it } from "vitest";
import { answerAfter, optionsFor, pickAnswer, reasonsFor, verdictInput, websiteHref } from "./review";

describe("verdictInput", () => {
  it("keeps a reason and correction only on falsch, as the database's CHECKs require", () => {
    expect(verdictInput("correct", "Verzeichnis", "x")).toEqual({ verdict: "correct", reason: null, correction: null });
    expect(verdictInput("wrong", " Verzeichnis ", " https://a.de ")).toEqual({
      verdict: "wrong", reason: "Verzeichnis", correction: "https://a.de",
    });
    expect(verdictInput("wrong", "", "")).toEqual({ verdict: "wrong", reason: null, correction: null });
  });

  it("refuses unknown verdicts and values over the database's limits", () => {
    expect(verdictInput("maybe", null, null)).toBeNull();
    expect(verdictInput("wrong", "x".repeat(101), null)).toBeNull();
    expect(verdictInput("wrong", null, "x".repeat(501))).toBeNull();
  });
});

describe("answerAfter", () => {
  const wrong = { verdict: "wrong" as const, reason: "Verzeichnis", correction: "https://b.de" };

  it("takes the answer back when the active button is clicked again", () => {
    expect(answerAfter({ verdict: "correct", reason: null, correction: null }, "correct")).toBeNull();
  });

  it("keeps reason and correction when falsch is clicked, replaces them when given", () => {
    expect(answerAfter({ verdict: "unsure", reason: null, correction: null }, "wrong")).toEqual({
      verdict: "wrong", reason: null, correction: null,
    });
    expect(answerAfter(wrong, "wrong", "Namensvetter")).toEqual({ ...wrong, reason: "Namensvetter" });
    expect(answerAfter(wrong, "wrong", undefined, "")).toEqual({ ...wrong, correction: null });
  });

  it("drops reason and correction when the answer changes to richtig", () => {
    expect(answerAfter(wrong, "correct")).toEqual({ verdict: "correct", reason: null, correction: null });
  });
});

describe("pickAnswer", () => {
  it("counts the source's own value as richtig and anything else as a correction", () => {
    expect(pickAnswer({ value: "Photonics" }, false, null, "Photonics")).toEqual({ verdict: "correct", reason: null, correction: null });
    expect(pickAnswer({ value: "Photonics" }, false, null, "Robotics")).toEqual({
      verdict: "wrong", reason: null, correction: "Robotics",
    });
  });

  it("fills a gap with the picked option", () => {
    expect(pickAnswer({ value: "" }, true, null, "Robotics")).toEqual({ verdict: "wrong", reason: null, correction: "Robotics" });
  });
});

describe("helpers", () => {
  it("links websites only, adding https to a bare host", () => {
    expect(websiteHref("beispiel.de")).toBe("https://beispiel.de/");
    expect(websiteHref("http://a.de/impressum")).toBe("http://a.de/impressum");
    expect(websiteHref("Photonics")).toBeNull();
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref(null)).toBeNull();
  });

  it("gives website candidates the website reasons, and every field 'andere' last", () => {
    expect(reasonsFor("candidate_url")).toEqual(["Verzeichnis", "Mutterfirma", "Namensvetter", "nicht erreichbar", "andere"]);
    expect(reasonsFor("legal_form").at(-1)).toBe("andere");
  });

  it("offers option lists for Technologiefeld and WZ only", () => {
    expect(optionsFor("technology_field")).toBe("technology_field");
    expect(optionsFor("wz_division_estimated")).toBe("wz");
    expect(optionsFor("website")).toBeNull();
  });
});
