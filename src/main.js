import QRCode from "qrcode";
import { config } from "./config.js";
import { deck } from "./content/deck.js";
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
  const notes = button("Notes", "Toggle speaker notes", () => controller.toggleNotes());
  const voice = button(config.realtime.enabled ? "Start voice" : "Voice setup optional", "Toggle Realtime voice controls", toggleVoice);
  voice.disabled = !config.realtime.enabled;
  consoleEl.append(previous, counter, next, divider(), qr, notes, divider(), voice);

  const sandbox = node("form", "command-sandbox");
  sandbox.setAttribute("aria-label", "Command sandbox");
  const sandboxLabel = node("label", "command-sandbox__label", "Try a deterministic command");
  const sandboxInput = document.createElement("input");
  sandboxInput.placeholder = "next slide · go to slide 7 · show QR";
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
