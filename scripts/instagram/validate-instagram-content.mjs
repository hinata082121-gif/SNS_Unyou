#!/usr/bin/env node
import {
  collectPostText,
  countDuplicateIds,
  listProhibitedMatches,
  loadInstagramBrand,
  loadInstagramPosts,
  loadInstagramReels,
  summarizeByFormat
} from "./lib/instagram-content-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/validate-instagram-content.mjs\nValidates safe Instagram draft content without publishing.");
  process.exit(0);
}

const brand = loadInstagramBrand();
const postPlan = loadInstagramPosts();
const reelsPlan = loadInstagramReels();
const posts = Array.isArray(postPlan.posts) ? postPlan.posts : [];
const reels = Array.isArray(reelsPlan.ideas) ? reelsPlan.ideas : [];
const prohibited = Array.isArray(brand.prohibited) ? brand.prohibited : [];

let captionEmptyCount = 0;
let slideCountMismatchCount = 0;
let altTextEmptyCount = 0;
let prohibitedExpressionCount = 0;
let nonDraftPublishStatusCount = 0;
let threadsHandleMismatchCount = 0;
let invalidBrandLinkCount = 0;
let carouselCount = 0;
let postMissingRequiredFieldCount = 0;
let mediaItemCountMismatchCount = 0;

const requiredPostFields = [
  "id",
  "title",
  "objective",
  "audiencePain",
  "contentPillar",
  "format",
  "slideCount",
  "slides",
  "caption",
  "firstLineHook",
  "callToAction",
  "hashtags",
  "threadsCrossPost",
  "threadsCtaAllowed",
  "media",
  "mediaStatus",
  "reviewStatus",
  "publishStatus"
];

for (const post of posts) {
  for (const field of requiredPostFields) {
    if (!(field in post)) postMissingRequiredFieldCount += 1;
  }
  if (!String(post.caption || "").trim()) captionEmptyCount += 1;
  if (post.publishStatus !== "draft") nonDraftPublishStatusCount += 1;
  if (post.format === "carousel") carouselCount += 1;
  if (!Array.isArray(post.slides) || post.slides.length !== Number(post.slideCount)) slideCountMismatchCount += 1;
  if (!post.media || !Array.isArray(post.media.items) || post.media.items.length !== Number(post.slideCount)) {
    mediaItemCountMismatchCount += 1;
  }
  for (const slide of Array.isArray(post.slides) ? post.slides : []) {
    if (!String(slide.accessibilityText || "").trim()) altTextEmptyCount += 1;
  }
  for (const item of Array.isArray(post.media?.items) ? post.media.items : []) {
    if (!String(item.altText || "").trim()) altTextEmptyCount += 1;
  }
  prohibitedExpressionCount += listProhibitedMatches(collectPostText(post), prohibited).length;
  if (post.threadsCtaAllowed && !String(post.threadsCrossPost || "").includes(brand.handle)) {
    threadsHandleMismatchCount += 1;
  }
}

let reelsMissingRequiredFieldCount = 0;
let reelsNonDraftCount = 0;
const requiredReelFields = [
  "id",
  "title",
  "duration",
  "hook",
  "sceneList",
  "onScreenText",
  "narration",
  "requiredAssets",
  "caption",
  "CTA",
  "bgmPolicy",
  "noFaceRequired",
  "screenRecordingRequired",
  "publishStatus"
];
for (const reel of reels) {
  for (const field of requiredReelFields) {
    if (!(field in reel)) reelsMissingRequiredFieldCount += 1;
  }
  if (reel.publishStatus !== "draft") reelsNonDraftCount += 1;
  prohibitedExpressionCount += listProhibitedMatches([
    reel.title,
    reel.hook,
    reel.narration,
    reel.caption,
    reel.CTA
  ].join("\n"), prohibited).length;
}

if (brand.handle !== "@ichi_social") invalidBrandLinkCount += 1;
if (brand.profileUrl !== "https://www.instagram.com/ichi_social/") invalidBrandLinkCount += 1;

const summary = {
  ok: posts.length === 12 &&
    reels.length === 6 &&
    countDuplicateIds(posts) === 0 &&
    countDuplicateIds(reels) === 0 &&
    carouselCount >= 8 &&
    captionEmptyCount === 0 &&
    slideCountMismatchCount === 0 &&
    altTextEmptyCount === 0 &&
    prohibitedExpressionCount === 0 &&
    nonDraftPublishStatusCount === 0 &&
    postMissingRequiredFieldCount === 0 &&
    reelsMissingRequiredFieldCount === 0 &&
    reelsNonDraftCount === 0 &&
    threadsHandleMismatchCount === 0 &&
    invalidBrandLinkCount === 0 &&
    mediaItemCountMismatchCount === 0,
  brandHandle: brand.handle,
  profileUrl: brand.profileUrl,
  postCount: posts.length,
  reelsIdeaCount: reels.length,
  carouselCount,
  duplicatePostIdCount: countDuplicateIds(posts),
  duplicateReelIdCount: countDuplicateIds(reels),
  captionEmptyCount,
  slideCountMismatchCount,
  altTextEmptyCount,
  prohibitedExpressionCount,
  nonDraftPublishStatusCount,
  postMissingRequiredFieldCount,
  reelsMissingRequiredFieldCount,
  reelsNonDraftCount,
  mediaItemCountMismatchCount,
  threadsHandleMismatchCount,
  invalidBrandLinkCount,
  formatBreakdown: summarizeByFormat(posts),
  livePublishExecuted: false
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
