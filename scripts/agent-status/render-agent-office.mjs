import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, "data", "agent-status", "tasks");
const OUTPUT = path.join(ROOT, "tmp", "agent-office.html");

const SECRET_PATTERN =
  /(SECRET_TOKEN|SHEETS_SECRET_TOKEN|SHEETS_WEBHOOK_URL|api[_ -]?key|OAuth|token=|password|Cookie|Authorization|Bearer|Gmail app password|口座|登録番号)/i;

const STATUS_META = {
  success: { label: "完了", icon: "✅", className: "ok" },
  blocked: { label: "停止", icon: "⚠️", className: "danger" },
  failed: { label: "失敗", icon: "💥", className: "danger" },
  running: { label: "実行中", icon: "⏳", className: "active" },
  checking: { label: "確認中", icon: "🔍", className: "active" },
  needs_review: { label: "人間確認待ち", icon: "🙋", className: "warn" },
  waiting_human: { label: "人間確認待ち", icon: "🙋", className: "warn" },
  partial: { label: "一部完了", icon: "🟡", className: "warn" },
  queued: { label: "待機中", icon: "📝", className: "idle" },
  pending: { label: "未着手", icon: "📝", className: "idle" },
  skipped: { label: "未実行", icon: "💤", className: "idle" },
  synced: { label: "同期済み", icon: "🔁", className: "ok" },
  idle: { label: "待機", icon: "💤", className: "idle" },
  unknown: { label: "不明", icon: "❔", className: "unknown" },
};

