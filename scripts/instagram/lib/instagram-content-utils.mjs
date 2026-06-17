import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BRAND_PATH = path.join(ROOT, "config", "instagram", "brand.json");
const POSTS_PATH = path.join(ROOT, "data", "instagram", "drafts", "initial-12-posts-2026-06-17.json");
const REELS_PATH = path.join(ROOT, "data", "instagram", "reels", "reels-ideas-2026-06-17.json");

export function loadInstagramBrand(filePath = BRAND_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadInstagramPosts(filePath = POSTS_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadInstagramReels(filePath = REELS_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function listProhibitedMatches(text, prohibited) {
  const source = String(text || "");
  return prohibited.filter((word) => source.includes(word));
}

export function collectPostText(post) {
  return [
    post.title,
    post.objective,
    post.audiencePain,
    post.caption,
    post.firstLineHook,
    post.callToAction,
    post.threadsCrossPost,
    ...(Array.isArray(post.slides) ? post.slides.flatMap((slide) => [
      slide.heading,
      slide.body,
      slide.accessibilityText
    ]) : [])
  ].filter(Boolean).join("\n");
}

export function countDuplicateIds(items) {
  const ids = items.map((item) => item.id).filter(Boolean);
  return ids.length - new Set(ids).size;
}

export function summarizeByFormat(posts) {
  return posts.reduce((acc, post) => {
    const key = post.format || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
