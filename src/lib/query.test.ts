import { describe, expect, it } from "vitest";
import {
  listField,
  listParams,
  neighbours,
  orderBy,
  pageNumbers,
  registerNumberPattern,
  searchTerm,
  searchVariable,
  sortOf,
  visibleColumns,
  where,
  withParams,
} from "./query";

describe("sortOf / orderBy", () => {
  it("defaults to name ascending", () => {
    expect(sortOf({})).toEqual({ key: "name", dir: "asc" });
    expect(orderBy({})).toEqual([{ name: "asc_nulls_last" }, { id: "asc" }]);
  });

  it("sorts by a relationship's aggregate through a dotted path", () => {
    expect(orderBy({ sort: "emails" })).toEqual([
      { emails_aggregate: { min: { email: "asc_nulls_last" } } },
      { name: "asc" },
      { id: "asc" },
    ]);
    expect(orderBy({ sort: "comment", dir: "desc" })[0]).toEqual({
      comments_aggregate: { max: { created_at: "desc_nulls_last" } },
    });
  });

  it("sorts the long text columns too", () => {
    expect(orderBy({ sort: "management" })[0]).toEqual({ management: "asc_nulls_last" });
    expect(orderBy({ sort: "activity_description" })[0]).toEqual({ activity_description: "asc_nulls_last" });
  });

  it("maps a column to its view field, nulls last, name then id as tie-break", () => {
    expect(orderBy({ sort: "fundings", dir: "desc" })).toEqual([
      { funding_total_eur: "desc_nulls_last" },
      { name: "asc" },
      { id: "asc" },
    ]);
  });

  it("ignores unknown sort fields and directions", () => {
    expect(sortOf({ sort: "salary", dir: "sideways" })).toEqual({ key: "name", dir: "asc" });
    expect(sortOf({ sort: "__proto__" })).toEqual({ key: "name", dir: "asc" });
  });
});

