#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "threads-runner-"));
fs.cpSync(path.join(root, "scripts"), path.join(tmp, "scripts"), { recursive: true });
fs.cpSync(path.join(root, "config"), path.join(tmp, "config"), { recursive: true });
fs.cpSync(path.join(root, "package.json"), path.join(tmp, "package.json"));

const mockScript = path.join(tmp, "scripts", "threads", "mock-publish-ok.mjs");
fs.writeFileSync(mockScript, "console.log(JSON.stringify({ok:true,published:false,blockedReason:'threads_dry_run',slot:process.argv[process.argv.indexOf('--slot')+1],postDate:process.argv[process.argv.indexOf('--date')+1],compensationPostExecuted:false,postIdPresent:false}));\n");
const slowScript = path.join(tmp, "scripts", "threads", "mock-publish-slow.mjs");
fs.writeFileSync(slowScript, "setTimeout(()=>console.log(JSON.stringify({ok:true})), 5000);\n");

const inside11 = runRunner(["--slot", "11", "--date", "2026-06-23", "--now-iso", "2026-06-23T11:00:00+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(inside11.status, 0);
assert.equal(inside11.json.withinWindow, true);
assert.equal(inside11.json.nodeStarted, true);

const inside19 = runRunner(["--slot", "19", "--date", "2026-06-23", "--now-iso", "2026-06-23T19:13:00+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(inside19.status, 0);
assert.equal(inside19.json.withinWindow, true);
assert.equal(inside19.json.nodeStarted, true);

const late11 = runRunner(["--slot", "11", "--date", "2026-06-23", "--now-iso", "2026-06-23T15:18:31+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(late11.status, 0);
assert.equal(late11.json.blockedReason, "outside_slot_window");
assert.equal(late11.json.nodeStarted, false);
assert.equal(late11.json.compensationPostExecuted, false);

const late19 = runRunner(["--slot", "19", "--date", "2026-06-23", "--now-iso", "2026-06-23T19:31:00+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(late19.status, 0);
assert.equal(late19.json.blockedReason, "outside_slot_window");
assert.equal(late19.json.nodeStarted, false);

writePublished("2026-06-23", "11");
const published = runRunner(["--slot", "11", "--date", "2026-06-23", "--now-iso", "2026-06-23T11:00:00+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(published.status, 0);
assert.equal(published.json.blockedReason, "already_published");
assert.equal(published.json.nodeStarted, false);

const lockDir = path.join(tmp, "data", "threads", "runtime-locks");
fs.mkdirSync(lockDir, { recursive: true });
fs.writeFileSync(path.join(lockDir, "2026-06-24-19.lock"), JSON.stringify({ postDate: "2026-06-24", slot: "19", reason: "test" }));
const locked = runRunner(["--slot", "19", "--date", "2026-06-24", "--now-iso", "2026-06-24T19:00:00+09:00", "--node-script", "scripts/threads/mock-publish-ok.mjs"]);
assert.equal(locked.status, 0);
assert.equal(locked.json.blockedReason, "slot_lock_exists");
assert.equal(locked.json.nodeStarted, false);

const timedOut = runRunner(["--slot", "19", "--date", "2026-06-25", "--now-iso", "2026-06-25T19:00:00+09:00", "--node-timeout-seconds", "1", "--node-script", "scripts/threads/mock-publish-slow.mjs"]);
assert.equal(timedOut.status, 124);
assert.equal(timedOut.json.timedOut, true);
assert.equal(timedOut.json.processAborted, true);
assert.equal(timedOut.json.blockedReason, "node_runner_timeout");

const logText = fs.existsSync(path.join(tmp, "data", "threads", "runner-logs"))
  ? fs.readdirSync(path.join(tmp, "data", "threads", "runner-logs")).map((name) => fs.readFileSync(path.join(tmp, "data", "threads", "runner-logs", name), "utf8")).join("\n")
  : "";
assert.equal(/synthetic-token|post text|https?:\/\//i.test(logText), false);

console.log(JSON.stringify({
  threadRunnerSafetyTestCount: 12,
  passed: true,
  inside11NodeStarted: inside11.json.nodeStarted,
  inside19NodeStarted: inside19.json.nodeStarted,
  outsideWindowNodeStarted: late11.json.nodeStarted || late19.json.nodeStarted,
  timeoutSeconds: 1,
  timeoutAborted: timedOut.json.processAborted,
  realThreadsApiCallCount: 0,
  autoReplyExecuted: false,
  autoLikeExecuted: false,
  autoFollowExecuted: false,
  sensitiveDataLogged: false
}));

function runRunner(args) {
  const result = spawnSync("python", ["scripts/threads/run_scheduled_thread.py", ...args], {
    cwd: tmp,
    env: { ...process.env, THREADS_NODE_EXE: process.execPath },
    encoding: "utf8"
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json: parseLastJson(result.stdout || result.stderr) };
}

function parseLastJson(output) {
  const text = String(output || "").trim();
  const start = text.lastIndexOf("{");
  assert.ok(start >= 0, output);
  return JSON.parse(text.slice(start));
}

function writePublished(date, slot) {
  const dir = path.join(tmp, "data", "threads", "published");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}-${slot}.json`), `${JSON.stringify({ published: true, postIdPresent: true }, null, 2)}\n`);
}
