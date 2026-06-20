#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OUTBOX_HEADERS, toTsv } from './pool-utils.mjs';

const ROOT = process.cwd();
const TARGET_DATE = '2026-06-20';
const tmpDir = fs.mkdtempSync(path.join(ROOT, 'data', 'gmail', 'outbox', 'recovery', '.test-recovery-single-'));

try {
  const success = createFixture('success');
  const successRun = runRecovery(success, [], {
    NODE_OPTIONS: `--import=${throwingFetchModule()}`
  });
  assert.equal(successRun.status, 0);
  const successSummary = JSON.parse(successRun.stdout);
  assert.equal(successSummary.mode, 'dry_run');
  assert.equal(successSummary.targetDate, TARGET_DATE);
  assert.equal(successSummary.sourceType, 'recovery_single');
  assert.equal(successSummary.candidateCount, 1);
  assert.equal(successSummary.sheetRowCount, 1);
  assert.equal(successSummary.approvalState, 'approved');
  assert.equal(successSummary.humanReviewCompleted, true);
  assert.equal(successSummary.validationPassed, true);
  assert.equal(successSummary.networkRequestAttempted, false);
  assert.equal(successSummary.sheetUpdated, false);
  assert.equal(successSummary.manifestCreated, false);
  assert.equal(successSummary.gmailSentCount, 0);

  assertBlocked(createFixture('count-zero', { rowCount: 0 }), 'outbox_candidate_count_not_1');
  assertBlocked(createFixture('count-two', { rowCount: 2 }), 'outbox_candidate_count_not_1');
  assertBlocked(createFixture('unapproved', { approvalStatus: 'needs_review', status: 'needs_review', approved: false }), 'status_not_approved');
  assertBlocked(createFixture('human-review-false', { humanReviewCompleted: false }), 'human_review_not_completed');
  assertBlocked(createFixture('human-review-count-zero', { humanReviewedCount: 0 }), 'human_review_count_not_1');
  assertBlocked(createFixture('target-auto-approved', { targetAutoApproved: true }), 'target_auto_approved_not_false');
  assertBlocked(createFixture('metric-nonzero', { metrics: { suppressionMatchCount: 1 } }), 'suppressionMatchCount_nonzero');
  assertBlocked(createFixture('identity-mismatch', { identityMismatch: true }), 'identity_mismatch');

  const wrongDate = createFixture('wrong-date', { date: '2026-06-21' });
  const wrongDateRun = runRecovery(wrongDate, ['--date', TARGET_DATE]);
  assert.notEqual(wrongDateRun.status, 0);
  assert.equal(JSON.parse(wrongDateRun.stdout).blockedReason, 'path_not_target_noon_recovery');

  const normalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmail-recovery-single-normal-path-'));
  fs.mkdirSync(normalDir, { recursive: true });
  const normal = createFixture('normal-path', { baseDir: normalDir });
  const normalRun = runRecovery(normal, []);
  assert.notEqual(normalRun.status, 0);
  assert.equal(JSON.parse(normalRun.stdout).blockedReason, 'path_not_recovery_dir');

  const normalScriptRejectsRecoveryOne = spawnSync(process.execPath, [
    'scripts/gmail/sync-outbox-to-sheet.mjs',
    '--date', TARGET_DATE,
    '--tsv', success.sheetsTsv,
    '--local-dry-run'
  ], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      GMAIL_SHEET_SYNC_ENABLED: 'true',
      GMAIL_SHEET_SYNC_DRY_RUN: 'true',
      NODE_OPTIONS: `--import=${throwingFetchModule()}`
    }),
    encoding: 'utf8'
  });
  assert.notEqual(normalScriptRejectsRecoveryOne.status, 0);
  assert.equal(JSON.parse(normalScriptRejectsRecoveryOne.stdout).blockedReason, 'outbox_validation_errors');

  const executeDryRunGuard = runRecovery(success, ['--execute', '--confirm-write-count', '1'], {
    NODE_OPTIONS: `--import=${throwingFetchModule()}`,
    GMAIL_RECOVERY_SINGLE_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token'
  });
  assert.notEqual(executeDryRunGuard.status, 0);
  const executeDryRunSummary = JSON.parse(executeDryRunGuard.stdout);
  assert.equal(executeDryRunSummary.networkRequestAttempted, false);
  assert.equal(executeDryRunSummary.sheetUpdated, false);
  assert.equal(executeDryRunSummary.blockedReason, 'execute_requires_dry_run_false');

  const executeConfirmGuard = runRecovery(success, ['--execute'], {
    NODE_OPTIONS: `--import=${throwingFetchModule()}`,
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'false',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token',
    LIVE_SEND_ENABLED: 'false',
    AUTO_SEND_ENABLED: 'false'
  });
  assert.notEqual(executeConfirmGuard.status, 0);
  assert.equal(JSON.parse(executeConfirmGuard.stdout).blockedReason, 'execute_requires_confirm_write_count_1');

  const executeWrite = runRecovery(success, ['--execute', '--confirm-write-count', '1'], {
    NODE_OPTIONS: `--import=${mockExecuteFetchModule()}`,
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'false',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token',
    LIVE_SEND_ENABLED: 'false',
    AUTO_SEND_ENABLED: 'false'
  });
  assert.equal(executeWrite.status, 0);
  const executeWriteSummary = JSON.parse(executeWrite.stdout);
  assert.equal(executeWriteSummary.mode, 'execute');
  assert.equal(executeWriteSummary.networkRequestAttempted, true);
  assert.equal(executeWriteSummary.action, 'sync_recovery_single');
  assert.equal(executeWriteSummary.validationPassed, true);
  assert.equal(executeWriteSummary.candidateCount, 1);
  assert.equal(executeWriteSummary.intendedWriteCount, 1);
  assert.equal(executeWriteSummary.actualWriteCount, 1);
  assert.equal(executeWriteSummary.dryRun, false);
  assert.equal(executeWriteSummary.sheetUpdated, true);
  assert.equal(executeWriteSummary.conflict, false);

  const validateOnly = runRecovery(success, ['--validate-only-webhook'], {
    NODE_OPTIONS: `--import=${mockValidateOnlyFetchModule()}`,
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token'
  });
  assert.equal(validateOnly.status, 0);
  const validateOnlySummary = JSON.parse(validateOnly.stdout);
  assert.equal(validateOnlySummary.mode, 'validate_only_webhook');
  assert.equal(validateOnlySummary.networkRequestAttempted, true);
  assert.equal(validateOnlySummary.action, 'sync_recovery_single');
  assert.equal(validateOnlySummary.validationPassed, true);
  assert.equal(validateOnlySummary.candidateCount, 1);
  assert.equal(validateOnlySummary.intendedWriteCount, 1);
  assert.equal(validateOnlySummary.actualWriteCount, 0);
  assert.equal(validateOnlySummary.dryRun, true);
  assert.equal(validateOnlySummary.sheetUpdated, false);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  recoverySingleSyncTestScenarioCount: 16,
  passed: true,
  syntheticFixtureUsed: true,
  dryRunNetworkCallCount: 0,
  normalThirtyPathStillRejectsOneRow: true,
  executeGuardNetworkCallCount: 0,
  executeWebhookMockCallCount: 1,
  validateOnlyWebhookMockCallCount: 1,
  personalDataLogged: false
}, null, 2));

