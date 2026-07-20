import assert from "node:assert/strict";
import test from "node:test";
import { DECK_TOOLS, dispatchDeckTool, matchWakeCommand, parseSandboxCommand } from "../src/realtime/client.js";

test("wake word must be standalone", () => {
  assert.deepEqual(matchWakeCommand("Cue, next slide", "cue"), { matched: true, command: "next slide", transcript: "Cue, next slide" });
  assert.equal(matchWakeCommand("rescue the slide", "cue").matched, false);
});

test("sandbox commands map to the same allowlisted tools as Realtime", () => {
  const allowed = new Set(DECK_TOOLS.map((item) => item.name));
  for (const command of ["next slide", "back", "go to slide 7", "show QR", "hide overlay"]) {
    assert.ok(allowed.has(parseSandboxCommand(command).name));
  }
  assert.equal(parseSandboxCommand("invent a slide"), null);
});

test("tool dispatch calls only deterministic controller methods", () => {
  const calls = [];
  const controller = {
    next: () => calls.push(["next"]),
    previous: () => calls.push(["previous"]),
    goTo: (value) => calls.push(["goTo", value]),
    showQr: () => calls.push(["showQr"]),
    hideOverlay: () => calls.push(["hideOverlay"]),
  };
  dispatchDeckTool("next_slide", {}, controller);
  dispatchDeckTool("go_to_slide", { slide_number: 4 }, controller);
  dispatchDeckTool("show_qr", {}, controller);
  assert.deepEqual(calls, [["next"], ["goTo", 4], ["showQr"]]);
  assert.throws(() => dispatchDeckTool("write_slide", {}, controller), /Unsupported/);
});
