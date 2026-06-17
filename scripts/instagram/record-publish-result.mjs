#!/usr/bin/env node
import { loadPublishHistory, savePublishHistory } from "./lib/instagram-publishing-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/record-publish-result.mjs --id <post-id> --status success|failed\nRecords a safe manual/API publish result summary.");
  process.exit(0);
}

const id = argValue("id");
const status = argValue("status", "failed");
const history = loadPublishHistory();
history.entries.push({
  id,
  published: status === "success",
  manuallyRecorded: true,
  recordedAt: new Date().toISOString(),
  retryAllowed: status !== "success",
});
savePublishHistory(history);
console.log(JSON.stringify({ ok: Boolean(id), id, status, livePublishExecuted: false }, null, 2));
process.exit(id ? 0 : 1);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}