function assertBlocked(fixture, reason) {
  const result = runRecovery(fixture);
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stdout).blockedReason, reason);
}

function runRecovery(fixture, extraArgs = [], env = {}) {
  return spawnSync(process.execPath, [
    'scripts/gmail/sync-gmail-sales-recovery-single.mjs',
    '--date', fixture.date,
    '--outbox-file', fixture.outbox,
    '--status-file', fixture.status,
    '--sheets-json', fixture.sheetsJson,
    '--sheets-tsv', fixture.sheetsTsv,
    ...extraArgs
  ], {
    cwd: ROOT,
    env: Object.assign({}, process.env, env),
    encoding: 'utf8'
  });
}

function createFixture(name, options = {}) {
  const date = options.date || TARGET_DATE;
  const baseDir = options.baseDir || path.join(tmpDir, name);
  fs.mkdirSync(baseDir, { recursive: true });
  const baseName = `${date}-noon-recovery`;
  const outbox = path.join(baseDir, `${baseName}-outbox-1.json`);
  const status = path.join(baseDir, `${baseName}-status.json`);
  const sheetsJson = path.join(baseDir, `${baseName}-sheets-ready.json`);
  const sheetsTsv = path.join(baseDir, `${baseName}-sheets-ready.tsv`);
  const rowCount = options.rowCount ?? 1;
  const rows = Array.from({ length: rowCount }, (_, index) => buildRow(index + 1, { identityMismatch: options.identityMismatch && index === 0 }));
  const firstRow = rows[0] || buildRow(1);
  const approvalStatus = options.approvalStatus || 'approved';
  const statusValue = options.status || (approvalStatus === 'approved' ? 'approved' : 'needs_review');
  const humanReviewCompleted = options.humanReviewCompleted ?? true;
  const humanReviewedCount = options.humanReviewedCount ?? 1;
  const targetAutoApproved = options.targetAutoApproved ?? false;
  const approved = options.approved ?? approvalStatus === 'approved';
  const metrics = Object.assign({
    candidateCount: rowCount,
    duplicateCount: 0,
    requiredFieldMissingCount: 0,
    personalizationInvalidCount: 0,
    suppressionMatchCount: 0,
    gmailSentMatchCount: 0,
    sheetHistoryMatchCount: 0,
    localHistoryMatchCount: 0,
    existingOutboxMatchCount: 0,
    june19SourceMatchCount: 0,
    june20ExistingTargetMatchCount: 0,
    approvalStatus,
    humanReviewCompleted,
    humanReviewedCount
  }, options.metrics || {});

  writeJson(outbox, {
    targetDate: date,
    sendDate: date,
    sendBatchId: `gmail-sales-${date}-noon-recovery`,
    candidateCount: rowCount,
    approvalStatus,
    approved,
    humanReviewCompleted,
    humanReviewedCount,
    targetAutoApproved,
    manifestCreated: false,
    googleSheetsUpdated: false,
    gmailSendExecuted: false,
    candidates: rows
  });
  writeJson(status, {
    targetDate: date,
    sendBatchId: `gmail-sales-${date}-noon-recovery`,
    status: statusValue,
    candidateCount: rowCount,
    approvalStatus,
    humanReviewCompleted,
    humanReviewedCount,
    targetAutoApproved,
    manifestCreated: false,
    googleSheetsUpdated: false,
    gmailSendExecuted: false,
    metrics
  });
  writeJson(sheetsJson, {
    targetDate: date,
    sendDate: date,
    sendBatchId: `gmail-sales-${date}-noon-recovery`,
    headers: OUTBOX_HEADERS,
    rows: options.identityMismatch ? [Object.assign({}, firstRow, { dedupeKey: 'different-dedupe-key' })] : rows
  });
  fs.writeFileSync(sheetsTsv, toTsv(options.identityMismatch ? [Object.assign({}, firstRow, { dedupeKey: 'different-dedupe-key' })] : rows), 'utf8');
  return { date, outbox, status, sheetsJson, sheetsTsv };
}

