#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LAUNCH_PATH = path.join(
  ROOT,
  "data",
  "instagram",
  "production-ready",
  "initial-launch-3-posts-2026-06-17.json",
);
const PREVIEW_PATH = path.join(ROOT, "docs", "content", "instagram-launch-3-preview.md");

if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/instagram/render-instagram-launch3-preview.mjs\nRenders a safe Markdown preview for the first three Instagram launch carousel drafts.",
  );
  process.exit(0);
}

function render(plan) {
  const lines = [
    "# Instagram Launch 3 Preview",
    "",
    "初回公開3投稿の人間レビュー用プレビューです。本番投稿は行っていません。",
    "",
    "## Summary",
    "",
    `- Brand: ${plan.brand.name}`,
    `- Handle: ${plan.brand.handle}`,
    `- Profile URL: ${plan.brand.profileUrl}`,
    `- Post count: ${plan.posts.length}`,
    `- Total slides: ${plan.posts.reduce((sum, post) => sum + Number(post.slideCount || 0), 0)}`,
    "- Publish status: draft",
    "- Approval status: needs_human_review",
    "",
  ];

  for (const post of plan.posts) {
    lines.push(
      `## ${post.publishOrder}. ${post.title}`,
      "",
      `Objective: ${post.objective}`,
      `Audience: ${post.targetAudience.join(" / ")}`,
      `Slides: ${post.slideCount}`,
      "",
      "### Slides",
    );
    for (const slide of post.slides) {
      lines.push(`- ${slide.slideNumber}. ${slide.heading} / ${slide.body.join(" / ")}`);
    }
    lines.push(
      "",
      "### Caption",
      post.caption,
      "",
      `CTA: ${post.CTA}`,
      "",
      `Hashtags: ${post.hashtags.join(" ")}`,
      "",
      "### Threads Draft",
      post.threadsDraft.text,
      "",
      "### Design",
      `- Canvas: ${post.canvasSize}`,
      `- Main colors: ${post.designTokens.background}, ${post.designTokens.paleAccent}, ${post.designTokens.primary}`,
      "- Use line or flat icons and wide margins.",
      "",
      "### Review Checklist",
    );
    for (const [key, value] of Object.entries(post.reviewChecklist)) {
      lines.push(`- ${key}: ${value}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const plan = JSON.parse(fs.readFileSync(LAUNCH_PATH, "utf8"));
fs.writeFileSync(PREVIEW_PATH, render(plan), "utf8");
console.log(JSON.stringify({
  ok: true,
  previewPath: path.relative(ROOT, PREVIEW_PATH),
  postCount: plan.posts.length,
  totalSlideCount: plan.posts.reduce((sum, post) => sum + Number(post.slideCount || 0), 0),
  livePublishExecuted: false,
}, null, 2));
