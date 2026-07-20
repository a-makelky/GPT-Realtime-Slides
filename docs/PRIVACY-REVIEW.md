# Public-release privacy review

Review date: 2026-07-19

## Scope

The review covered tracked source, sample content, documentation, tests, build configuration, repository history, and the generated production bundle.

## Excluded by design

- Event-specific slide copy and speaker biography
- Contact cards, phone numbers, email addresses, and social profiles
- Personal photographs, family media, and product screenshots
- Original event forms, IDs, responses, testimonials, and exported data
- Personal domains and event routes
- Cloud-provider account, database, namespace, and worker identifiers
- API keys, environment files, local state, and source maps

## Public data behavior

The starter has no identity, testimonial, free-text, analytics, cookie, or browser-fingerprinting field. The optional Cloudflare extension stores opaque attendee IDs, recovery-code hashes, multiple-choice answers, and timestamps in a new D1 database.

The public aggregate endpoint releases complete cohorts of at least three. It never returns raw answers, attendee IDs, recovery material, hidden totals, or per-response timestamps. The migration contains no `INSERT` statements, so a new deployment begins with zero attendee, submission, and answer rows.

The command sandbox is entirely local. Optional Realtime voice control transmits microphone audio only after the deployer explicitly enables the feature and the presenter grants microphone permission. Audience input does not depend on Realtime or an OpenAI API key.

## Automated checks

`tests/privacy.test.mjs` scans tracked text for known event identities, domains, phone-number shapes, and OpenAI API-key patterns. Build verification separately checks that source maps are disabled and that presenter-only controls are not created in audience mode.
