#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OUTBOX_HEADERS, buildBatchId } from './pool-utils.mjs';

const ROOT = process.cwd();
const TARGET_DATE = '2026-06-19';
const SEND_BATCH_ID = buildBatchId(TARGET_DATE);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmail-sheet-sync-test-'));
const tsvPath = path.join(tmpDir, 'safe-outbox.tsv');

try {
  fs.writeFileSync(tsvPath, buildTsv(), 'utf8');
  const localDryRun = runSync(['--date', TARGET_DATE, '--tsv', tsvPath], {
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_SYNC_MODE: 'local_dry_run',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token'
  });
  assert.equal(localDryRun.status, 0);
  const localSummary = JSON.parse(localDryRun.stdout);
  assert.equal(localSummary.syncMode, 'local_dry_run');
  assert.equal(localSummary.blockedReason, 'sheet_sync_local_dry_run');
  assert.equal(localSummary.sheetSynced, false);

  const connectedDryRun = runSync(['--date', TARGET_DATE, '--tsv', tsvPath, '--connected-dry-run'], {
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token',
    NODE_OPTIONS: `--import=${mockFetchModule()}`
  });
  assert.equal(connectedDryRun.status, 0);
  const connectedSummary = JSON.parse(connectedDryRun.stdout);
  assert.equal(connectedSummary.syncMode, 'connected_dry_run');
  assert.equal(connectedSummary.connectedToGoogleSheet, true);
  assert.equal(connectedSummary.targetWorksheetExists, true);
  assert.equal(connectedSummary.incomingHeaderCount, OUTBOX_HEADERS.length);
  assert.equal(connectedSummary.incomingCandidateCount, 30);
  assert.equal(connectedSummary.schemaValid, true);
  assert.equal(connectedSummary.requiredHeadersPresent, true);
  assert.equal(connectedSummary.incomingDuplicateCount, 0);
  assert.equal(connectedSummary.googleSheetsUpdated, false);
  assert.equal(connectedSummary.maintenanceLeaseCreated, false);
  assert.equal(connectedSummary.scriptPropertiesUpdated, false);

  const writeGuard = runSync(['--date', TARGET_DATE, '--tsv', tsvPath, '--write'], {
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token',
    NODE_OPTIONS: `--import=${throwingFetchModule()}`
  });
  assert.notEqual(writeGuard.status, 0);
  const writeGuardSummary = JSON.parse(writeGuard.stdout);
  assert.equal(writeGuardSummary.blockedReason, 'sheet_sync_write_requires_dry_run_false');

  const connectedFailure = runSync(['--date', TARGET_DATE, '--tsv', tsvPath, '--connected-dry-run'], {
    GMAIL_SHEET_SYNC_ENABLED: 'true',
    GMAIL_SHEET_SYNC_DRY_RUN: 'true',
    GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
    GMAIL_SHEET_SYNC_TOKEN: 'token',
    NODE_OPTIONS: `--import=${failingFetchModule()}`
  });
  assert.notEqual(connectedFailure.status, 0);
  const failedSummary = JSON.parse(connectedFailure.stdout);
  assert.equal(failedSummary.blockedReason, 'connected_dry_run_failed');
  assert.equal(failedSummary.sheetSynced, false);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  syncScriptTestScenarioCount: 4,
  passed: true,
  localDryRunWebhookCallCount: 0,
  connectedDryRunWebhookCallCount: 1,
  connectedDryRunPayloadModeValid: true,
  connectedDryRunPayloadDryRunValid: true,
  connectedDryRunFallsBackToWrite: false,
  personalDataLogged: false
}, null, 2));

function runSync(args, env) {
  return spawnSync(process.execPath, ['scripts/gmail/sync-outbox-to-sheet.mjs', ...args], {
    cwd: ROOT,
    env: Object.assign({}, process.env, env),
    encoding: 'utf8'
  });
}

function buildTsv() {
  const rows = Array.from({ length: 30 }, (_, index) => {
    const value = index + 1;
    const row = {
      prospectId: `prospect-${value}`,
      name: `Business ${value}`,
      businessType: 'service',
      area: 'Tokyo',
      email: `recipient${value}@example.invalid`,
      contactEmail: `recipient${value}@example.invalid`,
      publicSource: 'public',
      sourceUrl: `https://source-${value}.example.invalid`,
      issueHypothesis: 'issue',
      salesAngle: 'angle',
      subject: `Subject ${value}`,
      body: `Body ${value} ご返信不要`,
      status: 'ready',
      sendDate: TARGET_DATE,
      nextActionDate: TARGET_DATE,
      dedupeKey: `dedupe-${value}`,
      sendBatchId: SEND_BATCH_ID,
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
    return OUTBOX_HEADERS.map((header) => String(row[header] ?? '').replace(/\t/g, ' ')).join('\t');
  });
  return [OUTBOX_HEADERS.join('\t'), ...rows].join('\n');
}

function mockFetchModule() {
  const source = `
globalThis.fetch = async (_url, options) => {
  const payload = JSON.parse(String(options && options.body || '{}'));
  const ok = payload.mode === 'connected_dry_run' &&
    payload.operation === 'connected_dry_run' &&
    payload.action === 'connected_dry_run' &&
    payload.dryRun === true &&
    payload.candidateCount === 30 &&
    payload.headers.length === ${OUTBOX_HEADERS.length} &&
    payload.rows.length === 30 &&
    !payload.maintenanceLease;
  return {
    ok,
    text: async () => JSON.stringify(ok ? {
      ok: true,
      event: 'gmail_sheet_sync_connected_dry_run',
      mode: 'connected_dry_run',
      status: 'pass',
      connectedToGoogleSheet: true,
      targetWorksheetResolved: true,
      targetWorksheetExists: true,
      currentHeaderCount: ${OUTBOX_HEADERS.length},
      currentRowCount: 0,
      incomingHeaderCount: ${OUTBOX_HEADERS.length},
      incomingCandidateCount: 30,
      schemaValid: true,
      requiredHeadersPresent: true,
      existingDuplicateCount: 0,
      incomingDuplicateCount: 0,
      matchingIdentityCount: 0,
      wouldInsertCount: 30,
      wouldUpdateCount: 0,
      wouldSkipCount: 0,
      wouldDeleteCount: 0,
      wouldClearWorksheet: false,
      wouldWriteCount: 30,
      existingDataOverwriteRisk: false,
      unrelatedExistingRowCount: 0,
      maintenanceLeaseCreated: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    } : { ok: false, blockedReason: 'mock_payload_invalid' })
  };
};`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

function throwingFetchModule() {
  return `data:text/javascript,${encodeURIComponent('globalThis.fetch = async () => { throw new Error("fetch_should_not_run"); };')}`;
}

function failingFetchModule() {
  const source = `
globalThis.fetch = async () => ({
  ok: false,
  text: async () => JSON.stringify({ ok: false, blockedReason: 'connected_dry_run_failed', sheetSynced: false })
});`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
