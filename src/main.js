import QRCode from "qrcode";
import { config } from "./config.js";
import { deck } from "./content/deck.js";
import { AudienceAggregatePoller } from "./audience/presenter-pulse.js";
import { createDeckController } from "./core/controller.js";
import { renderSlide } from "./core/renderer.js";
import { validateDeck } from "./core/schema.js";
import { dispatchDeckTool, parseSandboxCommand, RealtimeDeckClient } from "./realtime/client.js";

validateDeck(deck);
const mode = document.body.dataset.mode === "audience" ? "audience" : "presenter";
const params = new URLSearchParams(window.location.search);
const initialIndex = Math.max(0, Number(params.get("slide") || 1) - 1);
const controller = createDeckController(deck.slides.length, initialIndex);
const app = document.getElementById("app");

applyTheme();
const ui = buildShell();
let qrDataUrl = "";
let realtimeClient = null;
let audiencePoller = null;

controller.subscribe((state) => {
  const slide = deck.slides[state.index];
  ui.stage.replaceChildren(renderSlide(slide, state.index + 1, deck.slides.length));
  document.title = `${slide.title} · ${config.app.title}`;
  history.replaceState({}, "", `${location.pathname}?slide=${state.index + 1}`);
  if (mode === "presenter") updatePresenter(state, slide);
  updateOverlay(state);
});

window.deckController = controller;
window.addEventListener("keydown", handleKeydown);
if (mode === "audience") {
  ui.stage.setAttribute("aria-label", "Audience slides. Tap the right side to advance or the left side to go back.");
  ui.stage.addEventListener("click", (event) => {
    const bounds = ui.stage.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width * 0.35) controller.previous();
    else controller.next();
  });
}
prepareQr();

function buildShell() {
  const shell = node("main", `deck-app deck-app--${mode}`);
  const stage = node("section", "deck-stage");
  stage.id = "deckStage";
  stage.setAttribute("aria-live", "polite");
  const overlay = node("div", "deck-overlay");
  overlay.id = "deckOverlay";
  overlay.hidden = true;
  shell.append(stage, overlay);

  const result = { shell, stage, overlay };
  if (mode === "presenter") Object.assign(result, buildPresenter(shell));
  app.replaceChildren(shell);
  return result;
}

function buildPresenter(shell) {
  const consoleEl = node("section", "presenter-console");
  consoleEl.setAttribute("aria-label", "Presenter controls");
  const previous = button("←", "Previous slide", () => controller.previous(), "control control--square");
  const counter = node("strong", "presenter-counter", `1 / ${deck.slides.length}`);
  const next = button("→", "Next slide", () => controller.next(), "control control--square");
  const qr = button("QR", "Show audience QR", () => controller.showQr());
  const audience = button("Results", "Show live audience results", () => controller.showAudienceResults());
  audience.disabled = !config.audience.enabled;
  const notes = button("Notes", "Toggle speaker notes", () => controller.toggleNotes());
  const voice = button(config.realtime.enabled ? "Start voice" : "Voice setup optional", "Toggle Realtime voice controls", toggleVoice);
  voice.disabled = !config.realtime.enabled;
  consoleEl.append(previous, counter, next, divider(), qr, audience, notes, divider(), voice);

  const sandbox = node("form", "command-sandbox");
  sandbox.setAttribute("aria-label", "Command sandbox");
  const sandboxLabel = node("label", "command-sandbox__label", "Try a deterministic command");
  const sandboxInput = document.createElement("input");
  sandboxInput.placeholder = "next slide · show audience results · show QR";
  sandboxInput.autocomplete = "off";
  sandboxInput.setAttribute("aria-label", "Deck command");
  const sandboxButton = button("Run", "Run command", null, "control control--run");
  sandboxButton.type = "submit";
  const sandboxStatus = node("span", "command-sandbox__status", "No AI or API key required.");
  sandbox.addEventListener("submit", (event) => {
    event.preventDefault();
    const parsed = parseSandboxCommand(sandboxInput.value);
    if (!parsed) {
      sandboxStatus.textContent = "Command not recognized. Try “go to slide 7”.";
      return;
    }
    dispatchDeckTool(parsed.name, parsed.args, controller);
    sandboxStatus.textContent = `Ran ${parsed.name.replaceAll("_", " ")}.`;
    sandboxInput.select();
  });
  sandboxLabel.append(sandboxInput);
  sandbox.append(sandboxLabel, sandboxButton, sandboxStatus);

  const notesPanel = node("aside", "speaker-notes");
  notesPanel.hidden = true;
  const notesTitle = node("h2", "speaker-notes__title");
  const notesPurpose = node("p", "speaker-notes__purpose");
  const notesTrack = node("p", "speaker-notes__track");
  const notesCue = node("p", "speaker-notes__cue");
  notesPanel.append(notesTitle, notesPurpose, notesTrack, notesCue);
  shell.append(sandbox, consoleEl, notesPanel);
  return { consoleEl, counter, notesPanel, notesTitle, notesPurpose, notesTrack, notesCue, voice, sandboxStatus };
}

function updatePresenter(state, slide) {
  ui.counter.textContent = `${state.index + 1} / ${deck.slides.length}`;
  ui.notesPanel.hidden = !state.notesOpen;
  ui.notesTitle.textContent = slide.title;
  ui.notesPurpose.textContent = slide.notes?.purpose || "";
  ui.notesTrack.textContent = slide.notes?.talkTrack || "";
  ui.notesCue.textContent = slide.notes?.cue ? `Cue: ${slide.notes.cue}` : "";
}

