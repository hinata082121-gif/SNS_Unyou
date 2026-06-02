import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, "data", "agent-status", "tasks");
const OUTPUT = path.join(ROOT, "tmp", "agent-office.html");

const SECRET_PATTERN =
  /(SECRET_TOKEN|SHEETS_SECRET_TOKEN|SHEETS_WEBHOOK_URL|api[_ -]?key|OAuth|token=|password|Cookie|Authorization|Bearer|Gmail app password|口座|登録番号)/i;

const STATUS_META = {
  success: { label: "完了", icon: "✓", tone: "ok" },
  blocked: { label: "停止", icon: "!", tone: "danger" },
  failed: { label: "失敗", icon: "x", tone: "danger" },
  running: { label: "実行中", icon: "...", tone: "active" },
  checking: { label: "確認中", icon: "?", tone: "active" },
  needs_review: { label: "人間確認待ち", icon: "?", tone: "warn" },
  waiting_human: { label: "人間確認待ち", icon: "?", tone: "warn" },
  partial: { label: "一部完了", icon: "△", tone: "warn" },
  queued: { label: "待機中", icon: "-", tone: "idle" },
  pending: { label: "未着手", icon: "-", tone: "idle" },
  skipped: { label: "未実行", icon: "z", tone: "idle" },
  synced: { label: "同期済み", icon: "↻", tone: "ok" },
  idle: { label: "待機", icon: "z", tone: "idle" },
  unknown: { label: "不明", icon: "?", tone: "unknown" },
};

