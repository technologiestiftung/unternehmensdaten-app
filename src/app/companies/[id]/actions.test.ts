import { afterEach, describe, expect, it, vi } from "vitest";
import { stubHasura } from "@/test/hasura-stub";
import { setVote } from "./actions";

// Integration: form data → Hasura mutation. Only the session, the network and the cache are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ accessToken: "token", userId: "u1" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ID = "00000000-0000-4000-8000-000000000001";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("setVote", () => {
  it("records a vote as an upsert", async () => {
    const requests = stubHasura({ SetVote: { insert_feedback_one: { verdict: "correct" } } });
    await setVote(ID, "legal_form", "GmbH", form({ verdict: "correct" }));
    expect(requests.map((r) => r.operation)).toEqual(["SetVote"]);
    expect(requests[0].variables).toMatchObject({ company_id: ID, field_name: "legal_form", value: "GmbH", verdict: "correct" });
  });

  it("takes the user's vote back when the active verdict is clicked again", async () => {
    const requests = stubHasura({ RemoveVote: { delete_feedback: { affected_rows: 1 } } });
    await setVote(ID, "legal_form", "GmbH", form({ verdict: "remove" }));
    expect(requests).toEqual([
      { operation: "RemoveVote", variables: { company_id: ID, field_name: "legal_form", value: "GmbH" }, authorization: "Bearer token" },
    ]);
  });

  it("sends nothing for an unknown field, a bad id or an unknown verdict", async () => {
    const requests = stubHasura({});
    await setVote(ID, "salary", "1", form({ verdict: "remove" }));
    await setVote("not-a-uuid", "legal_form", "GmbH", form({ verdict: "remove" }));
    await setVote(ID, "legal_form", "GmbH", form({ verdict: "maybe" }));
    expect(requests).toHaveLength(0);
  });
});
