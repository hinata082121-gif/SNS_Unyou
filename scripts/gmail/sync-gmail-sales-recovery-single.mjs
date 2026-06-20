#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  OUTBOX_HEADERS,
  hasOptOutText,
  isValidEmail,
  parseArgs,
  readJson,
  safeSummary
} from './pool-utils.mjs';

const ROOT = process.cwd();
const RECOVERY_DIR = path.resolve(ROOT, 'data', 'gmail', 'outbox', 'recovery');
const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(`Usage: node scripts/gmail/sync-gmail-sales-recovery-single.mjs --date YYYY-MM-DD [--dry-run] [--validate-only-webhook] [--execute --confirm-write-count 1]

Validates one approved noon recovery row for a later manual Sheet sync step.
Default dry-run never sends a webhook request. Validate-only webhook sends one dryRun=true request. Execute sends one dryRun=false sync_recovery_single request only with confirm-write-count 1. It never prints row contents, emails, URLs, IDs, hashes, tokens, or payload bodies.`);
  process.exit(0);
}

const targetDate = String(args.date || '').trim();
const executeRequested = args.execute === true;
const validateOnlyWebhook = args['validate-only-webhook'] === true;
const confirmWriteCount = Number(args['confirm-write-count'] || 0);
const dryRun = !executeRequested;
const sourceType = 'recovery_single';
const defaultBase = `${targetDate}-noon-recovery`;
const paths = {
  outbox: args['outbox-file'] || path.join('data', 'gmail', 'outbox', 'recovery', `${defaultBase}-outbox-1.json`),
  status: args['status-file'] || path.join('data', 'gmail', 'outbox', 'recovery', `${defaultBase}-status.json`),
  sheetsJson: args['sheets-json'] || path.join('data', 'gmail', 'outbox', 'recovery', `${defaultBase}-sheets-ready.json`),
  sheetsTsv: args['sheets-tsv'] || path.join('data', 'gmail', 'outbox', 'recovery', `${defaultBase}-sheets-ready.tsv`)
};

const summary = {
  mode: validateOnlyWebhook ? 'validate_only_webhook' : (dryRun ? 'dry_run' : 'execute'),
  targetDate,
  sourceType,
  candidateCount: 0,
  sheetRowCount: 0,
  approvalState: '',
  humanReviewCompleted: false,
  validationPassed: false,
  networkRequestAttempted: false,
  sheetUpdated: false,
  manifestCreated: false,
  gmailSentCount: 0,
  blockedReason: ''
};

class RecoverySyncError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

try {
  const validation = validateRecoverySingle({ targetDate, paths });
  const payload = buildRecoveryPayload(validation);
  Object.assign(summary, {
    candidateCount: validation.candidateCount,
    sheetRowCount: validation.sheetRowCount,
    approvalState: validation.approvalState,
    humanReviewCompleted: validation.humanReviewCompleted,
    manifestCreated: validation.manifestCreated,
    validationPassed: true
  });

  if (validateOnlyWebhook) {
    const responseSummary = await sendRecoveryWebhook(payload, { dryRun: true });
    Object.assign(summary, responseSummary);
    console.log(safeSummary(summary));
    process.exit(responseSummary.validationPassed && responseSummary.actualWriteCount === 0 && responseSummary.sheetUpdated === false ? 0 : 1);
  }

  if (dryRun) {
    console.log(safeSummary(summary));
    process.exit(0);
  }

  if (confirmWriteCount !== 1) throw new RecoverySyncError('execute_requires_confirm_write_count_1');
  const responseSummary = await sendRecoveryWebhook(payload, { dryRun: false });
  Object.assign(summary, responseSummary);
  console.log(safeSummary(summary));
  process.exit(
    responseSummary.validationPassed &&
    responseSummary.candidateCount === 1 &&
    responseSummary.intendedWriteCount <= 1 &&
    responseSummary.actualWriteCount <= 1 &&
    responseSummary.conflict === false &&
    (responseSummary.actualWriteCount === 1 || responseSummary.alreadyApplied === true)
      ? 0
      : 1
  );
} catch (error) {
  summary.blockedReason = error instanceof RecoverySyncError ? error.reason : 'recovery_single_validation_failed';
  console.log(safeSummary(summary));
  process.exit(1);
}

