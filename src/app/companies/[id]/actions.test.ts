import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth";
import { stubHasura } from "@/test/hasura-stub";
import { setVote } from "./actions";

// Integration: form data → Hasura mutation. Only the session, the network and the cache are stubbed.
vi.mock("@/lib/auth", () => ({ requireSession: vi.fn(async () => ({ accessToken: "token", userId: "u1" })) }));
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
      {
        operation: "RemoveVote",
        variables: {
          where: {
            company_id: { _eq: ID },
            field_name: { _eq: "legal_form" },
            value: { _eq: "GmbH" },
            author_id: { _eq: "u1" },
          },
        },
        authorization: "Bearer token",
      },
    ]);
  });

  it("removes nothing when the session has no user id", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ accessToken: "token", expires: "" });
    const requests = stubHasura({});
    await setVote(ID, "legal_form", "GmbH", form({ verdict: "remove" }));
    expect(requests).toHaveLength(0);
  });

  it("sends nothing for an unknown field, a bad id or an unknown verdict", async () => {
    const requests = stubHasura({});
    await setVote(ID, "salary", "1", form({ verdict: "remove" }));
    await setVote("not-a-uuid", "legal_form", "GmbH", form({ verdict: "remove" }));
    await setVote(ID, "legal_form", "GmbH", form({ verdict: "maybe" }));
    expect(requests).toHaveLength(0);
  });
});
