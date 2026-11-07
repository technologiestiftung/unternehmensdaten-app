import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { listParams, where } from "@/lib/query";
import { Filters } from "./filters";

const options = { legal_form: ["GmbH"], register_status: ["active", "dissolved"], technology_field: [] };

const statusOptions = (q?: string, register_status?: string) => {
  const html = renderToStaticMarkup(<Filters params={{ q, register_status }} options={options} sources={[]} tlds={[]} />);
  const select = html.match(/<select name="register_status"[^>]*>(.*?)<\/select>/)?.[1] ?? "";
  return [...select.matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)].map(([, value, attrs, label]) =>
    attrs.includes("selected") ? [value, label, "selected"] : [value, label]);
};

describe("Filters", () => {
  it("submits an empty status by default, so a search keeps the default status rule", () => {
    expect(statusOptions()).toEqual([
      ["", "active", "selected"],
      ["all", "alle"],
      ["dissolved", "dissolved"],
    ]);
  });

  it("labels the default \"alle\" while the search is a register number", () => {
    expect(statusOptions("HRB 92123")[0]).toEqual(["", "alle", "selected"]);
  });

  it("shows an explicit \"active\" from a link as chosen, the filter the list applies", () => {
    expect(statusOptions("HRB 92123", "active")).toContainEqual(["active", "active", "selected"]);
  });
});

// What a GET submit of the rendered form sends for the selects: each one's selected option, else its first.
const submittedSelects = (html: string) =>
  Object.fromEntries([...html.matchAll(/<select name="([^"]+)"[^>]*>(.*?)<\/select>/g)].map(([, name, body]) => {
    const values = [...body.matchAll(/<option value="([^"]*)"([^>]*)>/g)];
    return [name, (values.find(([, , attrs]) => attrs.includes("selected")) ?? values[0])[1]];
  }));

describe("Filters → where, as a typed search submits the form", () => {
  const typed = (q: string) => {
    const html = renderToStaticMarkup(<Filters params={{}} options={options} sources={[]} tlds={[]} />);
    return where(listParams({ ...submittedSelects(html), q }));
  };
  const statusConditions = (w: Record<string, unknown>) =>
    ((w._and as Record<string, unknown>[] | undefined) ?? []).filter((c) => "register_status" in c);

  it("a typed register number finds any status (a dissolved HRB 92123 too)", () => {
    expect(statusConditions(typed("HRB 92123"))).toEqual([]);
  });

  it("a typed name lists only active companies", () => {
    expect(statusConditions(typed("Berghain OstGut"))).toEqual([{ register_status: { _eq: "active" } }]);
  });
});
