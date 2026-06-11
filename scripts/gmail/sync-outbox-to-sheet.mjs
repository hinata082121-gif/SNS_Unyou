#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveDateArg, safeSummary } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/sync-outbox-to-sheet.mjs [--date YYYY-MM-DD|today|tomorrow] [--tsv data/gmail/outbox/YYYY-MM-DD-gmail-sales-sheets-ready.tsv]

Safely prepares a Google Sheets sync request for Gmail outbox rows. Defaults to dry-run and does not print row contents, emails, names, message bodies, Sheet IDs, URLs, or tokens.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = resolveDateArg(args.date, 'tomorrow');
const tsvPath = args.tsv || path.join('data', 'gmail', 'outbox', `${sendDate}-gmail-sales-sheets-ready.tsv`);
const syncEnabled = process.env.GMAIL_SHEET_SYNC_ENABLED === 'true';
const webhookConfigured = Boolean(process.env.GMAIL_SHEET_SYNC_WEBHOOK_URL);
const tokenConfigured = Boolean(process.env.GMAIL_SHEET_SYNC_TOKEN);
const dryRun = process.env.GMAIL_SHEET_SYNC_DRY_RUN !== 'false';
const summary = {
  ok: false,
  sendDate,
  tsvPath,
  tsvExists: fs.existsSync(tsvPath),
  rowCount: 0,
  syncEnabled,
  dryRun,
  webhookConfigured,
  tokenConfigured,
  sheetSynced: false,
  manualPasteRequired: true,
  blockedReason: ''
};

if (!summary.tsvExists) {
  summary.blockedReason = 'tsv_not_found';
  console.log(safeSummary(summary));
  process.exit(1);
}

const lineCount = fs.readFileSync(tsvPath, 'utf8').trimEnd().split('\n').length;
summary.rowCount = Math.max(0, lineCount - 1);

if (summary.rowCount !== 30) {
  summary.blockedReason = 'row_count_not_30';
  console.log(safeSummary(summary));
  process.exit(1);
}

if (!syncEnabled || dryRun) {
  summary.ok = true;
  summary.blockedReason = syncEnabled ? 'sheet_sync_dry_run' : 'sheet_sync_disabled';
  console.log(safeSummary(summary));
  process.exit(0);
}

if (!webhookConfigured || !tokenConfigured) {
  summary.blockedReason = 'sheet_sync_not_configured';
  console.log(safeSummary(summary));
  process.exit(1);
}

summary.blockedReason = 'sheet_sync_execution_not_enabled_in_local_script';
console.log(safeSummary(summary));
process.exit(1);
