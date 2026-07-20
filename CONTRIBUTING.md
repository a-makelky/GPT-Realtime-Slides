# Contributing

Contributions are welcome.

Before opening a pull request:

1. Keep the public demo free of personal data, credentials, private URLs, and production account identifiers.
2. Keep presenter and audience views on the same canonical deck source.
3. Keep every essential action available without AI or network access after the app loads.
4. Do not add arbitrary HTML fields to slide content.
5. Run `npm run verify`.

New Realtime tools must map to an existing deterministic controller method and must be covered by tests. Do not allow the model to generate or rewrite live slide content.
