import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Filters } from "./filters";

const options = { legal_form: ["GmbH"], register_status: ["active", "dissolved"], technology_field: [] };

const statusOptions = (q?: string) => {
  const html = renderToStaticMarkup(<Filters params={{ q }} options={options} sources={[]} />);
  const select = html.match(/<select name="register_status"[^>]*>(.*?)<\/select>/)?.[1] ?? "";
  return [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(([, value, label]) => [value, label]);
};

describe("Filters", () => {
  it("submits an empty status by default, so a search keeps the default status rule", () => {
    expect(statusOptions()).toEqual([
      ["", "active"],
      ["all", "alle"],
      ["dissolved", "dissolved"],
    ]);
  });

  it("labels the default \"alle\" while the search is a register number", () => {
    expect(statusOptions("HRB 92123")[0]).toEqual(["", "alle"]);
  });
});