const OFFICE_AGENTS = [
  {
    key: "hermes",
    match: (task) => task.agent === "Hermes" || task.avatar === "hermes-scheduler" || task.avatar === "sales-scout",
    name: "Hermes / 営業担当",
    role: "営業候補・営業進行管理",
    icon: "🔎",
    desk: "営業デスク",
  },
  {
    key: "sheets",
    match: (task) => task.avatar === "sheets-clerk" || /sheet/i.test(`${task.title} ${task.summary}`),
    name: "Sheets Clerk / 記録担当",
    role: "Google Sheets記録係",
    icon: "📊",
    desk: "記録デスク",
  },
  {
    key: "git",
    match: (task) => task.avatar === "codex-engineer" || /git|push|commit/i.test(`${task.title} ${task.summary}`),
    name: "Git Keeper / Git管理",
    role: "Git/GitHub管理係",
    icon: "🧑‍💻",
    desk: "Gitデスク",
  },
  {
    key: "mio",
    match: () => false,
    name: "ミオ / 秘書",
    role: "今日のまとめ・注意アラート",
    icon: "💬",
    desk: "秘書席",
  },
  {
    key: "human",
    match: (task) => ["needs_review", "waiting_human", "blocked", "partial"].includes(task.status),
    name: "あなた / 判断担当",
    role: "返信確認・判断・目視確認",
    icon: "🙋",
    desk: "判断席",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncate(value, max = 150) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function latestTime(task) {
  return Date.parse(task.updatedAt || task.startedAt || task.createdAt || "") || 0;
}

function readTasks() {
  const tasks = [];
  const warnings = [];

  if (!fs.existsSync(TASK_DIR)) {
    return { tasks, warnings: [`${path.relative(ROOT, TASK_DIR)} が見つかりません。`] };
  }

  for (const file of fs.readdirSync(TASK_DIR).filter((item) => item.endsWith(".json"))) {
    const fullPath = path.join(TASK_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      if (SECRET_PATTERN.test(raw)) {
        warnings.push(`${path.relative(ROOT, fullPath)} に秘密情報らしき語句があります。値は表示していません。`);
        continue;
      }
      const task = JSON.parse(raw);
      tasks.push({ ...task, __file: path.relative(ROOT, fullPath) });
    } catch (error) {
      warnings.push(`${path.relative(ROOT, fullPath)} の読み込みに失敗: ${error.message}`);
    }
  }

  tasks.sort((a, b) => latestTime(b) - latestTime(a));
  return { tasks, warnings };
}

function safeExec(command) {
  try {
    return { ok: true, output: execSync(command, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ""}${error.stderr || error.message}`.trim() };
  }
}

function readGitState() {
  const short = safeExec("git status --short");
  const branch = safeExec("git status -sb");
  const ignoredProtected = safeExec("git status --short --ignored=matching --untracked-files=all data/prospects docs/reports/sales");
  const combinedLines = `${short.output}\n${ignoredProtected.output}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const untracked = combinedLines.filter((line) => line.startsWith("?? "));
  const ignored = combinedLines.filter((line) => line.startsWith("!! "));
  const protectedLines = combinedLines.filter((line) => /(?:data\/prospects|docs\/reports\/sales|data\\prospects|docs\\reports\\sales)/.test(line));
  const prospectLines = protectedLines.filter((line) => /data[\\/]prospects/.test(line));
  const salesReportLines = protectedLines.filter((line) => /docs[\\/]reports[\\/]sales/.test(line));

  return {
    ok: short.ok,
    short: short.output,
    branch: branch.output,
    ignoredProtected: ignoredProtected.output,
    untrackedCount: untracked.length,
    ignoredCount: ignored.length,
    protectedCount: protectedLines.length,
    prospectCount: prospectLines.length,
    salesReportCount: salesReportLines.length,
    error: short.ok ? "" : short.output,
  };
}

function metaFor(status) {
  return STATUS_META[status] || STATUS_META.unknown;
}

function representativeTask(tasks, agent) {
  return tasks.find(agent.match);
}

function renderOfficeAgent(tasks, agent) {
  const task = representativeTask(tasks, agent);
  const status = metaFor(task?.status || (agent.key === "mio" ? "running" : "idle"));
  const progress = Math.max(0, Math.min(100, Number(task?.progress ?? (agent.key === "mio" ? 100 : 0))));
  const phase = task?.phase || (agent.key === "mio" ? "案内中" : "待機中");

  return `<article class="desk ${status.className}">
    <div class="desk-top">
      <span class="lamp"></span>
      <span class="badge">${status.icon} ${escapeHtml(status.label)}</span>
    </div>
    <div class="character" aria-hidden="true">
      <div class="head">${agent.icon}</div>
      <div class="body"></div>
    </div>
    <h3>${escapeHtml(agent.name)}</h3>
    <p class="role">${escapeHtml(agent.role)}</p>
    <p class="phase">${escapeHtml(phase)}</p>
    <div class="mini-progress"><span style="width:${progress}%"></span></div>
    <small>${escapeHtml(agent.desk)}</small>
  </article>`;
}

function hasText(tasks, pattern) {
  return tasks.some((task) => pattern.test(`${task.id} ${task.title} ${task.summary} ${task.nextAction} ${(task.notes || []).join(" ")}`));
}

function createMioMessage(tasks, gitState) {
  const sheetsDone = tasks.some((task) =>
    task.status === "success" && /sheets-update-2026-06-02-instagram-dm|Instagram DM|Sheets更新|Google Sheets/i.test(`${task.id} ${task.title} ${task.summary}`),
  );
  const hasJune5 = hasText(tasks, /2026-06-05|返信確認|フォローアップ|反応欄/);
  const protectedFiles = gitState.prospectCount > 0 || gitState.salesReportCount > 0;

  const lines = [];
  if (sheetsDone) {
    lines.push("本日の記録作業は完了しています。Instagram DM送信済み10件はGoogle Sheetsに反映済みです。");
  } else {
    lines.push("Sheets更新の完了タスクは見つかりません。必要なら記録状況を目視確認してください。");
  }
  if (hasJune5) {
    lines.push("次は2026-06-05に返信確認とフォローアップ判断を行ってください。");
  } else {
    lines.push("次の人間タスクは返信確認、DM可否判断、Sheets目視確認です。");
  }
  if (protectedFiles) {
    lines.push("営業リスト系または営業レポート系ファイルが作業ツリーに残っています。git add . は使わず、必要ファイルだけ個別に追加してください。");
  }
  lines.push("追加DM、営業候補再生成、Google Sheets再送信は今は行いません。");
  return lines.join(" ");
}

function renderTaskList(tasks) {
  return tasks
    .map((task) => {
      const status = metaFor(task.status);
      return `<article class="task-row ${status.className}">
        <div class="task-status">${status.icon}</div>
        <div>
          <h4>${escapeHtml(task.title || task.id)}</h4>
          <p>${escapeHtml(truncate(task.summary, 170))}</p>
          <small>${escapeHtml(task.phase)} / ${escapeHtml(task.updatedAt || task.startedAt || task.createdAt || "日時不明")}</small>
        </div>
      </article>`;
    })
    .join("");
}

function renderNextActions(tasks) {
  const actions = tasks
    .filter((task) => task.nextAction)
    .sort((a, b) => {
      const aImportant = /2026-06-05|返信確認|反応欄|フォローアップ/.test(a.nextAction) ? 1 : 0;
      const bImportant = /2026-06-05|返信確認|反応欄|フォローアップ/.test(b.nextAction) ? 1 : 0;
      return bImportant - aImportant || latestTime(b) - latestTime(a);
    })
    .slice(0, 8);

  if (actions.length === 0) return "<li>次アクション未登録。人間が返信確認予定を確認してください。</li>";
  return actions
    .map((task) => `<li><b>${escapeHtml(task.title || task.id)}</b>: ${escapeHtml(truncate(task.nextAction, 140))}</li>`)
    .join("");
}

function renderWarnings(gitState, parseWarnings) {
  const warnings = [
    "git add . 禁止。必要なファイルだけ個別に git add する。",
    "追加DM、営業候補再生成、Google Sheets再送信は禁止。",
    "2026-06-05までは返信確認待ち。返信内容の判断は人間が行う。",
    "Webhook URL、トークン、認証情報をチャットやGitに貼らない。",
  ];
  if (gitState.prospectCount > 0) warnings.unshift(`営業リスト系ファイルあり: ${gitState.prospectCount}件`);
  if (gitState.salesReportCount > 0) warnings.unshift(`営業レポート系ファイルあり: ${gitState.salesReportCount}件`);
  if (!gitState.ok) warnings.unshift("git status の読み取りに失敗。HTML生成は継続しました。");
  warnings.push(...parseWarnings);

  return warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function renderGitState(gitState) {
  const branch = gitState.branch || "取得できませんでした";
  const short = gitState.short || "変更なし、または取得できませんでした";
  const ignored = gitState.ignoredProtected || "保護対象のignored/untracked情報なし";
  return `<div class="git-grid">
    <div><b>未追跡件数</b><span>${gitState.untrackedCount}</span></div>
    <div><b>ignored件数</b><span>${gitState.ignoredCount}</span></div>
    <div><b>営業リスト系</b><span>${gitState.prospectCount}</span></div>
    <div><b>営業レポート系</b><span>${gitState.salesReportCount}</span></div>
  </div>
  <h4>branch</h4>
  <pre>${escapeHtml(branch)}</pre>
  <h4>git status --short</h4>
  <pre>${escapeHtml(short)}</pre>
  <h4>protected ignored/untracked</h4>
  <pre>${escapeHtml(ignored)}</pre>`;
}

function renderHtml(tasks, parseWarnings, gitState) {
  const generatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const completed = tasks.filter((task) => task.status === "success").slice(0, 8);
  const mioMessage = createMioMessage(tasks, gitState);
  const humanTasks = [
    "2026-06-05の返信確認",
    "返信内容の判断",
    "フォローアップ文面の確認",
    "Google Sheetsの目視確認",
    "DM送信可否判断",
    "営業リスト/営業レポートをコミットしない判断",
  ];

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>自動化ビジネス司令室</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#101522;
      --panel:#1b2435;
      --panel2:#26324a;
      --line:#6ee7f9;
      --ok:#51d88a;
      --warn:#f9c74f;
      --danger:#ff5c7a;
      --active:#74b9ff;
      --idle:#9aa6b2;
      --text:#eef6ff;
      --muted:#a9b7ca;
      font-family: "MS Gothic", "Yu Gothic", Consolas, monospace;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      background:
        linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px),
        radial-gradient(circle at 50% -10%, #2c3e66 0, var(--bg) 48%);
      background-size: 16px 16px, 16px 16px, auto;
      color:var(--text);
    }
    header { padding:28px clamp(16px, 4vw, 42px) 18px; border-bottom:4px solid #0b0f18; background:rgba(10,14,24,.9); }
    h1, h2, h3, h4, p { letter-spacing:0; }
    h1 { margin:0; font-size:clamp(28px, 5vw, 48px); text-shadow:4px 4px 0 #000; }
    .subtitle { margin:8px 0 0; color:var(--muted); }
    .header-meta { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .chip { border:2px solid var(--line); background:#111827; padding:7px 10px; box-shadow:4px 4px 0 #000; }
    main { padding:22px clamp(14px, 3vw, 36px) 44px; display:grid; gap:22px; }
    section { border:4px solid #0b0f18; background:rgba(27,36,53,.94); box-shadow:8px 8px 0 rgba(0,0,0,.45); padding:18px; }
    section h2 { margin:0 0 14px; font-size:22px; color:#fef08a; text-shadow:2px 2px 0 #000; }
    .office {
      position:relative;
      min-height:460px;
      display:grid;
      grid-template-columns:repeat(5, minmax(150px, 1fr));
      gap:16px;
      align-items:end;
      padding:22px;
      overflow:hidden;
      background:
        linear-gradient(#222e45 0 56%, #1a2334 56% 100%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 2px, transparent 2px 42px);
    }
    .office:before {
      content:"";
      position:absolute; inset:56% 0 0;
      background:repeating-linear-gradient(90deg, #22314a 0 42px, #1a2740 42px 84px);
      opacity:.8;
    }
    .desk {
      position:relative;
      z-index:1;
      min-height:250px;
      border:3px solid #0b0f18;
      background:linear-gradient(#34425d 0 58%, #7b4e2f 58% 100%);
      padding:10px;
      box-shadow:6px 6px 0 #000;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:flex-end;
      text-align:center;
    }
    .desk-top { position:absolute; top:8px; left:8px; right:8px; display:flex; justify-content:space-between; align-items:center; }
    .badge { font-size:12px; background:#0b0f18; border:2px solid currentColor; padding:3px 5px; }
    .lamp { width:12px; height:12px; background:currentColor; border:2px solid #000; box-shadow:0 0 12px currentColor; animation:blink 1.4s steps(2) infinite; }
    .desk.ok { color:var(--ok); }
    .desk.warn { color:var(--warn); }
    .desk.danger { color:var(--danger); }
    .desk.active { color:var(--active); }
    .desk.idle, .desk.unknown { color:var(--idle); }
    .character { width:74px; height:98px; display:grid; justify-items:center; align-items:end; margin-bottom:8px; }
    .head { width:62px; height:62px; display:grid; place-items:center; font-size:36px; background:#111827; border:3px solid #000; box-shadow:4px 4px 0 #000; }
    .body { width:54px; height:32px; background:currentColor; border:3px solid #000; box-shadow:4px 4px 0 #000; }
    .desk h3 { color:var(--text); margin:4px 0; font-size:16px; }
    .role, .phase { color:var(--muted); font-size:12px; margin:2px 0; }
    .mini-progress { width:100%; height:9px; border:2px solid #000; background:#101522; margin:8px 0; }
    .mini-progress span { display:block; height:100%; background:currentColor; }
    .mio-box { display:grid; grid-template-columns:84px 1fr; gap:14px; align-items:start; }
    .mio-face { width:84px; height:84px; display:grid; place-items:center; font-size:46px; background:#0b0f18; border:4px solid #fef08a; box-shadow:6px 6px 0 #000; }
    .speech { position:relative; background:#f8fafc; color:#111827; border:4px solid #0b0f18; padding:16px; box-shadow:6px 6px 0 #000; line-height:1.7; }
    .speech:after { content:""; position:absolute; left:-18px; top:28px; border:10px solid transparent; border-right-color:#0b0f18; }
    .speech .cursor { display:inline-block; width:10px; height:18px; background:#111827; vertical-align:middle; animation:blink 1s steps(2) infinite; }
    .grid-two { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:20px; }
    .task-row { display:grid; grid-template-columns:40px 1fr; gap:10px; padding:12px; border:3px solid #0b0f18; background:#121a2a; box-shadow:4px 4px 0 #000; margin-bottom:10px; }
    .task-row.ok { border-color:var(--ok); }
    .task-row.warn { border-color:var(--warn); }
    .task-row.danger { border-color:var(--danger); }
    .task-row.active { border-color:var(--active); }
    .task-status { font-size:24px; }
    .task-row h4 { margin:0 0 4px; color:#fff; }
    .task-row p { margin:0 0 4px; color:#d7e3f5; line-height:1.5; }
    small { color:var(--muted); }
    ul { margin:0; padding-left:22px; line-height:1.8; }
    li strong, b { color:#fef08a; }
    .alert-list li { margin-bottom:6px; color:#ffd9df; }
    .git-grid { display:grid; grid-template-columns:repeat(4, minmax(120px,1fr)); gap:10px; margin-bottom:14px; }
    .git-grid div { border:3px solid #0b0f18; background:#101522; padding:12px; box-shadow:4px 4px 0 #000; }
    .git-grid b { display:block; color:var(--muted); font-size:12px; }
    .git-grid span { display:block; font-size:28px; color:#fff; margin-top:4px; }
    pre { max-height:210px; overflow:auto; white-space:pre-wrap; background:#0b0f18; border:3px solid #000; padding:12px; color:#dbeafe; }
    .footer-note { color:var(--muted); text-align:center; padding:18px; }
    @keyframes blink { 50% { opacity:.35; } }
    @media (max-width: 980px) {
      .office { grid-template-columns:repeat(2, minmax(150px, 1fr)); }
      .grid-two { grid-template-columns:1fr; }
      .git-grid { grid-template-columns:repeat(2, minmax(120px,1fr)); }
    }
    @media (max-width: 560px) {
      .office { grid-template-columns:1fr; padding:12px; }
      .mio-box { grid-template-columns:1fr; }
      .speech:after { display:none; }
      .git-grid { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>自動化ビジネス司令室</h1>
    <p class="subtitle">Agent Office / Local Operations Dashboard</p>
    <div class="header-meta">
      <span class="chip">最終生成: ${escapeHtml(generatedAt)}</span>
      <span class="chip">読み込みタスク: ${tasks.length}件</span>
      <span class="chip">ローカルHTML専用</span>
    </div>
  </header>
  <main>
    <section>
      <h2>ピクセルオフィス</h2>
      <div class="office">
        ${OFFICE_AGENTS.map((agent) => renderOfficeAgent(tasks, agent)).join("")}
      </div>
    </section>

    <section>
      <h2>秘書ミオの今日の案内</h2>
      <div class="mio-box">
        <div class="mio-face">💬</div>
        <div class="speech">${escapeHtml(mioMessage)} <span class="cursor"></span></div>
      </div>
    </section>

    <div class="grid-two">
      <section>
        <h2>今日完了したこと</h2>
        ${completed.length ? renderTaskList(completed) : "<p>完了タスクはまだありません。</p>"}
      </section>

      <section>
        <h2>次にやること</h2>
        <ul>${renderNextActions(tasks)}</ul>
      </section>
    </div>

    <div class="grid-two">
      <section>
        <h2>人間が必要なタスク</h2>
        <ul>${humanTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
      </section>

      <section>
        <h2>注意アラート</h2>
        <ul class="alert-list">${renderWarnings(gitState, parseWarnings)}</ul>
      </section>
    </div>

    <section>
      <h2>Git状態</h2>
      ${renderGitState(gitState)}
    </section>

    <p class="footer-note">この画面はローカル確認専用です。公開サイト、Next.js UI、Vercel本番には表示しません。</p>
  </main>
</body>
</html>`;
}

const { tasks, warnings } = readTasks();
const gitState = readGitState();

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, renderHtml(tasks, warnings, gitState), "utf8");

console.log(`Rendered ${path.relative(ROOT, OUTPUT)} with ${tasks.length} task(s).`);
if (warnings.length > 0) {
  console.log(`Warnings: ${warnings.length}`);
}
