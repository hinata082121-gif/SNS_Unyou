#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

const root = process.cwd();
const hermesRoot = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "hermes")
  : "";
const jobsPath = hermesRoot ? path.join(hermesRoot, "cron", "jobs.json") : "";
const targetDate = argValue("date", jstDate(1));
const outboxTask = readJson(path.join(root, "data", "agent-status", "tasks", `gmail-next-day-outbox-${targetDate}.json`), null);
const jobs = readHermesJobs(jobsPath);
const threadJobs = jobs.filter((job) => String(job.name || "").includes("Threads"));
const gmailJobs = jobs.filter((job) => String(job.name || "").includes("Gmail"));
const rollingPlansReady = [jstDate(0), jstDate(1), jstDate(2)].every((date) => {
  const plan = readJson(path.join(root, "data", "threads", "post-plans", `${date}.json`), null);
  const slots = Array.isArray(plan?.posts) ? plan.posts.map((post) => String(post.time || "")) : [];
  return slots.includes("11:00") && slots.includes("19:00");
});

const metrics = outboxTask?.metrics || {};
const summary = {
  ok: rollingPlansReady && Number(metrics.selectedCount || 0) === 30,
  checkedAt: new Date().toISOString(),
  threads: {
    gatewayRunning: null,
    jobsRegistered: threadJobs.length,
    rollingPlansReady,
    last11Status: statusForJob(threadJobs, "11"),
    last19Status: statusForJob(threadJobs, "19")
  },
  gmail: {
    prepJobsRegistered: gmailJobs.length >= 6,
    registeredJobCount: gmailJobs.length,
    targetDate,
    outboxCount: Number(metrics.selectedCount || 0),
    readyCount: Number(metrics.sheetReadyRowsExpected || metrics.expectedReadyRows || 0),
    preflightSafe: Boolean(metrics.preflightPassed),
    liveSendEnabled: false,
    autoSendEnabled: false,
    sheetSynced: Boolean(metrics.sheetSynced),
    manualPasteRequired: Boolean(metrics.manualPasteRequired)
  },
  sensitiveDataLogged: false
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readHermesJobs(filePath) {
  const data = readJson(filePath, null);
  if (!data) return [];
  return Array.isArray(data.jobs) ? data.jobs : Array.isArray(data) ? data : [];
}

function statusForJob(jobs, marker) {
  const job = jobs.find((item) => String(item.name || "").includes(marker));
  return job ? String(job.last_status || job.state || "unknown") : "missing";
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
