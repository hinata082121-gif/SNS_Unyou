#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { hasInstagramDestination, loadThreadsBrandConfig } from "./lib/threads-brand.mjs";
import { validateThreadsMedia } from "./lib/media-validation.mjs";

const DEFAULT_PLAN = "docs/threads/post-plans/threads-post-plan-2026-06-week1.md";
const MAX_LENGTH = 500;
const PROHIBITED = [
  "必ず",
  "絶対",
  "売上保証",
  "確実に増える",
  "誰でも稼げる",
];

function showHelp() {
  console.log(`Usage: node scripts/threads/validate-thread-posts.mjs [planFile]\n\nValidates Threads post drafts without publishing or printing secrets.`);
}

if (process.argv.includes("--help")) {
  showHelp();
  process.exit(0);
}

const planFile = process.argv[2] || DEFAULT_PLAN;
const fullPath = path.resolve(process.cwd(), planFile);

if (!fs.existsSync(fullPath)) {
  console.error(JSON.stringify({ ok: false, reason: "plan_file_not_found" }));
  process.exit(1);
}

const planRecords = fs.statSync(fullPath).isDirectory()
  ? readJsonPlanDrafts(fullPath)
  : readMarkdownPlanDrafts(fullPath);
const drafts = planRecords.map((record) => record.text);
const duplicateCount = drafts.length - new Set(drafts).size;
const tooLongCount = drafts.filter((draft) => draft.length > MAX_LENGTH).length;
const prohibitedCount = drafts.filter((draft) =>
  PROHIBITED.some((word) => draft.includes(word)),
).length;
const emptyCount = drafts.filter((draft) => !draft).length;
const brand = loadThreadsBrandConfig();
const instagramConfigured = hasInstagramDestination(brand);
const instagramCtaCount = planRecords.filter((record) => record.hasInstagramCta).length;
const instagramCtaNeedsReviewCount = instagramConfigured ? 0 : instagramCtaCount;
const consecutiveSameCtaCount = countConsecutiveSameCta(planRecords);
const mediaValidation = await validatePlanMedia(planRecords);

const summary = {
  ok: duplicateCount === 0 &&
    tooLongCount === 0 &&
    prohibitedCount === 0 &&
    emptyCount === 0 &&
    instagramCtaNeedsReviewCount === 0 &&
    consecutiveSameCtaCount === 0 &&
    mediaValidation.errorCount === 0,
  draftCount: drafts.length,
  duplicateCount,
  tooLongCount,
  prohibitedCount,
  emptyCount,
  instagramConfigured,
  instagramCtaCount,
  instagramCtaNeedsReviewCount,
  consecutiveSameCtaCount,
  mediaPostCount: mediaValidation.mediaPostCount,
  mediaValidationErrorCount: mediaValidation.errorCount,
  maxLength: MAX_LENGTH,
};

console.log(JSON.stringify(summary));
process.exit(summary.ok ? 0 : 1);

function readMarkdownPlanDrafts(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return [...text.matchAll(/- 投稿文案:\s*(.+)/g)].map((match) => ({
    text: match[1].trim(),
    cta: "",
    hasInstagramCta: false,
    media: { type: "none", items: [] }
  }));
}

function readJsonPlanDrafts(dirPath) {
  const drafts = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    try {
      const plan = JSON.parse(fs.readFileSync(path.join(dirPath, entry.name), "utf8"));
      if (!Array.isArray(plan.posts)) continue;
      for (const post of plan.posts) {
        const cta = String(post.cta || "").trim();
        drafts.push({
          text: [post.text, cta].filter(Boolean).join("\n\n").trim(),
          cta,
          hasInstagramCta: /Instagram/i.test(cta),
          media: post.media || { type: "none", items: [] }
        });
      }
    } catch {
      drafts.push({ text: "", cta: "", hasInstagramCta: false, media: { type: "none", items: [] } });
    }
  }
  return drafts;
}

async function validatePlanMedia(records) {
  let mediaPostCount = 0;
  let errorCount = 0;
  for (const record of records) {
    const validation = await validateThreadsMedia(record.media, { network: false });
    if (validation.media.type !== "none") mediaPostCount += 1;
    errorCount += validation.errors.length;
  }
  return { mediaPostCount, errorCount };
}

function countConsecutiveSameCta(records) {
  let count = 0;
  let last = "";
  for (const record of records) {
    const cta = String(record.cta || "").trim();
    if (cta && cta === last) count += 1;
    if (cta) last = cta;
  }
  return count;
}
