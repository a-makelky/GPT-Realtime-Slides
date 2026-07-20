import assert from "node:assert/strict";
import test from "node:test";
import { createDeckController } from "../src/core/controller.js";

test("manual controls clamp boundaries and manage overlays deterministically", () => {
  const controller = createDeckController(3);
  controller.previous();
  assert.equal(controller.getState().index, 0);
  controller.goTo(99);
  assert.equal(controller.getState().index, 2);
  controller.showQr();
  assert.equal(controller.getState().overlay, "qr");
  controller.showAudienceResults();
  assert.equal(controller.getState().overlay, "audience");
  controller.next();
  assert.equal(controller.getState().overlay, null);
});

test("subscribers receive immutable snapshots", () => {
  const controller = createDeckController(2);
  const snapshots = [];
  const unsubscribe = controller.subscribe((state) => snapshots.push(state));
  controller.next();
  unsubscribe();
  controller.previous();
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every(Object.isFrozen));
});
