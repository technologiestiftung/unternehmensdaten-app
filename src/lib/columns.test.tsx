import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { company } from "@/test/hasura-stub";
import { COLUMNS, foundingText, shortRegisterNumber } from "./columns";
import { ConfidenceBadge } from "./confidence";
import { fieldLabel, shownValues, voteTarget } from "./history";

const fundings = COLUMNS.find((col) => col.key === "fundings")!;
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/ /g, " ");

describe("Förderungen column", () => {
  it("shows the sum and says what the count is", () => {
    const html = renderToStaticMarkup(<>{fundings.render(company({ funding_count: 9, funding_total_eur: 4132893 }))}</>);
    expect(text(html)).toBe("4.132.893 € (9 Förderungen)");
  });

  it("uses the singular for one grant", () => {
    const html = renderToStaticMarkup(<>{fundings.render(company({ funding_count: 1, funding_total_eur: 5000 }))}</>);
    expect(text(html)).toBe("5.000 € (1 Förderung)");
  });

  it("shows a dash without grants", () => {
    expect(fundings.render(company({ funding_count: 0 }))).toBe("–");
  });
});

describe("Registernummer column", () => {
  const column = COLUMNS.find((col) => col.key === "registration_number")!;

  it("shows the short number, the court as a tooltip, and offers no vote", () => {
    const full = "Amtsgericht Berlin (Charlottenburg) HRB 121291 B";
    const html = renderToStaticMarkup(<>{column.render(company({ registration_number: full }))}</>);
    expect(text(html)).toBe("HRB 121291 B");
    expect(html).toContain(`title="${full}"`);
    expect(column.votes).toBeUndefined();
  });

  it("keeps register types other than HRB and shows odd values whole", () => {
    expect(shortRegisterNumber("Amtsgericht Berlin (Charlottenburg) VR 12345")).toBe("VR 12345");
    expect(shortRegisterNumber("unbekannt")).toBe("unbekannt");
  });

  it("shows a dash without a number", () => {
    expect(column.render(company({ registration_number: null }))).toBe("–");
  });
});

describe("classification links", () => {
  const column = (key: string) => COLUMNS.find((col) => col.key === key)!;

  it("links a Technologiefeld and a WZ number to their entry", () => {
    const c = company({ technology_field: "Artificial Intelligence", wz_code: "62.01" });
    expect(renderToStaticMarkup(<>{column("technology_field").render(c)}</>)).toBe(
      '<a href="/classifications#tf-artificial-intelligence">Artificial Intelligence</a>',
    );
    // One WZ row: the official number wins over the estimate.
    expect(renderToStaticMarkup(<>{column("wz_division_estimated").render({ ...c, wz_division_estimated: "56" })}</>)).toBe(
      '<a href="/classifications#wz-62">62.01</a>',
    );
    const estimated = company({ wz_code: null, wz_division_estimated: "56" });
    expect(renderToStaticMarkup(<>{column("wz_division_estimated").render(estimated)}</>)).toBe('<a href="/classifications#wz-56">56</a>');
    expect(column("wz_division_estimated").field!(estimated)).toBe("wz_division_estimated");
    expect(column("wz_division_estimated").field!(c)).toBe("wz_code");
  });

  it("shows a dash without a value", () => {
    expect(column("technology_field").render(company({ technology_field: null }))).toBe("–");
  });
});

describe("Gründung", () => {
  it("shows the date when it is known and in the shown year, else the year alone, never a made-up date", () => {
    expect(foundingText({ established_at: "2010-05-12", established_year: 2010 })).toBe("12.05.2010");
    expect(foundingText({ established_at: null, established_year: 2010 })).toBe("2010");
    // A person corrected the year: the old date no longer agrees with it, so only the year is shown.
    expect(foundingText({ established_at: "2010-05-12", established_year: 2012 })).toBe("2012");
    expect(foundingText({ established_at: null, established_year: null })).toBe("–");
  });
});

// Bands as decided in unternehmensdatenbank #183: green >= 80 %, yellow 50-79 %, red < 50 %.
describe("confidence bands at their edges (#183)", () => {
  it.each([
    [1, "green", "100 %"],
    [0.8, "green", "80 %"],
    [0.79, "yellow", "79 %"],
    [0.5, "yellow", "50 %"],
    [0.49, "red", "49 %"],
    [0.05, "red", "5 %"],
  ])("%s is %s and reads %s", (value, color, label) => {
    const html = renderToStaticMarkup(<ConfidenceBadge value={value} />);
    expect(html).toContain(`bg-${color}-100`);
    expect(html).toContain(`>${label}<`);
  });
});

describe("history of the fields inside a merged row (#183)", () => {
  const c = company({ wz_code: "62.01", wz_division_estimated: "56", business_purpose: "Register", activity_description: "Homepage" });

  it("names wz_code and business_purpose by their merged row", () => {
    expect(fieldLabel("wz_code")).toBe("WZ");
    expect(fieldLabel("wz_division_estimated")).toBe("WZ");
    expect(fieldLabel("business_purpose")).toBe("Tätigkeit");
  });

  it("votes on each field's own raw value, not on the value the row shows", () => {
    expect(shownValues("wz_code", c)).toEqual(["62.01"]);
    expect(shownValues("wz_division_estimated", c)).toEqual(["56"]);
    expect(shownValues("business_purpose", c)).toEqual(["Register"]);
    expect(shownValues("activity_description", c)).toEqual(["Homepage"]);
    expect(voteTarget("business_purpose", c)).toBe("Register");
    expect(voteTarget("wz_division_estimated", c)).toBe("56");
  });
});