async function sendRecoveryWebhook(payload, options) {
  const settings = options || {};
  const syncEnabled = process.env.GMAIL_SHEET_SYNC_ENABLED === 'true';
  const syncDryRun = process.env.GMAIL_SHEET_SYNC_DRY_RUN !== 'false';
  const webhookUrl = String(process.env.GMAIL_SHEET_WEBHOOK_URL || '').trim();
  const syncToken = String(process.env.GMAIL_SHEET_SYNC_TOKEN || '').trim();
  if (!syncEnabled) throw new RecoverySyncError('sheet_sync_disabled');
  if (settings.dryRun === true && !syncDryRun) throw new RecoverySyncError('validate_only_requires_dry_run_true');
  if (settings.dryRun === false && syncDryRun) throw new RecoverySyncError('execute_requires_dry_run_false');
  if (settings.dryRun === false && process.env.LIVE_SEND_ENABLED === 'true') throw new RecoverySyncError('live_send_enabled');
  if (settings.dryRun === false && process.env.AUTO_SEND_ENABLED === 'true') throw new RecoverySyncError('auto_send_enabled');
  if (!webhookUrl || !syncToken) throw new RecoverySyncError('sheet_sync_not_configured');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({}, payload, {
      token: syncToken,
      dryRun: settings.dryRun === true,
      requestId: `recovery-single-${settings.dryRun === true ? 'validate-only' : 'execute'}-${Date.now()}-${process.pid}`
    }))
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    throw new RecoverySyncError('response_parse_failure');
  }
  if (!response.ok || body.ok === false) {
    throw new RecoverySyncError(String(body.errorCode || body.blockedReason || 'webhook_validate_only_failed'));
  }
  return safeWebhookResponse(body);
}

function safeWebhookResponse(body) {
  return {
    networkRequestAttempted: true,
    httpOk: true,
    action: body.action === 'sync_recovery_single' ? 'sync_recovery_single' : String(body.action || ''),
    validationPassed: body.validationPassed === true,
    candidateCount: Number(body.candidateCount || 0),
    intendedWriteCount: Number(body.intendedWriteCount || 0),
    actualWriteCount: Number(body.actualWriteCount || 0),
    dryRun: body.dryRun === true,
    sheetUpdated: body.sheetUpdated === true,
    conflict: body.conflict === true,
    alreadyApplied: body.alreadyApplied === true,
    blockedReason: String(body.errorCode || body.blockedReason || '')
  };
}

