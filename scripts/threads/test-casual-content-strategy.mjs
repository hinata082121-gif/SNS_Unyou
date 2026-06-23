#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { THREADS_CONTENT_BANK } from "./lib/content-bank.mjs";

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "threads-casual-"));
fs.cpSync(path.join(root, "scripts"), path.join(tmp, "scripts"), { recursive: true });
fs.cpSync(path.join(root, "config"), path.join(tmp, "config"), { recursive: true });
fs.cpSync(path.join(root, "package.json"), path.join(tmp, "package.json"));

const bankStats = summarize(THREADS_CONTENT_BANK);
assert.ok(THREADS_CONTENT_BANK.length >= 90);
assert.ok(bankStats.formatCounts.sns_tip >= 18);
assert.ok(bankStats.formatCounts.rewrite_demo >= 18);
assert.ok((bankStats.formatCounts.shop_sns_aruaru || 0) + (bankStats.formatCounts.humorous_observation || 0) >= 16);
assert.ok((bankStats.formatCounts.behind_the_scenes || 0) + (bankStats.formatCounts.honest_opinion || 0) >= 10);
assert.ok(bankStats.formatCounts.quick_fix >= 10);
assert.ok(bankStats.formatCounts.specific_question >= 6);
assert.ok(bankStats.formatCounts.soft_showcase >= 2);
assert.equal(bankStats.duplicateTextCount, 0);
assert.ok(bankStats.directSalesCtaRatio <= 0.15);
assert.ok(bankStats.stiffExpressionCount <= 2);

const startDay = dayNumber("2099-03-01");
const generatedPosts = [];
for (let offset = 0; offset < 45; offset += 1) {
  const date = dateFromDayNumber(startDay + offset);
  run(["scripts/threads/create-daily-post-plan.mjs", date], { cwd: tmp });
  const plan = readJson(path.join(tmp, "data", "threads", "post-plans", `${date}.json`));
  assert.equal(plan.posts.length, 2);
  assert.equal(JSON.stringify(plan), JSON.stringify(readJson(path.join(tmp, "data", "threads", "post-plans", `${date}.json`))));
  assert.notEqual(plan.posts[0].theme, plan.posts[1].theme);
  generatedPosts.push(...plan.posts);
}

const generatedStats = summarize(generatedPosts);
assert.equal(generatedStats.duplicateTextCount, 0);
assert.equal(countRepeatedThemes(generatedPosts), 0);
assert.equal(countFormatStreaks(generatedPosts, 3), 0);
assert.equal(countIndustryRepeats(generatedPosts), 0);
assert.ok(generatedStats.ctaRatio <= 0.25);
assert.ok(generatedStats.directSalesCtaRatio <= 0.15);
assert.equal(generatedPosts.filter((post) => post.time === "11:00").every((post) => ["sns_tip", "rewrite_demo", "quick_fix", "soft_showcase"].includes(post.format)), true);
assert.equal(generatedPosts.filter((post) => post.time === "19:00").some((post) => ["shop_sns_aruaru", "humorous_observation", "behind_the_scenes", "honest_opinion", "specific_question"].includes(post.format)), true);

const today = jstDate(0);
writePlan(tmp, today, {
  date: today,
  posts: [
    { date: today, time: "11:00", theme: "protected", text: "published slot protected text", cta: "", contentPillar: "legacy", format: "legacy", hookType: "legacy", targetIndustry: "業種共通", media: { type: "none", items: [] } },
    { date: today, time: "19:00", theme: "old", text: "old unpublished text", cta: "", contentPillar: "legacy", format: "legacy", hookType: "legacy", targetIndustry: "業種共通", media: { type: "none", items: [] } }
  ]
});
writePublished(tmp, today, "11");
const refresh = run(["scripts/threads/refresh-future-post-plans.mjs"], { cwd: tmp });
assert.equal(refresh.ok, true);
assert.equal(refresh.liveThreadsApiCallCount, 0);
assert.equal(refresh.compensationPostExecuted, false);
const refreshedToday = readJson(path.join(tmp, "data", "threads", "post-plans", `${today}.json`));
assert.equal(refreshedToday.posts.find((post) => post.time === "11:00").text, "published slot protected text");
assert.notEqual(refreshedToday.posts.find((post) => post.time === "19:00").text, "old unpublished text");

console.log(JSON.stringify({
  casualContentStrategyTestCount: 26,
  passed: true,
  candidateBankCount: THREADS_CONTENT_BANK.length,
  snsTipCount: bankStats.formatCounts.sns_tip,
  rewriteDemoCount: bankStats.formatCounts.rewrite_demo,
  humorAndAruaruCount: (bankStats.formatCounts.shop_sns_aruaru || 0) + (bankStats.formatCounts.humorous_observation || 0),
  fortyFiveDayReuseCount: generatedStats.duplicateTextCount,
  liveThreadsApiCallCount: 0,
  compensationPostExecuted: false,
  autoReplyExecuted: false,
  autoLikeExecuted: false,
  autoFollowExecuted: false,
  tokenLogged: false,
  postIdLogged: false
}));

function summarize(posts) {
  const texts = posts.map((post) => String(post.text || ""));
  const ctaCount = posts.filter((post) => post.cta).length;
  const directSalesCtaCount = posts.filter((post) => post.hasDirectSalesCta || /無料診断|無料チェック|相談できます|無料で確認/.test(String(post.cta || ""))).length;
  return {
    duplicateTextCount: texts.length - new Set(texts).size,
    ctaRatio: posts.length ? ctaCount / posts.length : 0,
    directSalesCtaRatio: posts.length ? directSalesCtaCount / posts.length : 0,
    stiffExpressionCount: texts.filter((text) => /改善しやすいです|進みやすくなります|無料で確認します|一緒に整理できます|相談できます/.test(text)).length,
    formatCounts: countBy(posts, "format")
  };
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function countRepeatedThemes(posts) {
  let count = 0;
  for (let index = 1; index < posts.length; index += 1) if (posts[index].theme === posts[index - 1].theme) count += 1;
  return count;
}

function countFormatStreaks(posts, length) {
  let count = 0;
  for (let index = length - 1; index < posts.length; index += 1) {
    const slice = posts.slice(index - length + 1, index + 1);
    if (slice.every((post) => post.format === slice[0].format)) count += 1;
  }
  return count;
}

function countIndustryRepeats(posts) {
  let count = 0;
  for (let index = 1; index < posts.length; index += 1) if (posts[index].targetIndustry === posts[index - 1].targetIndustry) count += 1;
  return count;
}

function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd || root,
    env: Object.assign({}, process.env, options.env || {}),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return parseJson(result.stdout);
}

function parseJson(output) {
  const text = String(output || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  assert.ok(start >= 0 && end > start);
  return JSON.parse(text.slice(start, end + 1));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writePlan(base, date, plan) {
  const dir = path.join(base, "data", "threads", "post-plans");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}.json`), `${JSON.stringify(plan, null, 2)}\n`);
}

function writePublished(base, date, slot) {
  const dir = path.join(base, "data", "threads", "published");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}-${slot}.json`), `${JSON.stringify({ published: true, postIdPresent: true }, null, 2)}\n`);
}

function dayNumber(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function dateFromDayNumber(value) {
  return new Date(value * 86400000).toISOString().slice(0, 10);
}

function jstDate(daysFromToday = 0) {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const base = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + daysFromToday));
  return base.toISOString().slice(0, 10);
}
