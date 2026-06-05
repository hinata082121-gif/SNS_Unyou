"use client";

import { useState } from "react";

import type {
  AgentOfficeDashboardData,
  AgentOfficeDepartment,
  AgentOfficeDepartmentKey,
  SafeAgentTask,
} from "@/lib/agent-office";
import { AgentCard } from "./AgentCard";
import { StatusBadge } from "./StatusBadge";

export function AgentOfficeDashboard({
  data,
}: {
  data: AgentOfficeDashboardData;
}) {
  const [activeDepartmentKey, setActiveDepartmentKey] =
    useState<AgentOfficeDepartmentKey>("overall");
  const activeDepartment =
    data.departments.find((department) => department.key === activeDepartmentKey) ||
    data.departments[0];

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Header data={data} />
        <Summary data={data} />
        <DepartmentTabs
          departments={data.departments}
          activeKey={activeDepartment.key}
          onChange={setActiveDepartmentKey}
        />
        <DepartmentOverview department={activeDepartment} />
        <UrgentStrip tasks={activeDepartment.urgentTasks} />
        <PixelOffice tasks={activeDepartment.tasks.slice(0, 5)} />
        <Panels data={data} department={activeDepartment} />
        <SafetyNotes />
      </section>
    </main>
  );
}

export function LockedAgentOffice() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08111f] px-4 text-white">
      <section className="w-full max-w-lg border border-white/15 bg-slate-950 p-6 shadow-[0_0_0_2px_rgba(255,255,255,0.05)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          ICHI Agent Office
        </p>
        <h1 className="mt-4 text-2xl font-black">アクセスキーが必要です</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          このページは内部運用状況の確認用です。Vercel環境変数
          `AGENT_OFFICE_ACCESS_KEY` と一致する `?key=...` を付けてアクセスしてください。
        </p>
        <div className="mt-5 border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-50">
          URL共有やスクリーンショット共有時は、keyを外部へ見せないでください。
        </div>
      </section>
    </main>
  );
}

function Header({ data }: { data: AgentOfficeDashboardData }) {
  return (
    <header className="grid gap-5 border border-white/15 bg-slate-950/80 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
          AIアバター進捗確認室
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-5xl">
          ICHI Agent Office
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
          Hermes Agent、Codex、Apps Script、Gmail営業、Threads運用、Instagram運用の状態を表示専用で確認します。
          自動業務の結果はAgent status更新とGit pushを通じて反映されます。
          ここから送信・投稿・Sheets更新は実行されません。
        </p>
      </div>
      <div className="border border-cyan-300/30 bg-cyan-300/10 p-4">
        <p className="text-xs font-black text-cyan-100">最終生成</p>
        <p className="mt-2 font-number text-lg font-black">
          {formatFullDate(data.generatedAt)}
        </p>
        <p className="mt-2 text-sm text-cyan-50">{data.topState}</p>
      </div>
    </header>
  );
}