function validateRecoverySingle(settings) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.targetDate)) {
    throw new RecoverySyncError('target_date_required');
  }

  validateRecoveryPath(settings.paths.outbox, settings.targetDate, 'outbox-1.json');
  validateRecoveryPath(settings.paths.status, settings.targetDate, 'status.json');
  validateRecoveryPath(settings.paths.sheetsJson, settings.targetDate, 'sheets-ready.json');
  validateRecoveryPath(settings.paths.sheetsTsv, settings.targetDate, 'sheets-ready.tsv');

  const outbox = readJson(settings.paths.outbox, null);
  const status = readJson(settings.paths.status, null);
  const sheetsJson = readJson(settings.paths.sheetsJson, null);
  const tsv = parseTsv(settings.paths.sheetsTsv);
  if (!outbox || !status || !sheetsJson) throw new RecoverySyncError('json_unreadable');

  const candidates = Array.isArray(outbox.candidates) ? outbox.candidates : [];
  const sheetRows = Array.isArray(sheetsJson.rows) ? sheetsJson.rows : [];
  const sheetHeaders = Array.isArray(sheetsJson.headers) ? sheetsJson.headers : [];
  const metrics = status.metrics || {};

  if (candidates.length !== 1 || Number(outbox.candidateCount) !== 1) throw new RecoverySyncError('outbox_candidate_count_not_1');
  if (Number(status.candidateCount || metrics.candidateCount) !== 1) throw new RecoverySyncError('status_candidate_count_not_1');
  if (sheetRows.length !== 1 || tsv.rows.length !== 1) throw new RecoverySyncError('sheet_row_count_not_1');

  requireEqual(outbox.targetDate || outbox.sendDate, settings.targetDate, 'outbox_date_mismatch');
  requireEqual(status.targetDate, settings.targetDate, 'status_date_mismatch');
  requireEqual(sheetsJson.targetDate || sheetsJson.sendDate, settings.targetDate, 'sheets_json_date_mismatch');
  requireEqual(tsv.rowSendDate, settings.targetDate, 'sheets_tsv_date_mismatch');

  if (!String(outbox.sendBatchId || '').includes('recovery')) throw new RecoverySyncError('outbox_not_recovery_batch');
  requireEqual(outbox.sendBatchId, status.sendBatchId, 'status_batch_mismatch');
  requireEqual(outbox.sendBatchId, sheetsJson.sendBatchId, 'sheets_json_batch_mismatch');
  requireEqual(outbox.sendBatchId, tsv.rowSendBatchId, 'sheets_tsv_batch_mismatch');

  if (!headersMatch(sheetHeaders) || !headersMatch(tsv.headers)) throw new RecoverySyncError('header_mismatch');

  if (status.status !== 'approved') throw new RecoverySyncError('status_not_approved');
  if (outbox.approvalStatus !== 'approved' || status.approvalStatus !== 'approved') throw new RecoverySyncError('approval_status_not_approved');
  if (outbox.approved !== true) throw new RecoverySyncError('outbox_not_approved');
  if (outbox.humanReviewCompleted !== true || status.humanReviewCompleted !== true) throw new RecoverySyncError('human_review_not_completed');
  if (Number(outbox.humanReviewedCount) !== 1 || Number(status.humanReviewedCount) !== 1) throw new RecoverySyncError('human_review_count_not_1');
  if (outbox.targetAutoApproved !== false || status.targetAutoApproved !== false) throw new RecoverySyncError('target_auto_approved_not_false');
  if (outbox.manifestCreated !== false || status.manifestCreated !== false) throw new RecoverySyncError('manifest_already_created');
  if (outbox.googleSheetsUpdated !== false || status.googleSheetsUpdated !== false) throw new RecoverySyncError('sheet_already_updated');
  if (outbox.gmailSendExecuted !== false || status.gmailSendExecuted !== false) throw new RecoverySyncError('gmail_send_already_executed');

  validateZeroMetric(metrics, 'requiredFieldMissingCount');
  validateZeroMetric(metrics, 'personalizationInvalidCount');
  validateZeroMetric(metrics, 'suppressionMatchCount');
  validateZeroMetric(metrics, 'gmailSentMatchCount');
  validateZeroMetric(metrics, 'sheetHistoryMatchCount');
  validateZeroMetric(metrics, 'localHistoryMatchCount');
  validateZeroMetric(metrics, 'existingOutboxMatchCount');
  validateZeroMetric(metrics, 'june19SourceMatchCount');
  validateZeroMetric(metrics, 'june20ExistingTargetMatchCount');
  validateZeroMetric(metrics, 'duplicateCount');

  const candidate = candidates[0];
  const sheetRow = sheetRows[0];
  const tsvRow = tsv.rowObject;
  if (!sameIdentity(candidate, sheetRow) || !sameIdentity(candidate, tsvRow) || !sameIdentity(sheetRow, tsvRow)) {
    throw new RecoverySyncError('identity_mismatch');
  }
  if (!isValidEmail(String(sheetRow.email || sheetRow.contactEmail || '').trim())) throw new RecoverySyncError('invalid_email');
  if (String(sheetRow.status || '').toLowerCase() !== 'ready' || String(tsvRow.status || '').toLowerCase() !== 'ready') {
    throw new RecoverySyncError('status_not_ready');
  }
  if (!sheetRow.subject || !sheetRow.body || !tsvRow.subject || !tsvRow.body) throw new RecoverySyncError('missing_subject_or_body');
  if (!hasOptOutText(sheetRow.body) || !hasOptOutText(tsvRow.body)) throw new RecoverySyncError('missing_opt_out_text');

  return {
    candidateCount: candidates.length,
    sheetRowCount: sheetRows.length,
    approvalState: status.approvalStatus,
    humanReviewCompleted: status.humanReviewCompleted === true,
    manifestCreated: status.manifestCreated === true,
    approvalStatus: status.approvalStatus,
    humanReviewedCount: Number(status.humanReviewedCount),
    targetAutoApproved: status.targetAutoApproved,
    safetyCounters: {
      requiredFieldMissingCount: Number(metrics.requiredFieldMissingCount ?? 0),
      personalizationInvalidCount: Number(metrics.personalizationInvalidCount ?? 0),
      recipientDuplicateCount: Number(metrics.recipientDuplicateCount ?? metrics.duplicateCount ?? 0),
      domainDuplicateCount: Number(metrics.domainDuplicateCount ?? 0),
      businessDuplicateCount: Number(metrics.businessDuplicateCount ?? 0),
      suppressionMatchCount: Number(metrics.suppressionMatchCount ?? 0),
      gmailSentMatchCount: Number(metrics.gmailSentMatchCount ?? 0),
      sheetHistoryMatchCount: Number(metrics.sheetHistoryMatchCount ?? 0),
      localHistoryMatchCount: Number(metrics.localHistoryMatchCount ?? 0),
      existingOutboxMatchCount: Number(metrics.existingOutboxMatchCount ?? 0),
      june19SourceMatchCount: Number(metrics.june19SourceMatchCount ?? 0),
      june20ExistingTargetMatchCount: Number(metrics.june20ExistingTargetMatchCount ?? 0)
    },
    headers: tsv.headers,
    rows: tsv.rows,
    sendBatchId: outbox.sendBatchId
  };
}

