import { describe, expect, it } from "vitest";
import { orderBy, sortOf, where, withParams } from "./query";

describe("sortOf / orderBy", () => {
  it("defaults to name ascending", () => {
    expect(sortOf({})).toEqual({ key: "name", dir: "asc" });
    expect(orderBy({})).toEqual([{ name: "asc_nulls_last" }]);
  });

  it("maps a column to its view field, nulls last, name as tie-break", () => {
    expect(orderBy({ sort: "fundings", dir: "desc" })).toEqual([
      { funding_total_eur: "desc_nulls_last" },
      { name: "asc" },
    ]);
  });

  it("ignores unknown sort fields and directions", () => {
    expect(sortOf({ sort: "comment", dir: "sideways" })).toEqual({ key: "name", dir: "asc" });
    expect(sortOf({ sort: "__proto__" })).toEqual({ key: "name", dir: "asc" });
  });
});

describe("where", () => {
  it("is empty without filters", () => {
    expect(where({})).toEqual({});
    expect(where({ q: "  ", legal_form: "" })).toEqual({});
  });

  it("combines every filter with AND", () => {
    expect(
      where({ q: "bau", legal_form: "GmbH", register_status: "aktiv", wz: "62", website: "1", fundings: "1" }),
    ).toEqual({
      _and: [
        { name: { _ilike: "%bau%" } },
        { legal_form: { _eq: "GmbH" } },
        { register_status: { _eq: "aktiv" } },
        { wz_code: { _like: "62%" } },
        { website: { _is_null: false } },
        { funding_count: { _gt: 0 } },
      ],
    });
  });

  it("drops a WZ prefix that is not a WZ code", () => {
    expect(where({ wz: "62%' OR 1=1" })).toEqual({});
  });
});

describe("withParams", () => {
  it("keeps filters, replaces the changed ones and drops empty values", () => {
    expect(withParams({ q: "bau", page: "3" }, { sort: "revenue", page: undefined })).toBe("/?q=bau&sort=revenue");
    expect(withParams({}, {})).toBe("/");
  });
});
