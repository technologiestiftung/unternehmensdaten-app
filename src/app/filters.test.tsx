import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Filters } from "./filters";

const options = { legal_form: ["GmbH"], register_status: ["active", "dissolved"], technology_field: [] };

const statusOptions = (q?: string, register_status?: string) => {
  const html = renderToStaticMarkup(<Filters params={{ q, register_status }} options={options} sources={[]} />);
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
