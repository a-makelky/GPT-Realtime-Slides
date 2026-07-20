import assert from "node:assert/strict";
import test from "node:test";
import { deck } from "../src/content/deck.js";
import { validateDeck } from "../src/core/schema.js";

test("the public example deck is valid and uses unique stable ids", () => {
  assert.equal(validateDeck(deck), deck);
  assert.equal(new Set(deck.slides.map((slide) => slide.id)).size, deck.slides.length);
});

test("arbitrary HTML and duplicate ids are rejected", () => {
  assert.throws(() => validateDeck({ version: 1, slides: [{ id: "x", layout: "title", title: "One", html: "<script>" }] }), /arbitrary HTML/);
  assert.throws(() => validateDeck({ version: 1, slides: [
    { id: "x", layout: "title", title: "One" },
    { id: "x", layout: "title", title: "Two" },
  ] }), /Duplicate slide id/);
});
