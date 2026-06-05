#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/publish-scheduled-thread.mjs --slot 11|19\nPublishes only when THREADS_PUBLISH_ENABLED=true and THREADS_DRY_RUN=false. Otherwise records blocked/dry-run status.");
  process.exit(0);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const slot = argValue("slot", "11");
const publishEnabled = process.env.THREADS_PUBLISH_ENABLED === "true";
const dryRun = process.env.THREADS_DRY_RUN !== "false";
const hasToken = Boolean(process.env.THREADS_ACCESS_TOKEN);
const hasUserId = Boolean(process.env.THREADS_USER_ID);

const result = {
  ok: false,
  slot,
  publishEnabled,
  dryRun,
  apiConfigured: hasToken && hasUserId,
  published: false,
  blockedReason: "",
};

if (!hasToken || !hasUserId) {
  result.blockedReason = "threads_api_not_configured";
} else if (!publishEnabled) {
  result.blockedReason = "publish_disabled";
} else if (dryRun) {
  result.blockedReason = "dry_run_enabled";
} else {
  result.ok = false;
  result.blockedReason = "api_publish_not_implemented_in_local_stub";
}

const outDir = path.join(process.cwd(), "data", "threads", "published");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, `${new Date().toISOString().slice(0, 10)}-${slot}.json`),
  `${JSON.stringify(result, null, 2)}\n`,
);

console.log(JSON.stringify(result));
process.exit(result.published ? 0 : 1);
