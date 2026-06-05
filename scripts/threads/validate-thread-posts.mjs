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

const text = fs.readFileSync(fullPath, "utf8");
const drafts = [...text.matchAll(/- 投稿文案:\s*(.+)/g)].map((match) => match[1].trim());
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
