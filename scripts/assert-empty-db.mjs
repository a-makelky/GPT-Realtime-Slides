import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const databaseIndex = args.indexOf("--database");
const database = databaseIndex >= 0 ? args[databaseIndex + 1] : "";
const wantsPreview = args.includes("--preview");
const wantsRemote = args.includes("--remote");
const wantsLocal = args.includes("--local");
const targetArgs = wantsPreview ? ["--remote", "--preview"] : wantsRemote ? ["--remote"] : wantsLocal ? ["--local"] : [];

if (!database || targetArgs.length === 0 || (wantsLocal && (wantsRemote || wantsPreview))) {
  console.error("Usage: node scripts/assert-empty-db.mjs --database <name-or-binding> (--remote|--preview|--local)");
  process.exit(2);
}

const sql = [
  "SELECT 'attendees' AS table_name, COUNT(*) AS row_count FROM attendees",
  "UNION ALL SELECT 'submissions', COUNT(*) FROM submissions",
  "UNION ALL SELECT 'answers', COUNT(*) FROM answers",
].join(" ");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules/.bin/wrangler");
const result = spawnSync(wrangler, ["d1", "execute", database, ...targetArgs, "--json", "--command", sql], {
  cwd: root,
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "Could not read database counts.\n");
  process.exit(result.status || 1);
}

let payload;
try { payload = JSON.parse(result.stdout); }
catch {
  console.error("Wrangler did not return valid JSON.");
  process.exit(1);
}

const rows = payload?.[0]?.results || payload?.result?.[0]?.results || [];
const counts = Object.fromEntries(rows.map((row) => [row.table_name, Number(row.row_count)]));
const expected = ["attendees", "submissions", "answers"];
if (expected.some((table) => !Number.isFinite(counts[table]))) {
  console.error("Database count response was incomplete.");
  process.exit(1);
}
if (expected.some((table) => counts[table] !== 0)) {
  console.error(`Database is not empty: ${expected.map((table) => `${table}=${counts[table]}`).join(", ")}`);
  process.exit(1);
}

console.log(`Database is empty: ${expected.map((table) => `${table}=0`).join(", ")}`);
