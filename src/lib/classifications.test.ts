import { describe, expect, it } from "vitest";
import { technologyFieldAnchor, wzAnchor, wzSections } from "./classifications";

describe("anchors", () => {
  it("turns an English field name into a stable anchor", () => {
    expect(technologyFieldAnchor("Artificial Intelligence & Data Science")).toBe("tf-artificial-intelligence-data-science");
    expect(technologyFieldAnchor("Café Robotics")).toBe("tf-cafe-robotics");
  });

  it("finds a WZ code's division, or none", () => {
    expect(wzAnchor("62.01")).toBe("wz-62");
    expect(wzAnchor("62")).toBe("wz-62");
    expect(wzAnchor("x")).toBeUndefined();
  });
});

describe("wzSections", () => {
  it("groups divisions by section, sections in order", () => {
    const d = (division: string, section: string) => ({ division, title: `T${division}`, section, section_title: `S${section}` });
    expect(wzSections([d("01", "A"), d("62", "J"), d("02", "A")])).toEqual([
      { section: "A", title: "SA", divisions: [d("01", "A"), d("02", "A")] },
      { section: "J", title: "SJ", divisions: [d("62", "J")] },
    ]);
  });
});
