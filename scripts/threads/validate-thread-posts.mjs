#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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

const drafts = fs.statSync(fullPath).isDirectory()
  ? readJsonPlanDrafts(fullPath)
  : readMarkdownPlanDrafts(fullPath);
const duplicateCount = drafts.length - new Set(drafts).size;
const tooLongCount = drafts.filter((draft) => draft.length > MAX_LENGTH).length;
const prohibitedCount = drafts.filter((draft) =>
  PROHIBITED.some((word) => draft.includes(word)),
).length;
const emptyCount = drafts.filter((draft) => !draft).length;

const summary = {
  ok: duplicateCount === 0 && tooLongCount === 0 && prohibitedCount === 0 && emptyCount === 0,
  draftCount: drafts.length,
  duplicateCount,
  tooLongCount,
  prohibitedCount,
  emptyCount,
  maxLength: MAX_LENGTH,
};

console.log(JSON.stringify(summary));
process.exit(summary.ok ? 0 : 1);

function readMarkdownPlanDrafts(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return [...text.matchAll(/- 投稿文案:\s*(.+)/g)].map((match) => match[1].trim());
}

function readJsonPlanDrafts(dirPath) {
  const drafts = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    try {
      const plan = JSON.parse(fs.readFileSync(path.join(dirPath, entry.name), "utf8"));
      if (!Array.isArray(plan.posts)) continue;
      for (const post of plan.posts) {
        drafts.push([post.text, post.cta].filter(Boolean).join("\n\n").trim());
      }
    } catch {
      drafts.push("");
    }
  }
  return drafts;
}
