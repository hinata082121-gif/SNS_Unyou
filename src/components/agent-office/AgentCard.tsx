import type { SafeAgentTask } from "@/lib/agent-office";
import { MetricGrid } from "./MetricGrid";
import { StatusBadge } from "./StatusBadge";

const ROLE_COLORS: Record<string, string> = {
  Gmail営業送信: "from-sky-400 to-cyan-200",
  Gmail候補プール補充: "from-emerald-400 to-lime-200",
  Hermes監視: "from-violet-400 to-indigo-200",
  Instagram運用: "from-pink-400 to-orange-200",
  "Agent Office": "from-amber-300 to-yellow-100",
};

export function AgentCard({ task }: { task: SafeAgentTask }) {
  const color = ROLE_COLORS[task.role] || "from-slate-300 to-white";

  return (
    <article className="grid gap-4 border border-white/15 bg-slate-950/75 p-4 shadow-[0_0_0_2px_rgba(255,255,255,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PixelAvatar gradient={color} status={task.status} />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              {task.categoryLabel} / {task.role}
            </p>
            <h2 className="mt-1 break-words text-lg font-black leading-snug text-white">
              {task.title}
            </h2>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-300">{task.phase}</p>
          <p className="font-number text-xs font-black text-slate-300">
            {task.progress}%
          </p>
        </div>
        <div className="h-2 border border-white/10 bg-slate-900">
          <div
            className={`h-full bg-gradient-to-r ${color}`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      <p className="text-sm leading-7 text-slate-300">{task.summary}</p>

      <div className="border border-amber-300/20 bg-amber-300/10 p-3">
        <p className="text-xs font-black text-amber-100">次にやること</p>
        <p className="mt-2 text-sm leading-7 text-amber-50">{task.nextAction}</p>
      </div>

      <MetricGrid metrics={task.metrics} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>priority: {task.priority}</span>
        <span>updated: {formatDate(task.updatedAt)}</span>
      </div>
    </article>
  );
}

function PixelAvatar({
  gradient,
  status,
}: {
  gradient: string;
  status: SafeAgentTask["status"];
}) {
  const lamp =
    status === "success"
      ? "bg-emerald-300"
      : status === "blocked" || status === "failed"
        ? "bg-red-300"
        : status === "needs_review"
          ? "bg-amber-300"
          : "bg-sky-300";

  return (
    <div className="relative grid h-20 w-16 shrink-0 place-items-center border border-white/15 bg-slate-900">
      <span className={`absolute right-1 top-1 size-2 ${lamp}`} />
      <div className="relative h-14 w-10">
        <div className="absolute left-2 top-0 h-5 w-6 border border-slate-950 bg-amber-100" />
        <div className={`absolute left-1 top-5 h-6 w-8 bg-gradient-to-b ${gradient}`} />
        <div className="absolute left-0 top-5 h-2 w-2 bg-amber-100" />
        <div className="absolute right-0 top-5 h-2 w-2 bg-amber-100" />
        <div className="absolute bottom-0 left-2 h-3 w-2 bg-slate-300" />
        <div className="absolute bottom-0 right-2 h-3 w-2 bg-slate-300" />
        <div className="absolute left-3 top-2 h-1 w-1 bg-slate-950" />
        <div className="absolute right-3 top-2 h-1 w-1 bg-slate-950" />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "未確認";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
