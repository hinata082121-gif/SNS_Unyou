#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/ensure-rolling-post-plans.mjs\nEnsures today, tomorrow, and the day after tomorrow have local Threads post plans. Does not publish.");
  process.exit(0);
}

const timezone = "Asia/Tokyo";
const dates = [jstDate(0), jstDate(1), jstDate(2)];
let datesCreated = 0;
let datesExisting = 0;
let slotsPrepared = 0;
const failedDates = [];

for (const date of dates) {
  const before = inspectPlan(date);
  if (before.ok) {
    datesExisting += 1;
    slotsPrepared += before.slotsPrepared.length;
    continue;
  }

  const created = spawnSync("node", ["scripts/threads/create-daily-post-plan.mjs", date], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  const after = created.status === 0 ? inspectPlan(date) : { ok: false, slotsPrepared: [] };
  if (after.ok) {
    datesCreated += 1;
    slotsPrepared += after.slotsPrepared.length;
  } else {
    failedDates.push(date);
  }
}

const summary = {
  ok: failedDates.length === 0,
  timezone,
  datesChecked: dates.length,
  datesCreated,
  datesExisting,
  slotsPrepared,
  failedDateCount: failedDates.length
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

function inspectPlan(date) {
  const fullPath = path.join(process.cwd(), "data", "threads", "post-plans", `${date}.json`);
  if (!fs.existsSync(fullPath)) return { ok: false, slotsPrepared: [] };
  try {
    const plan = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const slotsPrepared = Array.isArray(plan.posts)
      ? plan.posts.map((post) => normalizeSlot(post.time)).filter(Boolean)
      : [];
    const strategyReady = Array.isArray(plan.posts)
      ? plan.posts.every((post) => post.pillar && post.hookType && post.slotRole)
      : false;
    return {
      ok: slotsPrepared.includes("11") && slotsPrepared.includes("19") && strategyReady,
      slotsPrepared
    };
  } catch {
    return { ok: false, slotsPrepared: [] };
  }
}

function normalizeSlot(value) {
  const match = String(value || "").match(/^(\d{1,2})(?::00)?$/);
  return match ? match[1].padStart(2, "0") : "";
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
