import type { AgentOfficeDashboardData, SafeAgentTask } from "@/lib/agent-office";
import { AgentCard } from "./AgentCard";
import { StatusBadge } from "./StatusBadge";

export function AgentOfficeDashboard({
  data,
}: {
  data: AgentOfficeDashboardData;
}) {
  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Header data={data} />
        <Summary data={data} />
        <PixelOffice tasks={data.featuredTasks} />
        <Panels data={data} />
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
          Hermes Agent、Codex、Apps Script、Gmail営業、Instagram運用の状態を表示専用で確認します。
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

function Summary({ data }: { data: AgentOfficeDashboardData }) {
  const cards = [
    ["success", "完了", data.counts.success],
    ["needs_review", "確認待ち", data.counts.needs_review],
    ["blocked", "停止", data.counts.blocked],
    ["running", "実行中", data.counts.running],
  ] as const;

  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <p className="text-center text-xs font-black text-slate-300">{task.role}</p>
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

function Panels({ data }: { data: AgentOfficeDashboardData }) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
      <div className="grid gap-4">
        {data.featuredTasks.map((task) => (
          <AgentCard key={task.id} task={task} />
        ))}
      </div>
      <aside className="grid content-start gap-4">
        <ActionPanel title="人間確認が必要" tasks={data.humanReviewTasks} />
        <ActionPanel title="次にやること" tasks={data.nextActions} />
        <TaskList tasks={data.tasks.slice(0, 10)} />
      </aside>
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
        <li>Gmail送信、自動返信、Instagram操作は実行しません。</li>
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
