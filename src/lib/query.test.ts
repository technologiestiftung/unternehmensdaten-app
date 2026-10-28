import { describe, expect, it } from "vitest";
import { listParams, neighbours, orderBy, pageNumbers, sortOf, where, withParams } from "./query";

describe("sortOf / orderBy", () => {
  it("defaults to name ascending", () => {
    expect(sortOf({})).toEqual({ key: "name", dir: "asc" });
    expect(orderBy({})).toEqual([{ name: "asc_nulls_last" }, { id: "asc" }]);
  });

  it("maps a column to its view field, nulls last, name then id as tie-break", () => {
    expect(orderBy({ sort: "fundings", dir: "desc" })).toEqual([
      { funding_total_eur: "desc_nulls_last" },
      { name: "asc" },
      { id: "asc" },
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
      where({ q: "bau", legal_form: "GmbH", register_status: "aktiv", wz: "62", website: "1", fundings: "1", source: "website_discovery" }),
    ).toEqual({
      _and: [
        { name: { _ilike: "%bau%" } },
        { legal_form: { _eq: "GmbH" } },
        { register_status: { _eq: "aktiv" } },
        { wz_code: { _like: "62%" } },
        { website: { _is_null: false } },
        { funding_count: { _gt: 0 } },
        { source_keys: { _contains: ["website_discovery"] } },
      ],
    });
  });

  it("drops a WZ prefix that is not a WZ code", () => {
    expect(where({ wz: "62%' OR 1=1" })).toEqual({});
    expect(where({ source: "x'] } }" })).toEqual({});
  });
});

describe("withParams", () => {
  it("keeps filters, replaces the changed ones and drops empty values", () => {
    expect(withParams({ q: "bau", page: "3" }, { sort: "revenue", page: undefined })).toBe("/?q=bau&sort=revenue");
    expect(withParams({}, {})).toBe("/");
  });
});

describe("listParams", () => {
  it("takes the first value of a repeated key, so filters do not throw", () => {
    const params = listParams({ q: ["a", "b"], legal_form: ["GmbH", "AG"], page: "2", sort: undefined });
    expect(params).toEqual({ q: "a", legal_form: "GmbH", page: "2" });
    expect(where(params)).toEqual({ _and: [{ name: { _ilike: "%a%" } }, { legal_form: { _eq: "GmbH" } }] });
    expect(withParams(params, {})).toBe("/?q=a&legal_form=GmbH&page=2");
  });
});

describe("pageNumbers", () => {
  it("shows every page when there are few", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps first, last and the current neighbourhood, with gaps", () => {
    expect(pageNumbers(1, 59)).toEqual([1, 2, 3, "…", 59]);
    expect(pageNumbers(30, 59)).toEqual([1, "…", 28, 29, 30, 31, 32, "…", 59]);
    expect(pageNumbers(59, 59)).toEqual([1, "…", 57, 58, 59]);
  });

  it("does not hide a single page behind a gap marker", () => {
    expect(pageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, 6, "…", 10]);
    expect(pageNumbers(5, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, "…", 10]);
    expect(pageNumbers(6, 10)).toEqual([1, "…", 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("neighbours", () => {
  const slice = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];

  it("finds the companies either side, with their list positions", () => {
    expect(neighbours(slice, "b", 10)).toEqual({
      prev: { id: "a", name: "A", pos: 10 },
      next: { id: "c", name: "C", pos: 12 },
    });
  });

  it("has no prev for the first company", () => {
    expect(neighbours(slice.slice(0, 2), "a", 0)).toEqual({ prev: undefined, next: { id: "b", name: "B", pos: 1 } });
  });

  it("shows nothing when the list changed and the company moved", () => {
    expect(neighbours(slice, "x", 10)).toEqual({});
  });
});

describe("withParams with a path", () => {
  it("links a company page with the list it came from", () => {
    expect(withParams({ q: "bau", sort: "revenue" }, { pos: "3" }, "/companies/1")).toBe(
      "/companies/1?q=bau&sort=revenue&pos=3",
    );
    expect(withParams({}, {}, "/companies/1")).toBe("/companies/1");
  });
});
