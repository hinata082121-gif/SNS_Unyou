#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from '../lib/load-local-env.mjs';
import {
  buildBatchId,
  hasOptOutText,
  isValidEmail,
  OUTBOX_HEADERS,
  parseArgs,
  resolveDateArg,
  safeSummary
} from './pool-utils.mjs';

loadLocalEnv();

function printHelp() {
  console.log(`Usage: node scripts/gmail/sync-outbox-to-sheet.mjs [--date YYYY-MM-DD|today|tomorrow] [--tsv data/gmail/outbox/YYYY-MM-DD-gmail-sales-sheets-ready.tsv]

Safely validates and optionally syncs Gmail outbox rows to Google Sheets.
Defaults to sync disabled and dry-run. It never sends Gmail and never prints row contents, emails, names, message bodies, Sheet IDs, URLs, or tokens.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = resolveDateArg(args.date, 'tomorrow');
const sendBatchId = args['send-batch-id'] || buildBatchId(sendDate);
const tsvPath = args.tsv || path.join('data', 'gmail', 'outbox', `${sendDate}-gmail-sales-sheets-ready.tsv`);
const syncEnabled = process.env.GMAIL_SHEET_SYNC_ENABLED === 'true';
const dryRun = process.env.GMAIL_SHEET_SYNC_DRY_RUN !== 'false';
const webhookUrl = process.env.GMAIL_SHEET_WEBHOOK_URL || '';
const syncToken = process.env.GMAIL_SHEET_SYNC_TOKEN || '';
const targetName = process.env.GMAIL_SHEET_TARGET_NAME || '';
const readyTabName = process.env.GMAIL_SHEET_READY_TAB_NAME || '';
const webhookConfigured = Boolean(webhookUrl);
const tokenConfigured = Boolean(syncToken);

const summary = {
  ok: false,
  sendDate,
  sendBatchId,
  tsvExists: fs.existsSync(tsvPath),
  rowCount: 0,
  syncEnabled,
  dryRun,
  webhookConfigured,
  tokenConfigured,
  sheetSynced: false,
  manualPasteRequired: true,
  validationErrorCount: 0,
  duplicateCount: 0,
  headerMatched: false,
  sendDateMatched: false,
  sendBatchIdMatched: false,
  subjectBodyPresent: false,
  optOutPresent: false,
  blockedReason: ''
};

if (!summary.tsvExists) {
  summary.blockedReason = 'tsv_not_found';
  console.log(safeSummary(summary));
  process.exit(1);
}

const parsed = parseTsv(tsvPath);
const validation = validateRows(parsed, { sendDate, sendBatchId });
Object.assign(summary, validation.safe);

if (validation.errors.length > 0) {
  summary.blockedReason = 'outbox_validation_errors';
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

try {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: syncToken,
      sendDate,
      sendBatchId,
      targetName,
      readyTabName,
      rowCount: parsed.rows.length,
      headers: parsed.headers,
      rows: parsed.rows
    })
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }

  summary.ok = response.ok && body.ok !== false;
  summary.sheetSynced = summary.ok && Boolean(body.sheetSynced);
  summary.manualPasteRequired = !summary.sheetSynced;
  summary.blockedReason = summary.ok ? '' : String(body.blockedReason || 'sheet_sync_failed');
  console.log(safeSummary(summary));
  process.exit(summary.ok ? 0 : 1);
} catch {
  summary.blockedReason = 'sheet_sync_request_failed';
  console.log(safeSummary(summary));
  process.exit(1);
}

function parseTsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw ? raw.split(/\r?\n/) : [];
  const headers = lines[0] ? lines[0].split('\t').map((value) => value.trim()) : [];
  const rows = lines.slice(1).filter(Boolean).map((line) => line.split('\t'));
  return { headers, rows };
}

function validateRows(parsed, expected) {
  const index = Object.fromEntries(parsed.headers.map((header, i) => [header, i]));
  const errors = [];
  const emailSet = new Set();
  let duplicateCount = 0;
  let sendDateMismatchCount = 0;
  let sendBatchIdMismatchCount = 0;
  let missingSubjectBodyCount = 0;
  let missingOptOutTextCount = 0;
  let invalidEmailCount = 0;

  const headerMatched = OUTBOX_HEADERS.every((header, i) => parsed.headers[i] === header)
    && parsed.headers.length === OUTBOX_HEADERS.length;

  if (!headerMatched) {
    errors.push('header_mismatch');
  }
  if (parsed.rows.length !== 30) {
    errors.push('row_count_not_30');
  }

  parsed.rows.forEach((cells) => {
    const email = cell(cells, index.email) || cell(cells, index.contactEmail);
    const subject = cell(cells, index.subject);
    const body = cell(cells, index.body);
    const rowSendDate = cell(cells, index.sendDate);
    const rowBatchId = cell(cells, index.sendBatchId);

    if (!isValidEmail(String(email || '').trim())) {
      invalidEmailCount += 1;
    }
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail) {
      if (emailSet.has(normalizedEmail)) duplicateCount += 1;
      emailSet.add(normalizedEmail);
    }
    if (rowSendDate !== expected.sendDate) sendDateMismatchCount += 1;
    if (rowBatchId !== expected.sendBatchId) sendBatchIdMismatchCount += 1;
    if (!subject || !body) missingSubjectBodyCount += 1;
    if (!hasOptOutText(body)) missingOptOutTextCount += 1;
  });

  if (duplicateCount > 0) errors.push('duplicate_rows');
  if (invalidEmailCount > 0) errors.push('invalid_email');
  if (sendDateMismatchCount > 0) errors.push('send_date_mismatch');
  if (sendBatchIdMismatchCount > 0) errors.push('send_batch_id_mismatch');
  if (missingSubjectBodyCount > 0) errors.push('missing_subject_or_body');
  if (missingOptOutTextCount > 0) errors.push('missing_opt_out_text');

  return {
    errors,
    safe: {
      rowCount: parsed.rows.length,
      validationErrorCount: errors.length,
      duplicateCount,
      headerMatched,
      sendDateMatched: sendDateMismatchCount === 0,
      sendBatchIdMatched: sendBatchIdMismatchCount === 0,
      subjectBodyPresent: missingSubjectBodyCount === 0,
      optOutPresent: missingOptOutTextCount === 0
    }
  };
}

function cell(cells, columnIndex) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) return '';
  return String(cells[columnIndex] ?? '').trim();
}
