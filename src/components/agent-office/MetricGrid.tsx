import type { SafeMetric } from "@/lib/agent-office";

export function MetricGrid({ metrics }: { metrics: SafeMetric[] }) {
  if (!metrics.length) {
    return (
      <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
        安全に表示できるmetricsはありません。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="min-h-16 border border-white/10 bg-white/5 p-3"
        >
          <p className="break-words text-[11px] font-bold uppercase text-slate-400">
            {metric.label}
          </p>
          <p className="mt-1 break-words font-number text-lg font-black text-white">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}
