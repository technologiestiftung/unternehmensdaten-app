import { vi } from "vitest";
import type { CompanyProfile } from "@/lib/columns";

/** A company as Hasura returns it for the list and detail queries. */
export const company = (over: Partial<CompanyProfile> = {}): CompanyProfile => ({
  id: "00000000-0000-4000-8000-000000000001", name: "Beispiel GmbH", employee_count: 12, revenue: 1000,
  funding_count: 0, funding_total_eur: null, wz_code: "62.01", established_at: "2010-01-01",
  address: "Weg 1, Berlin", legal_form: "GmbH", technology_field: null,
  website: "https://a.de", management: "Anna A", business_purpose: null, deeptech_class: null,
  deeptech_confidence: null, is_ai: false, register_status: "aktiv",
  updated_at: null, ...over,
});

/**
 * Stubs `fetch` as Hasura: answers each GraphQL query or mutation by its name (`query Companies(` →
 * "Companies") and records every request, so tests can check the variables the app sent.
 */
export function stubHasura(answers: Record<string, unknown>) {
  vi.stubEnv("HASURA_GRAPHQL_URL", "http://hasura.test/v1/graphql");
  const requests: { operation: string; variables: Record<string, unknown>; authorization: string }[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body));
    const operation = /(?:query|mutation) (\w+)/.exec(query)?.[1] ?? "";
    requests.push({ operation, variables, authorization: new Headers(init.headers).get("authorization") ?? "" });
    if (!(operation in answers)) return Response.json({ errors: [{ message: `no stub for ${operation}` }] });
    return Response.json({ data: answers[operation] });
  });
  return requests;
}