describe("where", () => {
  it("shows active companies when no status is chosen", () => {
    const active = { _and: [{ register_status: { _eq: "active" } }] };
    expect(where({})).toEqual(active);
    expect(where(listParams({ q: "  ", legal_form: "", register_status: "" }))).toEqual(active);
  });

  it("shows every status for \"alle\", and the chosen one otherwise", () => {
    expect(where({ register_status: "all" })).toEqual({});
    expect(where({ register_status: "dissolved" })).toEqual({ _and: [{ register_status: { _eq: "dissolved" } }] });
  });

  it("finds a register number whatever its status, unless a status is chosen", () => {
    expect(where({ q: "HRB 92123" })._and).toHaveLength(1);
    expect(where({ q: "HRB 92123", register_status: "active" })._and).toHaveLength(2);
  });

  it("applies the default to the empty status the search form submits", () => {
    expect(where(listParams({ q: "HRB 92123", register_status: "" }))._and).toEqual([
      { _or: [{ name: { _ilike: "%HRB 92123%" } }, { registration_number: { _iregex: "HRB\\s*92123(\\D|$)" } }] },
    ]);
    // A name search is matched by `search_companies`, not by `where`.
    expect(where(listParams({ q: "Berghain", register_status: "" }))).toEqual({
      _and: [{ register_status: { _eq: "active" } }],
    });
  });

  it("treats \"all\" as a value for other dropdowns", () => {
    expect(where({ legal_form: ["all"], register_status: "all" })).toEqual({ _and: [{ legal_form: { _in: ["all"] } }] });
  });

  it("keeps \"alle\" in page and sort links", () => {
    expect(withParams({ register_status: "all" }, { page: "2" })).toBe("/?register_status=all&page=2");
  });

  it("combines every filter with AND", () => {
    expect(
      where({
        q: "bau",
        legal_form: ["GmbH", "AG"],
        technology_field: ["Software, IT"],
        register_status: "aktiv",
        wz: "62",
        source: ["website_discovery"],
        tld: ["de"],
        fund: "10k",
      }),
    ).toEqual({
      _and: [
        { register_status: { _eq: "aktiv" } },
        { legal_form: { _in: ["GmbH", "AG"] } },
        { technology_field: { _in: ["Software, IT"] } },
        { wz_division_estimated: { _like: "62%" } },
        { _or: [{ source_keys: { _contains: ["website_discovery"] } }] },
        { _or: [{ website: { _iregex: "^([a-z]+://)?[^/:?#]*\\.(de)([:/?#]|$)" } }] },
        { funding_total_eur: { _gte: 10_000, _lt: 100_000 } },
      ],
    });
  });

  it("matches any of several sources", () => {
    expect(where({ source: ["a", "b"], register_status: "all" })).toEqual({
      _and: [{ _or: [{ source_keys: { _contains: ["a"] } }, { source_keys: { _contains: ["b"] } }] }],
    });
  });

  it("matches a website by the last label of its host only", () => {
    const pattern = new RegExp(
      (where({ tld: ["de", "berlin"], register_status: "all" })._and as { _or: { website: { _iregex: string } }[] }[])[0]._or[0].website._iregex,
      "i",
    );
    expect(["https://www.example.de", "example.berlin/impressum", "http://a.de:8080"].every((w) => pattern.test(w))).toBe(true);
    expect(["https://de.example.com", "https://example.com/de", "https://example.dev"].some((w) => pattern.test(w))).toBe(false);
  });

  it("finds companies without a website, alone or with chosen endings", () => {
    expect(where({ tld: ["none"], register_status: "all" })).toEqual({ _and: [{ _or: [{ website: { _is_null: true } }] }] });
    expect(where({ tld: ["none", "de"], register_status: "all" })._and).toEqual([
      { _or: [{ website: { _is_null: true } }, { website: { _iregex: "^([a-z]+://)?[^/:?#]*\\.(de)([:/?#]|$)" } }] },
    ]);
  });

  it("filters grants by a range from the dropdown, ignoring unknown values", () => {
    expect(where({ fund: "none", register_status: "all" })).toEqual({ _and: [{ funding_count: { _eq: 0 } }] });
    expect(where({ fund: "any", register_status: "all" })).toEqual({ _and: [{ funding_count: { _gt: 0 } }] });
    expect(where({ fund: "10m", register_status: "all" })).toEqual({ _and: [{ funding_total_eur: { _gte: 10_000_000 } }] });
    expect(where({ fund: "1000", register_status: "all" })).toEqual({});
  });

  it("filters the estimated WZ division by its two digits", () => {
    expect(where({ wz: "62.01", register_status: "all" })).toEqual({ _and: [{ wz_division_estimated: { _like: "62%" } }] });
  });

  it("drops a WZ prefix that is not a WZ code", () => {
    expect(where({ wz: "62%' OR 1=1", register_status: "all" })).toEqual({});
    expect(where({ source: ["x'] } }"], tld: ["de|.*"], register_status: "all" })).toEqual({});
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
    const params = listParams({ q: ["a", "b"], page: ["2", "3"], sort: undefined });
    expect(params).toEqual({ q: "a", page: "2" });
  });

  it("keeps every value of a multi-select, dropping empty ones, and repeats them in links", () => {
    const params = listParams({ legal_form: ["GmbH", "AG", ""], source: "x", tld: "" });
    expect(params).toEqual({ legal_form: ["GmbH", "AG"], source: ["x"] });
    expect(withParams(params, {})).toBe("/?legal_form=GmbH&legal_form=AG&source=x");
  });

  it("joins the repeated cols of the column checkboxes", () => {
    expect(listParams({ cols: ["revenue", "website"] })).toEqual({ cols: "revenue,website" });
    expect(listParams({ cols: "revenue,website" })).toEqual({ cols: "revenue,website" });
  });
});

