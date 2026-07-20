import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const textExtensions = new Set([".js", ".mjs", ".json", ".html", ".css", ".md", ".yml", ".yaml", ".txt"]);
const excluded = new Set(["node_modules", "dist", ".git"]);

test("tracked public source contains no known source identities, domains, or credential shapes", async () => {
  const files = await walk(root.pathname);
  const findings = [];
  const deny = [
    new RegExp(["aar", "on\\s+ma", "kelky"].join(""), "i"),
    new RegExp(["aaron", "makelky", "\\.com"].join(""), "i"),
    new RegExp(["m4", "ward", "\\.win"].join(""), "i"),
    new RegExp(["spo", "kane"].join(""), "i"),
    new RegExp(["jet", "hro"].join(""), "i"),
    new RegExp(["je", "ff\\s+(?:and|&)\\s+vi", "cki"].join(""), "i"),
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\b\d{3}[-.)\s]\d{3}[-.\s]\d{4}\b/,
  ];
  for (const file of files) {
    if (file.endsWith("privacy.test.mjs")) continue;
    const content = await readFile(file, "utf8");
    if (deny.some((pattern) => pattern.test(content))) findings.push(file.replace(root.pathname, ""));
  }
  assert.deepEqual(findings, []);
});

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (textExtensions.has(extname(entry.name)) || entry.name === "LICENSE") files.push(path);
  }
  return files;
}
