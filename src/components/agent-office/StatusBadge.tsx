import type { AgentOfficeStatus } from "@/lib/agent-office";

const STATUS_LABELS: Record<AgentOfficeStatus, string> = {
  success: "完了",
  needs_review: "確認待ち",
  blocked: "停止",
  running: "実行中",
  checking: "確認中",
  scheduled: "予定",
  partial: "一部完了",
  failed: "失敗",
  skipped: "未実行",
  stale: "未反映",
  unknown: "不明",
};

const STATUS_CLASSES: Record<AgentOfficeStatus, string> = {
  success: "border-emerald-400/50 bg-emerald-400/15 text-emerald-100",
  needs_review: "border-amber-300/50 bg-amber-300/15 text-amber-100",
  blocked: "border-red-400/50 bg-red-400/15 text-red-100",
  running: "border-sky-300/50 bg-sky-300/15 text-sky-100",
  checking: "border-sky-300/50 bg-sky-300/15 text-sky-100",
  scheduled: "border-indigo-300/50 bg-indigo-300/15 text-indigo-100",
  partial: "border-orange-300/50 bg-orange-300/15 text-orange-100",
  failed: "border-red-400/50 bg-red-400/15 text-red-100",
  skipped: "border-neutral-300/40 bg-neutral-300/10 text-neutral-200",
  stale: "border-fuchsia-300/50 bg-fuchsia-300/15 text-fuchsia-100",
  unknown: "border-neutral-300/40 bg-neutral-300/10 text-neutral-200",
};

export function StatusBadge({ status }: { status: AgentOfficeStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-md border px-3 py-1 text-xs font-black ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
