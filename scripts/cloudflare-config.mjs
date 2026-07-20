import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(root, "wrangler.jsonc");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/u;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/u;

export function renderCloudflareConfig({ project, database, databaseId, eventId }) {
  const config = {
    $schema: "./node_modules/wrangler/config-schema.json",
    name: project,
    pages_build_output_dir: "./dist",
    compatibility_date: "2026-07-19",
    vars: { EVENT_ID: eventId },
    d1_databases: [{
      binding: "DB",
      database_name: database,
      database_id: databaseId,
      preview_database_id: "DB",
      migrations_dir: "migrations",
    }],
  };
  const errors = validateCloudflareConfig(config);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function parseJsonc(source) {
  return JSON.parse(removeTrailingCommas(removeComments(source)));
}

export function validateCloudflareConfig(config) {
  const errors = [];
  if (!SLUG_PATTERN.test(config?.name || "")) {
    errors.push("Project name must use lowercase letters, numbers, and interior hyphens.");
  }
  if (config?.pages_build_output_dir !== "./dist") {
    errors.push('pages_build_output_dir must be "./dist".');
  }
  if (!EVENT_ID_PATTERN.test(config?.vars?.EVENT_ID || "")) {
    errors.push("EVENT_ID must use letters, numbers, periods, underscores, or interior hyphens.");
  }
  const binding = config?.d1_databases?.find((entry) => entry?.binding === "DB");
  if (!binding) {
    errors.push('A D1 binding named "DB" is required.');
    return errors;
  }
  if (!DATABASE_NAME_PATTERN.test(binding.database_name || "")) {
    errors.push("D1 database name must use letters, numbers, underscores, or interior hyphens.");
  }
  if (!UUID_PATTERN.test(binding.database_id || "")) {
    errors.push("D1 database ID must be the UUID returned by `wrangler d1 create`.");
  }
  if (binding.preview_database_id !== "DB") {
    errors.push('preview_database_id must be "DB" so Pages rehearsals use local storage.');
  }
  if (binding.migrations_dir !== "migrations") {
    errors.push('migrations_dir must be "migrations".');
  }
  return errors;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "create") {
    const options = parseArguments(args);
    const rendered = renderCloudflareConfig({
      project: requiredOption(options, "project"),
      database: requiredOption(options, "database"),
      databaseId: requiredOption(options, "database-id"),
      eventId: requiredOption(options, "event-id"),
    });
    try {
      await writeFile(configPath, rendered, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error("wrangler.jsonc already exists. It was left unchanged.");
      }
      throw error;
    }
    console.log("Created ignored wrangler.jsonc with a local-only preview binding.");
    console.log("Next: npm run db:migrate:local, then npm run cf:dev");
    return;
  }
  if (command === "check") {
    let config;
    try {
      config = parseJsonc(await readFile(configPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error("wrangler.jsonc is missing. Run `npm run cf:setup -- --help` for setup instructions.");
      }
      throw new Error(`wrangler.jsonc could not be parsed: ${error.message}`);
    }
    const errors = validateCloudflareConfig(config);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    console.log("Cloudflare configuration is ready: Pages output, DB binding, migration path, and local preview are valid.");
    return;
  }
  printUsage();
  process.exitCode = command === "--help" || command === "help" ? 0 : 2;
}

function parseArguments(args) {
  if (args.includes("--help")) {
    printUsage();
    process.exit(0);
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid option near ${flag || "the end of the command"}.`);
    }
    options[flag.slice(2)] = value;
  }
  return options;
}

function requiredOption(options, name) {
  if (!options[name]) throw new Error(`Missing required option --${name}.`);
  return options[name];
}

function printUsage() {
  console.log(`Usage:
  npm run cf:setup -- --project <pages-project> --database <d1-name> --database-id <uuid> --event-id <event-id>
  npm run cf:config:check

The setup command creates an ignored wrangler.jsonc and refuses to overwrite an existing one.`);
}

function removeComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function removeTrailingCommas(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ",") {
      let nextIndex = index + 1;
      while (/\s/u.test(source[nextIndex] || "")) nextIndex += 1;
      if (source[nextIndex] === "}" || source[nextIndex] === "]") continue;
    }
    output += char;
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
