#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/weekly-viral-analysis.mjs\nCreates a safe weekly analysis placeholder. Does not scrape, login, like, follow, or repost.");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(process.cwd(), "docs", "threads", "weekly-analysis");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `threads-weekly-analysis-${today}.md`);
const body = `# Threads週次分析 ${today}\n\n## 状態\n\n初期雛形です。公開情報の安全な範囲で、伸びた投稿の構造、冒頭文、CTA、テーマを分析します。\n\n## 禁止\n\n- 無断転載しない\n- 本文丸コピーしない\n- 自動返信/いいね/フォローしない\n- トークンや秘密情報を表示しない\n`;
fs.writeFileSync(outFile, body);
console.log(JSON.stringify({ ok: true, file: path.relative(process.cwd(), outFile) }));
