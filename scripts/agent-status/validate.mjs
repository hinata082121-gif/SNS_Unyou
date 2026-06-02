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

const AVATAR_VALUES = new Set([
  "codex-engineer",
  "hermes-scheduler",
  "sales-scout",
  "sheets-clerk",
  "ops-monitor",
  "pr-writer",
]);

const REQUIRED_KEYS = [
  "id",
  "agent",
  "avatar",
  "title",
  "category",
  "status",
  "phase",
  "progress",
  "priority",
  "summary",
  "artifacts",
  "metrics",
  "nextAction",
  "safeToAct",
  "notes",
];

const SECRET_PATTERN =
  /(SECRET_TOKEN|SHEETS_SECRET_TOKEN|SHEETS_WEBHOOK_URL|api[_ -]?key|OAuth|token=|password|Cookie|Authorization|Bearer|Gmail app password|口座|登録番号)/i;

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(dir, file));
}

function validateTask(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  let task;
  try {
    task = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON: ${error.message}`);
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in task)) throw new Error(`${filePath}: missing required key ${key}`);
  }
  if (!STATUS_VALUES.has(task.status)) throw new Error(`${filePath}: invalid status ${task.status}`);
  if (!AGENT_VALUES.has(task.agent)) throw new Error(`${filePath}: invalid agent ${task.agent}`);
  if (!AVATAR_VALUES.has(task.avatar)) throw new Error(`${filePath}: invalid avatar ${task.avatar}`);
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) {
    throw new Error(`${filePath}: progress must be an integer from 0 to 100`);
  }
  if (!Array.isArray(task.artifacts)) throw new Error(`${filePath}: artifacts must be an array`);
  if (!Array.isArray(task.notes)) throw new Error(`${filePath}: notes must be an array`);
  if (typeof task.metrics !== "object" || task.metrics === null || Array.isArray(task.metrics)) {
    throw new Error(`${filePath}: metrics must be an object`);
  }
  if (SECRET_PATTERN.test(raw)) {
    throw new Error(`${filePath}: possible secret-like value detected`);
  }
}

function main() {
  const files = listJsonFiles(TASK_DIR);
  for (const file of files) validateTask(file);
  console.log(`Validated ${files.length} agent status task file(s).`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
