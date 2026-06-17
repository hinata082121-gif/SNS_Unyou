#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  collectPostText,
  countDuplicateIds,
  listProhibitedMatches,
  loadInstagramBrand,
} from "./lib/instagram-content-utils.mjs";

const ROOT = process.cwd();
const LAUNCH_PATH = path.join(
  ROOT,
  "data",
  "instagram",
  "production-ready",
  "initial-launch-3-posts-2026-06-17.json",
);

if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/instagram/validate-instagram-launch3.mjs\nValidates the first three Instagram launch carousel drafts without publishing.",
  );
  process.exit(0);
}

function loadLaunchPlan() {
  return JSON.parse(fs.readFileSync(LAUNCH_PATH, "utf8"));
}

const claimPatterns = [
  /実績[0-9０-９]/,
  /売上.*(保証|確約|倍)/,
  /誰でも稼げる/,
  /放置で成功/,
  /お客様の声/,
  /レビュー/,
];

const brand = loadInstagramBrand();
const plan = loadLaunchPlan();
const posts = Array.isArray(plan.posts) ? plan.posts : [];
const prohibited = Array.isArray(brand.prohibited) ? brand.prohibited : [];

let slideCountMismatchCount = 0;
let missingHeadingCount = 0;
let missingAltTextCount = 0;
let missingCaptionCount = 0;
let missingCtaCount = 0;
let prohibitedExpressionCount = 0;
let unsupportedClaimCount = 0;
let nonDraftPublishStatusCount = 0;
let nonReviewApprovalStatusCount = 0;
let handleMismatchCount = 0;
let profileUrlMismatchCount = 0;
let threadsLivePostCount = 0;
let imagePromptTextRiskCount = 0;

for (const post of posts) {
  if (!Array.isArray(post.slides) || post.slides.length !== Number(post.slideCount)) {
    slideCountMismatchCount += 1;
  }
  for (const slide of Array.isArray(post.slides) ? post.slides : []) {
    if (!String(slide.heading || "").trim()) missingHeadingCount += 1;
    if (!String(slide.accessibilityText || "").trim()) missingAltTextCount += 1;
  }
  if (!Array.isArray(post.altTexts) || post.altTexts.length !== Number(post.slideCount)) {
    missingAltTextCount += 1;
  }
  if (!String(post.caption || "").trim()) missingCaptionCount += 1;
  if (!String(post.CTA || "").trim()) missingCtaCount += 1;
  if (post.publishStatus !== "draft") nonDraftPublishStatusCount += 1;
  if (post.approvalStatus !== "needs_human_review") nonReviewApprovalStatusCount += 1;
  if (!String(post.threadsDraft?.text || "").includes(brand.handle)) handleMismatchCount += 1;
  if (post.threadsDraft?.publishStatus !== "draft") threadsLivePostCount += 1;

  const combined = collectPostText({
    ...post,
    callToAction: post.CTA,
    threadsCrossPost: post.threadsDraft?.text,
  });
  prohibitedExpressionCount += listProhibitedMatches(combined, prohibited).length;
  unsupportedClaimCount += claimPatterns.filter((pattern) => pattern.test(combined)).length;

  for (const prompt of post.imageGenerationInstructions?.prompts || []) {
    const text = String(prompt.prompt || "").toLowerCase();
    if (!text.includes("no text") || !text.includes("no logo") || !text.includes("no watermark")) {
      imagePromptTextRiskCount += 1;
    }
  }
}

if (brand.handle !== "@ichi_social") handleMismatchCount += 1;
if (brand.profileUrl !== "https://www.instagram.com/ichi_social/") profileUrlMismatchCount += 1;
if (plan.brand?.handle !== brand.handle) handleMismatchCount += 1;
if (plan.brand?.profileUrl !== brand.profileUrl) profileUrlMismatchCount += 1;

const publishOrders = posts.map((post) => post.publishOrder).sort((a, b) => a - b);
const publishOrderMatched = JSON.stringify(publishOrders) === JSON.stringify([1, 2, 3]);

const summary = {
  ok:
    posts.length === 3 &&
    publishOrderMatched &&
    countDuplicateIds(posts) === 0 &&
    slideCountMismatchCount === 0 &&
    missingHeadingCount === 0 &&
    missingAltTextCount === 0 &&
    missingCaptionCount === 0 &&
    missingCtaCount === 0 &&
    prohibitedExpressionCount === 0 &&
    unsupportedClaimCount === 0 &&
    nonDraftPublishStatusCount === 0 &&
    nonReviewApprovalStatusCount === 0 &&
    handleMismatchCount === 0 &&
    profileUrlMismatchCount === 0 &&
    threadsLivePostCount === 0 &&
    imagePromptTextRiskCount === 0 &&
    plan.livePublishExecuted === false &&
    plan.threadsLivePostExecuted === false &&
    plan.gmailSendExecuted === false &&
    plan.googleSheetsUpdated === false,
  brandHandle: brand.handle,
  profileUrl: brand.profileUrl,
  postCount: posts.length,
  totalSlideCount: posts.reduce((sum, post) => sum + Number(post.slideCount || 0), 0),
  duplicatePostIdCount: countDuplicateIds(posts),
  publishOrderMatched,
  slideCountMismatchCount,
  missingHeadingCount,
  missingAltTextCount,
  missingCaptionCount,
  missingCtaCount,
  prohibitedExpressionCount,
  unsupportedClaimCount,
  nonDraftPublishStatusCount,
  nonReviewApprovalStatusCount,
  handleMismatchCount,
  profileUrlMismatchCount,
  threadsLivePostCount,
  imagePromptTextRiskCount,
  livePublishExecuted: plan.livePublishExecuted,
  threadsLivePostExecuted: plan.threadsLivePostExecuted,
  gmailSendExecuted: plan.gmailSendExecuted,
  googleSheetsUpdated: plan.googleSheetsUpdated,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
