import fs from 'node:fs';
import path from 'node:path';
import { buildBatchId, jstDate, parseArgs, writeJson } from './pool-utils.mjs';

const TASK_DIR = path.join('data', 'agent-status', 'tasks');

function printHelp() {
  console.log(`Usage: node scripts/gmail/record-daily-send-result.mjs [--date YYYY-MM-DD] [--send-batch-id ID] --processed N --failed N [--batch-marked-sent true|false] [--live-send-reset-after-run true|false]

Records safe Gmail daily send result metadata into Agent Status JSON. Does not send email, read message bodies, update Sheets, or operate Apps Script triggers.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = String(args.date || jstDate(0));
const sendBatchId = String(args['send-batch-id'] || buildBatchId(sendDate));
const processed = numberArg(args.processed, 0);
const failedCount = numberArg(args.failed ?? args['failed-count'], 0);
const sentCount = numberArg(args.sent ?? args['sent-count'], Math.max(0, processed - failedCount));
const batchMarkedSent = booleanArg(args['batch-marked-sent'], failedCount === 0 && processed > 0);
const liveSendResetAfterRun = booleanArg(args['live-send-reset-after-run'], failedCount === 0 && processed > 0);
const newlineIssueResolved = booleanArg(args['newline-issue-resolved'], true);
const staleBatchIssueResolved = booleanArg(args['stale-batch-issue-resolved'], true);
const updatedAt = new Date().toISOString();

if (!/^\d{4}-\d{2}-\d{2}$/.test(sendDate)) {
  throw new Error('sendDate must be YYYY-MM-DD');
}
if (!sendBatchId || /r2-2026-06-05$/.test(sendBatchId) && sendDate !== '2026-06-05') {
  throw new Error('sendBatchId is invalid for the requested sendDate');
}

const success = processed === 30 && failedCount === 0 && batchMarkedSent && liveSendResetAfterRun;
const dailyTask = {
  id: `gmail-daily-sales-send-${sendDate}`,
  agent: 'Hermes',
  avatar: 'ops-monitor',
  title: `${sendDate} Gmail営業30件送信`,
  category: 'gmail_send',
  status: success ? 'success' : 'needs_review',
  phase: success ? `${sendDate} Gmail営業30件送信完了` : `${sendDate} Gmail営業送信結果の人間確認待ち`,
  progress: success ? 100 : 75,
  priority: 'high',
  createdAt: `${sendDate}T00:00:00.000Z`,
  updatedAt,
  summary: success
    ? `${sendDate}分のGmail営業30件送信が完了。安全な件数だけをAgent Officeへ反映し、同一batchの再送信は禁止する。`
    : `${sendDate}分のGmail営業送信結果に未解決項目があるため、人間確認が必要。`,
  artifacts: [
    'docs/gmail/gmail-recovery-stale-batch-2026-06-07.md'
  ],
  metrics: {
    sendDate,
    sendBatchId,
    targetSendCount: 30,
    processed,
    sentCount,
    failedCount,
    dryRun: false,
    liveSendEnabled: true,
    batchMarkedSent,
    liveSendResetAfterRun,
    newlineIssueResolved,
    staleBatchIssueResolved,
    safeToSendAgain: false
  },
  nextAction: success
    ? `${sendDate}分は再送信禁止。送信後確認、返信確認、翌日outbox準備、Agent Office反映監査へ進む。`
    : `${sendDate}分の送信結果ログを安全な件数だけ確認し、再送信せずneeds_review/blockedを解消する。`,
  safeToAct: success,
  notes: [
    'Gmail送信関数はこのスクリプトから実行しない',
    'Google Sheets直接更新なし',
    '送信済み行をreadyへ戻さない',
    '自動返信なし',
    'Apps Scriptトリガー操作なし',
    'メールアドレス・営業先名・本文全文・返信本文は記録しない'
  ]
};

writeTask(dailyTask);
updateRelatedTask(sendDate, sendBatchId, processed, failedCount, success, updatedAt);
console.log(JSON.stringify({
  recorded: true,
  sendDate,
  sendBatchId,
  processed,
  sentCount,
  failedCount,
  batchMarkedSent,
  liveSendResetAfterRun,
  status: dailyTask.status,
  safeToSendAgain: false
}, null, 2));

function updateRelatedTask(sendDateText, batchId, processedCount, failed, successValue, updatedAtText) {
  updateTask(`gmail-next-day-outbox-${sendDateText}`, (task) => {
    task.status = successValue ? 'success' : 'needs_review';
    task.phase = successValue ? `${sendDateText}用outbox/TSV使用済み・送信成功` : `${sendDateText}用outbox/TSV使用後確認待ち`;
    task.progress = successValue ? 100 : Math.max(Number(task.progress || 0), 80);
    task.updatedAt = updatedAtText;
    task.summary = successValue
      ? `${sendDateText}用outbox/TSVは使用済み。送信成功後のため同一batchの再送信は禁止する。`
      : `${sendDateText}用outbox/TSVの送信結果確認が必要。`;
    task.metrics = {
      ...(task.metrics || {}),
      sendDate: sendDateText,
      sendBatchId: batchId,
      sheetPasted: successValue ? true : task.metrics?.sheetPasted ?? false,
      preflightPassed: successValue ? true : task.metrics?.preflightPassed ?? false,
      gmailSendExecuted: processedCount > 0,
      processed: processedCount,
      failed,
      safeToSendAgain: false
    };
    task.nextAction = successValue
      ? `${sendDateText}分は再送信せず、翌日outbox準備と返信確認へ進む`
      : `${sendDateText}分は再送信せず、送信結果の安全な件数確認へ進む`;
    task.notes = uniqueNotes([...(task.notes || []), '再送信禁止', '送信済み行をreadyへ戻さない']);
    return task;
  });

  updateTask('gmail-send-stopped-stale-batch-2026-06-07', (task) => {
    if (sendDateText !== '2026-06-08' || !successValue) return task;
    task.status = 'success';
    task.phase = '6/5固定batch問題の復旧完了・6/8通常送信成功';
    task.progress = 100;
    task.updatedAt = updatedAtText;
    task.metrics = {
      ...(task.metrics || {}),
      sentOn20260608: 30,
      staleSendDateResolved: true,
      staleBatchIdResolved: true,
      expectedSendDateRecovered: '2026-06-08',
      expectedSendBatchIdRecovered: 'gmail-sales-2026-06-08',
      dailyRotationFixed: true,
      liveSendResetAfterRun: true,
      shouldResendOldBatch: false
    };
    task.nextAction = '6/9以降の日次ローテーションと17:20翌日outbox準備を監視する';
    task.notes = uniqueNotes([...(task.notes || []), '6/5送信済み行をreadyへ戻していない', '6/6・6/7の後追い再送は行わない', '6/8から通常再開']);
    return task;
  });
}

function writeTask(task) {
  writeJson(path.join(TASK_DIR, `${task.id}.json`), task);
}

function updateTask(id, updateFn) {
  const filePath = path.join(TASK_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return;
  const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  writeJson(filePath, updateFn(task));
}

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanArg(value, fallback) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function uniqueNotes(notes) {
  return [...new Set(notes.filter(Boolean))];
}
