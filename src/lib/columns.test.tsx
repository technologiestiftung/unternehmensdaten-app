import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { company } from "@/test/hasura-stub";
import { COLUMNS } from "./columns";

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
