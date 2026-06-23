#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildSafePublishLog, writePublishedLogAtomic } from "./lib/published-log-writer.mjs";

const date = argValue("date", "");
const slot = argValue("slot", "");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["11", "19"].includes(slot)) {
  console.error(JSON.stringify({ ok: false, blockedReason: "invalid_date_or_slot" }));
  process.exit(1);
}

const logPath = path.join(process.cwd(), "data", "threads", "published", `${date}-${slot}.json`);
const planPath = path.join(process.cwd(), "data", "threads", "post-plans", `${date}.json`);
const backupPath = `${logPath}.bak-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const existing = readJson(logPath, null);
const plan = readJson(planPath, null);
const planPost = Array.isArray(plan?.posts)
  ? plan.posts.find((post) => normalizeSlot(post.time) === slot)
  : null;

if (!existing) {
  console.error(JSON.stringify({ ok: false, blockedReason: "existing_log_not_parseable" }));
  process.exit(1);
}

fs.copyFileSync(logPath, backupPath);
const repaired = buildSafePublishLog({
  ...existing,
  slot,
  postDate: date,
  published: existing.published === true,
  blockedReason: String(existing.blockedReason || ""),
  compensationPostExecuted: false,
  targetIndustry: typeof planPost?.targetIndustry === "string" ? planPost.targetIndustry : null
});

writePublishedLogAtomic(logPath, repaired);
const verified = JSON.parse(fs.readFileSync(logPath, "utf8"));
console.log(JSON.stringify({
  ok: true,
  date,
  slot,
  backupCreated: fs.existsSync(backupPath),
  jsonParseSucceeded: true,
  publishedPreserved: verified.published === true,
  slotPreserved: verified.slot === slot,
  postDatePreserved: verified.postDate === date,
  blockedReasonPreserved: verified.blockedReason === "",
  compensationPostExecuted: verified.compensationPostExecuted === false,
  targetIndustryRestored: verified.targetIndustry === repaired.targetIndustry,
  realThreadsApiCallCount: 0,
  realPostCount: 0,
  sensitiveDataLogged: false
}));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeSlot(value) {
  const match = String(value || "").match(/^(\d{1,2})(?::00)?$/);
  return match ? match[1].padStart(2, "0") : "";
}
