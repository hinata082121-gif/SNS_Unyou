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
  categoryLabel: string;
  urgencyRank: number;
};

export type AgentOfficeCategoryGroup = {
  key: string;
  label: string;
  description: string;
  tasks: SafeAgentTask[];
};

export type AgentOfficeDashboardData = {
  generatedAt: string;
  tasks: SafeAgentTask[];
  featuredTasks: SafeAgentTask[];
  urgentTasks: SafeAgentTask[];
  nextActions: SafeAgentTask[];
  humanReviewTasks: SafeAgentTask[];
  replyCheckTask?: SafeAgentTask;
  categoryGroups: AgentOfficeCategoryGroup[];
  counts: Record<
    "success" | "needs_review" | "blocked" | "failed" | "running" | "scheduled",
    number
  >;
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
  "scheduled",
]);

const FEATURE_KEYWORDS = [
  "gmail-automation-readiness",
  "gmail-outbox",
  "gmail-daily-sales-send",
  "gmail-ready-candidate-pool",
  "gmail-full-auto-send-design",
  "gmail-reply-check",
  "market-analysis-friday",
  "instagram-initial-posts-published",
  "instagram-canva-materialization",
  "instagram-pre-publish-review",
  "agent-office-vercel-dashboard",
];

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  gmail_send: {
    label: "Gmail送信",
    description: "日次30件送信、Preflight、送信後確認",
  },
  gmail_list_refresh: {
    label: "Gmailリスト更新",
    description: "公開メール確認済み候補の補充とoutbox準備",
  },
  gmail_reply_check: {
    label: "Gmail返信確認",
    description: "返信有無、未読返信、人間確認要否の監視",
  },
  market_analysis: {
    label: "金曜市場分析",
    description: "市場変化、競合、翌週施策の分析予定",
  },
  instagram: {
    label: "Instagram運用",
    description: "自社投稿、反応確認、改善メモ",
  },
  hermes_monitoring: {
    label: "Hermes監視",
    description: "cron、Apps Script、Agent statusの監視",
  },
  dashboard: {
    label: "Agent Office",
    description: "表示ページ、Vercel公開、スマホ確認",
  },
  system: {
    label: "System",
    description: "運用基盤と安全確認",
  },
  sales: {
    label: "営業運用",
    description: "既存営業タスクと候補管理",
  },
  content: {
    label: "コンテンツ",
    description: "自社SNS制作と投稿後確認",
  },
};

const STATUS_PRIORITY: Record<AgentOfficeStatus, number> = {
  failed: 0,
  blocked: 1,
  needs_review: 2,
  running: 3,
  checking: 3,
  scheduled: 4,
  partial: 5,
  success: 6,
  skipped: 7,
  unknown: 8,
};

export function getAgentOfficeDashboardData(): AgentOfficeDashboardData {
  const tasks = loadTasks().sort(compareTasksForDisplay);
  const featuredTasks = selectFeaturedTasks(tasks);
  const replyCheckTask = tasks.find((task) => task.category === "gmail_reply_check");
  const urgentTasks = tasks
    .filter(
      (task) =>
        task.status === "failed" ||
        task.status === "blocked" ||
        hasTrueMetric(task, "needsHumanEmailCheck") ||
        hasPositiveMetric(task, "unreadReplyCount"),
    )
    .slice(0, 5);
  const nextActions = tasks
    .filter((task) => task.nextAction && task.status !== "success")
    .slice(0, 6);
  const humanReviewTasks = tasks
    .filter((task) => task.status === "needs_review" || task.nextAction.includes("人間"))
    .slice(0, 6);
  const counts = {
    success: tasks.filter((task) => task.status === "success").length,
    needs_review: tasks.filter((task) => task.status === "needs_review").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    failed: tasks.filter((task) => task.status === "failed").length,
    running: tasks.filter((task) => task.status === "running" || task.status === "checking").length,
    scheduled: tasks.filter((task) => task.status === "scheduled").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    tasks,
    featuredTasks,
    urgentTasks,
    nextActions,
    humanReviewTasks,
    replyCheckTask,
    categoryGroups: buildCategoryGroups(tasks),
    counts,
    topState: buildTopState(counts),
  };
}

function loadTasks(): SafeAgentTask[] {
  if (!fs.existsSync(TASK_DIR)) return [];
  return fs
    .readdirSync(TASK_DIR)
    .filter((file) => file.endsWith(".json") && !file.startsWith("template-"))
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
      categoryLabel: categoryLabel(safeText(raw.category, "system")),
      urgencyRank: STATUS_PRIORITY[status],
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
    .slice(0, 12)
    .map(([key, metricValue]) => ({
      label: key,
      value: safeText(String(metricValue)),
    }));
}

function inferRole(id: string, title: string, category: string, avatar: string): string {
  const text = `${id} ${title} ${category} ${avatar}`.toLowerCase();
  if (text.includes("gmail") && text.includes("pool")) return "Gmail候補プール補充";
  if (text.includes("gmail") && text.includes("reply")) return "Gmail返信確認";
  if (text.includes("gmail") && text.includes("list")) return "Gmailリスト更新";
  if (text.includes("gmail")) return "Gmail営業送信";
  if (text.includes("market")) return "金曜市場分析";
  if (text.includes("instagram")) return "Instagram運用";
  if (text.includes("hermes") || text.includes("scheduled")) return "Hermes監視";
  if (text.includes("agent-office") || text.includes("dashboard")) return "Agent Office";
  return "運用タスク";
}

function compareTasksByDate(a: SafeAgentTask, b: SafeAgentTask): number {
  return Date.parse(b.updatedAt || "0") - Date.parse(a.updatedAt || "0");
}

function compareTasksForDisplay(a: SafeAgentTask, b: SafeAgentTask): number {
  const urgencyDelta = a.urgencyRank - b.urgencyRank;
  if (urgencyDelta !== 0) return urgencyDelta;
  return compareTasksByDate(a, b);
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
  if (counts.failed > 0 || counts.blocked > 0) return "停止中タスクあり";
  if (counts.needs_review > 0) return "人間確認待ちあり";
  if (counts.running > 0) return "実行中タスクあり";
  return "自動化正常稼働中";
}

function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label || category;
}

function buildCategoryGroups(tasks: SafeAgentTask[]): AgentOfficeCategoryGroup[] {
  const order = [
    "gmail_send",
    "gmail_list_refresh",
    "gmail_reply_check",
    "hermes_monitoring",
    "market_analysis",
    "instagram",
    "dashboard",
    "system",
    "sales",
    "content",
  ];
  const grouped = new Map<string, SafeAgentTask[]>();
  for (const task of tasks) {
    const key = task.category;
    grouped.set(key, [...(grouped.get(key) || []), task]);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const aIndex = order.includes(a) ? order.indexOf(a) : order.length;
      const bIndex = order.includes(b) ? order.indexOf(b) : order.length;
      return aIndex - bIndex || a.localeCompare(b);
    })
    .map(([key, groupTasks]) => ({
      key,
      label: CATEGORY_META[key]?.label || key,
      description: CATEGORY_META[key]?.description || "Agent statusで管理する運用タスク",
      tasks: groupTasks.sort(compareTasksForDisplay),
    }));
}

function hasTrueMetric(task: SafeAgentTask, label: string): boolean {
  return task.metrics.some(
    (metric) => metric.label === label && metric.value.toLowerCase() === "true",
  );
}

function hasPositiveMetric(task: SafeAgentTask, label: string): boolean {
  return task.metrics.some((metric) => metric.label === label && Number(metric.value) > 0);
}
