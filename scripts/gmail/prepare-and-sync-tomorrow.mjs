#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadLocalEnv } from '../lib/load-local-env.mjs';
import { buildBatchId, parseArgs, readJson, resolveDateArg, safeSummary, writeJson } from './pool-utils.mjs';

loadLocalEnv();

function printHelp() {
  console.log(`Usage: node scripts/gmail/prepare-and-sync-tomorrow.mjs [--date YYYY-MM-DD|tomorrow]

17:20 automation entrypoint. Prepares an outbox, runs the Sheet sync step, and records the ready verification target. Defaults to dry-run Sheet sync unless environment flags explicitly enable production sync.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = resolveDateArg(args.date, 'tomorrow');
const sendBatchId = args['send-batch-id'] || buildBatchId(sendDate);
const summary = {
  ok: false,
  sendDate,
  sendBatchId,
  prepared: false,
  sheetSynced: false,
  manualPasteRequired: true,
  readyRowsVerified: false,
  gmailSendExecuted: false,
  googleSheetsUpdatedByThisRun: false,
  blockedReason: ''
};

const prepare = run('node', ['scripts/gmail/prepare-tomorrow-outbox.mjs', '--date', sendDate]);
summary.prepared = prepare.status === 0;
if (!summary.prepared) {
  summary.blockedReason = 'outbox_prepare_failed';
  console.log(safeSummary(summary));
  process.exit(2);
}

const sync = run('node', ['scripts/gmail/sync-outbox-to-sheet.mjs', '--date', sendDate]);
const syncSummary = parseJson(sync.stdout);
summary.sheetSynced = Boolean(syncSummary.sheetSynced);
summary.manualPasteRequired = syncSummary.manualPasteRequired !== false;
summary.googleSheetsUpdatedByThisRun = summary.sheetSynced;
if (sync.status !== 0) {
  summary.blockedReason = syncSummary.blockedReason || 'sheet_sync_failed';
  console.log(safeSummary(summary));
  process.exit(1);
}

const verify = run('node', ['scripts/gmail/verify-sheet-ready-rows.mjs', '--date', sendDate]);
const verifySummary = parseJson(verify.stdout);
summary.readyRowsVerified = Boolean(verifySummary.readyRowsVerified);
summary.ok = true;
summary.blockedReason = summary.sheetSynced ? '' : (syncSummary.blockedReason || 'sheet_sync_dry_run');
updateAgentStatus(summary, syncSummary, verifySummary);
console.log(safeSummary(summary));
process.exit(0);

function run(command, argv) {
  return spawnSync(command, argv, {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

function parseJson(stdout) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch {
    return {};
  }
}

function updateAgentStatus(result, syncResult, verifyResult) {
  const filePath = path.join('data', 'agent-status', 'tasks', `gmail-next-day-outbox-${sendDate}.json`);
  const task = readJson(filePath, null);
  if (!task) return;
  const metrics = Object.assign({}, task.metrics || {}, {
    sheetSyncChecked: true,
    sheetSynced: result.sheetSynced,
    manualPasteRequired: result.manualPasteRequired,
    readyRowsVerified: result.readyRowsVerified,
    sheetSyncDryRun: Boolean(syncResult.dryRun),
    sheetSyncEnabled: Boolean(syncResult.syncEnabled),
    syncValidationErrorCount: Number(syncResult.validationErrorCount || 0),
    syncDuplicateCount: Number(syncResult.duplicateCount || 0),
    expectedReadyRows: Number(verifyResult.expectedReadyRows || 30),
    gmailSendExecuted: false,
    googleSheetsUpdatedByThisScript: result.sheetSynced
  });
  task.updatedAt = new Date().toISOString();
  task.metrics = metrics;
  task.phase = result.sheetSynced
    ? '翌日outbox30件作成済み・Sheet同期済み・Preflight待ち'
    : '翌日outbox30件作成済み・Sheet同期dry-run/手動反映待ち';
  task.status = result.sheetSynced ? 'needs_review' : 'needs_review';
  task.progress = result.sheetSynced ? 90 : Math.max(Number(task.progress || 80), 80);
  task.nextAction = result.sheetSynced
    ? 'Apps ScriptでrunPreflightDiagnosticsOnly()とrunPreflightCheckOnly()を実行し、readyRows=30を確認する'
    : 'Sheet同期設定を確認するか、生成済みTSVをGmail送信対象シートへ反映し、Preflightを実行する';
  writeJson(filePath, task);
}
