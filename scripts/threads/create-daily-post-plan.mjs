#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { hasInstagramDestination, loadThreadsBrandConfig, selectInstagramCta } from "./lib/threads-brand.mjs";
import { EVENING_FORMATS, MORNING_FORMATS, THREADS_CONTENT_BANK } from "./lib/content-bank.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/create-daily-post-plan.mjs [YYYY-MM-DD]\nCreates a deterministic casual Threads post plan JSON without publishing or exposing secrets.");
  process.exit(0);
}

const date = process.argv[2] || new Date().toISOString().slice(0, 10);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = createDailyPlan(date);
  const outDir = path.join(process.cwd(), "data", "threads", "post-plans");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${date}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    postCount: plan.posts.length,
    candidateBankCount: THREADS_CONTENT_BANK.length,
    snsTipCount: countFormat("sns_tip"),
    rewriteDemoCount: countFormat("rewrite_demo"),
    humorAndAruaruCount: THREADS_CONTENT_BANK.filter((post) => ["shop_sns_aruaru", "humorous_observation"].includes(post.format)).length,
    ctaCount: plan.posts.filter((post) => post.cta).length,
    file: path.relative(process.cwd(), outFile)
  }));
}

export function createDailyPlan(targetDate) {
  const brand = loadThreadsBrandConfig();
  const instagramReady = hasInstagramDestination(brand);
  const history = loadRecentPlanHistory(targetDate, 45);
  const coverage = requiredCoverageForDate(targetDate);
  const morning = selectCandidate({ date: targetDate, slot: "11", history, used: [], preferredFormats: coverage.morning });
  const evening = selectCandidate({ date: targetDate, slot: "19", history, used: [morning], preferredFormats: coverage.evening });
  return {
    date: targetDate,
    strategyVersion: "casual-viral-formats-v1",
    posts: [
      buildPost({ date: targetDate, time: "11:00", source: morning, cta: "" }),
      buildPost({ date: targetDate, time: "19:00", source: evening, cta: selectCta({ date: targetDate, source: evening, brand, instagramReady, history }) })
    ]
  };
}

function requiredCoverageForDate(targetDate) {
  const phase = dayNumber(targetDate) % 3;
  if (phase === 0) {
    return {
      morning: new Set(["rewrite_demo", ...MORNING_FORMATS]),
      evening: new Set(["shop_sns_aruaru", "humorous_observation", ...EVENING_FORMATS])
    };
  }
  if (phase === 1) {
    return {
      morning: new Set(["sns_tip", ...MORNING_FORMATS]),
      evening: new Set(["specific_question", ...EVENING_FORMATS])
    };
  }
  return {
    morning: new Set(["quick_fix", ...MORNING_FORMATS]),
    evening: new Set(["behind_the_scenes", "honest_opinion", ...EVENING_FORMATS])
  };
}

function selectCandidate({ date, slot, history, used, preferredFormats }) {
  const dayIndex = dayNumber(date);
  const offset = slot === "11" ? 0 : 1;
  const recentTexts = new Set(history.map((post) => post.text));
  const recentKeys = new Set(history.map((post) => post.contentKey));
  const recentFormats = history.concat(used).slice(-2).map((post) => post.format);
  const previousIndustry = history.concat(used).slice(-1)[0]?.targetIndustry || "";
  const startIndex = Math.abs((dayIndex * 2 + offset) % THREADS_CONTENT_BANK.length);
  for (const preferredFormat of preferredFormats) {
    for (let step = 0; step < THREADS_CONTENT_BANK.length; step += 1) {
      const candidate = THREADS_CONTENT_BANK[(startIndex + step) % THREADS_CONTENT_BANK.length];
      if (candidate.format !== preferredFormat) continue;
      if (recentTexts.has(candidate.text) || recentKeys.has(candidate.contentKey)) continue;
      if (used.some((post) => post.text === candidate.text || post.theme === candidate.theme)) continue;
      if (used.some((post) => post.targetIndustry === candidate.targetIndustry)) continue;
      if (previousIndustry && previousIndustry === candidate.targetIndustry) continue;
      if (recentFormats.length >= 2 && recentFormats.every((format) => format === candidate.format)) continue;
      return candidate;
    }
  }
  for (let step = 0; step < THREADS_CONTENT_BANK.length; step += 1) {
    const candidate = THREADS_CONTENT_BANK[(startIndex + step) % THREADS_CONTENT_BANK.length];
    if (recentTexts.has(candidate.text) || recentKeys.has(candidate.contentKey)) continue;
    if (used.some((post) => post.text === candidate.text || post.theme === candidate.theme || post.targetIndustry === candidate.targetIndustry)) continue;
    if (previousIndustry && previousIndustry === candidate.targetIndustry) continue;
    if (recentFormats.length >= 2 && recentFormats.every((format) => format === candidate.format)) continue;
    return candidate;
  }
  return THREADS_CONTENT_BANK[startIndex];
}

function buildPost({ date, time, source, cta }) {
  return {
    date,
    time,
    theme: source.theme,
    text: source.text,
    cta,
    contentPillar: source.contentPillar,
    format: source.format,
    hookType: source.hookType,
    tone: source.tone,
    targetIndustry: source.targetIndustry,
    hasQuestion: source.hasQuestion,
    hasDirectSalesCta: source.hasDirectSalesCta || /無料診断|無料チェック|相談できます|無料で確認/.test(cta),
    slotRole: time === "11:00" ? "useful_midday_idea" : "evening_conversation",
    contentKey: source.contentKey,
    media: source.media || { type: "none", items: [] }
  };
}

function selectCta({ date, source, brand, instagramReady, history }) {
  if (!["soft_showcase", "specific_question", "honest_opinion"].includes(source.format)) return "";
  const recentCtaCount = history.slice(-13).filter((post) => post.cta).length;
  if (recentCtaCount >= 1) return "";
  if (dayNumber(date) % 7 !== 2) return "";
  return instagramReady ? selectInstagramCta(brand, dayNumber(date)) : "";
}

function loadRecentPlanHistory(targetDate, days) {
  const rows = [];
  for (let offset = days; offset >= 1; offset -= 1) {
    const date = dateFromDayNumber(dayNumber(targetDate) - offset);
    const plan = readJson(path.join(process.cwd(), "data", "threads", "post-plans", `${date}.json`), null);
    if (!Array.isArray(plan?.posts)) continue;
    for (const post of plan.posts) {
      rows.push({
        text: String(post.text || ""),
        theme: String(post.theme || ""),
        format: String(post.format || ""),
        hookType: String(post.hookType || ""),
        targetIndustry: String(post.targetIndustry || ""),
        contentKey: String(post.contentKey || ""),
        cta: String(post.cta || "")
      });
    }
  }
  return rows;
}

function countFormat(format) {
  return THREADS_CONTENT_BANK.filter((post) => post.format === format).length;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function dayNumber(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function dateFromDayNumber(value) {
  return new Date(value * 86400000).toISOString().slice(0, 10);
}