function buildRow(index, options = {}) {
  return {
    prospectId: `synthetic-prospect-${index}`,
    name: `Synthetic Business ${index}`,
    businessType: 'service',
    area: 'Tokyo',
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'public',
    sourceUrl: `https://source${index}.example.invalid`,
    issueHypothesis: 'issue',
    salesAngle: 'angle',
    subject: `Synthetic subject ${index}`,
    body: `Synthetic body ${index} ご返信不要`,
    status: 'ready',
    sendDate: TARGET_DATE,
    nextActionDate: TARGET_DATE,
    dedupeKey: options.identityMismatch ? `mismatch-${index}` : `synthetic-dedupe-${index}`,
    sendBatchId: `gmail-sales-${TARGET_DATE}-noon-recovery`,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: '',
    doNotContact: '',
    lastCheckedAt: '',
    notes: ''
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function throwingFetchModule() {
  return `data:text/javascript,${encodeURIComponent('globalThis.fetch = async () => { throw new Error("fetch_should_not_run"); };')}`;
}

function mockValidateOnlyFetchModule() {
  const source = `
globalThis.fetch = async (_url, options) => {
  const payload = JSON.parse(String(options && options.body || '{}'));
  const ok = payload.action === 'sync_recovery_single' &&
    payload.operation === 'sync_recovery_single' &&
    payload.mode === 'sync_recovery_single' &&
    payload.sourceType === 'recovery_single' &&
    payload.dryRun === true &&
    payload.candidateCount === 1 &&
    payload.sheetRowCount === 1 &&
    payload.rows.length === 1 &&
    payload.approvalStatus === 'approved' &&
    payload.humanReviewCompleted === true &&
    payload.humanReviewedCount === 1 &&
    payload.targetAutoApproved === false &&
    payload.manifestCreated === false &&
    payload.token === 'token';
  return {
    ok,
    text: async () => JSON.stringify(ok ? {
      ok: true,
      action: 'sync_recovery_single',
      mode: 'sync_recovery_single',
      targetDate: '2026-06-20',
      validationPassed: true,
      candidateCount: 1,
      intendedWriteCount: 1,
      actualWriteCount: 0,
      dryRun: true,
      sheetUpdated: false,
      conflict: false,
      errorCode: ''
    } : { ok: false, errorCode: 'mock_payload_invalid' })
  };
};`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

function mockExecuteFetchModule() {
  const source = `
globalThis.fetch = async (_url, options) => {
  const payload = JSON.parse(String(options && options.body || '{}'));
  const ok = payload.action === 'sync_recovery_single' &&
    payload.operation === 'sync_recovery_single' &&
    payload.mode === 'sync_recovery_single' &&
    payload.sourceType === 'recovery_single' &&
    payload.dryRun === false &&
    payload.candidateCount === 1 &&
    payload.sheetRowCount === 1 &&
    payload.rows.length === 1 &&
    payload.approvalStatus === 'approved' &&
    payload.humanReviewCompleted === true &&
    payload.humanReviewedCount === 1 &&
    payload.targetAutoApproved === false &&
    payload.manifestCreated === false &&
    payload.token === 'token';
  return {
    ok,
    text: async () => JSON.stringify(ok ? {
      ok: true,
      action: 'sync_recovery_single',
      mode: 'sync_recovery_single',
      targetDate: '2026-06-20',
      validationPassed: true,
      candidateCount: 1,
      intendedWriteCount: 1,
      actualWriteCount: 1,
      dryRun: false,
      sheetUpdated: true,
      conflict: false,
      alreadyApplied: false,
      errorCode: ''
    } : { ok: false, errorCode: 'mock_execute_payload_invalid' })
  };
};`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
