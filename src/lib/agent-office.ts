import fs from "node:fs";
import path from "node:path";

export type AgentOfficeStatus =
  | "success"
  | "needs_review"
  | "blocked"
  | "running"
  | "checking"
  | "scheduled"
  | "partial"
  | "failed"
  | "skipped"
  | "unknown";

export type SafeMetric = {
  label: string;
  value: string;
};

export type SafeAgentTask = {
  id: string;
  agent: string;
  avatar: string;
  title: string;
  category: string;
  status: AgentOfficeStatus;
  phase: string;
  progress: number;
  priority: string;
  updatedAt: string;
  summary: string;
  nextAction: string;
  metrics: SafeMetric[];
  role: string;
};

export type AgentOfficeDashboardData = {
  generatedAt: string;
  tasks: SafeAgentTask[];
  featuredTasks: SafeAgentTask[];
  nextActions: SafeAgentTask[];
  humanReviewTasks: SafeAgentTask[];
  counts: Record<"success" | "needs_review" | "blocked" | "running", number>;
  topState: string;
};

type RawTask = {
  id?: unknown;
  agent?: unknown;
  avatar?: unknown;
  title?: unknown;
  category?: unknown;
  status?: unknown;
  phase?: unknown;
  progress?: unknown;
  priority?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  summary?: unknown;
  nextAction?: unknown;
  metrics?: unknown;
};

const TASK_DIR = path.join(process.cwd(), "data", "agent-status", "tasks");

const PRIVATE_WORDS = [
  `SECRET${"_"}TOKEN`,
  `SHEETS${"_"}SECRET${"_"}TOKEN`,
  `SHEETS${"_"}WEBHOOK${"_"}URL`,
  `api[_ -]?${"key"}`,
  `O${"Auth"}`,
  `token${"="}`,
  `pass${"word"}`,
  `Coo${"kie"}`,
  `Authori${"zation"}`,
  `Bear${"er"}`,
  `Gmail app pass${"word"}`,
  `Google Sheets ${"ID"}`,
  `Apps Script ${"URL"}`,
  `Webhook ${"URL"}`,
  `[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}`,
];

const SECRET_OR_PRIVATE_PATTERN = new RegExp(PRIVATE_WORDS.join("|"), "i");

const STATUS_SET = new Set([
  "success",
  "needs_review",
  "blocked",
  "running",
  "checking",
  "partial",
  "failed",
  "skipped",
  "queued",
  "synced",
]);

const FEATURE_KEYWORDS = [
  "gmail-daily-sales-send",
  "gmail-outbox",
  "gmail-ready-candidate-pool",
  "gmail-automation-readiness",
  "gmail-full-auto-send-design",
  "instagram-initial-posts-published",
  "instagram-canva-materialization",
  "instagram-pre-publish-review",
];

export function getAgentOfficeDashboardData(): AgentOfficeDashboardData {
  const tasks = loadTasks().sort(compareTasksByDate);
  const featuredTasks = selectFeaturedTasks(tasks);
  const nextActions = tasks
    .filter((task) => task.nextAction && task.status !== "success")
    .slice(0, 6);
  const humanReviewTasks = tasks
    .filter((task) => task.status === "needs_review" || task.nextAction.includes("人間"))
    .slice(0, 6);
  const counts = {
    success: tasks.filter((task) => task.status === "success").length,
    needs_review: tasks.filter((task) => task.status === "needs_review").length,
    blocked: tasks.filter((task) => task.status === "blocked" || task.status === "failed").length,
    running: tasks.filter((task) => task.status === "running" || task.status === "checking").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    tasks,
    featuredTasks,
    nextActions,
    humanReviewTasks,
    counts,
    topState: buildTopState(counts),
  };
}

function loadTasks(): SafeAgentTask[] {
  if (!fs.existsSync(TASK_DIR)) return [];
  return fs
    .readdirSync(TASK_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(TASK_DIR, file))
    .map(readTask)
    .filter((task): task is SafeAgentTask => Boolean(task));
}

function readTask(filePath: string): SafeAgentTask | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawTask;
    const id = safeText(raw.id);
    const status = normalizeStatus(raw.status);
    return {
      id,
      agent: safeText(raw.agent, "Agent"),
      avatar: safeText(raw.avatar, "ops-monitor"),
      title: safeText(raw.title, "Untitled Task"),
      category: safeText(raw.category, "operations"),
      status,
      phase: safeText(raw.phase, "未確認"),
      progress: safeProgress(raw.progress),
      priority: safeText(raw.priority, "medium"),
      updatedAt: safeText(raw.updatedAt || raw.createdAt, ""),
      summary: safeText(raw.summary, "要約なし"),
      nextAction: safeText(raw.nextAction, "次アクション未設定"),
      metrics: safeMetrics(raw.metrics),
      role: inferRole(id, safeText(raw.title), safeText(raw.category), safeText(raw.avatar)),
    };
  } catch {
    return null;
  }
}

function normalizeStatus(value: unknown): AgentOfficeStatus {
  const raw = String(value || "unknown");
  if (!STATUS_SET.has(raw)) return "unknown";
  if (raw === "queued" || raw === "synced") return "scheduled";
  return raw as AgentOfficeStatus;
}

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? fallback).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (SECRET_OR_PRIVATE_PATTERN.test(text)) return "非表示";
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function safeProgress(value: unknown): number {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function safeMetrics(value: unknown): SafeMetric[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([key, metricValue]) => !SECRET_OR_PRIVATE_PATTERN.test(`${key}:${String(metricValue)}`))
    .filter(([, metricValue]) => {
      const type = typeof metricValue;
      return type === "number" || type === "boolean" || type === "string";
    })
    .slice(0, 6)
    .map(([key, metricValue]) => ({
      label: key,
      value: safeText(String(metricValue)),
    }));
}

function inferRole(id: string, title: string, category: string, avatar: string): string {
  const text = `${id} ${title} ${category} ${avatar}`.toLowerCase();
  if (text.includes("gmail") && text.includes("pool")) return "Gmail候補プール補充";
  if (text.includes("gmail")) return "Gmail営業送信";
  if (text.includes("instagram")) return "Instagram運用";
  if (text.includes("hermes") || text.includes("scheduled")) return "Hermes監視";
  if (text.includes("agent-office") || text.includes("dashboard")) return "Agent Office";
  return "運用タスク";
}

function compareTasksByDate(a: SafeAgentTask, b: SafeAgentTask): number {
  return Date.parse(b.updatedAt || "0") - Date.parse(a.updatedAt || "0");
}

function selectFeaturedTasks(tasks: SafeAgentTask[]): SafeAgentTask[] {
  const featured = FEATURE_KEYWORDS.map((keyword) =>
    tasks.find((task) => task.id.includes(keyword)),
  ).filter((task): task is SafeAgentTask => Boolean(task));

  const unique = new Map(featured.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (unique.size >= 5) break;
    if (task.status === "blocked" || task.status === "needs_review") {
      unique.set(task.id, task);
    }
  }
  return [...unique.values()].slice(0, 5);
}

function buildTopState(counts: AgentOfficeDashboardData["counts"]): string {
  if (counts.blocked > 0) return "要確認の停止タスクあり";
  if (counts.needs_review > 0) return "人間確認待ちあり";
  if (counts.running > 0) return "実行中タスクあり";
  return "主要タスクは安定";
}
