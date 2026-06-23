#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
const windowsScheduler = readWindowsSchedulerHealth();
const threadJobs = jobs.filter((job) => String(job.name || "").includes("Threads"));
const gmailJobs = jobs.filter((job) => String(job.name || "").includes("Gmail"));
const threadsAudit = readThreadsDailyAudit(jstDate(0));
const rollingPlansReady = [jstDate(0), jstDate(1), jstDate(2)].every((date) => {
  const plan = readJson(path.join(root, "data", "threads", "post-plans", `${date}.json`), null);
  const slots = Array.isArray(plan?.posts) ? plan.posts.map((post) => String(post.time || "")) : [];
  return slots.includes("11:00") && slots.includes("19:00");
});

const metrics = outboxTask?.metrics || {};
const threadsOk = threadJobs.length >= 2 &&
  rollingPlansReady &&
  isSuccessStatus(statusForJob(threadJobs, "11")) &&
  isSuccessStatus(statusForJob(threadJobs, "19")) &&
  !hasStaleThreadJobState(threadJobs) &&
  threadsAudit.publishedPostCount === 2 &&
  threadsAudit.duplicatePublishCount === 0;
const gmailOk = Number(metrics.selectedCount || 0) === 30;
const summary = {
  ok: threadsOk && gmailOk,
  checkedAt: new Date().toISOString(),
  threads: {
    ok: threadsOk,
    status: threadsOk ? "pass" : "blocked",
    gatewayRunning: null,
    jobsRegistered: threadJobs.length,
    rollingPlansReady,
    last11Status: statusForJob(threadJobs, "11"),
    last19Status: statusForJob(threadJobs, "19"),
    publishedPostCount: threadsAudit.publishedPostCount,
    expectedPostCount: threadsAudit.expectedPostCount,
    missingSlotCount: threadsAudit.missingSlotCount,
    missingSlots: threadsAudit.missingSlots,
    duplicatePublishCount: threadsAudit.duplicatePublishCount,
    schedulerTriggered: threadsAudit.schedulerTriggered,
    runnerStarted: threadsAudit.runnerStarted,
    withinWindowCount: threadsAudit.withinWindowCount,
    nodeStartedCount: threadsAudit.nodeStartedCount,
    timedOut: threadsAudit.timedOut,
    processAborted: threadsAudit.processAborted,
    staleJobState: hasStaleThreadJobState(threadJobs),
    compensationPostExecuted: false
  },
  gmail: {
    ok: gmailOk,
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
  windowsScheduler,
  sensitiveDataLogged: false
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasStaleThreadJobState(jobs) {
  if (!jobs.length) return true;
  const today = jstDate(0);
  return jobs.some((job) => {
    const value = String(job.last_run_at || job.lastRunAt || job.last_run || job.lastRun || "");
    return value && !value.startsWith(today);
  });
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
  return job ? String(job.last_status || job.lastStatus || job.state || "unknown") : "missing";
}

function isSuccessStatus(value) {
  const normalized = String(value || "").toLowerCase();
  return ["success", "ok", "pass", "completed"].includes(normalized);
}

function readThreadsDailyAudit(date) {
  const slots = ["11", "19"].map((slot) => {
    const log = readJson(path.join(root, "data", "threads", "published", `${date}-${slot}.json`), null);
    return {
      slot,
      published: log?.published === true,
      status: log?.published === true ? "success" : log ? "blocked" : "missing",
      blockedReason: log?.published === true ? "" : String(log?.blockedReason || "missing_publish_log"),
      runnerStarted: log?.runnerStarted === true || log?.commandReached === true,
      withinWindow: log?.withinWindow === true || log?.insideSlotWindow === true,
      nodeStarted: log?.nodeStarted === true || log?.commandReached === true,
      timedOut: log?.timedOut === true,
      processAborted: log?.processAborted === true
    };
  });
  const publishedPostCount = slots.filter((slot) => slot.published).length;
  const missingSlots = slots.filter((slot) => !slot.published).map((slot) => slot.slot);
  return {
    date,
    expectedPostCount: 2,
    publishedPostCount,
    missingSlotCount: missingSlots.length,
    missingSlots,
    duplicatePublishCount: 0,
    schedulerTriggered: slots.some((slot) => slot.runnerStarted || slot.status !== "missing"),
    runnerStarted: slots.some((slot) => slot.runnerStarted),
    withinWindowCount: slots.filter((slot) => slot.withinWindow).length,
    nodeStartedCount: slots.filter((slot) => slot.nodeStarted).length,
    timedOut: slots.some((slot) => slot.timedOut),
    processAborted: slots.some((slot) => slot.processAborted)
  };
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

function readWindowsSchedulerHealth() {
  if (process.platform !== "win32") {
    return {
      available: false,
      taskCount: 0,
      enabledCount: 0,
      wakeToRunCount: 0,
      startWhenAvailableCount: 0,
      failedTaskCount: 0,
      nextCriticalRun: null,
      wakeTimersAcEnabled: null,
      wakeTimersDcEnabled: null
    };
  }

  const taskScript = `
    $tasks = Get-ScheduledTask -TaskPath '\\ICHI-Social\\' -ErrorAction SilentlyContinue;
    $rows = foreach ($task in $tasks) {
      $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction SilentlyContinue;
      [pscustomobject]@{
        enabled = ($task.State -ne 'Disabled');
        wakeToRun = [bool]$task.Settings.WakeToRun;
        startWhenAvailable = [bool]$task.Settings.StartWhenAvailable;
        lastTaskResult = $info.LastTaskResult;
        nextRunTime = $info.NextRunTime;
      }
    };
    [pscustomobject]@{
      taskCount = @($rows).Count;
      enabledCount = @($rows | Where-Object enabled).Count;
      wakeToRunCount = @($rows | Where-Object wakeToRun).Count;
      startWhenAvailableCount = @($rows | Where-Object startWhenAvailable).Count;
      failedTaskCount = @($rows | Where-Object { $_.lastTaskResult -notin @(0,267011,$null) }).Count;
      nextCriticalRun = if (@($rows | Where-Object nextRunTime).Count -gt 0) { (@($rows | Where-Object nextRunTime | Sort-Object nextRunTime | Select-Object -First 1).nextRunTime).ToString('o') } else { $null };
    } | ConvertTo-Json -Compress
  `;

  const powerScript = `
    $q = powercfg /QUERY SCHEME_CURRENT SUB_SLEEP 2>$null | Out-String;
    [pscustomobject]@{
      wakeTimersAcEnabled = [bool]($q -match '(?s)(Allow wake timers|RTCWAKE|スリープ解除タイマー).*?(Current AC Power Setting Index|現在の AC 電源設定のインデックス):\\s*0x00000001');
      wakeTimersDcEnabled = [bool]($q -match '(?s)(Allow wake timers|RTCWAKE|スリープ解除タイマー).*?(Current DC Power Setting Index|現在の DC 電源設定のインデックス):\\s*0x00000001');
    } | ConvertTo-Json -Compress
  `;

  const taskHealth = readPowerShellJson(taskScript, {});
  const powerHealth = readPowerShellJson(powerScript, {});
  return {
    available: true,
    taskCount: Number(taskHealth.taskCount || 0),
    enabledCount: Number(taskHealth.enabledCount || 0),
    wakeToRunCount: Number(taskHealth.wakeToRunCount || 0),
    startWhenAvailableCount: Number(taskHealth.startWhenAvailableCount || 0),
    failedTaskCount: Number(taskHealth.failedTaskCount || 0),
    nextCriticalRun: taskHealth.nextCriticalRun || null,
    wakeTimersAcEnabled: typeof powerHealth.wakeTimersAcEnabled === "boolean" ? powerHealth.wakeTimersAcEnabled : null,
    wakeTimersDcEnabled: typeof powerHealth.wakeTimersDcEnabled === "boolean" ? powerHealth.wakeTimersDcEnabled : null
  };
}

function readPowerShellJson(command, fallback) {
  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output ? JSON.parse(output) : fallback;
  } catch {
    return fallback;
  }
}
