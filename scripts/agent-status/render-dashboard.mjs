import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, "data", "agent-status", "tasks");
const OUTPUT = path.join(ROOT, "tmp", "agent-dashboard.html");

const AVATARS = {
  "codex-engineer": { name: "Codex Engineer", role: "実装、lint/build、commit/push", icon: "🧑‍💻" },
  "hermes-scheduler": { name: "Hermes Scheduler", role: "cron、定期実行、補完チェック", icon: "🕰️" },
  "sales-scout": { name: "Sales Scout", role: "営業候補探索、重複除外、候補不足検知", icon: "🔎" },
  "sheets-clerk": { name: "Sheets Clerk", role: "Google Sheets投入、upsert、列整合性", icon: "📊" },
  "ops-monitor": { name: "Ops Monitor", role: "インシデント、依存復旧、Git同期、0件防止", icon: "🛡️" },
  "pr-writer": { name: "PR Writer", role: "自社SNS、投稿案、広報コンテンツ", icon: "📣" },
};

const STATUS_META = {
  queued: { label: "Queued", color: "#6b7280" },
  running: { label: "Running", color: "#2563eb" },
  checking: { label: "Checking", color: "#7c3aed" },
  success: { label: "Success", color: "#059669" },
  partial: { label: "Partial", color: "#d97706" },
  blocked: { label: "Blocked", color: "#dc2626" },
  failed: { label: "Failed", color: "#991b1b" },
  skipped: { label: "Skipped", color: "#64748b" },
  needs_review: { label: "Needs Review", color: "#ca8a04" },
  synced: { label: "Synced", color: "#0891b2" },
};

const SECRET_PATTERN =
  /(SECRET_TOKEN|SHEETS_SECRET_TOKEN|SHEETS_WEBHOOK_URL|api[_ -]?key|OAuth|token=|password|Cookie|Authorization|Bearer|Gmail app password)/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readTasks() {
  if (!fs.existsSync(TASK_DIR)) return [];
  return fs
    .readdirSync(TASK_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(TASK_DIR, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      if (SECRET_PATTERN.test(raw)) {
        throw new Error(`Possible secret-like value detected in ${path.relative(ROOT, fullPath)}`);
      }
      return JSON.parse(raw);
    });
}

function sortTasks(tasks) {
  const urgent = new Set(["blocked", "failed", "needs_review"]);
  return tasks.sort((a, b) => {
    const urgentDelta = Number(urgent.has(b.status)) - Number(urgent.has(a.status));
    if (urgentDelta !== 0) return urgentDelta;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

function renderTask(task) {
  const avatar = AVATARS[task.avatar] || { name: task.avatar, role: "", icon: "🤖" };
  const status = STATUS_META[task.status] || { label: task.status, color: "#64748b" };
  const metrics = Object.entries(task.metrics || {})
    .map(([key, value]) => `<span class="metric"><b>${escapeHtml(key)}</b>${escapeHtml(value)}</span>`)
    .join("");
  const artifacts = (task.artifacts || [])
    .map((artifact) => `<li>${escapeHtml(artifact)}</li>`)
    .join("");
  const notes = (task.notes || [])
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");

  return `
    <article class="task-card" style="--status:${status.color}">
      <div class="task-head">
        <div class="avatar" title="${escapeHtml(avatar.role)}">${avatar.icon}</div>
        <div>
          <div class="agent">${escapeHtml(avatar.name)} / ${escapeHtml(task.agent)}</div>
          <h2>${escapeHtml(task.title)}</h2>
        </div>
        <span class="status">${escapeHtml(status.label)}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(task.category)}</span>
        <span>${escapeHtml(task.priority)}</span>
        <span>${escapeHtml(task.phase)}</span>
        <span>Updated ${escapeHtml(task.updatedAt)}</span>
      </div>
      <p>${escapeHtml(task.summary)}</p>
      <div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(task.progress) || 0))}%"></span></div>
      <div class="progress-label">${escapeHtml(task.progress)}%</div>
      <div class="metrics">${metrics}</div>
      <h3>Next Action</h3>
      <p>${escapeHtml(task.nextAction)}</p>
      <h3>Artifacts</h3>
      <ul>${artifacts || "<li>None</li>"}</ul>
      <h3>Notes</h3>
      <ul>${notes || "<li>None</li>"}</ul>
    </article>`;
}

function render(tasks) {
  const counts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const countBadges = Object.entries(STATUS_META)
    .map(([status, meta]) => `<span class="count" style="--status:${meta.color}">${meta.label}: ${counts[status] || 0}</span>`)
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ICHI Social Agent Operations Dashboard</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f8fafc; color:#111827; }
    body { margin:0; }
    header { padding:32px 40px 20px; background:#111827; color:white; }
    header p { max-width:960px; color:#cbd5e1; }
    main { padding:24px 40px 48px; }
    .notice { padding:12px 14px; border:1px solid #facc15; background:#fef9c3; color:#713f12; border-radius:8px; margin:0 0 20px; }
    .counts { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; }
    .count { border-left:5px solid var(--status); background:white; color:#111827; padding:8px 10px; border-radius:6px; font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; }
    .task-card { background:white; border:1px solid #e5e7eb; border-top:5px solid var(--status); border-radius:8px; padding:18px; box-shadow:0 8px 24px rgba(15, 23, 42, 0.06); }
    .task-head { display:flex; gap:12px; align-items:flex-start; }
    .avatar { width:48px; height:48px; display:grid; place-items:center; border-radius:50%; background:#f1f5f9; font-size:28px; flex:0 0 auto; }
    h1 { margin:0; font-size:30px; letter-spacing:0; }
    h2 { margin:2px 0 0; font-size:18px; letter-spacing:0; }
    h3 { margin:14px 0 4px; font-size:13px; color:#475569; text-transform:uppercase; letter-spacing:0; }
    p { line-height:1.6; }
    ul { margin:6px 0 0; padding-left:18px; }
    li { overflow-wrap:anywhere; }
    .agent { color:#64748b; font-size:13px; }
    .status { margin-left:auto; background:var(--status); color:white; border-radius:999px; padding:4px 8px; font-size:12px; white-space:nowrap; }
    .meta { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
    .meta span { background:#f1f5f9; border-radius:999px; padding:4px 8px; font-size:12px; color:#334155; }
    .progress { height:10px; border-radius:999px; background:#e5e7eb; overflow:hidden; }
    .progress span { display:block; height:100%; background:var(--status); }
    .progress-label { font-size:12px; color:#475569; margin-top:4px; }
    .metrics { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .metric { display:flex; gap:6px; align-items:center; border:1px solid #e5e7eb; border-radius:6px; padding:5px 7px; font-size:12px; }
    footer { padding:24px 40px; color:#64748b; }
  </style>
</head>
<body>
  <header>
    <h1>ICHI Social Agent Operations Dashboard</h1>
    <p>Codex/Hermes Agentのローカル運用状況を確認するMVPです。公開サイトやVercel本番には表示しないでください。</p>
    <div class="counts">${countBadges}</div>
  </header>
  <main>
    <div class="notice">このHTMLはローカル閲覧専用です。営業送信、Google Sheets投入、SNS投稿、認証情報表示は行いません。</div>
    <section class="grid">
      ${tasks.map(renderTask).join("\n")}
    </section>
  </main>
  <footer>Generated at ${escapeHtml(new Date().toISOString())}. Source: data/agent-status/tasks/*.json</footer>
</body>
</html>`;
}

try {
  const tasks = sortTasks(readTasks());
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, render(tasks));
  console.log(`Rendered ${path.relative(ROOT, OUTPUT)} with ${tasks.length} task(s).`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
