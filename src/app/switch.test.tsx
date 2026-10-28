import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch";

const input = (html: string) => html.match(/<input[^>]*>/)?.[0] ?? "";

describe("Switch", () => {
  it("is a labelled native checkbox announced as a switch, submitting 1 when on", () => {
    const html = renderToStaticMarkup(<Switch name="website" isChecked>mit Website</Switch>);
    expect(html).toMatch(/^<label[^>]*><input /);
    expect(html).toContain("mit Website</label>");
    for (const attr of ['type="checkbox"', 'role="switch"', 'name="website"', 'value="1"', 'checked=""']) {
      expect(input(html)).toContain(attr);
    }
  });

  it("is off when not checked", () => {
    expect(input(renderToStaticMarkup(<Switch name="review" isChecked={false}>Werte bewerten</Switch>))).not.toContain("checked=");
  });
});
