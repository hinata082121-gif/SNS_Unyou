#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, safeSummary, writeJson } from '../gmail/pool-utils.mjs';

function showHelp() {
  console.log(`Usage: node scripts/sales/record-reply-kpis.mjs --date YYYY-MM-DD --sent 30 --positive 0 --neutral 0 --negative 0 --opt-out 0 --auto-reply 0 --meeting 0 --won 0

Records safe daily sales KPI counts only. Does not read email bodies, recipients, prospect names, or Gmail threads.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  showHelp();
  process.exit(0);
}

const date = String(args.date || new Date().toISOString().slice(0, 10));
const sentCount = toCount(args.sent || args.sentCount);
const positiveReplyCount = toCount(args.positive || args.positiveReplyCount);
const neutralReplyCount = toCount(args.neutral || args.neutralReplyCount);
const negativeReplyCount = toCount(args.negative || args.negativeReplyCount);
const optOutCount = toCount(args['opt-out'] || args.optOutCount);
const autoReplyCount = toCount(args['auto-reply'] || args.autoReplyCount);
const unknownReplyCount = toCount(args.unknown || args.unknownReplyCount);
const meetingCount = toCount(args.meeting || args.meetingCount);
const wonCount = toCount(args.won || args.wonCount);
const replyCount = positiveReplyCount + neutralReplyCount + negativeReplyCount + optOutCount + autoReplyCount + unknownReplyCount;

const record = {
  date,
  sentCount,
  replyCount,
  positiveReplyCount,
  neutralReplyCount,
  negativeReplyCount,
  optOutCount,
  autoReplyCount,
  unknownReplyCount,
  meetingCount,
  wonCount,
  totalReplyRate: rate(replyCount, sentCount),
  positiveReplyRate: rate(positiveReplyCount, sentCount),
  meetingRate: rate(meetingCount, sentCount),
  salesConversionRate: rate(wonCount, sentCount),
  containsSensitiveData: false,
  source: 'manual_safe_counts'
};

const task = {
  id: `sales-kpi-${date}`,
  agent: 'Hermes',
  avatar: 'sales-scout',
  title: `${date} ICHI Social営業KPI`,
  category: 'sales_growth',
  status: 'needs_review',
  phase: '営業KPI件数記録',
  progress: 60,
  priority: 'high',
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: new Date().toISOString(),
  summary: 'Gmail営業と追客の安全な件数KPIのみを記録。メール本文、メールアドレス、営業先名、返信本文は扱わない。',
  metrics: record,
  nextAction: '週次レビューで返信率、ポジティブ返信率、商談化率を確認し、翌週の文面とThreads投稿を改善する。',
  safeToAct: true,
  notes: [
    '件数のみ',
    'メール本文なし',
    'メールアドレスなし',
    '営業先名なし',
    '返信本文なし'
  ],
  artifacts: [
    'docs/sales/ichi-social-kpi-plan-2026-06-12.md'
  ]
};

writeJson(path.join('data', 'agent-status', 'tasks', `${task.id}.json`), task);
console.log(safeSummary({ ok: true, ...record }));

function toCount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function rate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}