function updateOverlay(state) {
  if (state.overlay === "audience") {
    showAudienceOverlay({ status: "loading", data: null });
    if (!audiencePoller) {
      audiencePoller = new AudienceAggregatePoller({
        endpoint: config.audience.aggregateEndpoint,
        onUpdate: showAudienceOverlay,
      });
      audiencePoller.start();
    }
    return;
  }
  if (audiencePoller) {
    audiencePoller.stop();
    audiencePoller = null;
  }
  if (state.overlay !== "qr") {
    ui.overlay.hidden = true;
    ui.overlay.replaceChildren();
    return;
  }
  ui.overlay.hidden = false;
  const card = node("section", "qr-card");
  card.append(node("span", "qr-card__eyebrow", config.qr.label));
  if (qrDataUrl) {
    const image = document.createElement("img");
    image.src = qrDataUrl;
    image.alt = "QR code for the audience slide view";
    card.append(image);
  } else card.append(node("p", "", "Preparing QR…"));
  card.append(node("p", "qr-card__url", new URL(config.qr.url, location.href).href));
  card.append(button("Close", "Close QR overlay", () => controller.hideOverlay(), "control control--close"));
  ui.overlay.replaceChildren(card);
}

function showAudienceOverlay({ status, data }) {
  if (controller.getState().overlay !== "audience") return;
  ui.overlay.hidden = false;
  const card = node("section", "audience-results-card");
  card.append(node("span", "participant-kicker", "Live audience input"), node("h2", "", "What is changing in the room?"));
  const statusText = node("p", "audience-results-status");
  const grid = node("div", "audience-results-grid");

  if (status === "loading") statusText.textContent = "Loading grouped results…";
  else if (status === "error") statusText.textContent = "Audience input is unavailable. Deck controls still work.";
  else {
    const measures = audienceMeasures(data);
    const pairedCount = Number(data?.paired?.publishedRespondents || 0);
    if (data?.paired?.suppressed !== false || measures.length === 0) {
      statusText.textContent = `Waiting for at least ${Number(data?.privacyThreshold || 3)} paired responses.`;
    } else {
      statusText.textContent = `${pairedCount} paired responses · updates in privacy-safe groups`;
      measures.forEach((measure) => {
        const item = node("section", "audience-result");
        item.append(node("h3", "", measure.label), node("p", "audience-result__score", `${formatScore(measure.before)} → ${formatScore(measure.after)}`));
        item.append(node("p", "", `${measure.delta >= 0 ? "+" : ""}${measure.delta.toFixed(1)} average change`));
        grid.append(item);
      });
    }
  }
  card.append(statusText, grid);
  const actions = node("div", "audience-results-actions");
  const participate = node("a", "", "Open the entrance form");
  participate.href = new URL(config.audience.participantUrl, location.href).href;
  actions.append(participate, button("Close", "Close audience results", () => controller.hideOverlay(), "control control--close"));
  card.append(actions);
  ui.overlay.replaceChildren(card);
}

function audienceMeasures(data) {
  const source = data?.paired?.measures;
  const entries = Array.isArray(source) ? source.map((item) => [item.id || item.pairId, item]) : Object.entries(source || {});
  return entries.flatMap(([id, item]) => {
    const before = Number(item.beforeMean ?? item.entranceMean ?? item.entrance?.mean ?? item.before?.mean);
    const after = Number(item.afterMean ?? item.exitMean ?? item.exit?.mean ?? item.after?.mean);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return [];
    return [{ label: item.prompt || item.label || String(id).replaceAll("-", " "), before, after, delta: Number.isFinite(Number(item.delta)) ? Number(item.delta) : after - before }];
  });
}

function formatScore(value) {
  return Number(value).toFixed(1);
}

async function prepareQr() {
  if (!config.qr.enabled) return;
  qrDataUrl = await QRCode.toDataURL(new URL(config.qr.url, location.href).href, { width: 520, margin: 1, color: { dark: "#08152f", light: "#ffffff" } });
  if (controller.getState().overlay === "qr") updateOverlay(controller.getState());
}

function handleKeydown(event) {
  if (event.target instanceof HTMLInputElement) return;
  if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); controller.next(); }
  if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); controller.previous(); }
  if (event.key === "Home") controller.first();
  if (event.key === "End") controller.last();
  if (event.key.toLowerCase() === "q" && mode === "presenter") controller.showQr();
  if (event.key.toLowerCase() === "r" && mode === "presenter") controller.showAudienceResults();
  if (event.key.toLowerCase() === "n" && mode === "presenter") controller.toggleNotes();
  if (event.key === "Escape") controller.hideOverlay();
}

async function toggleVoice() {
  if (!config.realtime.enabled) return;
  if (realtimeClient) {
    realtimeClient.disconnect();
    realtimeClient = null;
    ui.voice.textContent = "Start voice";
    return;
  }
  realtimeClient = new RealtimeDeckClient({
    controller,
    secretEndpoint: config.realtime.clientSecretEndpoint,
    wakeWord: config.realtime.wakeWord,
    onStatus: ({ message }) => { ui.sandboxStatus.textContent = message; },
  });
  try {
    await realtimeClient.connect();
    ui.voice.textContent = "Stop voice";
  } catch (error) {
    ui.sandboxStatus.textContent = `${error.message} Manual controls still work.`;
    realtimeClient.disconnect();
    realtimeClient = null;
  }
}

function applyTheme() {
  Object.entries(config.theme).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value));
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function button(text, label, handler, className = "control") {
  const el = node("button", className, text);
  el.type = "button";
  el.setAttribute("aria-label", label);
  if (handler) el.addEventListener("click", handler);
  return el;
}

function divider() {
  return node("span", "control-divider");
}
