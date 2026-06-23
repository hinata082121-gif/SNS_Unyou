#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { hasInstagramDestination, loadThreadsBrandConfig } from "./lib/threads-brand.mjs";
import { validateThreadsMedia } from "./lib/media-validation.mjs";

const DEFAULT_PLAN = "docs/threads/post-plans/threads-post-plan-2026-06-week1.md";
const MAX_LENGTH = 500;
const MIN_BANK_COUNT_PER_SLOT = 30;
const PROHIBITED = ["必ず", "絶対", "売上保証", "確実に増える", "誰でも稼げる"];
const STIFF_PHRASES = ["無料で確認します", "一緒に整理できます", "相談できます", "改善しやすいです", "進みやすくなります"];
const SALES_PHRASES = ["無料診断", "無料チェック", "申し込み", "相談", "DMで", "プロフィールから"];
const QUESTION_WORDS = ["どこ", "何", "どちら", "ありますか", "ですか"];

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/validate-thread-posts.mjs [planFile]\nValidates Threads post drafts without publishing or printing post text/secrets.");
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
const emptyCount = drafts.filter((draft) => !draft).length;
const prohibitedCount = drafts.filter((draft) => PROHIBITED.some((word) => draft.includes(word))).length;
const hookMissingCount = planRecords.filter((record) => !hookPresent(record.text)).length;
const conversationalToneCount = planRecords.filter((record) => conversationalTone(record.text)).length;
const excessivePolitenessCount = countPhraseHits(drafts, STIFF_PHRASES);
const salesLanguageCount = countPhraseHits(drafts, SALES_PHRASES);
const repeatedOpeningCount = countRepeatedOpenings(planRecords);
const repeatedThemeCount = countRepeatedThemes(planRecords);
const specificQuestionCount = planRecords.filter((record) => questionSpecificity(record.text)).length;
const standaloneValueCount = planRecords.filter((record) => standaloneValue(record.text)).length;
const ctaCount = planRecords.filter((record) => record.cta).length;
const directSalesCtaCount = planRecords.filter((record) => /無料診断|無料チェック|相談|DM/i.test(record.cta)).length;
const ctaRatio = planRecords.length ? ctaCount / planRecords.length : 0;
const directSalesCtaRatio = planRecords.length ? directSalesCtaCount / planRecords.length : 0;
const lengthBand = countLengthBand(drafts);
const consecutiveSameCtaCount = countConsecutiveSameCta(planRecords);
const sevenDayRepeatCount = countSevenDayRepeats(planRecords);
const bankCounts = countSlots(planRecords);
const mediaValidation = await validatePlanMedia(planRecords);
const brand = loadThreadsBrandConfig();
const instagramConfigured = hasInstagramDestination(brand);
const instagramCtaCount = planRecords.filter((record) => record.hasInstagramCta).length;
const instagramCtaNeedsReviewCount = instagramConfigured ? 0 : instagramCtaCount;
const ctaRatioOk = planRecords.length < 14 ? ctaRatio <= 0.5 : ctaRatio <= 2 / 14;
const directSalesCtaRatioOk = planRecords.length < 14 ? directSalesCtaRatio <= 0.25 : directSalesCtaRatio <= 1 / 14;
const modernQualityRequired = planRecords.some((record) => record.pillar || record.hookType);
const bankSizeOk = isContentBankPath(fullPath)
  ? bankCounts.morning >= MIN_BANK_COUNT_PER_SLOT && bankCounts.evening >= MIN_BANK_COUNT_PER_SLOT
  : true;

const summary = {
  ok: duplicateCount === 0 &&
    tooLongCount === 0 &&
    prohibitedCount === 0 &&
    emptyCount === 0 &&
    instagramCtaNeedsReviewCount === 0 &&
    consecutiveSameCtaCount === 0 &&
    (!modernQualityRequired || repeatedOpeningCount === 0) &&
    (!modernQualityRequired || repeatedThemeCount === 0) &&
    sevenDayRepeatCount === 0 &&
    (!modernQualityRequired || hookMissingCount === 0) &&
    (!modernQualityRequired || excessivePolitenessCount <= 2) &&
    (!modernQualityRequired || salesLanguageCount <= Math.max(2, Math.floor(planRecords.length * 0.15))) &&
    (!modernQualityRequired || ctaRatioOk) &&
    (!modernQualityRequired || directSalesCtaRatioOk) &&
    bankSizeOk &&
    mediaValidation.errorCount === 0,
  draftCount: drafts.length,
  duplicateCount,
  tooLongCount,
  prohibitedCount,
  emptyCount,
  hookPresent: hookMissingCount === 0,
  hookMissingCount,
  conversationalTone: conversationalToneCount,
  excessivePolitenessCount,
  salesLanguageCount,
  repeatedOpeningCount,
  repeatedThemeCount,
  questionSpecificity: specificQuestionCount,
  standaloneValue: standaloneValueCount,
  ctaRatio: Number(ctaRatio.toFixed(3)),
  directSalesCtaRatio: Number(directSalesCtaRatio.toFixed(3)),
  lengthBand,
  morningBankCount: bankCounts.morning,
  eveningBankCount: bankCounts.evening,
  sevenDayRepeatCount,
  instagramConfigured,
  instagramCtaCount,
  instagramCtaNeedsReviewCount,
  consecutiveSameCtaCount,
  mediaPostCount: mediaValidation.mediaPostCount,
  mediaValidationErrorCount: mediaValidation.errorCount,
  maxLength: MAX_LENGTH,
  personalDataLogged: false,
  tokenLogged: false
};

