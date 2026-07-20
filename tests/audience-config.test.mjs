import assert from "node:assert/strict";
import test from "node:test";
import { audienceConfig, questionsForPhase } from "../shared/audience-config.js";

test("audience questions are multiple-choice only and carry a public purpose", () => {
  assert.equal(audienceConfig.privacyThreshold, 3);
  assert.ok(audienceConfig.questions.length > 0);
  for (const question of audienceConfig.questions) {
    assert.equal(question.type, "single");
    assert.equal(question.visibility, "public-aggregate");
    assert.ok(question.purpose.length > 10);
    assert.ok(!/name|email|phone|organization|testimonial|free.?text/iu.test(question.id));
    assert.ok(question.options.every((option) => typeof option.id === "string" && typeof option.label === "string"));
  }
});

test("paired audience questions use identical scales", () => {
  const entrance = questionsForPhase("entrance");
  const exit = questionsForPhase("exit");
  assert.equal(entrance.length, exit.length);
  for (const before of entrance) {
    const after = exit.find((question) => question.pairId === before.pairId);
    assert.ok(after);
    assert.equal(after.prompt, before.prompt);
    assert.deepEqual(after.options.map(({ id, score }) => ({ id, score })), before.options.map(({ id, score }) => ({ id, score })));
  }
});
