# Devpost submission draft

## Project name

GPT Realtime Slides

## Category

Developer Tools

## Tagline

An open-source presentation runtime that keeps humans with the room and AI on a short leash.

## What it does

GPT Realtime Slides turns one small content module into a clean audience deck and a presenter view with notes, QR sharing, manual controls, live grouped audience results, and a deterministic command sandbox. Optional OpenAI Realtime voice control uses a standalone wake word and can call only one allowlisted deck action. It never generates slide content, never speaks over the presenter, and never replaces the keyboard or buttons.

The hosted demo works with no account, test data, or API key. Judges can navigate the deck, run commands such as `go to slide 7`, open the QR overlay, and verify that presenter notes are absent from the audience route.

## Inspiration

The tool came from a real live-event constraint: a presenter should be watching the audience, not repeatedly returning to a laptop. A production event deck proved the interaction model. Build Week created the opportunity to extract the useful control system into a clean, reusable public project.

## How it was built

The frontend is plain HTML, CSS, and JavaScript with Vite. One canonical deck module feeds both modes. A small controller owns navigation, notes, and overlays. Keyboard input, buttons, the no-key command sandbox, and optional Realtime tools all dispatch to that same controller. Cloudflare Pages Functions validate anonymous multiple-choice entrance and exit ratings, store them in a blank D1 database, and return grouped results only after the release threshold.

The Realtime client uses browser WebRTC and a server-minted ephemeral client secret. Standard API keys remain on the deployer's server and are not part of the repository or public demo.

## How Codex and GPT-5.6 were used

Codex first mapped the production event system, then parallel subagents audited PII, secrets, licensing, Git history, and the clean extraction boundary. The human product decisions were to exclude the event database and all personal assets, preserve one content source, make manual controls foundational, restrict voice to silent deterministic tool calls, and rebuild audience storage from a blank schema. Codex implemented those decisions, created privacy regression tests, validated the production bundle, and tested the public routes.

## Challenges

Setting a hard boundary for AI was difficult. Voice interaction had to remain useful in a live room without gaining permission to improvise the deck. Public release also required removing recoverable identity data from Git history instead of deleting files only from the latest commit.

## Accomplishments

- One content source with hard presenter/audience separation
- Complete no-key hosted test path
- Anonymous paired audience input backed by Cloudflare D1
- Live results released only in complete cohorts
- Wake-word-gated, one-tool Realtime contract
- Manual operation even when optional services fail
- Clean MIT-licensed history with automated PII and secret scanning
- No third-party media or unlicensed proof assets

## What is next

Add an authoring UI, export themes as packages, and add configurable bot protection for large public audience-input deployments.

## Links

- Demo: https://gpt-realtime-slides.pages.dev/
- Audience view: https://gpt-realtime-slides.pages.dev/slides
- Audience input: https://gpt-realtime-slides.pages.dev/participate?phase=entrance
- Source: https://github.com/a-makelky/GPT-Realtime-Slides
- Demo video: https://youtu.be/ycg1gV7y_IQ
- Codex session ID: 019f7cd2-ff5e-7843-9035-22699c0049cc
