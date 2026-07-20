# Security policy

## Supported version

Security fixes are applied to the current `main` branch.

## Report a vulnerability

Use GitHub's private vulnerability-reporting feature for this repository. Do not open a public issue containing a credential, exploit, private URL, or personal data.

## Credential boundary

Never commit API keys. A standard OpenAI API key belongs only in a trusted server environment. The browser may receive a short-lived Realtime client secret from a deployer-controlled backend.

The included local token server is intentionally restricted to loopback origins. Before adapting it for a public deployment, add user authorization, abuse controls, rate limiting, spending limits, and an allowlist for expected origins.
