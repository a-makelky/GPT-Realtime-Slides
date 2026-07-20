const DEFAULT_WAKE_WORD = "cue";
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export const DECK_TOOLS = Object.freeze([
  tool("next_slide", "Advance the presentation by exactly one slide."),
  tool("previous_slide", "Move the presentation back by exactly one slide."),
  {
    type: "function",
    name: "go_to_slide",
    description: "Navigate directly to a numbered slide.",
    parameters: {
      type: "object",
      properties: { slide_number: { type: "integer", minimum: 1 } },
      required: ["slide_number"],
      additionalProperties: false,
    },
  },
  tool("show_qr", "Show the configured audience QR code."),
  tool("show_audience_results", "Show privacy-thresholded aggregate audience results."),
  tool("hide_overlay", "Hide the currently visible presentation overlay."),
]);

function tool(name, description) {
  return {
    type: "function",
    name,
    description,
    parameters: { type: "object", properties: {}, additionalProperties: false },
  };
}

export function dispatchDeckTool(name, args = {}, controller) {
  if (!controller) throw new Error("Deck controller is unavailable.");
  switch (name) {
    case "next_slide": return controller.next();
    case "previous_slide": return controller.previous();
    case "go_to_slide": {
      const slideNumber = Number(args.slide_number);
      if (!Number.isInteger(slideNumber) || slideNumber < 1) throw new Error("slide_number must be a positive integer.");
      return controller.goTo(slideNumber);
    }
    case "show_qr": return controller.showQr();
    case "show_audience_results": return controller.showAudienceResults();
    case "hide_overlay": return controller.hideOverlay();
    default: throw new Error(`Unsupported deck tool: ${String(name)}`);
  }
}

export function parseSandboxCommand(value) {
  const command = String(value || "").trim().toLowerCase().replace(/[.!?]+$/u, "");
  if (/^(next|next slide|advance)$/u.test(command)) return { name: "next_slide", args: {} };
  if (/^(previous|previous slide|back|go back)$/u.test(command)) return { name: "previous_slide", args: {} };
  if (/^(show|open) (the )?(qr|qr code)$/u.test(command)) return { name: "show_qr", args: {} };
  if (/^(show|open) (the )?(audience )?(results|pulse)$/u.test(command)) return { name: "show_audience_results", args: {} };
  if (/^(hide|close|clear)( the)? (qr|overlay)$/u.test(command)) return { name: "hide_overlay", args: {} };
  const direct = command.match(/^(?:go to |show )?slide (\d+)$/u);
  if (direct) return { name: "go_to_slide", args: { slide_number: Number(direct[1]) } };
  return null;
}

export function matchWakeCommand(transcript, wakeWord = DEFAULT_WAKE_WORD) {
  const spoken = String(transcript || "").trim();
  const wake = String(wakeWord || DEFAULT_WAKE_WORD).trim();
  if (!spoken || !wake) return { matched: false, command: "", transcript: spoken };
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(wake)}(?:$|[^\\p{L}\\p{N}])`, "iu");
  const match = pattern.exec(spoken);
  if (!match) return { matched: false, command: "", transcript: spoken };
  const command = spoken.slice(match.index + match[0].length).replace(/^[\s,.:;!?—–-]+/u, "").trim();
  return { matched: true, command, transcript: spoken };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RealtimeDeckClient extends EventTarget {
  constructor({ controller, secretEndpoint, wakeWord = DEFAULT_WAKE_WORD, onStatus = () => {} } = {}) {
    super();
    this.controller = controller;
    this.secretEndpoint = secretEndpoint;
    this.wakeWord = wakeWord;
    this.onStatus = onStatus;
    this.peer = null;
    this.channel = null;
    this.stream = null;
    this.pendingResponseId = null;
  }

  async connect() {
    if (!this.secretEndpoint) throw new Error("A server-side client-secret endpoint is required.");
    this.onStatus({ status: "connecting", message: "Requesting microphone access…" });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const secretResponse = await fetch(this.secretEndpoint, { method: "POST", headers: { Accept: "application/json" } });
    if (!secretResponse.ok) throw new Error(`Client-secret endpoint returned ${secretResponse.status}.`);
    const secretPayload = await secretResponse.json();
    const ephemeralKey = extractClientSecret(secretPayload);

    this.peer = new RTCPeerConnection();
    this.channel = this.peer.createDataChannel("oai-events");
    this.stream.getTracks().forEach((track) => this.peer.addTrack(track, this.stream));
    this.channel.addEventListener("message", (event) => this.#handleEvent(event));

    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    const response = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
      body: offer.sdp,
    });
    if (!response.ok) throw new Error(`Realtime connection returned ${response.status}.`);
    await this.peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    await waitForOpen(this.channel);
    this.#send(this.#sessionUpdate());
    this.onStatus({ status: "ready", message: `Say “${this.wakeWord}” plus a command.` });
  }

  disconnect() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.channel?.close();
    this.peer?.close();
    this.stream = null;
    this.channel = null;
    this.peer = null;
    this.pendingResponseId = null;
    this.onStatus({ status: "off", message: "Voice control is off. Manual controls still work." });
  }

  #sessionUpdate() {
    return {
      type: "session.update",
      session: {
        type: "realtime",
        instructions: [
          "You are a silent deterministic remote for a slide presentation.",
          "Use exactly one available tool when the command is unambiguous.",
          "Never generate presentation content and never speak or explain.",
        ].join(" "),
        output_modalities: ["text"],
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
            turn_detection: { type: "server_vad", create_response: false, interrupt_response: false },
          },
        },
        tools: DECK_TOOLS,
        tool_choice: "auto",
      },
    };
  }

  #handleEvent(message) {
    let event;
    try { event = JSON.parse(message.data); } catch { return; }
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const wake = matchWakeCommand(event.transcript, this.wakeWord);
      if (event.item_id) this.#send({ type: "conversation.item.delete", item_id: event.item_id });
      if (!wake.matched || !wake.command) return;
      this.#send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: `Verified deck command: ${wake.command}` }] },
      });
      this.#send({
        type: "response.create",
        response: { instructions: "Call exactly one matching deck tool. Otherwise call no tool. Do not speak.", output_modalities: ["text"] },
      });
    }
    if (event.type === "response.created") this.pendingResponseId = event.response?.id || null;
    if (event.type === "response.done" && event.response?.id === this.pendingResponseId) {
      const calls = (event.response.output || []).filter((item) => item.type === "function_call");
      this.pendingResponseId = null;
      if (calls.length !== 1) return;
      const call = calls[0];
      let args = {};
      try { args = JSON.parse(call.arguments || "{}"); } catch { return; }
      dispatchDeckTool(call.name, args, this.controller);
      this.#send({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: true }) },
      });
    }
  }

  #send(event) {
    if (this.channel?.readyState !== "open") throw new Error("Realtime data channel is not open.");
    this.channel.send(JSON.stringify(event));
  }
}

function extractClientSecret(payload) {
  const value = payload?.value || payload?.client_secret?.value || payload?.client_secret || payload?.clientSecret;
  if (typeof value !== "string" || value.length < 10) throw new Error("Server did not return a client secret.");
  return value;
}

function waitForOpen(channel, timeoutMs = 15_000) {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out opening the Realtime data channel.")), timeoutMs);
    channel.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    channel.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Realtime data channel failed.")); }, { once: true });
  });
}
