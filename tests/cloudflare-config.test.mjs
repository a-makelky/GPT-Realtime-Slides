import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseJsonc,
  renderCloudflareConfig,
  validateCloudflareConfig,
} from "../scripts/cloudflare-config.mjs";

const validInput = Object.freeze({
  project: "my-realtime-slides",
  database: "my_realtime_slides_audience",
  databaseId: "11111111-1111-4111-8111-111111111111",
  eventId: "my-event-2026",
});

test("the guided setup renders a complete Pages and D1 configuration", () => {
  const config = JSON.parse(renderCloudflareConfig(validInput));
  assert.equal(config.name, validInput.project);
  assert.equal(config.pages_build_output_dir, "./dist");
  assert.equal(config.vars.EVENT_ID, validInput.eventId);
  assert.deepEqual(config.d1_databases, [{
    binding: "DB",
    database_name: validInput.database,
    database_id: validInput.databaseId,
    preview_database_id: "DB",
    migrations_dir: "migrations",
  }]);
  assert.deepEqual(validateCloudflareConfig(config), []);
});

test("configuration validation rejects placeholders and unsafe preview bindings", () => {
  const config = JSON.parse(renderCloudflareConfig(validInput));
  config.d1_databases[0].database_id = "REPLACE_WITH_PRODUCTION_DATABASE_ID";
  config.d1_databases[0].preview_database_id = validInput.databaseId;
  assert.deepEqual(validateCloudflareConfig(config), [
    "D1 database ID must be the UUID returned by `wrangler d1 create`.",
    'preview_database_id must be "DB" so Pages rehearsals use local storage.',
  ]);
});

test("the config reader accepts JSONC comments and trailing commas", () => {
  const parsed = parseJsonc(`{
    // Pages project
    "name": "slides", // keep this comment out of the value
    "vars": { "EVENT_ID": "event/*literal*/", },
  }`);
  assert.deepEqual(parsed, {
    name: "slides",
    vars: { EVENT_ID: "event/*literal*/" },
  });
});

test("the committed example contains no deployable production database ID", async () => {
  const example = parseJsonc(await readFile(new URL("../wrangler.example.jsonc", import.meta.url), "utf8"));
  assert.equal(example.d1_databases[0].binding, "DB");
  assert.equal(example.d1_databases[0].preview_database_id, "DB");
  assert.doesNotMatch(example.d1_databases[0].database_id, /^[0-9a-f-]{36}$/iu);
});
