import { audienceConfig, questionsForPhase } from "../../shared/audience-config.js";
import { AudienceApiClient } from "./api-client.js";

const api = new AudienceApiClient();
const params = new URLSearchParams(location.search);
const phase = params.get("phase") === "exit" ? "exit" : "entrance";
const storageKey = `gpt-realtime-slides:${audienceConfig.deckId}:attendee`;
const root = document.getElementById("app");
let attendeeId = readAttendeeId();

render();

function render() {
  const main = element("main", "participant-app");
  const header = element("header", "participant-header");
  header.append(
    element("span", "participant-kicker", "GPT Realtime Slides"),
    element("h1", "", phase === "entrance" ? "Before you explore" : "After you explore"),
    element("p", "participant-intro", "Rate two statements before and after the demo. Your answers appear only in grouped results. No name, email, free text, or browser fingerprint is collected."),
  );

  const nav = element("nav", "participant-nav");
  nav.setAttribute("aria-label", "Audience routes");
  nav.append(link("Entrance", "./participate.html?phase=entrance", phase === "entrance"), link("Exit", "./participate.html?phase=exit", phase === "exit"), link("Slides", "./slides.html"));
  header.append(nav);
  main.append(header);

  if (phase === "exit" && !attendeeId) main.append(buildRecovery());
  else main.append(buildQuestionForm());
  root.replaceChildren(main);
}

function buildQuestionForm() {
  const form = element("form", "participant-card");
  const questions = questionsForPhase(phase);
  for (const question of questions) {
    const fieldset = element("fieldset", "rating-fieldset");
    fieldset.dataset.questionId = question.id;
    fieldset.append(element("legend", "rating-legend", question.prompt));
    const options = element("div", "rating-options");
    for (const option of question.options) {
      const label = element("label", "rating-option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.id;
      input.value = option.id;
      input.required = question.required;
      label.append(input, element("span", "", option.label));
      options.append(label);
    }
    fieldset.append(options);
    form.append(fieldset);
  }

  const status = element("p", "participant-status", "Responses become public only as grouped results.");
  const submit = element("button", "participant-submit", phase === "entrance" ? "Save entrance response" : "Save exit response");
  submit.type = "submit";
  form.append(submit, status);
  let recoveryCode = "";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Saving…";
    try {
      if (!attendeeId) {
        const session = await api.createSession();
        attendeeId = session.attendeeId;
        recoveryCode = session.recoveryCode;
        saveAttendeeId(attendeeId);
        const recoveryNotice = element("aside", "recovery-notice");
        recoveryNotice.append(element("strong", "", "Save this recovery code:"), element("code", "recovery-code", recoveryCode));
        form.insertBefore(recoveryNotice, submit);
      }
      const answers = Object.fromEntries(questions.map((question) => [question.id, [new FormData(form).get(question.id)]]));
      await api.submitPhase({ phase, attendeeId, answers });
      showSuccess(form, recoveryCode);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
  return form;
}

function buildRecovery() {
  const section = element("section", "participant-card");
  section.append(element("h2", "", "Continue your earlier response"), element("p", "", "Enter the recovery code shown after your entrance response. It is never placed in a URL."));
  const form = element("form", "recovery-form");
  const input = document.createElement("input");
  input.name = "recoveryCode";
  input.autocomplete = "off";
  input.placeholder = "ABCD-EFGH-JKLM-NPQR-STUV";
  input.setAttribute("aria-label", "Recovery code");
  input.required = true;
  const submit = element("button", "participant-submit", "Recover response");
  submit.type = "submit";
  const status = element("p", "participant-status", "Your code identifies only an anonymous response pair.");
  form.append(input, submit, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Checking…";
    try {
      const session = await api.recoverSession(input.value);
      attendeeId = session.attendeeId;
      saveAttendeeId(attendeeId);
      render();
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
  section.append(form, link("Start with the entrance questions", "./participate.html?phase=entrance"));
  return section;
}

function showSuccess(form, recoveryCode) {
  const card = element("section", "participant-success");
  card.append(element("span", "participant-kicker", "Saved"), element("h2", "", phase === "entrance" ? "Your entrance response is paired." : "Your entrance and exit responses are paired."));
  if (recoveryCode) {
    card.append(element("p", "", "Save this one-time recovery code if you may use another device for the exit response."), element("code", "recovery-code", recoveryCode));
  }
  card.append(phase === "entrance" ? link("Open the audience slides", "./slides.html", false, "participant-submit") : link("Return to the presentation", "./slides.html", false, "participant-submit"));
  form.replaceWith(card);
}

function readAttendeeId() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    return typeof value?.attendeeId === "string" ? value.attendeeId : "";
  } catch { return ""; }
}

function saveAttendeeId(value) {
  localStorage.setItem(storageKey, JSON.stringify({ attendeeId: value }));
}

function link(text, href, current = false, className = "") {
  const anchor = element("a", className, text);
  anchor.href = href;
  if (current) anchor.setAttribute("aria-current", "page");
  return anchor;
}

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
