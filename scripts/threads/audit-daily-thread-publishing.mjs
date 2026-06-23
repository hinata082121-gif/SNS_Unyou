#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/audit-daily-thread-publishing.mjs --date YYYY-MM-DD [--expected-slots 11,19]\nAudits safe local Threads publish logs. Does not publish, backfill, or print post text/IDs.");
  process.exit(0);
}

const date = argValue("date", jstDate(0));
const expectedSlots = argValue("expected-slots", "11,19").split(",").map((slot) => slot.trim()).filter(Boolean);
const slotResults = expectedSlots.map((slot) => inspectSlot(date, slot));
const publishedPostCount = slotResults.filter((slot) => slot.published).length;
const duplicatePublishCount = countDuplicatePublishedLogs(date, expectedSlots);
const missingSlots = slotResults.filter((slot) => !slot.published).map((slot) => slot.slot);
const last11 = slotResults.find((slot) => slot.slot === "11") || { status: "missing" };
const last19 = slotResults.find((slot) => slot.slot === "19") || { status: "missing" };

const summary = {
  date,
  expectedPostCount: expectedSlots.length,
  publishedPostCount,
  missingSlotCount: missingSlots.length,
  published11: Boolean(last11.published),
  published19: Boolean(last19.published),
  missingSlots,
  last11Status: last11.status,
  last19Status: last19.status,
  last11BlockedReason: last11.blockedReason,
  last19BlockedReason: last19.blockedReason,
  duplicatePublishCount,
  ok: publishedPostCount === expectedSlots.length && duplicatePublishCount === 0,
  compensationPostExecuted: false
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

function inspectSlot(date, slot) {
  const filePath = path.join(process.cwd(), "data", "threads", "published", `${date}-${slot}.json`);
  const stat = safeStat(filePath);
  const data = readJson(filePath, null);
  const published = data?.published === true;
  return {
    slot,
    logExists: Boolean(stat),
    lastRunAt: stat ? stat.mtime.toISOString() : "",
    status: published ? "success" : data ? "blocked" : "missing",
    blockedReason: published ? "" : String(data?.blockedReason || "missing_publish_log"),
    published,
    postIdPresent: Boolean(data?.postIdPresent),
    compensationPostExecuted: false
  };
}

function countDuplicatePublishedLogs(date, expectedSlots) {
  const dir = path.join(process.cwd(), "data", "threads", "published");
  if (!fs.existsSync(dir)) return 0;
  let duplicateCount = 0;
  for (const slot of expectedSlots) {
    const matches = fs.readdirSync(dir).filter((name) => name === `${date}-${slot}.json`);
    if (matches.length > 1) duplicateCount += matches.length - 1;
  }
  return duplicateCount;
}

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

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function jstDate(daysFromToday = 0) {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const base = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + daysFromToday
  ));
  return base.toISOString().slice(0, 10);
}
