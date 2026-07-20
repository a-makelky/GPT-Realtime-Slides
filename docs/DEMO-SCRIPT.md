# Demo video script

Target runtime: 2:25

## 0:00–0:20 — The problem

“Presentation software assumes the presenter is standing beside a keyboard. GPT Realtime Slides keeps the human with the room while keeping every AI action deterministic.”

Show the opening slide and advance with the keyboard.

## 0:20–0:50 — One source, two views

Open the presenter and audience routes side by side.

“Both views read the same deck source. The audience gets only the story. Notes, controls, microphone state, and the command sandbox exist only in the presenter view.”

Open Notes, then show they are absent from the audience page.

## 0:50–1:25 — Working no-key sandbox

Run `go to slide 7`, `show QR`, and `hide overlay`.

“The hosted demo needs no API key. These commands exercise the exact same allowlisted controller as keyboard buttons and optional Realtime tools. AI never writes or improvises slide content.”

## 1:25–1:50 — Realtime design

Show the Realtime client and tool list in the repository.

“When a deployer enables voice, the browser checks a standalone wake word, accepts at most one allowlisted function call, and stays silent. OpenAI's WebRTC flow uses a short-lived client secret; the standard key stays on the deployer's server and never enters this repo.”

## 1:50–2:15 — Codex and GPT-5.6

Show the commit history, privacy test, and README build narrative.

“Codex and GPT-5.6 helped excavate a production event tool, parallelize privacy and licensing reviews, and turn the reusable pieces into a clean public product. The important human decisions were what to exclude and how little authority the model should receive.”

## 2:15–2:25 — Close

Return to the closing slide and show the QR.

“Fork it, change one deck file and six theme tokens, and make it yours. GPT Realtime Slides is open source under the MIT license.”
