import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { handleJson, requestPayload } from "../server/audience-pages.js";

const root = new URL("..", import.meta.url);

test("the audience migration is schema-only and cannot seed production data", async () => {
  const migration = await readFile(new URL("../migrations/0001_audience.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE attendees/u);
  assert.match(migration, /response_hash TEXT NOT NULL/u);
  assert.match(migration, /CREATE TABLE submissions/u);
  assert.match(migration, /CREATE TABLE answers/u);
  assert.doesNotMatch(migration, /\bINSERT\b/iu);
  assert.doesNotMatch(migration, /fixture|seed|testimonial|email|name|free.?text/iu);
});

test("the public audience API exposes only the four approved route families", async () => {
  const files = await walk(new URL("../functions/api/audience/", import.meta.url));
  const routes = files
    .filter((file) => !file.endsWith("_shared.js"))
    .map((file) => file.replace("functions/api/audience/", ""))
    .sort();
  assert.deepEqual(routes, ["aggregates.js", "recover.js", "responses/[phase].js", "session.js"]);
  assert.equal(routes.some((route) => /raw|export|reset|fixture/iu.test(route)), false);
});

test("the D1 adapter uses bound prepared statements and transactional batch writes", async () => {
  const core = await readFile(new URL("../server/audience-core.js", import.meta.url), "utf8");
  assert.match(core, /db\.prepare\(/u);
  assert.match(core, /\.bind\(/u);
  assert.match(core, /await db\.batch\(statements\)/u);
  assert.doesNotMatch(core, /db\.exec\(/u);
  assert.doesNotMatch(core, /DELETE FROM attendees|DELETE FROM submissions/iu);
  assert.match(core, /ON CONFLICT\(event_id, attendee_id, phase\) DO NOTHING/u);
});

test("mutation payloads fail closed without an exact same-origin Origin header", async () => {
  const makeRequest = (origin) => new Request("https://slides.example/api/audience/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: "{}",
  });

  await assert.rejects(requestPayload({ request: makeRequest() }), (error) => error.status === 403);
  await assert.rejects(requestPayload({ request: makeRequest("https://other.example") }), (error) => error.status === 403);
  assert.deepEqual(await requestPayload({ request: makeRequest("https://slides.example") }), {});

  const context = { request: makeRequest() };
  const response = await handleJson(context, () => requestPayload(context));
  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "origin_not_allowed");
  assert.equal(typeof payload.error.message, "string");
});

test("the example Pages configuration keeps production IDs out and uses local preview storage", async () => {
  const config = await readFile(new URL("../wrangler.example.jsonc", import.meta.url), "utf8");
  assert.match(config, /"binding": "DB"/u);
  assert.match(config, /"database_id": "REPLACE_WITH_PRODUCTION_DATABASE_ID"/u);
  assert.match(config, /"preview_database_id": "DB"/u);
  assert.match(config, /"migrations_dir": "migrations"/u);
});

async function walk(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) files.push(...await walk(child));
    else files.push(child.pathname.replace(root.pathname, ""));
  }
  return files;
}
