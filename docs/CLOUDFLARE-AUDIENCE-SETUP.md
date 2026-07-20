# Cloudflare audience input setup

This optional deployment adds anonymous entrance and exit ratings to a Cloudflare Pages project. Pages Functions handle the API, and D1 stores the responses. The presentation continues to work without this backend.

The setup creates a new database from the repository's schema. It does not import sample responses, event records, or an OpenAI API key.

## What you need

- Node.js 20 or newer
- A Cloudflare account
- Wrangler 4, already included as a development dependency
- A unique Pages project name, D1 database name, and event ID

Install the project and sign in to Cloudflare:

```bash
npm install
npx wrangler login
npx wrangler whoami
```

## 1. Create an empty D1 database

Choose a database name for this deployment:

```bash
npx wrangler d1 create my-slides-audience
```

Wrangler prints the new database name and UUID. Copy the UUID for the next step. D1 database IDs identify a resource but do not grant access by themselves.

## 2. Create the local deployment configuration

Run the guided setup command with your Pages project, database, database UUID, and event ID:

```bash
npm run cf:setup -- \
  --project my-realtime-slides \
  --database my-slides-audience \
  --database-id PASTE_THE_UUID_FROM_WRANGLER \
  --event-id my-event-2026
```

This creates `wrangler.jsonc`. The file is ignored by Git because it contains deployment-specific identifiers. The command refuses to overwrite an existing configuration.

Keep these values aligned:

| Setting | Purpose |
| --- | --- |
| `name` | Cloudflare Pages project name |
| `DB` | Required D1 binding name used by the Functions |
| `database_name` and `database_id` | The empty D1 database created above |
| `EVENT_ID` | Namespace separating one event's records from another |
| `preview_database_id: "DB"` | Keeps Wrangler Pages rehearsals in local storage |

Check the configuration at any time:

```bash
npm run cf:config:check
```

## 3. Rehearse locally

Apply the schema to Wrangler's local D1 storage:

```bash
npm run db:migrate:local
npm run db:assert-empty:local
npm run cf:dev
```

Open `http://127.0.0.1:8788/` for the presenter and `http://127.0.0.1:8788/participate?phase=entrance` for audience input.

Local responses live under the ignored `.wrangler/state` directory. They do not reach Cloudflare's production database. The empty check is expected to fail after you submit local rehearsal responses.

Cloudflare Pages cannot use a remote D1 database during local development. Use the local workflow above instead of testing against production. See Cloudflare's [Pages D1 local-development guidance](https://developers.cloudflare.com/d1/best-practices/local-development/).

## 4. Deploy through Wrangler

Create the Pages project once. Skip this command if the project already exists:

```bash
npx wrangler pages project create my-realtime-slides --production-branch main
```

Apply the schema to the remote database and confirm it is still blank:

```bash
npm run db:migrate:remote
npm run db:assert-empty:remote
```

Deploy the built site and Pages Functions:

```bash
npm run cf:deploy -- --branch main
```

The deployment reads the D1 binding from the ignored `wrangler.jsonc`. No standard API key is bundled into the site.

After deployment, this read-only endpoint should return HTTP 200 with `suppressed: true` and `publishedRespondents: 0`:

```text
https://YOUR_PAGES_DOMAIN/api/audience/aggregates
```

Do not submit a valid production response merely to test whether the database is blank. Use the aggregate endpoint and the remote empty check.

## Git-connected Pages alternative

If Cloudflare builds directly from your GitHub fork, use this Pages configuration:

- Build command: `npm run build`
- Build output directory: `dist`
- Production D1 binding: variable name `DB`, connected to your D1 database
- Environment variable: `EVENT_ID`, using your event namespace

Apply the remote migration from a trusted development machine before the first deployment. Then redeploy the Pages project so the binding is available to the Functions. Cloudflare documents both Wrangler and dashboard binding paths in its [Pages bindings guide](https://developers.cloudflare.com/pages/functions/bindings/).

The repository does not commit `wrangler.jsonc`, so Git-connected deployments must configure the `DB` binding and `EVENT_ID` in the Cloudflare dashboard. Do not connect a preview deployment to the production database for rehearsals. Use local D1, or a separate preview database, instead.

## Customize the audience questions

Edit `shared/audience-config.js` before collecting responses:

- Keep entrance and exit questions paired with the same scale.
- Give every question a clear purpose and public-aggregate visibility.
- Keep the privacy threshold at three or higher.
- Avoid names, email addresses, organizations, testimonials, or free text unless you redesign the consent and data-handling model.

Changing `EVENT_ID` starts a separate logical event inside the same database. It does not delete earlier records. Use a separate D1 database when events require separate retention or access policies.

## Production guardrails

The starter deliberately has no public admin, export, reset, or raw-response route. Public results contain grouped counts and paired means only after the release threshold.

Before using anonymous input at a large or high-stakes event, add deployment-specific rate limiting or bot protection. Same-origin enforcement prevents cross-site form posts, but it does not prove that one response came from one human.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Audience input is unavailable` | Confirm the Pages binding is named exactly `DB`, then redeploy. |
| `no such table` in Function logs | Run `npm run db:migrate:remote` against the configured database. |
| Results remain hidden | Fewer than three complete responses are available for that released cohort. |
| Local responses appear missing | Run through `npm run cf:dev`; the plain Vite server has no Pages Functions or D1 binding. |
| Setup refuses to run | An existing `wrangler.jsonc` was preserved. Review it or move it before generating another. |
| Preview writes to production | Stop using that preview, check its binding, and rehearse through local D1 instead. |
