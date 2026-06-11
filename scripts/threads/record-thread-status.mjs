#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

function showHelp() {
  console.log(`Usage: node scripts/threads/record-thread-status.mjs --slot 11|19|weekly --status scheduled|blocked|needs_review|success\n\nWrites safe Agent Status JSON for Threads automation. Does not publish.`);
}

if (process.argv.includes("--help")) {
  showHelp();
  process.exit(0);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const slot = argValue("slot", "setup");
const status = argValue("status", "scheduled");
const now = new Date().toISOString();
const id = `threads-${slot}-status-${now.slice(0, 10)}`;
const task = {
  id,
  agent: "Hermes",
  avatar: "ops-monitor",
  title: slot === "weekly" ? "Threads週次バズ分析" : `Threads ${slot}:00 投稿`,
  category: slot === "weekly" ? "threads_weekly_analysis" : "threads_daily_post",
  status,
  phase: "Threads安全記録",
  progress: status === "success" ? 100 : 70,
  priority: "high",
  createdAt: now,
  updatedAt: now,
  summary: "Threads運用の安全な状態だけをAgent Officeへ記録する。",
  metrics: {
    publishEnabled: process.env.THREADS_PUBLISH_ENABLED === "true",
    dryRun: process.env.THREADS_DRY_RUN !== "false",
    autoReplyEnabled: false,
    autoLikeEnabled: false,
    autoFollowEnabled: false,
  },
  nextAction: "Threads API設定とdry-run検証後に投稿自動化へ進む。",
  safeToAct: true,
  notes: [
    "投稿本文やAPIトークンは表示しない",
    "自動返信/自動いいね/自動フォローなし",
  ],
  artifacts: [],
};

const outDir = path.join(process.cwd(), "data", "agent-status", "tasks");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${id}.json`);
fs.writeFileSync(outFile, `${JSON.stringify(task, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, file: path.relative(process.cwd(), outFile) }));