const AGENT_BLUEPRINTS = [
  {
    key: "hermes",
    className: "hermes",
    match: (task) => task.agent === "Hermes" || task.avatar === "hermes-scheduler" || task.avatar === "sales-scout",
    name: "Hermes",
    title: "営業担当",
    role: "営業候補・営業進行管理",
    station: "営業デスク",
    accessory: "営業メモ",
    monitor: "DM / LIST",
  },
  {
    key: "sheets",
    className: "sheets",
    match: (task) => task.avatar === "sheets-clerk" || /sheet/i.test(`${task.title} ${task.summary}`),
    name: "Sheets Clerk",
    title: "記録担当",
    role: "Google Sheets記録係",
    station: "記録デスク",
    accessory: "記録台帳",
    monitor: "ROWS ✓",
  },
  {
    key: "git",
    className: "git",
    match: (task) => task.avatar === "codex-engineer" || /git|push|commit/i.test(`${task.title} ${task.summary}`),
    name: "Git Keeper",
    title: "Git管理",
    role: "Git/GitHub管理係",
    station: "Gitデスク",
    accessory: "branch",
    monitor: "main →",
  },
  {
    key: "mio",
    className: "mio",
    match: () => false,
    name: "ミオ",
    title: "秘書",
    role: "今日のまとめ・次アクション案内",
    station: "受付デスク",
    accessory: "受付ベル",
    monitor: "TODAY",
  },
  {
    key: "human",
    className: "human",
    match: (task) => ["needs_review", "waiting_human", "blocked", "partial"].includes(task.status),
    name: "あなた",
    title: "判断担当",
    role: "返信確認・DM可否判断・目視確認",
    station: "確認ボード",
    accessory: "チェックリスト",
    monitor: "REVIEW",
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
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
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
      tasks.push({ ...JSON.parse(raw), __file: path.relative(ROOT, fullPath) });
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

function representativeTask(tasks, blueprint) {
  return tasks.find(blueprint.match);
}

function hasText(tasks, pattern) {
  return tasks.some((task) => pattern.test(`${task.id} ${task.title} ${task.summary} ${task.nextAction} ${(task.notes || []).join(" ")}`));
}

function buildOfficeCharacters(tasks, gitState) {
  return AGENT_BLUEPRINTS.map((blueprint) => {
    const task = representativeTask(tasks, blueprint);
    let status = task?.status || (blueprint.key === "mio" ? "running" : "idle");
    if (blueprint.key === "git" && (gitState.prospectCount > 0 || gitState.salesReportCount > 0)) status = task?.status === "success" ? "needs_review" : status;
    if (blueprint.key === "human" && !task) status = "needs_review";
    const meta = metaFor(status);
    const progress = Math.max(0, Math.min(100, Number(task?.progress ?? (blueprint.key === "mio" ? 100 : 0))));
    const phase = task?.phase || (blueprint.key === "mio" ? "案内中" : blueprint.key === "human" ? "返信確認待ち" : "待機中");

    return {
      ...blueprint,
      task,
      status,
      meta,
      progress,
      phase,
    };
  });
}

function buildSecretaryMessage(tasks, gitState) {
  const sheetsDone = tasks.some((task) =>
    task.status === "success" && /sheets-update-2026-06-02-instagram-dm|Instagram DM|Sheets更新|Google Sheets/i.test(`${task.id} ${task.title} ${task.summary}`),
  );
  const gitDone = tasks.some((task) =>
    task.status === "success" && /push完了|GitHub|commit|push/i.test(`${task.id} ${task.title} ${task.summary} ${task.phase}`),
  );
  const hasJune5 = hasText(tasks, /2026-06-05|返信確認|フォローアップ|反応欄/);
  const protectedFiles = gitState.prospectCount > 0 || gitState.salesReportCount > 0;

  const lines = [];
  if (sheetsDone) {
    lines.push("本日の記録作業は完了しています。Instagram DM送信済み10件はGoogle Sheetsに反映済みです。");
  } else {
    lines.push("Sheets更新の完了タスクは見つかりません。必要なら記録状況を目視確認してください。");
  }
  if (gitDone) lines.push("GitHubへの反映も完了済みです。");
  if (hasJune5) {
    lines.push("次は2026-06-05に返信確認とフォローアップ判断を行ってください。");
  } else {
    lines.push("次の人間タスクは返信確認、DM可否判断、Sheets目視確認です。");
  }
  if (protectedFiles) {
    lines.push("営業リスト系ファイルが残っているため、git add . は使わないでください。");
  }
  lines.push("追加DM、営業候補再生成、Google Sheets再送信は行いません。");
  return lines.join(" ");
}

function renderPixelHuman(character) {
  const typingClass = ["running", "checking"].includes(character.status) ? "is-typing" : "";
  const warnClass = ["blocked", "failed", "needs_review", "waiting_human", "partial"].includes(character.status) ? "has-warning" : "";
  return `<div class="pixel-human pixel-human--${character.className} ${typingClass} ${warnClass}">
    <div class="pixel-human__alert" aria-hidden="true">${character.meta.icon}</div>
    <div class="pixel-human__hair"></div>
    <div class="pixel-human__head">
      <span class="pixel-human__face"></span>
    </div>
    <div class="pixel-human__neck"></div>
    <div class="pixel-human__body">
      <span class="pixel-human__tie"></span>
      <span class="pixel-human__arm pixel-human__arm--left"></span>
      <span class="pixel-human__arm pixel-human__arm--right"></span>
    </div>
    <div class="pixel-human__legs">
      <span></span><span></span>
    </div>
    <div class="pixel-human__nameplate">${escapeHtml(character.name)}<small>${escapeHtml(character.title)}</small></div>
  </div>`;
}

function renderWorkstation(character) {
  return `<article class="workstation workstation--${character.key} ${character.meta.tone}">
    <div class="status-lamp" title="${escapeHtml(character.meta.label)}"></div>
    <div class="station-label">${escapeHtml(character.station)}</div>
    <div class="monitor">
      <div class="monitor__screen">${escapeHtml(character.monitor)}</div>
      <div class="monitor__base"></div>
    </div>
    ${renderPixelHuman(character)}
    <div class="desk">
      <div class="desk__item desk__item--paper">${escapeHtml(character.accessory)}</div>
      <div class="desk__keyboard"></div>
    </div>
    <div class="station-meta">
      <b>${character.meta.icon} ${escapeHtml(character.meta.label)}</b>
      <span>${escapeHtml(character.phase)}</span>
      <div class="mini-progress"><i style="width:${character.progress}%"></i></div>
    </div>
  </article>`;
}

function renderTaskBoard(humanTasks) {
  return `<aside class="task-board">
    <h3>あなたの確認ボード</h3>
    <ul>${humanTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
  </aside>`;
}

function renderAlertBoard(gitState, parseWarnings) {
  const alerts = [
    "git add . 禁止",
    "追加DM禁止",
    "営業候補再生成禁止",
    "Sheets再送信禁止",
    "Webhook URLやトークンを貼らない",
  ];
  if (gitState.prospectCount > 0) alerts.unshift(`営業リスト系: ${gitState.prospectCount}件保護`);
  if (gitState.salesReportCount > 0) alerts.unshift(`営業レポート系: ${gitState.salesReportCount}件保護`);
  if (!gitState.ok) alerts.unshift("git status 読み取り注意");
  alerts.push(...parseWarnings);

  return `<aside class="alert-board">
    <h3>注意アラート</h3>
    <ul>${alerts.map((alert) => `<li>${escapeHtml(alert)}</li>`).join("")}</ul>
  </aside>`;
}

function buildOfficeScene(characters, mioMessage, humanTasks, gitState, parseWarnings) {
  return `<section class="office-scene-wrap">
    <h2>AI社員オフィス</h2>
    <p class="scene-help">横幅が狭い場合は、事務所エリアを横スクロールできます。</p>
    <div class="office-scene" role="img" aria-label="AI社員が働くレトロゲーム風の事務所">
      <div class="office-wall">
        <div class="wall-clock"><span></span></div>
        <div class="window"><i></i><i></i><i></i><i></i></div>
        <div class="progress-lights">
          ${characters.map((character) => `<span class="${character.meta.tone}" title="${escapeHtml(character.name)}"></span>`).join("")}
        </div>
        <div class="whiteboard">
          <b>NEXT</b>
          <span>2026-06-05 返信確認</span>
          <span>追加DM禁止</span>
        </div>
      </div>
      <div class="office-floor">
        <div class="shelf"><span></span><span></span><span></span><span></span></div>
        <div class="plant"><span></span><i></i></div>
        <div class="mio-reception">
          ${renderWorkstation(characters.find((character) => character.key === "mio"))}
          <div class="speech-bubble">${escapeHtml(mioMessage)}</div>
        </div>
        <div class="workstations">
          ${characters.filter((character) => !["mio", "human"].includes(character.key)).map(renderWorkstation).join("")}
        </div>
        <div class="human-corner">
          ${renderWorkstation(characters.find((character) => character.key === "human"))}
          ${renderTaskBoard(humanTasks)}
        </div>
        ${renderAlertBoard(gitState, parseWarnings)}
      </div>
    </div>
  </section>`;
}

function renderTaskList(tasks) {
  return tasks
    .map((task) => {
      const meta = metaFor(task.status);
      return `<article class="task-row ${meta.tone}">
        <div class="task-status">${meta.icon}</div>
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

function buildPanels(tasks, humanTasks, gitState, parseWarnings) {
  const completed = tasks.filter((task) => task.status === "success").slice(0, 8);
  const recent = tasks.slice(0, 10);
  return `<div class="dashboard-panels">
    <section>
      <h2>今日完了したこと</h2>
      ${completed.length ? renderTaskList(completed) : "<p>完了タスクはまだありません。</p>"}
    </section>
    <section>
      <h2>次にやること</h2>
      <ul>${renderNextActions(tasks)}</ul>
    </section>
    <section>
      <h2>人間が必要なタスク</h2>
      <ul>${humanTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>注意アラート</h2>
      <ul class="alert-list">${renderWarnings(gitState, parseWarnings)}</ul>
    </section>
    <section class="wide-panel">
      <h2>Git状態</h2>
      ${renderGitState(gitState)}
    </section>
    <section class="wide-panel">
      <h2>最近のタスク一覧</h2>
      ${recent.length ? renderTaskList(recent) : "<p>タスクがありません。</p>"}
    </section>
  </div>`;
}

function buildStyles() {
  return `<style>
    :root {
      color-scheme: dark;
      --bg:#0d1320;
      --panel:#182338;
      --panel2:#26354f;
      --line:#72e7ff;
      --ok:#54df8c;
      --warn:#ffd166;
      --danger:#ff5c7a;
      --active:#7ab8ff;
      --idle:#91a1b2;
      --unknown:#cbd5e1;
      --text:#f2f7ff;
      --muted:#a8b5c9;
      --ink:#070b12;
      font-family:"MS Gothic","Yu Gothic",Consolas,monospace;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      color:var(--text);
      background:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
        radial-gradient(circle at 50% -8%, #293c66 0, #111827 42%, var(--bg) 100%);
      background-size:16px 16px,16px 16px,auto;
    }
    header { padding:28px clamp(16px,4vw,44px) 18px; border-bottom:4px solid var(--ink); background:rgba(8,12,22,.92); }
    h1,h2,h3,h4,p { letter-spacing:0; }
    h1 { margin:0; font-size:clamp(28px,5vw,50px); text-shadow:4px 4px 0 #000; }
    .subtitle { margin:8px 0 0; color:var(--muted); }
    .header-meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .chip { border:2px solid var(--line); background:#101827; padding:7px 10px; box-shadow:4px 4px 0 #000; }
    main { padding:22px clamp(12px,3vw,36px) 44px; display:grid; gap:22px; }
    section { border:4px solid var(--ink); background:rgba(24,35,56,.94); box-shadow:8px 8px 0 rgba(0,0,0,.45); padding:18px; }
    section h2 { margin:0 0 14px; color:#fff190; font-size:22px; text-shadow:2px 2px 0 #000; }
    .scene-help { margin:0 0 10px; color:var(--muted); }
    .office-scene-wrap { padding:14px; }
    .office-scene {
      min-width:1060px;
      max-width:1380px;
      margin:0 auto;
      border:5px solid #05070d;
      box-shadow:12px 12px 0 #000;
      overflow:hidden;
      background:#17223a;
    }
    .office-wall {
      position:relative;
      height:180px;
      background:
        linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px),
        linear-gradient(#253650, #1c2a43);
      background-size:42px 42px,auto;
      border-bottom:5px solid #05070d;
    }
    .wall-clock { position:absolute; left:34px; top:30px; width:58px; height:58px; border:5px solid #05070d; border-radius:50%; background:#f8fafc; box-shadow:5px 5px 0 #000; }
    .wall-clock span:before, .wall-clock span:after { content:""; position:absolute; left:27px; top:12px; width:4px; height:20px; background:#111827; transform-origin:bottom; }
    .wall-clock span:after { top:27px; height:17px; transform:rotate(90deg); }
    .window { position:absolute; right:44px; top:26px; width:190px; height:86px; border:5px solid #05070d; background:#9bdcff; box-shadow:6px 6px 0 #000; display:grid; grid-template-columns:1fr 1fr; }
    .window i { border:2px solid #05070d; background:linear-gradient(135deg, #bdf3ff, #6ca6ff); }
    .progress-lights { position:absolute; left:130px; top:36px; display:flex; gap:10px; padding:10px; border:4px solid #05070d; background:#101827; box-shadow:5px 5px 0 #000; }
    .progress-lights span { width:18px; height:18px; border:3px solid #000; background:var(--idle); box-shadow:0 0 12px currentColor; }
    .progress-lights .ok { background:var(--ok); }
    .progress-lights .warn { background:var(--warn); }
    .progress-lights .danger { background:var(--danger); animation:shake .7s steps(2) infinite; }
    .progress-lights .active { background:var(--active); animation:blink .9s steps(2) infinite; }
    .whiteboard { position:absolute; left:370px; top:25px; width:310px; min-height:104px; border:5px solid #05070d; background:#ecfeff; color:#0f172a; box-shadow:6px 6px 0 #000; padding:10px; display:grid; gap:4px; }
    .whiteboard b { color:#0f172a; font-size:18px; }
    .whiteboard span { border-left:6px solid #0ea5e9; padding-left:8px; }
    .office-floor {
      position:relative;
      min-height:650px;
      padding:24px 24px 30px;
      background:
        linear-gradient(45deg, rgba(255,255,255,.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.06) 75%),
        linear-gradient(45deg, rgba(255,255,255,.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.06) 75%),
        #172033;
      background-position:0 0,24px 24px;
      background-size:48px 48px;
    }
    .shelf { position:absolute; left:28px; top:18px; width:130px; height:160px; border:5px solid #05070d; background:#70492f; box-shadow:6px 6px 0 #000; padding:12px; display:grid; gap:8px; }
    .shelf span { background:#f97316; border:3px solid #05070d; }
    .plant { position:absolute; right:30px; bottom:42px; width:72px; height:118px; }
    .plant span { position:absolute; bottom:0; left:16px; width:42px; height:36px; border:4px solid #05070d; background:#9a5a2e; }
    .plant i, .plant:before, .plant:after { content:""; position:absolute; width:42px; height:42px; border:4px solid #05070d; background:#3bd671; }
    .plant i { left:14px; top:34px; }
    .plant:before { left:0; top:14px; transform:rotate(-20deg); }
    .plant:after { right:0; top:8px; transform:rotate(20deg); }
    .workstations { position:absolute; left:180px; top:66px; right:250px; display:grid; grid-template-columns:repeat(3, 1fr); gap:22px; }
    .mio-reception { position:absolute; left:36px; bottom:36px; width:330px; }
    .human-corner { position:absolute; right:28px; top:205px; width:340px; display:grid; gap:12px; }
    .workstation {
      position:relative;
      min-height:310px;
      border:4px solid #05070d;
      background:linear-gradient(#253650 0 55%, #6f472d 55% 100%);
      box-shadow:7px 7px 0 #000;
      padding:12px;
      color:var(--idle);
    }
    .workstation.ok { color:var(--ok); }
    .workstation.warn { color:var(--warn); }
    .workstation.danger { color:var(--danger); }
    .workstation.active { color:var(--active); }
    .workstation.unknown { color:var(--unknown); }
    .station-label { position:absolute; top:10px; left:10px; color:#f8fafc; font-size:12px; background:#05070d; padding:4px 6px; }
    .status-lamp { position:absolute; top:12px; right:12px; width:16px; height:16px; border:3px solid #05070d; background:currentColor; box-shadow:0 0 16px currentColor; animation:blink 1.4s steps(2) infinite; }
    .monitor { position:absolute; top:44px; left:50%; transform:translateX(-50%); width:112px; }
    .monitor__screen { height:58px; border:4px solid #05070d; background:#07111f; color:currentColor; display:grid; place-items:center; font-size:13px; box-shadow:4px 4px 0 #000; animation:monitorPulse 1.8s steps(2) infinite; }
    .monitor__base { width:44px; height:16px; margin:0 auto; border:4px solid #05070d; border-top:0; background:#1f2937; }
    .desk { position:absolute; left:22px; right:22px; bottom:38px; height:72px; border:4px solid #05070d; background:#8b5a36; box-shadow:5px 5px 0 #000; }
    .desk__keyboard { position:absolute; left:50%; bottom:8px; width:86px; height:12px; transform:translateX(-50%); border:3px solid #05070d; background:#dbeafe; }
    .desk__item { position:absolute; left:12px; top:10px; padding:3px 5px; border:3px solid #05070d; background:#f8fafc; color:#0f172a; font-size:10px; }
    .station-meta { position:absolute; left:12px; right:12px; bottom:6px; color:#f8fafc; display:grid; gap:3px; font-size:12px; }
    .mini-progress { height:8px; border:2px solid #05070d; background:#111827; }
    .mini-progress i { display:block; height:100%; background:currentColor; }
    .pixel-human { position:absolute; left:50%; bottom:97px; width:92px; height:154px; transform:translateX(-50%); z-index:2; color:#60a5fa; }
    .pixel-human__alert { display:none; position:absolute; top:-12px; right:2px; min-width:28px; height:28px; border:3px solid #05070d; background:#fff1f2; color:#be123c; font-weight:bold; place-items:center; box-shadow:4px 4px 0 #000; animation:shake .8s steps(2) infinite; }
    .pixel-human.has-warning .pixel-human__alert { display:grid; }
    .pixel-human__hair { position:absolute; left:24px; top:0; width:44px; height:18px; border:4px solid #05070d; background:#1f2937; }
    .pixel-human__head { position:absolute; left:20px; top:14px; width:52px; height:44px; border:4px solid #05070d; background:#f2c7a4; box-shadow:4px 4px 0 #000; }
    .pixel-human__face:before, .pixel-human__face:after { content:""; position:absolute; top:18px; width:6px; height:6px; background:#05070d; }
    .pixel-human__face:before { left:14px; }
    .pixel-human__face:after { right:14px; }
    .pixel-human__neck { position:absolute; left:38px; top:56px; width:18px; height:12px; border:3px solid #05070d; background:#f2c7a4; }
    .pixel-human__body { position:absolute; left:18px; top:66px; width:58px; height:54px; border:4px solid #05070d; background:currentColor; box-shadow:4px 4px 0 #000; }
    .pixel-human__tie { position:absolute; left:24px; top:4px; width:10px; height:26px; background:#f8fafc; border:2px solid #05070d; }
    .pixel-human__arm { position:absolute; top:8px; width:18px; height:54px; border:4px solid #05070d; background:currentColor; transform-origin:top center; }
    .pixel-human__arm--left { left:-20px; transform:rotate(12deg); }
    .pixel-human__arm--right { right:-20px; transform:rotate(-12deg); }
    .pixel-human.is-typing .pixel-human__arm--left { animation:typeLeft .55s steps(2) infinite; }
    .pixel-human.is-typing .pixel-human__arm--right { animation:typeRight .55s steps(2) infinite; }
    .pixel-human__legs { position:absolute; left:25px; top:118px; display:flex; gap:8px; }
    .pixel-human__legs span { width:18px; height:34px; border:4px solid #05070d; background:#1f2937; }
    .pixel-human__nameplate { position:absolute; left:50%; bottom:-34px; min-width:132px; transform:translateX(-50%); color:#f8fafc; background:#05070d; border:3px solid currentColor; padding:3px 6px; text-align:center; font-size:12px; box-shadow:3px 3px 0 #000; }
    .pixel-human__nameplate small { display:block; color:#cbd5e1; }
    .pixel-human--sheets { color:#22c55e; }
    .pixel-human--git { color:#a78bfa; }
    .pixel-human--mio { color:#f472b6; }
    .pixel-human--mio .pixel-human__hair { background:#fbbf24; }
    .pixel-human--human { color:#f97316; }
    .speech-bubble { position:absolute; left:160px; bottom:180px; width:420px; max-width:480px; border:5px solid #05070d; background:#f8fafc; color:#101827; padding:14px; line-height:1.7; box-shadow:7px 7px 0 #000; animation:floatBubble 2.5s ease-in-out infinite; z-index:4; }
    .speech-bubble:before { content:""; position:absolute; left:-24px; bottom:38px; border:12px solid transparent; border-right-color:#05070d; }
    .task-board, .alert-board { border:4px solid #05070d; box-shadow:5px 5px 0 #000; padding:12px; color:#0f172a; }
    .task-board { background:#ecfeff; }
    .alert-board { position:absolute; right:400px; bottom:34px; width:300px; background:#fff7ed; }
    .task-board h3, .alert-board h3 { margin:0 0 8px; color:#0f172a; }
    .task-board ul, .alert-board ul { margin:0; padding-left:18px; line-height:1.6; }
    .dashboard-panels { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:20px; }
    .wide-panel { grid-column:1 / -1; }
    .task-row { display:grid; grid-template-columns:38px 1fr; gap:10px; padding:12px; border:3px solid #05070d; background:#121a2a; box-shadow:4px 4px 0 #000; margin-bottom:10px; }
    .task-row.ok { border-color:var(--ok); }
    .task-row.warn { border-color:var(--warn); }
    .task-row.danger { border-color:var(--danger); }
    .task-row.active { border-color:var(--active); }
    .task-status { font-size:22px; color:#fef08a; }
    .task-row h4 { margin:0 0 4px; color:#fff; }
    .task-row p { margin:0 0 4px; color:#d7e3f5; line-height:1.5; }
    small { color:var(--muted); }
    ul { margin:0; padding-left:22px; line-height:1.8; }
    li strong, b { color:#fef08a; }
    .alert-list li { margin-bottom:6px; color:#ffd9df; }
    .git-grid { display:grid; grid-template-columns:repeat(4, minmax(120px,1fr)); gap:10px; margin-bottom:14px; }
    .git-grid div { border:3px solid #05070d; background:#101827; padding:12px; box-shadow:4px 4px 0 #000; }
    .git-grid b { display:block; color:var(--muted); font-size:12px; }
    .git-grid span { display:block; font-size:28px; color:#fff; margin-top:4px; }
    pre { max-height:210px; overflow:auto; white-space:pre-wrap; background:#05070d; border:3px solid #000; padding:12px; color:#dbeafe; }
    .footer-note { color:var(--muted); text-align:center; padding:18px; }
    @keyframes blink { 50% { opacity:.35; } }
    @keyframes monitorPulse { 50% { filter:brightness(1.5); } }
    @keyframes typeLeft { 50% { transform:rotate(30deg) translateY(4px); } }
    @keyframes typeRight { 50% { transform:rotate(-30deg) translateY(4px); } }
    @keyframes shake { 25% { transform:translateX(-2px); } 75% { transform:translateX(2px); } }
    @keyframes floatBubble { 50% { transform:translateY(-5px); } }
    @media (prefers-reduced-motion: reduce) {
      *, *:before, *:after { animation:none !important; transition:none !important; }
    }
    @media (max-width: 1120px) {
      .office-scene-wrap { overflow-x:auto; }
    }
    @media (max-width: 860px) {
      .dashboard-panels { grid-template-columns:1fr; }
      .git-grid { grid-template-columns:repeat(2, minmax(120px,1fr)); }
    }
    @media (max-width: 560px) {
      main { padding-inline:10px; }
      .git-grid { grid-template-columns:1fr; }
      .speech-bubble { font-size:13px; }
    }
  </style>`;
}

function renderHtml(tasks, parseWarnings, gitState) {
  const generatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const humanTasks = [
    "2026-06-05の返信確認",
    "返信内容の判断",
    "フォローアップ文面の確認",
    "Google Sheetsの目視確認",
    "DM送信可否判断",
    "営業リスト/営業レポートをコミットしない判断",
  ];
  const characters = buildOfficeCharacters(tasks, gitState);
  const mioMessage = buildSecretaryMessage(tasks, gitState);

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>自動化ビジネス司令室</title>
  ${buildStyles()}
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
    ${buildOfficeScene(characters, mioMessage, humanTasks, gitState, parseWarnings)}
    ${buildPanels(tasks, humanTasks, gitState, parseWarnings)}
    <p class="footer-note">この画面はローカル確認専用です。公開サイト、Next.js UI、Vercel本番には表示しません。</p>
  </main>
</body>
</html>`;
}

function main() {
  const { tasks, warnings } = readTasks();
  const gitState = readGitState();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, renderHtml(tasks, warnings, gitState), "utf8");
  console.log(`Rendered ${path.relative(ROOT, OUTPUT)} with ${tasks.length} task(s).`);
  if (warnings.length > 0) console.log(`Warnings: ${warnings.length}`);
}

main();