console.log(JSON.stringify(summary));
process.exit(summary.ok ? 0 : 1);

function readMarkdownPlanDrafts(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return [...text.matchAll(/- 投稿文案:\s*(.+)/g)].map((match) => ({
    text: match[1].trim(),
    cta: "",
    date: "",
    time: "",
    theme: "",
    pillar: "",
    hookType: "",
    hasInstagramCta: false,
    media: { type: "none", items: [] }
  }));
}

function readJsonPlanDrafts(dirPath) {
  const drafts = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    try {
      const date = entry.name.slice(0, 10);
      if (date < jstDate(0)) continue;
      const plan = JSON.parse(fs.readFileSync(path.join(dirPath, entry.name), "utf8"));
      if (!Array.isArray(plan.posts)) continue;
      for (const post of plan.posts) {
        const cta = String(post.cta || "").trim();
        drafts.push({
          text: [post.text, cta].filter(Boolean).join("\n\n").trim(),
          cta,
          date,
          time: String(post.time || ""),
          theme: String(post.theme || post.pillar || ""),
          pillar: String(post.pillar || ""),
          hookType: String(post.hookType || ""),
          hasInstagramCta: /Instagram/i.test(cta),
          media: post.media || { type: "none", items: [] }
        });
      }
    } catch {
      drafts.push({ text: "", cta: "", date: "", time: "", theme: "", pillar: "", hookType: "", hasInstagramCta: false, media: { type: "none", items: [] } });
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

function hookPresent(text) {
  const first = firstLine(text);
  return first.length >= 8 && first.length <= 35 && !/^SNSを整える時は/.test(first);
}

function conversationalTone(text) {
  return /あります|ですよね|大丈夫|思います|かもしれません|見たい|しんどい|もったいない/.test(text);
}

function questionSpecificity(text) {
  if (!text.includes("？") && !text.includes("?") && !text.includes("ですか")) return false;
  return QUESTION_WORDS.some((word) => text.includes(word));
}

function standaloneValue(text) {
  return text.length >= 45 && !/^詳しくは|無料診断|プロフィール/.test(text);
}

function countPhraseHits(texts, phrases) {
  return texts.reduce((count, text) => count + phrases.filter((phrase) => text.includes(phrase)).length, 0);
}

function countRepeatedOpenings(records) {
  let count = 0;
  let last = "";
  for (const record of records) {
    const opening = firstLine(record.text).slice(0, 12);
    if (opening && opening === last) count += 1;
    last = opening;
  }
  return count;
}

function countRepeatedThemes(records) {
  let count = 0;
  let last = "";
  for (const record of records) {
    const theme = String(record.theme || "").trim();
    if (theme && theme === last) count += 1;
    if (theme) last = theme;
  }
  return count;
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

function countSevenDayRepeats(records) {
  let count = 0;
  for (let index = 7; index < records.length; index += 1) {
    if (records[index].text && records[index].text === records[index - 7].text) count += 1;
  }
  return count;
}

function countLengthBand(texts) {
  return {
    under70: texts.filter((text) => text.length > 0 && text.length < 70).length,
    target70To180: texts.filter((text) => text.length >= 70 && text.length <= 180).length,
    over180: texts.filter((text) => text.length > 180 && text.length <= MAX_LENGTH).length
  };
}

function countSlots(records) {
  return {
    morning: records.filter((record) => normalizeSlot(record.time) === "11").length,
    evening: records.filter((record) => normalizeSlot(record.time) === "19").length
  };
}

function normalizeSlot(value) {
  const match = String(value || "").match(/^(\d{1,2})(?::00)?$/);
  return match ? match[1].padStart(2, "0") : "";
}

function firstLine(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function isContentBankPath(filePath) {
  return /threads-post-bank|post-bank|content-bank/i.test(filePath);
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
