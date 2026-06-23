#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createDailyPlan } from "./create-daily-post-plan.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/refresh-future-post-plans.mjs\nRefreshes today/tomorrow/day-after Threads plans for unpublished slots only. Does not publish or backfill past dates.");
  process.exit(0);
}

const dates = [jstDate(0), jstDate(1), jstDate(2)];
let datesChecked = 0;
let filesWritten = 0;
let slotsRefreshed = 0;
let publishedSlotsPreserved = 0;
let pastDatePublishCount = 0;

for (const date of dates) {
  datesChecked += 1;
  const refreshed = createDailyPlan(date);
  const existing = readPlan(date) || { date, posts: [] };
  const mergedPosts = refreshed.posts.map((newPost) => {
    const slot = normalizeSlot(newPost.time);
    const oldPost = Array.isArray(existing.posts) ? existing.posts.find((post) => normalizeSlot(post.time) === slot) : null;
    if (isPublished(date, slot) && oldPost) {
      publishedSlotsPreserved += 1;
      return oldPost;
    }
    slotsRefreshed += 1;
    return newPost;
  });
  const merged = {
    date,
    strategyVersion: "casual-viral-formats-v1",
    posts: mergedPosts
  };
  if (JSON.stringify(existing) !== JSON.stringify(merged)) {
    writePlan(date, merged);
    filesWritten += 1;
  }
}

console.log(JSON.stringify({
  ok: true,
  datesChecked,
  filesWritten,
  slotsRefreshed,
  publishedSlotsPreserved,
  pastDatePublishCount,
  liveThreadsApiCallCount: 0,
  compensationPostExecuted: false
}));

function readPlan(date) {
  return readJson(planPath(date), null);
}

function writePlan(date, plan) {
  const filePath = planPath(date);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`);
}

function planPath(date) {
  return path.join(process.cwd(), "data", "threads", "post-plans", `${date}.json`);
}

function isPublished(date, slot) {
  const log = readJson(path.join(process.cwd(), "data", "threads", "published", `${date}-${slot}.json`), null);
  return log?.published === true;
}

function normalizeSlot(value) {
  const match = String(value || "").match(/^(\d{1,2})(?::00)?$/);
  return match ? match[1].padStart(2, "0") : "";
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
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
