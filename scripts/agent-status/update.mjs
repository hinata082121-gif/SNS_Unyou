import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, "data", "agent-status", "tasks");

const STATUS_VALUES = new Set([
  "queued",
  "running",
  "checking",
  "success",
  "partial",
  "blocked",
  "failed",
  "skipped",
  "needs_review",
  "synced",
]);

const AGENT_VALUES = new Set(["Codex", "Hermes", "System", "Human"]);

const AVATARS = new Set([
  "codex-engineer",
  "hermes-scheduler",
  "sales-scout",
  "sheets-clerk",
  "ops-monitor",
  "pr-writer",
]);

const SECRET_PATTERN =
  /(SECRET_TOKEN|SHEETS_SECRET_TOKEN|SHEETS_WEBHOOK_URL|api[_ -]?key|OAuth|token=|password|Cookie|Authorization|Bearer|Gmail app password)/i;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    if (key === "artifact" || key === "note") {
      args[key] = [...(args[key] || []), value];
    } else if (key === "metric") {
      args.metrics = args.metrics || {};
      const [metricKey, ...metricValueParts] = value.split("=");
      if (!metricKey || metricValueParts.length === 0) {
        throw new Error("--metric must use key=value format");
      }
      args.metrics[metricKey] = parseMetricValue(metricValueParts.join("="));
    } else {
      args[key] = value;
    }
  }
  return args;
}

function parseMetricValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
}

function assertSafeText(label, value) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    if (typeof item === "string" && SECRET_PATTERN.test(item)) {
      throw new Error(`Refusing to save possible secret in ${label}`);
    }
  }
}

function requireValue(args, key) {
  if (!args[key]) throw new Error(`Missing required --${key}`);
}

function taskPath(id) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
    throw new Error("Task id must use letters, numbers, dots, underscores, or hyphens");
  }
  return path.join(TASK_DIR, `${id}.json`);
}

function readExisting(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateTask(task) {
  for (const key of ["id", "agent", "avatar", "title", "category", "status", "phase", "progress", "priority", "summary", "artifacts", "nextAction", "safeToAct", "notes"]) {
    if (!(key in task)) throw new Error(`Missing required key: ${key}`);
  }
  if (!STATUS_VALUES.has(task.status)) throw new Error(`Invalid status: ${task.status}`);
  if (!AGENT_VALUES.has(task.agent)) throw new Error(`Invalid agent: ${task.agent}`);
  if (!AVATARS.has(task.avatar)) throw new Error(`Invalid avatar: ${task.avatar}`);
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) {
    throw new Error("progress must be an integer from 0 to 100");
  }
  if (!Array.isArray(task.artifacts)) throw new Error("artifacts must be an array");
  if (!Array.isArray(task.notes)) throw new Error("notes must be an array");
  assertSafeText("summary", task.summary);
  assertSafeText("artifacts", task.artifacts);
  assertSafeText("notes", task.notes);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ["id", "agent", "avatar", "title", "status"]) {
    requireValue(args, key);
  }

  const now = new Date().toISOString();
  fs.mkdirSync(TASK_DIR, { recursive: true });
  const filePath = taskPath(args.id);
  const existing = readExisting(filePath);

  const artifacts = args.artifact
    ? Array.from(new Set([...(existing.artifacts || []), ...args.artifact]))
    : existing.artifacts || [];
  const notes = args.note
    ? Array.from(new Set([...(existing.notes || []), ...args.note]))
    : existing.notes || [];

  const nextTask = {
    id: args.id,
    agent: args.agent,
    avatar: args.avatar,
    title: args.title,
    category: args.category || existing.category || "ops",
    status: args.status,
    phase: args.phase || existing.phase || "未設定",
    progress: args.progress !== undefined ? Number(args.progress) : existing.progress ?? 0,
    priority: args.priority || existing.priority || "normal",
    createdAt: existing.createdAt || now,
    startedAt: args.startedAt || existing.startedAt || now,
    updatedAt: now,
    summary: args.summary || existing.summary || "",
    artifacts,
    metrics: { ...(existing.metrics || {}), ...(args.metrics || {}) },
    nextAction: args.next || args.nextAction || existing.nextAction || "",
    safeToAct: args.safeToAct !== undefined ? args.safeToAct === "true" : existing.safeToAct ?? false,
    notes,
  };

  validateTask(nextTask);
  fs.writeFileSync(filePath, `${JSON.stringify(nextTask, null, 2)}\n`);
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
