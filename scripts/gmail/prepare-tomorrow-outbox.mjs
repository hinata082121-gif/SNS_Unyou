import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { addDaysToDate, buildBatchId, jstDate, parseArgs, writeJson } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/prepare-tomorrow-outbox.mjs [--date YYYY-MM-DD|tomorrow]

Prepares the next Gmail outbox through the safe local selector and writes Agent Status metadata. It does not send email, update Google Sheets, operate Apps Script triggers, or print recipients.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = resolveTargetDate(args.date);
const sendBatchId = buildBatchId(sendDate);
const nextActionDate = addDaysToDate(sendDate, 2);
const startedAt = new Date().toISOString();
const result = spawnSync('node', [
  'scripts/gmail/select-daily-gmail-outbox.mjs',
  '--date',
  sendDate,
  '--next-action-date',
  nextActionDate
], {
  encoding: 'utf8',
  shell: process.platform === 'win32'
});

const summary = parseSummary(result.stdout);
const selectedCount = Number(summary.selected || 0);
const duplicateCount = Number(summary.duplicateCount || 0);
const success = result.status === 0 && selectedCount === 30 && duplicateCount === 0 && summary.sheetsReadyTsvCreated === true;
const status = success ? 'needs_review' : 'blocked';
const task = {
  id: `gmail-next-day-outbox-${sendDate}`,
  agent: 'Hermes',
  avatar: 'ops-monitor',
  title: `${sendDate} Gmail翌日outbox30件準備`,
  category: 'gmail_outbox',
  status,
  phase: success ? '翌日outbox30件作成済み・Sheet反映待ち' : '翌日outbox30件作成blocked',
  progress: success ? 80 : 40,
  priority: 'high',
  createdAt: `${sendDate}T00:00:00.000Z`,
  updatedAt: startedAt,
  summary: success
    ? `${sendDate}分のGmail outbox30件とSheets貼り付け用TSVを作成。安全なSheets自動反映経路が未確認のため、Sheet反映とPreflight確認はneeds_review。`
    : `${sendDate}分のGmail outbox30件を作成できなかった。候補不足または重複検出により送信準備はblocked。`,
  artifacts: [
    'docs/hermes-gmail-daily-monitoring-2026-06-03.md'
  ],
  metrics: {
    sendDate,
    sendBatchId,
    selectedCount,
    selectedCountTarget: 30,
    poolTotal: Number(summary.poolTotal || 0),
    availableChecked: Number(summary.availableChecked || 0),
    excludedHistorical: Number(summary.excludedHistorical || 0),
    duplicateCount,
    duplicateWithPreviousBatch: Boolean(summary.duplicateWithPreviousBatch),
    duplicateWithPastSent: duplicateCount > 0,
    shortage: Number(summary.shortage || Math.max(0, 30 - selectedCount)),
    outboxCreated: Boolean(summary.outboxCreated),
    sheetsReadyTsvCreated: Boolean(summary.sheetsReadyTsvCreated),
    sheetSynced: false,
    sheetReadyRowsExpected: success ? 30 : 0,
    preflightPending: success,
    manualPasteRequired: true,
    gmailSendExecuted: false,
    googleSheetsUpdatedByThisScript: false
  },
  nextAction: success
    ? 'Gmail送信対象シートへ翌日TSVを安全経路で反映し、runPreflightDiagnosticsOnly()とrunPreflightCheckOnly()でreadyRows=30を確認する'
    : 'Gmail-ready候補を補充し、過去送信済みと重複しない30件を再選出する',
  safeToAct: success,
  notes: [
    'Gmail送信なし',
    'Google Sheets直接更新なし',
    'Apps Scriptトリガー操作なし',
    '送信済み行をreadyへ戻さない',
    'outbox本体とTSV本文はGit追加禁止',
    'メールアドレス・営業先名・本文全文は表示しない'
  ]
};

writeJson(path.join('data', 'agent-status', 'tasks', `${task.id}.json`), task);
console.log(JSON.stringify({
  sendDate,
  sendBatchId,
  selectedCount,
  duplicateCount,
  duplicateWithPreviousBatch: Boolean(summary.duplicateWithPreviousBatch),
  duplicateWithPastSent: duplicateCount > 0,
  sheetsReadyTsvCreated: Boolean(summary.sheetsReadyTsvCreated),
  sheetSynced: false,
  manualPasteRequired: true,
  status
}, null, 2));

process.exit(success ? 0 : 2);

function resolveTargetDate(value) {
  const raw = String(value || 'tomorrow').trim().toLowerCase();
  if (raw === 'tomorrow') return jstDate(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  throw new Error('date must be YYYY-MM-DD or tomorrow');
}

function parseSummary(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
