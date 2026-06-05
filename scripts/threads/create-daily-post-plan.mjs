#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/create-daily-post-plan.mjs [YYYY-MM-DD]\nCreates a safe local Threads post plan JSON without secrets.");
  process.exit(0);
}

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const posts = [
  {
    date,
    time: "11:00",
    theme: "SNS導線改善",
    text: "投稿を増やす前に、プロフィールで何を頼めてどう予約するかが伝わるかを見るのがおすすめです。",
    cta: "気になる方は無料SNS診断へ。",
  },
  {
    date,
    time: "19:00",
    theme: "共感と無料診断導線",
    text: "SNSを頑張っているのに問い合わせにつながらない時は、投稿数より入口と予約導線を整える方が先かもしれません。",
    cta: "導線だけ無料で確認できます。",
  },
];

const outDir = path.join(process.cwd(), "data", "threads", "post-plans");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${date}.json`);
fs.writeFileSync(outFile, `${JSON.stringify({ date, posts }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, postCount: posts.length, file: path.relative(process.cwd(), outFile) }));
