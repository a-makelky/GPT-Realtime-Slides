import assert from "node:assert/strict";
import test from "node:test";
import { AudienceApiClient } from "../src/audience/api-client.js";

test("audience client sends only same-origin JSON contracts", async () => {
  const calls = [];
  const client = new AudienceApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await client.submitPhase({ phase: "entrance", attendeeId: "00000000-0000-4000-8000-000000000001", answers: { "entrance-adapt-runtime": ["3"] } });
  assert.equal(calls[0].url, "/api/audience/responses/entrance");
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    attendeeId: "00000000-0000-4000-8000-000000000001",
    answers: { "entrance-adapt-runtime": ["3"] },
  });
});

test("audience client rejects unsupported phases before a network call", () => {
  const client = new AudienceApiClient({ fetchImpl: async () => { throw new Error("should not run"); } });
  assert.throws(() => client.submitPhase({ phase: "other", attendeeId: "id", answers: {} }), /Unsupported/);
});

test("audience client surfaces the server's safe error message", async () => {
  const client = new AudienceApiClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: "response_locked", message: "This phase was already submitted." } }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }),
  });
  await assert.rejects(client.createSession(), /already submitted/);
});
