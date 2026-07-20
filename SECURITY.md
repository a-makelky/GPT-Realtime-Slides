# Security policy

## Supported version

Security fixes are applied to the current `main` branch.

## Report a vulnerability

Use GitHub's private vulnerability-reporting feature for this repository. Do not open a public issue containing a credential, exploit, private URL, or personal data.

## Credential boundary

Never commit API keys. A standard OpenAI API key belongs only in a trusted server environment. The browser may receive a short-lived Realtime client secret from a deployer-controlled backend.

The included local token server is intentionally restricted to loopback origins. Before adapting it for a public deployment, add user authorization, abuse controls, rate limiting, spending limits, and an allowlist for expected origins.

## Audience-data boundary

The optional Cloudflare extension accepts only the multiple-choice questions and option IDs defined in `shared/audience-config.js`. It has no raw-response, export, reset, identity, testimonial, or free-text endpoint.

Audience writes require same-origin JSON requests, use prepared D1 statements, and are capped at 8 KiB. Recovery codes are random, returned once, and stored only as hashes. Public aggregate responses release complete cohorts of at least three and contain no attendee IDs, hidden totals, recovery material, or per-response timestamps.

Anonymous public forms cannot guarantee one response per human. Add deployment-specific bot protection and rate limiting before using the extension for a large or high-stakes event.