function buildRecoveryPayload(validation) {
  return {
    mode: 'sync_recovery_single',
    operation: 'sync_recovery_single',
    action: 'sync_recovery_single',
    sourceType: 'recovery_single',
    dryRun: true,
    schemaVersion: 1,
    targetDate,
    sendDate: targetDate,
    sendBatchId: validation.sendBatchId,
    candidateCount: validation.candidateCount,
    sheetRowCount: validation.sheetRowCount,
    rowCount: validation.sheetRowCount,
    approvalStatus: validation.approvalStatus,
    humanReviewCompleted: validation.humanReviewCompleted,
    humanReviewedCount: validation.humanReviewedCount,
    targetAutoApproved: validation.targetAutoApproved,
    manifestCreated: validation.manifestCreated,
    safetyCounters: validation.safetyCounters,
    headers: validation.headers,
    rows: validation.rows
  };
}

function validateRecoveryPath(filePath, dateText, suffix) {
  const resolved = path.resolve(ROOT, filePath);
  if (!resolved.startsWith(`${RECOVERY_DIR}${path.sep}`)) throw new RecoverySyncError('path_not_recovery_dir');
  const base = path.basename(resolved);
  if (!base.startsWith(`${dateText}-noon-recovery-`) || !base.endsWith(suffix)) {
    throw new RecoverySyncError('path_not_target_noon_recovery');
  }
  if (!fs.existsSync(resolved)) throw new RecoverySyncError('source_file_not_found');
}

function parseTsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw ? raw.split(/\r?\n/) : [];
  const headers = lines[0] ? lines[0].split('\t').map((value) => value.trim()) : [];
  const rows = lines.slice(1).filter(Boolean).map((line) => line.split('\t'));
  const rowObject = Object.fromEntries(headers.map((header, index) => [header, String(rows[0]?.[index] ?? '')]));
  return {
    headers,
    rows,
    rowObject,
    rowSendDate: rowObject.sendDate || '',
    rowSendBatchId: rowObject.sendBatchId || ''
  };
}

function headersMatch(headers) {
  return Array.isArray(headers) &&
    headers.length === OUTBOX_HEADERS.length &&
    OUTBOX_HEADERS.every((header, index) => headers[index] === header);
}

function validateZeroMetric(metrics, key) {
  if (Number(metrics[key] ?? 0) !== 0) throw new RecoverySyncError(`${key}_nonzero`);
}

function requireEqual(actual, expected, reason) {
  if (String(actual || '') !== String(expected || '')) throw new RecoverySyncError(reason);
}

function sameIdentity(left, right) {
  return sameField(left, right, 'prospectId') &&
    sameField(left, right, 'dedupeKey') &&
    sameEmail(left, right);
}

function sameField(left, right, key) {
  return String(left?.[key] || '').trim().toLowerCase() === String(right?.[key] || '').trim().toLowerCase();
}

function sameEmail(left, right) {
  const leftEmail = String(left?.email || left?.contactEmail || '').trim().toLowerCase();
  const rightEmail = String(right?.email || right?.contactEmail || '').trim().toLowerCase();
  return leftEmail !== '' && leftEmail === rightEmail;
}