describe("visibleColumns", () => {
  const columns = [{ key: "revenue" }, { key: "website" }, { key: "cluster" }];

  it("keeps the asked-for columns in their usual order", () => {
    expect(visibleColumns(columns, "cluster,revenue")).toEqual([{ key: "revenue" }, { key: "cluster" }]);
  });

  it("shows all columns when none or only unknown ones are asked for", () => {
    expect(visibleColumns(columns, undefined)).toEqual(columns);
    expect(visibleColumns(columns, "")).toEqual(columns);
    expect(visibleColumns(columns, "salary,__proto__")).toEqual(columns);
    const withHidden = [{ key: "revenue" }, { key: "emails", hidden: true }];
    expect(visibleColumns(withHidden, undefined)).toEqual([{ key: "revenue" }]);
    expect(visibleColumns(withHidden, "emails")).toEqual([{ key: "emails", hidden: true }]);
  });

  it("reads the old key established_at, saved before the column became established_year", () => {
    const withFounding = [{ key: "revenue" }, { key: "established_year" }];
    expect(visibleColumns(withFounding, "established_at")).toEqual([{ key: "established_year" }]);
    expect(sortOf({ sort: "established_at", dir: "desc" })).toEqual({ key: "established_year", dir: "desc" });
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

describe("search by register number", () => {
  // The patterns Hasura gets are Postgres regexes; JavaScript's regex reads \\D and \\s the same way.
  const finds = (q: string, stored: string) => new RegExp(registerNumberPattern(q)!, "i").test(stored);
  const stored = "Amtsgericht Berlin (Charlottenburg) HRB 121291 B";

  it("finds a company by its number, with or without the register type", () => {
    for (const q of ["121291", "HRB 121291", "hrb121291", "HRB 121291 B"]) expect(finds(q, stored)).toBe(true);
  });

  it("matches whole numbers only, and the right register type", () => {
    expect(finds("12129", stored)).toBe(false);
    expect(finds("21291", stored)).toBe(false);
    expect(finds("HRA 121291", stored)).toBe(false);
  });

  it("leaves a name search alone", () => {
    expect(registerNumberPattern("Berghain")).toBeUndefined();
    expect(registerNumberPattern("Bau 2000 GmbH")).toBeUndefined();
    for (const q of ["2000 AG", "42 AG", "3D"]) {
      expect(registerNumberPattern(q)).toBeUndefined();
      expect(searchTerm({ q })).toBe(q);
    }
    expect(searchTerm({ q: "Berghain" })).toBe("Berghain");
  });

  it("searches name or register number when the search looks like a number", () => {
    expect(where({ q: "121291", register_status: "all" })).toEqual({
      _and: [{ _or: [{ name: { _ilike: "%121291%" } }, { registration_number: { _iregex: "(^|\\D)121291(\\D|$)" } }] }],
    });
  });
});

describe("sorting by register number", () => {
  it("is allowed, with the name as the tiebreak", () => {
    expect(orderBy({ sort: "registration_number", dir: "asc" })).toEqual([
      { registration_number: "asc_nulls_last" }, { name: "asc" }, { id: "asc" },
    ]);
  });
});

describe("search", () => {
  it("searches by words with the fuzzy function, a register number exactly", () => {
    expect(searchTerm({ q: " Berghian " })).toBe("Berghian");
    expect(searchTerm({ q: "HRB 92123" })).toBeUndefined();
    expect(searchTerm({ q: "  " })).toBeUndefined();
    expect(listField({ q: "Berghian" }, "companies_aggregate")).toBe(
      "companies_aggregate: search_companies_aggregate(args: { search: $search }, ",
    );
    expect(listField({ q: "HRB 92123" }, "companies")).toBe("companies(");
    expect(searchVariable({ q: "Berghian" })).toBe("$search: String!, ");
    expect(searchVariable({})).toBe("");
  });

  it("orders a search by relevance unless a column is chosen", () => {
    expect(sortOf({ q: "zalando" })).toEqual({ key: undefined, dir: "asc" });
    expect(orderBy({ q: "zalando" })).toEqual([]);
    expect(orderBy({ q: "zalando", sort: "revenue" })[0]).toEqual({ revenue: "asc_nulls_last" });
  });
});
