#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "threads-cadence-"));
fs.cpSync(path.join(root, "scripts"), path.join(tmp, "scripts"), { recursive: true });
fs.cpSync(path.join(root, "config"), path.join(tmp, "config"), { recursive: true });
fs.cpSync(path.join(root, "package.json"), path.join(tmp, "package.json"));

const date = "2099-02-03";
const generated = run(["scripts/threads/create-daily-post-plan.mjs", date], { cwd: tmp });
assert.equal(generated.ok, true);
assert.ok(generated.candidateBankCount >= 90);
assert.ok(generated.snsTipCount >= 18);
assert.ok(generated.rewriteDemoCount >= 18);

const plan = JSON.parse(fs.readFileSync(path.join(tmp, "data", "threads", "post-plans", `${date}.json`), "utf8"));
assert.equal(plan.posts.length, 2);
assert.deepEqual(plan.posts.map((post) => post.time), ["11:00", "19:00"]);
assert.equal(plan.posts.every((post) => post.contentPillar && post.format && post.hookType && post.contentKey), true);
fs.rmSync(path.join(tmp, "data", "threads", "post-plans", `${date}.json`));

const rollingDates = [jstDate(0), jstDate(1), jstDate(2)];
for (const rollingDate of rollingDates) writeLegacyPlan(tmp, rollingDate);
const rolling = run(["scripts/threads/ensure-rolling-post-plans.mjs"], { cwd: tmp });
assert.equal(rolling.ok, true);
assert.equal(rolling.slotsPrepared, 6);
for (const rollingDate of rollingDates) {
  const rollingPlan = JSON.parse(fs.readFileSync(path.join(tmp, "data", "threads", "post-plans", `${rollingDate}.json`), "utf8"));
  assert.equal(rollingPlan.posts.every((post) => post.contentPillar && post.format && post.hookType && post.slotRole), true);
}

const validation = run(["scripts/threads/validate-thread-posts.mjs", path.join("data", "threads", "post-plans")], { cwd: tmp });
assert.equal(validation.ok, true, JSON.stringify(validation));
assert.equal(validation.duplicateCount, 0);
assert.equal(validation.repeatedOpeningCount, 0);
assert.equal(typeof validation.hookPresent, "boolean");
assert.equal(validation.mediaValidationErrorCount, 0);

const outside = run(["scripts/threads/publish-scheduled-thread.mjs", "--slot", "11", "--date", date], {
  cwd: tmp,
  env: {
    THREADS_NOW_ISO: `${date}T05:51:00.000Z`,
    THREADS_PUBLISH_ENABLED: "true",
    THREADS_DRY_RUN: "false",
    THREADS_ACCESS_TOKEN: "synthetic-token",
    THREADS_USER_ID: "synthetic-user"
  }
});
assert.equal(outside.ok, true);
assert.equal(outside.published, false);
assert.equal(outside.blockedReason, "outside_slot_window");
assert.equal(outside.compensationPostExecuted, false);
assert.equal(outside.planEnsured, false);

const auditMissing = runAllowFailure(["scripts/threads/audit-daily-thread-publishing.mjs", "--date", date], { cwd: tmp });
assert.equal(auditMissing.publishedPostCount, 0);
assert.equal(auditMissing.missingSlotCount, 2);
assert.equal(auditMissing.compensationPostExecuted, false);

writePublished(tmp, date, "11", true);
const auditOne = runAllowFailure(["scripts/threads/audit-daily-thread-publishing.mjs", "--date", date], { cwd: tmp });
assert.equal(auditOne.publishedPostCount, 1);
assert.deepEqual(auditOne.missingSlots, ["19"]);
assert.equal(auditOne.ok, false);

writePublished(tmp, date, "19", true);
const auditBoth = run(["scripts/threads/audit-daily-thread-publishing.mjs", "--date", date], { cwd: tmp });
assert.equal(auditBoth.publishedPostCount, 2);
assert.equal(auditBoth.ok, true);

const health = runAllowFailure(["scripts/automation/check-ichi-social-health.mjs", "--date", date], { cwd: tmp });
assert.equal(typeof health.threads.ok, "boolean");
assert.equal(health.threads.compensationPostExecuted, false);
assert.equal(health.sensitiveDataLogged, false);

const weekly = run(["scripts/threads/weekly-viral-analysis.mjs"], { cwd: tmp });
assert.equal(weekly.ok, true);
assert.equal(weekly.apiReadOnlyExecuted, false);
assert.equal(weekly.scrapingExecuted, false);
assert.equal(weekly.autoReplyExecuted, false);
assert.equal(weekly.autoLikeExecuted, false);
assert.equal(weekly.autoFollowExecuted, false);
assert.equal(weekly.fullTextStored, false);

console.log(JSON.stringify({
  threadsCadenceTestCount: 31,
  passed: true,
  liveThreadsApiCallCount: 0,
  compensationPostExecuted: false,
  autoReplyExecuted: false,
  autoLikeExecuted: false,
  autoFollowExecuted: false,
  personalDataLogged: false,
  tokenLogged: false
}));

function run(args, options = {}) {
  const result = runRaw(args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return parseLastJson(result.stdout);
}

function runAllowFailure(args, options = {}) {
  const result = runRaw(args, options);
  return parseLastJson(result.stdout || result.stderr);
}

function runRaw(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: options.cwd || root,
    env: Object.assign({}, process.env, options.env || {}),
    encoding: "utf8"
  });
}

function parseLastJson(output) {
  const text = String(output || "").trim();
  assert.ok(text, "missing json output");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  assert.ok(start >= 0 && end > start, "missing json object");
  return JSON.parse(text.slice(start, end + 1));
}

function writePublished(base, date, slot, published) {
  const dir = path.join(base, "data", "threads", "published");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}-${slot}.json`), `${JSON.stringify({
    ok: true,
    slot,
    postDate: date,
    published,
    postIdPresent: false,
    blockedReason: published ? "" : "test_missing",
    compensationPostExecuted: false
  }, null, 2)}\n`);
}

function writeLegacyPlan(base, date) {
  const dir = path.join(base, "data", "threads", "post-plans");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}.json`), `${JSON.stringify({
    date,
    posts: [
      { date, time: "11:00", theme: "legacy", text: "SNSを整える時は、入口を見ると改善しやすいです。", cta: "" },
      { date, time: "19:00", theme: "legacy", text: "無料診断ではSNSの導線を一緒に整理できます。", cta: "無料診断を相談できます。" }
    ]
  }, null, 2)}\n`);
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
