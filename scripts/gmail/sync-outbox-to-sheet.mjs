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
  readJson,
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
const statusPath = args['status-file'] || path.join('data', 'agent-status', 'tasks', `gmail-sales-safe-preparation-${sendDate}.json`);
const syncEnabled = process.env.GMAIL_SHEET_SYNC_ENABLED === 'true';
const dryRun = process.env.GMAIL_SHEET_SYNC_DRY_RUN !== 'false';
const syncMode = resolveSyncMode(args, { syncEnabled, dryRun });
const webhookUrl = process.env.GMAIL_SHEET_WEBHOOK_URL || '';
const syncToken = process.env.GMAIL_SHEET_SYNC_TOKEN || '';
const targetName = process.env.GMAIL_SHEET_TARGET_NAME || '';
const readyTabName = process.env.GMAIL_SHEET_READY_TAB_NAME || '';
const webhookConfigured = Boolean(webhookUrl);
const tokenConfigured = Boolean(syncToken);
const maintenanceLease = {
  lockName: 'GMAIL_SALES_SHEET_MAINTENANCE',
  holderType: 'local_sync',
  holderId: `local-sync-${Date.now()}-${process.pid}`,
  leaseVersion: 1
};

const summary = {
  ok: false,
  sendDate,
  sendBatchId,
  tsvExists: fs.existsSync(tsvPath),
  rowCount: 0,
  syncEnabled,
  dryRun,
  syncMode,
  webhookConfigured,
  tokenConfigured,
  statusFileExists: fs.existsSync(statusPath),
  statusApprovedForWrite: false,
  sheetSynced: false,
  manualPasteRequired: true,
  validationErrorCount: 0,
  duplicateCount: 0,
  headerMatched: false,
  sendDateMatched: false,
  sendBatchIdMatched: false,
  statusValueMatched: false,
  statusMismatchCount: 0,
  subjectBodyPresent: false,
  optOutPresent: false,
  connectedToGoogleSheet: false,
  targetWorksheetResolved: false,
  targetWorksheetExists: false,
  currentHeaderCount: 0,
  currentRowCount: 0,
  incomingHeaderCount: 0,
  incomingCandidateCount: 0,
  schemaValid: false,
  requiredHeadersPresent: false,
  existingDuplicateCount: 0,
  incomingDuplicateCount: 0,
  matchingIdentityCount: 0,
  wouldInsertCount: 0,
  wouldUpdateCount: 0,
  wouldSkipCount: 0,
  wouldDeleteCount: 0,
  wouldClearWorksheet: false,
  wouldWriteCount: 0,
  existingDataOverwriteRisk: false,
  unrelatedExistingRowCount: 0,
  maintenanceLeaseCreated: false,
  googleSheetsUpdated: false,
  scriptPropertiesUpdated: false,
  privateSnapshotCreated: false,
  privateSnapshotPath: '',
  privateSnapshotTsvPath: '',
  safeDiffCreated: false,
  safeDiffPath: '',
  identitySetMatchCount: 0,
  headerSetsMatch: false,
  differingColumnCount: 0,
  normalizationOnlyColumnCount: 0,
  substantiveDifferenceColumnCount: 0,
  substantiveDifferenceRowCount: 0,
  identityDifferenceCount: 0,
  subjectDifferenceCount: 0,
  bodyDifferenceCount: 0,
  protectedStatusRowCount: 0,
  runtimeHistoryDifferenceCount: 0,
  currentDataWouldBeLostByReplacement: false,
  exactReasonAll30WouldUpdate: '',
  safeForRealSheetSync: false,
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

if (syncMode === 'local_dry_run') {
  summary.ok = true;
  summary.blockedReason = syncEnabled ? 'sheet_sync_local_dry_run' : 'sheet_sync_disabled';
  console.log(safeSummary(summary));
  process.exit(0);
}

if ((syncMode === 'connected_dry_run' || syncMode === 'read_only_snapshot') && !syncEnabled) {
  summary.blockedReason = 'sheet_sync_disabled';
  console.log(safeSummary(summary));
  process.exit(1);
}

if (syncMode === 'write' && (!syncEnabled || dryRun)) {
  summary.blockedReason = !syncEnabled ? 'sheet_sync_disabled' : 'sheet_sync_write_requires_dry_run_false';
  console.log(safeSummary(summary));
  process.exit(1);
}

if (syncMode === 'write') {
  const approval = readTargetApprovalStatus(statusPath);
  summary.statusFileExists = approval.exists;
  summary.statusApprovedForWrite = approval.approved;
  if (!approval.approved) {
    summary.blockedReason = approval.exists ? 'target_status_not_approved' : 'target_status_missing';
    console.log(safeSummary(summary));
    process.exit(1);
  }
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
      targetDate: sendDate,
      sendBatchId,
      action: syncMode === 'write' ? 'write' : syncMode,
      operation: syncMode === 'write' ? 'write' : syncMode,
      mode: syncMode,
      dryRun: syncMode !== 'write',
      candidateCount: parsed.rows.length,
      schemaVersion: 1,
      requestId: `sheet-sync-${Date.now()}-${process.pid}`,
      targetName,
      readyTabName,
      maintenanceLease: syncMode === 'write' ? maintenanceLease : undefined,
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
  Object.assign(summary, safeSheetSyncResponse(body));
  if (syncMode === 'read_only_snapshot' && summary.ok && body.mode === 'read_only_snapshot') {
    Object.assign(summary, writeSheetSnapshotAudit(body, parsed, { sendDate }));
  }
  console.log(safeSummary(summary));
  process.exit(summary.ok ? 0 : 1);
} catch {
  summary.blockedReason = 'sheet_sync_request_failed';
  console.log(safeSummary(summary));
  process.exit(1);
}

function resolveSyncMode(parsedArgs, settings) {
  const explicitMode = String(parsedArgs.mode || process.env.GMAIL_SHEET_SYNC_MODE || '').trim();
  if (parsedArgs['read-only-snapshot'] === true || explicitMode === 'read_only_snapshot') return 'read_only_snapshot';
  if (parsedArgs['connected-dry-run'] === true || explicitMode === 'connected_dry_run') return 'connected_dry_run';
  if (parsedArgs.write === true || explicitMode === 'write') return 'write';
  if (parsedArgs['local-dry-run'] === true || explicitMode === 'local_dry_run') return 'local_dry_run';
  if (!settings.syncEnabled || settings.dryRun) return 'local_dry_run';
  return 'write';
}

function safeSheetSyncResponse(body) {
  const keys = [
    'connectedToGoogleSheet',
    'targetWorksheetResolved',
    'targetWorksheetExists',
    'currentHeaderCount',
    'currentRowCount',
    'incomingHeaderCount',
    'incomingCandidateCount',
    'schemaValid',
    'requiredHeadersPresent',
    'existingDuplicateCount',
    'incomingDuplicateCount',
    'matchingIdentityCount',
    'wouldInsertCount',
    'wouldUpdateCount',
    'wouldSkipCount',
    'wouldDeleteCount',
    'wouldClearWorksheet',
    'wouldWriteCount',
    'existingDataOverwriteRisk',
    'unrelatedExistingRowCount',
    'maintenanceLeaseCreated',
    'googleSheetsUpdated',
    'scriptPropertiesUpdated',
    'event',
    'mode',
    'status',
    'blockedReason'
  ];
  return keys.reduce((safe, key) => {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) safe[key] = body[key];
    return safe;
  }, {});
}

