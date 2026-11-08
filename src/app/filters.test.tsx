import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listParams, where } from "@/lib/query";
import { clearFilterFields, Filters, FILTERS_FORM_ID } from "./filters";

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

// The few DOM classes the filter form's handlers check with instanceof (vitest runs in node, no DOM).
class FakeElement {
  constructor(private multiSelect = false) {}
  closest(selector: string) {
    return selector === "[data-multi-select]" && this.multiSelect ? this : null;
  }
}
class FakeInput extends FakeElement {
  checked = false;
  constructor(public type: string, public value = "", multiSelect = false) {
    super(multiSelect);
  }
}
class FakeSelect extends FakeElement {
  constructor(public value = "") {
    super();
  }
}
class FakeForm extends FakeElement {
  requestSubmit = vi.fn();
  constructor(public elements: FakeElement[]) {
    super();
  }
}

describe("Filter zurücksetzen (clearFilterFields)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setUp = () => {
    const search = new FakeInput("text", "Berghain");
    const checkbox = new FakeInput("checkbox");
    checkbox.checked = true;
    const select = new FakeSelect("dissolved");
    const hiddenSort = new FakeInput("hidden", "revenue");
    const multiSelectInput = new FakeInput("text", "GmbH", true);
    const form = new FakeForm([search, checkbox, select, hiddenSort, multiSelectInput]);
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLSelectElement", FakeSelect);
    vi.stubGlobal("HTMLFormElement", FakeForm);
    vi.stubGlobal("document", { getElementById: (id: string) => (id === FILTERS_FORM_ID ? form : null) });
    return { form, search, checkbox, select, hiddenSort, multiSelectInput };
  };

  it("empties text fields, selects and checkboxes, but leaves hidden view settings and multi-selects", () => {
    const { search, checkbox, select, hiddenSort, multiSelectInput } = setUp();
    clearFilterFields();
    expect([search.value, checkbox.checked, select.value]).toEqual(["", false, ""]);
    expect([hiddenSort.value, multiSelectInput.value]).toEqual(["revenue", "GmbH"]);
  });

  it("cancels a typing submit still pending, so the old search is not sent after the reset", () => {
    vi.useFakeTimers();
    const { form, search } = setUp();
    const element = Filters({ params: {}, options, sources: [], tlds: [] });
    element.props.onInput({ target: search, currentTarget: form });
    vi.advanceTimersByTime(100);
    clearFilterFields();
    vi.advanceTimersByTime(1000);
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  it("without a reset, the typed search does submit after the pause (the timer the reset must cancel)", () => {
    vi.useFakeTimers();
    const { form, search } = setUp();
    Filters({ params: {}, options, sources: [], tlds: [] }).props.onInput({ target: search, currentTarget: form });
    vi.advanceTimersByTime(1000);
    expect(form.requestSubmit).toHaveBeenCalledTimes(1);
  });
});
