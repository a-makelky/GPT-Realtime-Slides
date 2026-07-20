# Public-release privacy review

Review date: 2026-07-19

## Scope

The review covered tracked source, sample content, documentation, tests, build configuration, repository history, and the generated production bundle.

## Excluded by design

- Event-specific slide copy and speaker biography
- Contact cards, phone numbers, email addresses, and social profiles
- Personal photographs, family media, and product screenshots
- Attendee forms, IDs, responses, testimonials, and exported data
- Personal domains and event routes
- Cloud-provider account, database, namespace, and worker identifiers
- API keys, environment files, local state, and source maps

## Public data behavior

The demo has no forms, analytics, cookies, accounts, telemetry, or persistence. It does not collect or transmit personal information.

The command sandbox is entirely local. Optional Realtime voice control transmits microphone audio only after the deployer explicitly enables the feature and the presenter grants microphone permission.

## Automated checks

`tests/privacy.test.mjs` scans tracked text for known event identities, domains, phone-number shapes, and OpenAI API-key patterns. Build verification separately checks that source maps are disabled and that presenter-only controls are not created in audience mode.
