import assert from "node:assert/strict";
import test from "node:test";
import { AudienceAggregatePoller } from "../src/audience/presenter-pulse.js";

test("audience poller delivers the public aggregate contract and can stop cleanly", async () => {
  const updates = [];
  const payload = {
    ok: true,
    version: "v1-test",
    privacyThreshold: 3,
    paired: { suppressed: true, publishedRespondents: 0, measures: {} },
  };
  const poller = new AudienceAggregatePoller({
    intervalMs: 60_000,
    fetchImpl: async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json", ETag: '"v1-test"' },
    }),
    onUpdate: (update) => updates.push(update),
  });
  poller.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  poller.stop();
  assert.equal(updates[0].status, "loading");
  assert.equal(updates[1].status, "ready");
  assert.deepEqual(updates[1].data, payload);
});