function DepartmentTabs({
  departments,
  activeKey,
  onChange,
}: {
  departments: AgentOfficeDepartment[];
  activeKey: AgentOfficeDepartmentKey;
  onChange: (key: AgentOfficeDepartmentKey) => void;
}) {
  return (
    <nav className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Agent Office部門">
      {departments.map((department) => {
        const active = department.key === activeKey;
        return (
          <button
            key={department.key}
            type="button"
            onClick={() => onChange(department.key)}
            className={`min-h-20 border p-4 text-left transition ${
              active
                ? "border-cyan-200/60 bg-cyan-200/15 text-white"
                : "border-white/15 bg-slate-950/70 text-slate-300 hover:border-white/30"
            }`}
          >
            <span className="text-sm font-black">{department.label}</span>
            <span className="mt-2 block text-xs leading-5">{department.description}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DepartmentOverview({ department }: { department: AgentOfficeDepartment }) {
  const blockedCount = department.tasks.filter(
    (task) => task.status === "blocked" || task.status === "failed" || task.status === "stale",
  ).length;
  const reviewCount = department.tasks.filter((task) => task.status === "needs_review").length;
  const successCount = department.tasks.filter((task) => task.status === "success").length;

  return (
    <section className="mt-4 grid gap-3 border border-white/15 bg-slate-950/70 p-4 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
          {department.label}
        </p>
        <h2 className="mt-2 text-2xl font-black">{department.description}</h2>
      </div>
      <DepartmentMetric label="停止/未反映" value={blockedCount} />
      <DepartmentMetric label="確認待ち" value={reviewCount} />
      <DepartmentMetric label="完了" value={successCount} />
      <DepartmentMetric label="合計" value={department.tasks.length} />
    </section>
  );
}

function DepartmentMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-number text-3xl font-black">{value}</p>
    </div>
  );
}

function Summary({ data }: { data: AgentOfficeDashboardData }) {
  const cards = [
    ["failed", "失敗", data.counts.failed],
    ["blocked", "停止", data.counts.blocked],
    ["success", "完了", data.counts.success],
    ["needs_review", "確認待ち", data.counts.needs_review],
    ["running", "実行中", data.counts.running],
    ["scheduled", "予定", data.counts.scheduled],
  ] as const;

  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map(([status, label, value]) => (
        <div key={status} className="border border-white/15 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-300">{label}</p>
            <StatusBadge status={status} />
          </div>
          <p className="mt-4 font-number text-4xl font-black">{value}</p>
        </div>
      ))}
    </section>
  );
}

function UrgentStrip({ tasks }: { tasks: SafeAgentTask[] }) {
  if (!tasks.length) {
    return (
      <section className="mt-4 border border-emerald-300/25 bg-emerald-300/10 p-4">
        <p className="text-sm font-black text-emerald-50">自動化正常稼働中</p>
        <p className="mt-2 text-sm leading-7 text-emerald-50">
          現在、最優先で止まっているタスクはありません。人間確認待ちがある場合は下の「人間確認が必要」を確認してください。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 border border-red-300/35 bg-red-400/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-red-50">重要アラート</p>
          <p className="mt-1 text-sm text-red-100">
            停止、失敗、またはメール確認が必要なタスクです。人間が次アクションを確認してください。
          </p>
        </div>
        <span className="border border-red-200/30 px-3 py-1 text-xs font-black text-red-50">
          {tasks.length}件
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <div key={task.id} className="border border-red-200/20 bg-slate-950/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-red-100">{task.categoryLabel}</p>
                <p className="mt-1 text-sm font-black text-white">{task.title}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-red-50">{task.nextAction}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PixelOffice({ tasks }: { tasks: SafeAgentTask[] }) {
  return (
    <section className="mt-4 overflow-hidden border border-white/15 bg-[#0c1830]">
      <div className="grid min-h-[520px] grid-rows-[160px_1fr] lg:min-h-[460px]">
        <div className="relative border-b border-white/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] p-5">
          <div className="absolute left-5 top-5 h-16 w-28 border border-cyan-200/30 bg-cyan-200/10" />
          <div className="absolute right-5 top-5 w-56 border border-white/15 bg-slate-950/60 p-3">
            <p className="text-xs font-black text-slate-300">今日の確認</p>
            <p className="mt-2 text-sm leading-6 text-white">
              Gmail 30件は手動承認待ち。Hermesは監視、Codexは記録。
            </p>
          </div>
          <div className="absolute bottom-5 left-5 flex gap-2">
            {["bg-emerald-300", "bg-amber-300", "bg-sky-300"].map((color) => (
              <span key={color} className={`block size-3 ${color}`} />
            ))}
          </div>
        </div>
        <div className="relative overflow-x-auto bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%),linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%)] bg-[position:0_0,16px_16px] bg-[size:32px_32px] p-4">
          <div className="grid min-w-[840px] grid-cols-5 gap-4">
            {tasks.map((task) => (
              <Workstation key={task.id} task={task} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Workstation({ task }: { task: SafeAgentTask }) {
  return (
    <div className="relative min-h-64 border border-white/10 bg-slate-950/45 p-3">
      <div className="mx-auto h-10 w-24 border border-cyan-200/25 bg-cyan-200/10" />
      <div className="mx-auto mt-2 h-3 w-16 bg-slate-800" />
      <div className="mx-auto mt-4 grid h-24 w-20 place-items-center border border-white/15 bg-slate-900">
        <div className="relative h-16 w-12">
          <div className="absolute left-3 top-0 h-6 w-6 bg-amber-100" />
          <div className="absolute left-2 top-5 h-8 w-8 bg-gradient-to-b from-slate-200 to-slate-500" />
          <div className="absolute left-0 top-6 h-3 w-3 bg-amber-100" />
          <div className="absolute right-0 top-6 h-3 w-3 bg-amber-100" />
          <div className="absolute bottom-0 left-3 h-4 w-2 bg-slate-300" />
          <div className="absolute bottom-0 right-3 h-4 w-2 bg-slate-300" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-center text-xs font-black text-slate-300">{task.categoryLabel}</p>
        <p className="mt-2 line-clamp-2 text-center text-sm font-black text-white">
          {task.title}
        </p>
      </div>
      <div className="absolute right-2 top-2">
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

function Panels({
  data,
  department,
}: {
  data: AgentOfficeDashboardData;
  department: AgentOfficeDepartment;
}) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
      <div className="grid gap-4">
        {department.tasks.slice(0, 6).map((task) => (
          <AgentCard key={task.id} task={task} />
        ))}
      </div>
      <aside className="grid content-start gap-4">
        {data.replyCheckTask ? <ReplyCheckPanel task={data.replyCheckTask} /> : null}
        <ActionPanel title="人間確認が必要" tasks={department.urgentTasks} />
        <ActionPanel
          title="次にやること"
          tasks={department.tasks.filter((task) => task.nextAction && task.status !== "success").slice(0, 6)}
        />
        <CategoryPanel groups={department.categoryGroups} />
        <TaskList tasks={department.tasks.slice(0, 10)} />
      </aside>
    </section>
  );
}

function ReplyCheckPanel({ task }: { task: SafeAgentTask }) {
  const repliedCount = metricValue(task, "repliedCount", "0");
  const unreadReplyCount = metricValue(task, "unreadReplyCount", "0");
  const needsHuman = metricValue(task, "needsHumanEmailCheck", "false") === "true";
  const lastReplyCheckAt = metricValue(task, "lastReplyCheckAt", "未実行");
  const nextReplyCheckAt = metricValue(task, "nextReplyCheckAt", "未設定");
  const autoReplyEnabled = metricValue(task, "autoReplyEnabled", "false");

  return (
    <section
      className={`border p-4 ${
        needsHuman || Number(unreadReplyCount) > 0
          ? "border-amber-300/40 bg-amber-300/10"
          : "border-emerald-300/25 bg-emerald-300/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Gmail返信確認</h2>
          <p className="mt-1 text-sm text-slate-300">
            現在メール確認: {needsHuman ? "必要" : "不要"}
          </p>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ReplyMetric label="返信あり" value={repliedCount} />
        <ReplyMetric label="未読返信" value={unreadReplyCount} />
        <ReplyMetric label="最終確認" value={formatMetricDate(lastReplyCheckAt)} />
        <ReplyMetric label="次回確認" value={formatMetricDate(nextReplyCheckAt)} />
      </div>
      <div className="mt-3 border border-white/10 bg-slate-950/50 p-3 text-sm leading-6 text-slate-200">
        自動返信: {autoReplyEnabled === "true" ? "ON" : "OFF"}
        <br />
        返信本文、メールアドレス、営業先名は表示しません。
      </div>
    </section>
  );
}

function ReplyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-16 border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words font-number text-sm font-black text-white">{value}</p>
    </div>
  );
}

function CategoryPanel({ groups }: { groups: AgentOfficeDepartment["categoryGroups"] }) {
  return (
    <section className="border border-white/15 bg-slate-950/80 p-4">
      <h2 className="text-lg font-black text-white">業務カテゴリ</h2>
      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const lead = group.tasks[0];
          return (
            <div key={group.key} className="border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{group.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {group.description}
                  </p>
                </div>
                {lead ? <StatusBadge status={lead.status} /> : null}
              </div>
              <p className="mt-2 text-xs text-slate-300">{group.tasks.length}件</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActionPanel({
  title,
  tasks,
}: {
  title: string;
  tasks: SafeAgentTask[];
}) {
  return (
    <section className="border border-white/15 bg-slate-950/80 p-4">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-black text-slate-400">{task.role}</p>
              <p className="mt-1 text-sm font-bold leading-6 text-white">
                {task.nextAction}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-300">現在表示する項目はありません。</p>
        )}
      </div>
    </section>
  );
}

function TaskList({ tasks }: { tasks: SafeAgentTask[] }) {
  return (
    <section className="border border-white/15 bg-slate-950/80 p-4">
      <h2 className="text-lg font-black text-white">最近のタスク</h2>
      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="grid grid-cols-[1fr_auto] gap-3 border border-white/10 bg-white/5 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{task.title}</p>
              <p className="mt-1 text-xs text-slate-400">{task.phase}</p>
            </div>
            <StatusBadge status={task.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SafetyNotes() {
  return (
    <section className="mt-4 border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm leading-7 text-emerald-50">
      <h2 className="font-black">Safety Notes</h2>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        <li>このページは表示専用です。</li>
        <li>Gmail送信、Threads投稿、自動返信、Instagram操作は実行しません。</li>
        <li>営業先名、メールアドレス、URL、秘密情報は表示しません。</li>
        <li>`data/gmail/`、`data/prospects/`、`tmp/` は読み込みません。</li>
      </ul>
    </section>
  );
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function metricValue(task: SafeAgentTask, label: string, fallback: string) {
  return task.metrics.find((metric) => metric.label === label)?.value || fallback;
}

function formatMetricDate(value: string) {
  if (!value || value === "null" || value === "未実行" || value === "未設定") return value;
  return formatFullDate(value);
}
