#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/weekly-viral-analysis.mjs [--metrics data/threads/metrics/YYYY-MM-DD.json]\nCreates safe weekly Threads analysis from local/manual metrics only. Does not scrape, login, like, follow, repost, or print post text.");
  process.exit(0);
}

const today = jstDate(0);
const metricsFile = argValue("metrics", "");
const published = readPublishedLogs();
const manualMetrics = metricsFile ? readManualMetrics(metricsFile) : [];
const merged = mergeMetrics(published, manualMetrics);
const byPillar = groupBy(merged, (item) => item.contentPillar || "unknown");
const byFormat = groupBy(merged, (item) => item.format || "unknown");
const bySlot = groupBy(merged, (item) => item.slot || "unknown");
const ctaRows = merged.filter((item) => item.hasCta);
const followerDelta = sum(merged, "followerDelta");
const publishedCount = merged.filter((item) => item.published).length;
const analysisStatus = publishedCount > 0 || manualMetrics.length > 0 ? "pass" : "insufficient_data";
const top = rankRows(merged).slice(0, 3);
const bottom = rankRows(merged).slice(-3);

const outDir = path.join(process.cwd(), "docs", "threads", "weekly-analysis");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `threads-weekly-analysis-${today}.md`);
const body = [
  `# Threads週次分析 ${today}`,
  "",
  "## 入力",
  "",
  `- published count: ${publishedCount}`,
  `- manual metrics loaded: ${manualMetrics.length}`,
  `- status: ${analysisStatus}`,
  "- Threads API read-only insights: not executed",
  "- scraping/login automation: false",
  "- auto reply/like/follow: false",
  "",
  "## 上位投稿構造",
  "",
  safeList(top, "score"),
  "",
  "## 下位投稿構造",
  "",
  safeList(bottom, "score"),
  "",
  "## 柱別",
  "",
  safeGroupList(byPillar),
  "",
  "## format別",
  "",
  safeGroupList(byFormat),
  "",
  "## スロット別",
  "",
  safeGroupList(bySlot),
  "",
  "## 次週方針",
  "",
  `- 次週増やすformat: ${recommendMore(byFormat)}`,
  `- 次週減らすformat: ${recommendLess(byFormat)}`,
  "- 冒頭文: 説明から入らず、観察・本音・問いで始める",
  `- CTA比率: ${merged.length ? (ctaRows.length / merged.length).toFixed(2) : "0.00"}`,
  `- フォロワー増減: ${followerDelta}`,
  "- 投稿バンク調整: 共感、本音、検証メモを増やし、無料診断導線の連投を避ける",
  "",
  "## 安全",
  "",
  "- 投稿本文全文は保存しない",
  "- 投稿ID実値、token、個人情報は保存しない",
  "- 自動返信、自動いいね、自動フォローは行わない",
  ""
].join("\n");
fs.writeFileSync(outFile, body);
console.log(JSON.stringify({
  ok: true,
  status: analysisStatus,
  file: path.relative(process.cwd(), outFile),
  publishedCount,
  manualMetricCount: manualMetrics.length,
  apiReadOnlyExecuted: false,
  scrapingExecuted: false,
  autoReplyExecuted: false,
  autoLikeExecuted: false,
  autoFollowExecuted: false,
  fullTextStored: false
}));

function readPublishedLogs() {
  const dir = path.join(process.cwd(), "data", "threads", "published");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-(11|19)\.json$/.test(name))
    .map((name) => {
      const data = readJson(path.join(dir, name), {});
      const [, date, slot] = name.match(/^(\d{4}-\d{2}-\d{2})-(11|19)\.json$/) || [];
      return {
        date,
        slot,
        published: data.published === true,
        contentPillar: data.contentPillar || "unknown",
        format: data.format || "unknown",
        hookType: data.hookType || "unknown",
        hasCta: Boolean(data.hasCta),
        textLengthBand: data.textLengthBand || "unknown",
        textHash: safeHash([date, slot, data.postIdHash || ""].join(":")),
        views: Number(data.views || 0),
        likes: Number(data.likes || 0),
        replies: Number(data.replies || 0),
        reposts: Number(data.reposts || 0),
        quotes: Number(data.quotes || 0),
        followerDelta: Number(data.followerDelta || 0)
      };
    });
}

function readManualMetrics(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return [];
  if (fullPath.endsWith(".json")) {
    const data = readJson(fullPath, []);
    return Array.isArray(data) ? data.map(normalizeMetricRow) : Array.isArray(data.rows) ? data.rows.map(normalizeMetricRow) : [];
  }
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(",").map((header) => header.trim()) || [];
  return lines.map((line) => {
    const values = line.split(",");
    return normalizeMetricRow(Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  });
}

function normalizeMetricRow(row) {
  return {
    date: String(row.date || ""),
    slot: String(row.slot || ""),
    published: row.published !== false,
    contentPillar: String(row.contentPillar || row.pillar || "unknown"),
    format: String(row.format || "unknown"),
    hookType: String(row.hookType || "unknown"),
    hasCta: row.hasCta === true || String(row.hasCta || "").toLowerCase() === "true",
    textLengthBand: String(row.textLengthBand || "unknown"),
    textHash: safeHash(String(row.textHash || row.postHash || row.date || "")),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    replies: Number(row.replies || 0),
    reposts: Number(row.reposts || 0),
    quotes: Number(row.quotes || 0),
    followerDelta: Number(row.followerDelta || 0)
  };
}

function mergeMetrics(published, manualMetrics) {
  const byKey = new Map(published.map((row) => [`${row.date}-${row.slot}`, row]));
  for (const metric of manualMetrics) byKey.set(`${metric.date}-${metric.slot}`, Object.assign(byKey.get(`${metric.date}-${metric.slot}`) || {}, metric));
  return [...byKey.values()];
}

function rankRows(rows) {
  return rows.slice().sort((a, b) => score(a) - score(b));
}

function score(row) {
  const engagement = Number(row.likes || 0) + Number(row.replies || 0) * 2 + Number(row.reposts || 0) * 2 + Number(row.quotes || 0) * 2;
  return Number(row.views || 0) ? engagement / Number(row.views || 1) : engagement;
}

function safeList(rows) {
  if (!rows.length) return "- no safe metric rows";
  return rows.map((row) => `- slot=${row.slot || "unknown"} pillar=${row.contentPillar || "unknown"} format=${row.format || "unknown"} hook=${row.hookType || "unknown"} cta=${Boolean(row.hasCta)} length=${row.textLengthBand || "unknown"} score=${score(row).toFixed(3)}`).join("\n");
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const current = groups.get(key) || { key, count: 0, score: 0 };
    current.count += 1;
    current.score += score(row);
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({ key: group.key, count: group.count, avgScore: group.count ? group.score / group.count : 0 }));
}

function safeGroupList(groups) {
  if (!groups.length) return "- no safe groups";
  return groups.map((group) => `- ${group.key}: count=${group.count} avgScore=${group.avgScore.toFixed(3)}`).join("\n");
}

function recommendMore(groups) {
  return groups.slice().sort((a, b) => b.avgScore - a.avgScore)[0]?.key || "common_moment";
}

function recommendLess(groups) {
  return groups.slice().sort((a, b) => a.avgScore - b.avgScore)[0]?.key || "direct_sales_cta";
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function safeHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
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