function readTargetApprovalStatus(filePath) {
  const status = readJson(filePath, null);
  if (!status) return { exists: false, approved: false };
  const approvalStatus = String(status.approvalStatus || status.metrics?.approvalStatus || '').trim();
  const humanReviewCompleted = status.humanReviewCompleted === true || status.metrics?.humanReviewCompleted === true;
  return {
    exists: true,
    approved: status.status === 'approved' &&
      approvalStatus === 'approved' &&
      humanReviewCompleted === true
  };
}

function writeSheetSnapshotAudit(body, incoming, settings) {
  const currentHeaders = Array.isArray(body.headers) ? body.headers.map((value) => String(value || '')) : [];
  const currentRows = Array.isArray(body.rows) ? body.rows.map((row) => Array.isArray(row) ? row.map((value) => String(value ?? '')) : []) : [];
  const outputDir = process.env.GMAIL_SHEET_AUDIT_OUTPUT_DIR || path.join('tmp', 'gmail-sheet-audit', settings.sendDate);
  fs.mkdirSync(outputDir, { recursive: true });

  const privateSnapshotPath = path.join(outputDir, 'current-sheet-private.json');
  const privateSnapshotTsvPath = path.join(outputDir, 'current-sheet-private.tsv');
  const safeDiffPath = path.join(outputDir, 'sheet-vs-incoming-diff-safe.json');
  const snapshot = {
    createdAt: new Date().toISOString(),
    mode: 'read_only_snapshot',
    targetDate: settings.sendDate,
    headerCount: currentHeaders.length,
    rowCount: currentRows.length,
    headers: currentHeaders,
    rows: currentRows
  };
  fs.writeFileSync(privateSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  fs.writeFileSync(privateSnapshotTsvPath, toTsv(currentHeaders, currentRows), 'utf8');

  const diff = compareCurrentSheetToIncoming(currentHeaders, currentRows, incoming.headers, incoming.rows);
  fs.writeFileSync(safeDiffPath, `${JSON.stringify(diff, null, 2)}\n`, 'utf8');

  return {
    privateSnapshotCreated: true,
    privateSnapshotPath: path.resolve(privateSnapshotPath),
    privateSnapshotTsvPath: path.resolve(privateSnapshotTsvPath),
    safeDiffCreated: true,
    safeDiffPath: path.resolve(safeDiffPath),
    identitySetMatchCount: diff.identitySetMatchCount,
    headerSetsMatch: diff.headerSetsMatch,
    currentDuplicateCount: diff.currentDuplicateCount,
    incomingDuplicateCount: diff.incomingDuplicateCount,
    differingColumnCount: diff.differingColumnCount,
    normalizationOnlyColumnCount: diff.normalizationOnlyColumnCount,
    substantiveDifferenceColumnCount: diff.substantiveDifferenceColumnCount,
    substantiveDifferenceRowCount: diff.substantiveDifferenceRowCount,
    identityDifferenceCount: diff.identityDifferenceCount,
    subjectDifferenceCount: diff.subjectDifferenceCount,
    bodyDifferenceCount: diff.bodyDifferenceCount,
    protectedStatusRowCount: diff.protectedStatusRowCount,
    runtimeHistoryDifferenceCount: diff.runtimeHistoryDifferenceCount,
    currentDataWouldBeLostByReplacement: diff.currentDataWouldBeLostByReplacement,
    exactReasonAll30WouldUpdate: diff.exactReasonAll30WouldUpdate,
    safeForRealSheetSync: diff.safeForRealSheetSync
  };
}

function compareCurrentSheetToIncoming(currentHeaders, currentRows, incomingHeaders, incomingRows) {
  const currentIndex = Object.fromEntries(currentHeaders.map((header, index) => [header, index]));
  const incomingIndex = Object.fromEntries(incomingHeaders.map((header, index) => [header, index]));
  const allColumns = Array.from(new Set([...currentHeaders, ...incomingHeaders])).filter(Boolean);
  const currentMap = buildIdentityMap(currentRows, currentIndex);
  const incomingMap = buildIdentityMap(incomingRows, incomingIndex);
  const sharedIdentities = Object.keys(incomingMap.rows).filter((identity) => currentMap.rows[identity]);
  const headerSetsMatch = currentHeaders.length === incomingHeaders.length &&
    currentHeaders.every((header) => incomingHeaders.includes(header));
  const columnDiffs = allColumns.map((columnName) => compareColumn(columnName, sharedIdentities, currentMap.rows, incomingMap.rows, currentIndex, incomingIndex));
  const substantiveColumns = columnDiffs.filter((column) => column.substantiveDifferenceCount > 0);
  const normalizationColumns = columnDiffs.filter((column) => column.differingRowCount > 0 && column.substantiveDifferenceCount === 0);
  const identityColumns = ['prospectId', 'dedupeKey', 'email', 'contactEmail'];
  const subjectDiff = columnDiffs.find((column) => column.columnName === 'subject');
  const bodyDiff = columnDiffs.find((column) => column.columnName === 'body');
  const protectedStatusRowCount = countProtectedStatusRows(currentRows, currentIndex);
  const runtimeHistoryDifferenceCount = countRuntimeHistoryDifferences(sharedIdentities, currentMap.rows, incomingMap.rows, currentIndex, incomingIndex);
  const identityDifferenceCount = columnDiffs
    .filter((column) => identityColumns.includes(column.columnName))
    .reduce((sum, column) => sum + column.substantiveDifferenceCount, 0);
  const substantiveDifferenceRowCount = countRowsWithSubstantiveDifferences(columnDiffs);
  const currentOnlyCount = Object.keys(currentMap.rows).filter((identity) => !incomingMap.rows[identity]).length;
  const currentDataWouldBeLostByReplacement = currentOnlyCount > 0 || runtimeHistoryDifferenceCount > 0;
  const exactReasonAll30WouldUpdate = summarizeAllRowsWouldUpdate(columnDiffs, sharedIdentities.length);
  const safeForRealSheetSync = headerSetsMatch &&
    currentMap.duplicateCount === 0 &&
    incomingMap.duplicateCount === 0 &&
    identityDifferenceCount === 0 &&
    protectedStatusRowCount === 0 &&
    runtimeHistoryDifferenceCount === 0 &&
    substantiveDifferenceRowCount === 0 &&
    currentOnlyCount === 0;

  return {
    headerSetsMatch,
    currentHeaderCount: currentHeaders.length,
    currentRowCount: currentRows.length,
    incomingHeaderCount: incomingHeaders.length,
    incomingRowCount: incomingRows.length,
    identitySetMatchCount: sharedIdentities.length,
    currentDuplicateCount: currentMap.duplicateCount,
    incomingDuplicateCount: incomingMap.duplicateCount,
    currentOnlyIdentityCount: currentOnlyCount,
    incomingOnlyIdentityCount: Object.keys(incomingMap.rows).filter((identity) => !currentMap.rows[identity]).length,
    differingColumnCount: columnDiffs.filter((column) => column.differingRowCount > 0).length,
    normalizationOnlyColumnCount: normalizationColumns.length,
    substantiveDifferenceColumnCount: substantiveColumns.length,
    substantiveDifferenceRowCount,
    identityDifferenceCount,
    subjectDifferenceCount: subjectDiff ? subjectDiff.substantiveDifferenceCount : 0,
    bodyDifferenceCount: bodyDiff ? bodyDiff.substantiveDifferenceCount : 0,
    protectedStatusRowCount,
    runtimeHistoryDifferenceCount,
    currentDataWouldBeLostByReplacement,
    exactReasonAll30WouldUpdate,
    safeForRealSheetSync,
    columns: columnDiffs
  };
}

function buildIdentityMap(rows, index) {
  const identities = {};
  let duplicateCount = 0;
  rows.forEach((row) => {
    const identity = rowIdentity(row, index);
    if (!identity) return;
    if (identities[identity]) duplicateCount += 1;
    identities[identity] = row;
  });
  return { rows: identities, duplicateCount };
}

function rowIdentity(row, index) {
  const prospectId = cell(row, index.prospectId);
  if (prospectId) return `prospect:${prospectId.toLowerCase()}`;
  const dedupeKey = cell(row, index.dedupeKey);
  if (dedupeKey) return `dedupe:${dedupeKey.toLowerCase()}`;
  const email = String(cell(row, index.email) || cell(row, index.contactEmail)).toLowerCase();
  return email ? `email:${email}` : '';
}

function compareColumn(columnName, identities, currentRowsByIdentity, incomingRowsByIdentity, currentIndex, incomingIndex) {
  const result = {
    columnName,
    columnClass: classifyColumn(columnName),
    differingRowCount: 0,
    equalRowCount: 0,
    currentMissingCount: 0,
    incomingMissingCount: 0,
    whitespaceOnlyDifferenceCount: 0,
    lineEndingOnlyDifferenceCount: 0,
    dateFormatOnlyDifferenceCount: 0,
    booleanFormatOnlyDifferenceCount: 0,
    numericStringOnlyDifferenceCount: 0,
    nullEmptyOnlyDifferenceCount: 0,
    substantiveDifferenceCount: 0
  };
  identities.forEach((identity) => {
    const currentValue = valueAt(currentRowsByIdentity[identity], currentIndex[columnName]);
    const incomingValue = valueAt(incomingRowsByIdentity[identity], incomingIndex[columnName]);
    const kind = differenceKind(currentValue, incomingValue);
    if (kind === 'equal') {
      result.equalRowCount += 1;
      return;
    }
    result.differingRowCount += 1;
    if (currentValue === '') result.currentMissingCount += 1;
    if (incomingValue === '') result.incomingMissingCount += 1;
    if (kind === 'whitespace') result.whitespaceOnlyDifferenceCount += 1;
    else if (kind === 'line_ending') result.lineEndingOnlyDifferenceCount += 1;
    else if (kind === 'date_format') result.dateFormatOnlyDifferenceCount += 1;
    else if (kind === 'boolean_format') result.booleanFormatOnlyDifferenceCount += 1;
    else if (kind === 'numeric_string') result.numericStringOnlyDifferenceCount += 1;
    else if (kind === 'null_empty') result.nullEmptyOnlyDifferenceCount += 1;
    else result.substantiveDifferenceCount += 1;
  });
  return result;
}

function differenceKind(left, right) {
  if (left === right) return 'equal';
  if (isEmptyLike(left) && isEmptyLike(right)) return 'null_empty';
  if (left.trim() === right.trim()) return 'whitespace';
  if (normalizeLineEnding(left) === normalizeLineEnding(right)) return 'line_ending';
  if (normalizeDateText(left) && normalizeDateText(left) === normalizeDateText(right)) return 'date_format';
  if (normalizeBoolean(left) !== '' && normalizeBoolean(left) === normalizeBoolean(right)) return 'boolean_format';
  if (normalizeNumber(left) !== '' && normalizeNumber(left) === normalizeNumber(right)) return 'numeric_string';
  return 'substantive';
}

function classifyColumn(columnName) {
  if (['prospectId', 'dedupeKey'].includes(columnName)) return 'identity';
  if (['status', 'sendDate', 'sendBatchId', 'sentStatus', 'sentAt', 'sendState', 'sendRunId', 'sendReservedAt', 'sendAttemptCount', 'errorMessage'].includes(columnName)) return 'send_control';
  if (['subject', 'body'].includes(columnName)) return 'message_content';
  if (['name', 'businessType', 'area', 'email', 'contactEmail', 'publicSource', 'sourceUrl'].includes(columnName)) return 'recipient_business';
  if (['sentBy', 'replyStatus', 'unsubscribe', 'doNotContact', 'lastCheckedAt', 'notes'].includes(columnName)) return 'history_runtime';
  return 'metadata';
}

function countProtectedStatusRows(rows, index) {
  const protectedValues = ['sent', 'send_reserved', 'delivery_unknown', 'manual_review_required', 'failed_before_send'];
  return rows.filter((row) => {
    const values = [cell(row, index.status), cell(row, index.sendState), cell(row, index.sentStatus)].map((value) => value.toLowerCase());
    return values.some((value) => protectedValues.includes(value));
  }).length;
}

function countRuntimeHistoryDifferences(identities, currentRowsByIdentity, incomingRowsByIdentity, currentIndex, incomingIndex) {
  const runtimeColumns = ['sentAt', 'sentBy', 'sentStatus', 'errorMessage', 'replyStatus', 'unsubscribe', 'doNotContact', 'lastCheckedAt', 'notes', 'sendState', 'sendRunId', 'sendReservedAt', 'sendAttemptCount'];
  let count = 0;
  identities.forEach((identity) => {
    const hasLoss = runtimeColumns.some((column) => {
      const currentValue = valueAt(currentRowsByIdentity[identity], currentIndex[column]);
      const incomingValue = valueAt(incomingRowsByIdentity[identity], incomingIndex[column]);
      return currentValue !== '' && currentValue !== incomingValue && incomingValue === '';
    });
    if (hasLoss) count += 1;
  });
  return count;
}

function countRowsWithSubstantiveDifferences(columnDiffs) {
  return Math.max(0, ...columnDiffs.map((column) => column.substantiveDifferenceCount));
}

function summarizeAllRowsWouldUpdate(columnDiffs, rowCount) {
  if (rowCount <= 0) return '';
  const allRowColumns = columnDiffs.filter((column) => column.differingRowCount === rowCount);
  if (allRowColumns.length === 0) return '';
  if (allRowColumns.length === 1) return `single_column:${allRowColumns[0].columnName}`;
  const substantive = allRowColumns.filter((column) => column.substantiveDifferenceCount > 0).length;
  return substantive > 0 ? 'multiple_columns_with_substantive_differences' : 'multiple_columns_with_normalization_differences';
}

function normalizeLineEnding(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeDateText(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  return '';
}

function normalizeBoolean(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(text)) return 'true';
  if (['false', 'no', '0', 'n'].includes(text)) return 'false';
  return '';
}

function normalizeNumber(value) {
  const text = String(value || '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return '';
  return String(Number(text));
}

function isEmptyLike(value) {
  return ['', 'null', 'undefined'].includes(String(value || '').trim().toLowerCase());
}

function valueAt(row, index) {
  if (!Number.isInteger(index) || index < 0) return '';
  return String(row[index] ?? '');
}

function toTsv(headers, rows) {
  return [headers.join('\t'), ...rows.map((row) => headers.map((_, index) => String(row[index] ?? '').replace(/\r?\n/g, '\\n').replace(/\t/g, ' ')).join('\t'))].join('\n') + '\n';
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
  let statusMismatchCount = 0;
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
    const status = cell(cells, index.status).toLowerCase();
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
    if (status !== 'ready') statusMismatchCount += 1;
    if (!subject || !body) missingSubjectBodyCount += 1;
    if (!hasOptOutText(body)) missingOptOutTextCount += 1;
  });

  if (duplicateCount > 0) errors.push('duplicate_rows');
  if (invalidEmailCount > 0) errors.push('invalid_email');
  if (sendDateMismatchCount > 0) errors.push('send_date_mismatch');
  if (sendBatchIdMismatchCount > 0) errors.push('send_batch_id_mismatch');
  if (statusMismatchCount > 0) errors.push('status_not_ready');
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
      statusValueMatched: statusMismatchCount === 0,
      statusMismatchCount,
      subjectBodyPresent: missingSubjectBodyCount === 0,
      optOutPresent: missingOptOutTextCount === 0
    }
  };
}

function cell(cells, columnIndex) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) return '';
  return String(cells[columnIndex] ?? '').trim();
}
