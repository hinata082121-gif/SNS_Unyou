#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'gmail-sales-automation', 'Code.gs'), 'utf8');
const TARGET_DATE = '2026-06-19';
const BATCH_ID = `gmail-sales-${TARGET_DATE}`;
const HEADERS = [
  'email',
  'contactEmail',
  'name',
  'subject',
  'body',
  'status',
  'sendDate',
  'sendBatchId',
  'sourceUrl',
  'prospectId',
  'dedupeKey',
  'sentStatus',
  'sentAt',
  'sendState',
  'sendRunId',
  'sendReservedAt',
  'sendAttemptCount',
  'approvedBatchId',
  'approvedCandidateDigest',
  'deliveryUncertainAt',
  'lastSendErrorCode',
  'lastCheckedAt'
];
const OUTBOX_HEADERS = [
  'prospectId',
  'name',
  'businessType',
  'area',
  'email',
  'contactEmail',
  'publicSource',
  'sourceUrl',
  'issueHypothesis',
  'salesAngle',
  'subject',
  'body',
  'status',
  'sendDate',
  'nextActionDate',
  'dedupeKey',
  'sendBatchId',
  'sentAt',
  'sentBy',
  'sentStatus',
  'errorMessage',
  'replyStatus',
  'unsubscribe',
  'doNotContact',
  'lastCheckedAt',
  'notes'
];
const MAINTENANCE_HEADERS = [
  'lockName',
  'holderType',
  'holderId',
  'acquiredAt',
  'expiresAt',
  'heartbeatAt',
  'leaseVersion'
];

const scenarios = [
  ['LIVE_SEND_ENABLED missing blocks send', (env) => delete env.props.LIVE_SEND_ENABLED, (env, result) => {
    assertBlockedNoMail(env, result, 'live_send_disabled');
  }],
  ['LIVE_SEND_ENABLED uppercase TRUE blocks send', (env) => { env.props.LIVE_SEND_ENABLED = 'TRUE'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'live_send_disabled');
  }],
  ['AUTO_SEND_ENABLED false blocks scheduled entry', (env) => { env.entry = 'scheduled'; env.props.AUTO_SEND_ENABLED = 'false'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'auto_send_disabled');
  }],
  ['manifest missing blocks send', (env) => delete env.props.APPROVED_SEND_MANIFEST_JSON, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_load_failed');
  }],
  ['manifest expired blocks send', (env) => { env.manifest.expiresAt = '2020-01-01T00:00:00.000Z'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_expired');
  }],
  ['manifest digest mismatch blocks send', (env) => { env.manifest.candidateDigests[0] = 'digest_mismatch'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_digest_mismatch');
  }],
  ['suppression chunk missing blocks send', (env) => { env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_0; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['suppression checksum mismatch blocks send', (env) => { env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = 'bad_checksum'; }; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['recipient suppression match blocks MailApp', (env) => { env.suppression.recipientHashes = [hashValue(env.rows[0].email).slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['domain suppression match blocks MailApp', (env) => { env.suppression.domainHashes = [hashValue('safe-source-1.invalid').slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['business suppression match blocks MailApp', (env) => { env.suppression.businessFingerprints = [hashValue(`${'safe-source-1.invalid'}|${normalizeText(env.rows[0].name)}`).slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['maintenance lease sheet missing blocks send before Sheet row writes', (env) => delete env.workbook.sheets._gmail_maintenance, (env, result) => {
    assertBlockedNoMail(env, result, 'maintenance_sheet_missing');
    assert.equal(env.sheetWriteCount, 0);
  }],
  ['script lock failure blocks send', (env) => { env.lockAvailable = false; }, (env, result) => {
    assertBlockedNoMail(env, result, 'lock_unavailable');
  }],
  ['candidate digest mismatch blocks MailApp', (env) => { writeCell(env, 2, 'body', `${env.rows[0].body} changed`); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_digest_mismatch');
  }],
  ['Gmail Sent match blocks MailApp', (env) => { env.gmailSearchResultCount = 1; }, (env, result) => {
    assertBlockedNoMail(env, result, 'gmail_sent_history_match');
  }],
  ['Gmail Sent search exception blocks MailApp', (env) => { env.gmailSearchThrows = true; }, (env, result) => {
    assertBlockedNoMail(env, result, 'gmail_sent_history_match');
  }],
  ['ready row reserves then sends then marks SENT', () => {}, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'SENT');
    assert.equal(readCell(env, 2, 'sendAttemptCount'), 1);
    assert.equal(env.flushCount >= 2, true);
  }],
  ['MailApp exception leaves DELIVERY_UNKNOWN and rerun does not resend', (env) => { env.mailSendThrows = true; }, (env, result) => {
    assertBlockedNoMailCount(env, result, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'DELIVERY_UNKNOWN');
    env.mailSendThrows = false;
    const before = env.mailSendCount;
    env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
    assert.equal(env.mailSendCount, before);
  }],
  ['SENT update failure leaves non-ready state and rerun does not resend', (env) => { env.failSentUpdate = true; }, (env) => {
    assert.equal(env.mailSendCount, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'DELIVERY_UNKNOWN');
    env.failSentUpdate = false;
    const before = env.mailSendCount;
    env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
    assert.equal(env.mailSendCount, before);
  }],
  ['existing SEND_RESERVED blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'SEND_RESERVED'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['existing SENT blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'SENT'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['existing DELIVERY_UNKNOWN blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'DELIVERY_UNKNOWN'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['attemptCount at limit blocks MailApp', (env) => { writeCell(env, 2, 'sendAttemptCount', 1); }, (env, result) => {
    assertBlockedNoMail(env, result, 'send_attempt_limit_exceeded');
    assert.equal(result.attemptLimitExceededCount, 1);
  }],
  ['dry-run success does not write any external state', (env) => { env.entry = 'dryRun'; env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true'; }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.wouldAttemptCount, 1);
    assertDryRunWriteFree(env);
  }],
  ['dry-run blocked does not reset live send flags', (env) => {
    env.entry = 'dryRun';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    delete env.props.APPROVED_SEND_MANIFEST_JSON;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReasons || []).includes('manifest_load_failed'), true);
    assertDryRunWriteFree(env);
  }],
  ['dry-run sheet load exception remains write-free', (env) => {
    env.entry = 'dryRun';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    env.openSheetThrows = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assertDryRunWriteFree(env);
  }],
  ['manual then manual rerun sends only once', (env) => { env.afterRun = () => env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false }); }, (env) => {
    assert.equal(env.mailSendCount, 1);
  }],
  ['real send success resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 1);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['real send blocked resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    delete env.props.APPROVED_SEND_MANIFEST_JSON;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['real send exception resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    env.mailSendThrows = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 1);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['local_sync lease conflict blocks Apps Script send', (env) => {
    env.workbook.sheets._gmail_maintenance.rows[1] = ['GMAIL_SALES_SHEET_MAINTENANCE', 'local_sync', 'local-holder', new Date().toISOString(), '2099-01-01T00:00:00.000Z', new Date().toISOString(), '1'];
  }, (env, result) => {
    assertBlockedNoMail(env, result, 'maintenance_lease_held');
  }],
  ['expired lease can be acquired safely', (env) => {
    env.workbook.sheets._gmail_maintenance.rows[1] = ['GMAIL_SALES_SHEET_MAINTENANCE', 'local_sync', 'expired-holder', '2020-01-01T00:00:00.000Z', '2020-01-01T00:10:00.000Z', '2020-01-01T00:00:00.000Z', '1'];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 1);
  }],
  ['suppression JSON parse failure blocks send', (env) => { env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0 = '{bad'; env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256('{bad'); env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256('{bad'); }; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['manifest candidateCount mismatch blocks send', (env) => { env.manifest.candidateCount = 29; }, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_candidate_count_mismatch');
  }],
  ['safe logs do not contain row content or digests', () => {}, (env) => {
    const joined = env.logs.join('\n');
    assert.equal(joined.includes(env.rows[0].email), false);
    assert.equal(joined.includes(env.rows[0].name), false);
    assert.equal(joined.includes(env.rows[0].sourceUrl), false);
    assert.equal(joined.includes(env.rows[0].body), false);
    assert.equal(joined.includes(env.manifest.candidateDigests[0]), false);
  }],
  ['suppression diagnostic valid bundle is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.ledgerLoaded, true);
    assert.equal(result.propertyCountExpected, 10);
    assert.equal(result.propertyCountPresent, 10);
    assert.equal(result.missingPropertyCount, 0);
    assert.equal(result.chunkCount, 1);
    assert.equal(result.chunkChecksumValid, true);
    assert.equal(result.bundleChecksumValid, true);
    assert.equal(result.sourceEntryCount, 30);
    assert.equal(result.recipientCount, 30);
    assert.equal(result.domainCount, 30);
    assert.equal(result.businessCount, 30);
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic property missing is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_CREATED_AT;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.missingPropertyCount > 0, true);
    assert.equal(result.blockedReason, 'property_missing');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic chunk missing is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_0;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'property_missing');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic chunk checksum mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = 'mismatch'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'chunk_checksum_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic bundle checksum mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = 'mismatch'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'bundle_checksum_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic JSON parse failure is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => {
      env.props.GMAIL_SUPPRESSION_LEDGER_0 = '{bad';
      env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256('{bad');
      env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256('{bad');
    };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'json_parse_failure');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic count mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT = '29'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'count_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['connected sheet dry-run reads existing sheet and writes nothing', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.connectedToGoogleSheet, true);
    assert.equal(result.targetWorksheetExists, true);
    assert.equal(result.incomingHeaderCount, 26);
    assert.equal(result.incomingCandidateCount, 30);
    assert.equal(result.wouldInsertCount, 30);
    assert.equal(result.wouldWriteCount, 30);
    assert.equal(env.sheetReadCount > 0, true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run handles empty sheet as all inserts', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.currentHeaderCount, 0);
    assert.equal(result.currentRowCount, 0);
    assert.equal(result.wouldInsertCount, 30);
    assert.equal(result.existingDataOverwriteRisk, false);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run skips identical existing rows', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...env.outboxRows.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.matchingIdentityCount, 30);
    assert.equal(result.wouldSkipCount, 30);
    assert.equal(result.wouldInsertCount, 0);
    assert.equal(result.wouldUpdateCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run classifies updates inserts and unrelated rows', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    const existing = [
      ...env.outboxRows.slice(0, 10),
      ...env.outboxRows.slice(10, 15).map((row) => Object.assign({}, row, { subject: 'previous safe subject' })),
      buildOutboxRow(31),
      buildOutboxRow(32)
    ];
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...existing.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.wouldSkipCount, 10);
    assert.equal(result.wouldUpdateCount, 5);
    assert.equal(result.wouldInsertCount, 15);
    assert.equal(result.unrelatedExistingRowCount, 2);
    assert.equal(result.wouldDeleteCount, 2);
    assert.equal(result.existingDataOverwriteRisk, true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks incoming duplicate identity', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.rows[1][0] = env.sheetSyncPayload.rows[0][0];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('duplicate'), true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks existing duplicate identity', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    const duplicate = Object.assign({}, env.outboxRows[0], { subject: 'previous safe subject' });
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, outboxRowToCells(env.outboxRows[0]), outboxRowToCells(duplicate)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'existing_duplicate_identity');
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks unreadable existing headers', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [['notIdentity'], ['value']];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'existing_identity_header_missing');
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks missing target sheet without creating it', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    delete env.workbook.sheets.ready;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'target_sheet_missing');
    assert.equal(env.insertSheetCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run rejects bad token before sheet read', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.token = 'wrong-token';
  }, (env, result) => {
    assert.equal(result.blockedReason, 'token_mismatch');
    assert.equal(env.sheetReadCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run rejects unknown mode before write handler', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.mode = 'unknown';
    env.sheetSyncPayload.operation = 'unknown';
    env.sheetSyncPayload.action = 'unknown';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'unknown_sheet_sync_mode');
    assertSheetSyncReadOnly(env);
  }],
  ['sheet read-only snapshot returns rows only to response and writes nothing', (env) => {
    env.entry = 'sheetSyncReadOnlySnapshot';
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...env.outboxRows.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.event, 'gmail_sheet_sync_read_only_snapshot');
    assert.equal(result.mode, 'read_only_snapshot');
    assert.equal(result.headers.length, 26);
    assert.equal(result.rows.length, 30);
    assert.equal(result.currentRowCount, 30);
    assert.equal(env.logs.join('\n').includes(result.rows[0][0]), false);
    assertSheetSyncReadOnly(env);
  }],
  ['sheet read-only snapshot requires dryRun true and writes nothing', (env) => {
    env.entry = 'sheetSyncReadOnlySnapshot';
    env.sheetSyncPayload.dryRun = false;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'read_only_snapshot_requires_dry_run_true');
    assertSheetSyncReadOnly(env);
  }]
];

function createEnvironment() {
  const rows = Array.from({ length: 30 }, (_, index) => buildRow(index + 1));
  const outboxRows = Array.from({ length: 30 }, (_, index) => buildOutboxRow(index + 1));
  const env = {
    props: {
      SHEET_ID: 'mock-sheet',
      SHEET_NAME: 'sales',
      GMAIL_SHEET_SYNC_TOKEN: 'token',
      GMAIL_SHEET_READY_TAB_NAME: 'ready',
      DRY_RUN: 'false',
      LIVE_SEND_ENABLED: 'true',
      AUTO_SEND_ENABLED: 'true',
      SEND_DATE: TARGET_DATE,
      SEND_BATCH_ID: BATCH_ID,
      SEND_DATE_OVERRIDE: 'true',
      SEND_BATCH_ID_OVERRIDE: 'true',
      ALLOWED_SEND_START_HOUR: '0',
      ALLOWED_SEND_START_MINUTE: '0',
      ALLOWED_SEND_END_HOUR: '23',
      ALLOWED_SEND_END_MINUTE: '59',
      DAILY_SEND_LIMIT: '30',
      GMAIL_SEND_MAX_SEND_COUNT: '1',
      GMAIL_SEND_MAX_ATTEMPTS: '1',
      AUTO_RESET_LIVE_SEND_AFTER_RUN: 'false'
    },
    rows,
    outboxRows,
    sheetSyncPayload: buildSheetSyncPayload(outboxRows),
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [HEADERS, ...rows.map(rowToCells)]),
        ready: new MockSheet('ready', [OUTBOX_HEADERS]),
        _gmail_maintenance: new MockSheet('_gmail_maintenance', [MAINTENANCE_HEADERS])
      },
      getSheetByName(name) {
        return this.sheets[name] || null;
      },
      insertSheet(name) {
        env.insertSheetCount += 1;
        env.sheetWriteCount += 1;
        this.sheets[name] = new MockSheet(name, []);
        this.sheets[name].env = env;
        return this.sheets[name];
      }
    },
    suppression: {
      schemaVersion: 1,
      createdAt: '2026-06-19T00:00:00.000Z',
      sourceEntryCount: 1,
      recipientHashes: ['nonmatching_recipient_hash'],
      domainHashes: ['nonmatching_domain_hash'],
      businessFingerprints: ['nonmatching_business_hash']
    },
    manifest: null,
    entry: 'manual',
    mailSendCount: 0,
    gmailSearchResultCount: 0,
    gmailSearchThrows: false,
    mailSendThrows: false,
    lockAvailable: true,
    flushCount: 0,
    sheetReadCount: 0,
    sheetWriteCount: 0,
    setValueCount: 0,
    setValuesCount: 0,
    clearCount: 0,
    appendRowCount: 0,
    insertRowsCount: 0,
    deleteRowsCount: 0,
    insertSheetCount: 0,
    propertyWriteCount: 0,
    setPropertyCount: 0,
    setPropertiesCount: 0,
    deletePropertyCount: 0,
    triggerWriteCount: 0,
    draftCreateCount: 0,
    leaseWriteCount: 0,
    openSheetThrows: false,
    failSentUpdate: false,
    logs: []
  };
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  env.manifest = {
    schemaVersion: 1,
    targetDate: TARGET_DATE,
    batchId: BATCH_ID,
    candidateCount: 30,
    approvedOutboxHash: 'approved_outbox_hash_present',
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    expiresAt: '2099-01-01T00:00:00.000Z',
    maxSendCount: 1,
    candidateDigests: rows.map((row) => env.context.computeCandidateDigest_(row, TARGET_DATE, BATCH_ID))
  };
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  Object.values(env.workbook.sheets).forEach((sheet) => {
    sheet.env = env;
  });
  return env;
}

function buildContext(env) {
  return {
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => `uuid-${crypto.randomBytes(4).toString('hex')}`,
      formatDate: (date, _timezone, pattern) => formatDate(date, pattern)
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Tokyo'
    },
    Logger: {
      log: (value) => env.logs.push(String(value))
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => env.props[key],
        setProperty: (key, value) => {
          env.setPropertyCount += 1;
          env.propertyWriteCount += 1;
          env.props[key] = String(value);
        },
        setProperties: (values) => {
          env.setPropertiesCount += 1;
          env.propertyWriteCount += 1;
          Object.keys(values || {}).forEach((key) => {
            env.props[key] = String(values[key]);
          });
        },
        deleteProperty: (key) => {
          env.deletePropertyCount += 1;
          env.propertyWriteCount += 1;
          delete env.props[key];
        }
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => env.lockAvailable,
        releaseLock: () => {}
      })
    },
    SpreadsheetApp: {
      openById: () => {
        if (env.openSheetThrows) throw new Error('mock_sheet_load_failed');
        return env.workbook;
      },
      flush: () => { env.flushCount += 1; }
    },
    GmailApp: {
      search: () => {
        if (env.gmailSearchThrows) throw new Error('mock_gmail_search_failed');
        return Array.from({ length: env.gmailSearchResultCount }, () => ({}));
      },
      createDraft: () => {
        env.draftCreateCount += 1;
        return {};
      },
      getUserLabelByName: () => null,
      createLabel: () => ({ addToThread: () => {} })
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: () => {
        env.mailSendCount += 1;
        if (env.mailSendThrows) throw new Error('mock_mail_send_failed');
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => ({ text }) })
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      newTrigger: () => ({
        timeBased: () => ({
          everyDays: () => ({
            atHour: () => ({
              nearMinute: () => ({ create: () => { env.triggerWriteCount += 1; } }),
              create: () => { env.triggerWriteCount += 1; }
            })
          }),
          everyHours: () => ({ create: () => { env.triggerWriteCount += 1; } })
        })
      })
    }
  };
}

function runEntry(env) {
  if (env.entry === 'scheduled') return env.context.executeDailyGmailSalesSend_({ source: 'scheduled', requireAutoSend: true, dryRun: false });
  if (env.entry === 'dryRun') return env.context.runGmailSalesPreSendDryRun();
  if (env.entry === 'suppressionDiagnostic') return env.context.runGmailSuppressionLedgerReadOnlyDiagnostic();
  if (env.entry === 'sheetSyncConnectedDryRun' || env.entry === 'sheetSyncReadOnlySnapshot') {
    if (env.entry === 'sheetSyncReadOnlySnapshot') {
      env.sheetSyncPayload.action = 'read_only_snapshot';
      env.sheetSyncPayload.operation = 'read_only_snapshot';
      env.sheetSyncPayload.mode = 'read_only_snapshot';
    }
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    });
    return JSON.parse(output.text);
  }
  return env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
}

function installSuppressionProps(env) {
  const payload = JSON.stringify(sortObject(env.suppression));
  env.props.GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION = '1';
  env.props.GMAIL_SUPPRESSION_LEDGER_CREATED_AT = env.suppression.createdAt;
  env.props.GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT = String(env.suppression.sourceEntryCount);
  env.props.GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT = String(env.suppression.recipientHashes.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT = String(env.suppression.domainHashes.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT = String(env.suppression.businessFingerprints.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256(payload);
  env.props.GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT = '1';
  env.props.GMAIL_SUPPRESSION_LEDGER_0 = payload;
  env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256(payload);
}

function buildRow(index) {
  const name = `Business ${index}`;
  return {
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    name,
    subject: `Sales note ${index}`,
    body: `${name} 様\n安全なご案内です。\n今後のご案内が不要な場合はご返信不要です。`,
    status: 'ready',
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    sourceUrl: `https://safe-source-${index}.invalid/page`,
    prospectId: `prospect-${index}`,
    dedupeKey: `dedupe-${index}`,
    sentStatus: '',
    sentAt: '',
    sendState: '',
    sendRunId: '',
    sendReservedAt: '',
    sendAttemptCount: '',
    approvedBatchId: '',
    approvedCandidateDigest: '',
    deliveryUncertainAt: '',
    lastSendErrorCode: '',
    lastCheckedAt: ''
  };
}

function rowToCells(row) {
  return HEADERS.map((header) => row[header] ?? '');
}

function buildOutboxRow(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    businessType: 'service',
    area: 'Tokyo',
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'public',
    sourceUrl: `https://safe-source-${index}.invalid/page`,
    issueHypothesis: 'issue',
    salesAngle: 'angle',
    subject: `Subject ${index}`,
    body: `Body ${index} ご返信不要`,
    status: 'ready',
    sendDate: TARGET_DATE,
    nextActionDate: TARGET_DATE,
    dedupeKey: `dedupe-${index}`,
    sendBatchId: BATCH_ID,
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

function outboxRowToCells(row) {
  return OUTBOX_HEADERS.map((header) => row[header] ?? '');
}

function buildSheetSyncPayload(outboxRows) {
  return {
    token: 'token',
    action: 'connected_dry_run',
    operation: 'connected_dry_run',
    mode: 'connected_dry_run',
    dryRun: true,
    targetDate: TARGET_DATE,
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    headers: OUTBOX_HEADERS.slice(),
    rows: outboxRows.map(outboxRowToCells),
    candidateCount: outboxRows.length,
    schemaVersion: 1,
    requestId: 'runtime-test-connected-dry-run',
    readyTabName: 'ready'
  };
}

function assertBlockedNoMail(env, result, reason) {
  assert.equal(result.status, 'blocked');
  assert.equal((result.blockedReasons || []).includes(reason), true);
  assert.equal(env.mailSendCount, 0);
}

function assertBlockedNoMailCount(env, result, mailCount) {
  assert.equal(result.status, 'blocked');
  assert.equal(env.mailSendCount, mailCount);
}

function assertDryRunWriteFree(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
  assert.equal(resetLogCount(env), 0);
}

function assertDiagnosticReadOnly(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
}

function assertSheetSyncReadOnly(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.setValueCount, 0);
  assert.equal(env.setValuesCount, 0);
  assert.equal(env.clearCount, 0);
  assert.equal(env.appendRowCount, 0);
  assert.equal(env.insertRowsCount, 0);
  assert.equal(env.deleteRowsCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
}

function resetLogCount(env) {
  return env.logs.filter((line) => line.includes('live_send_reset_after_run')).length;
}

function useThirtySuppressionEntries(env) {
  env.suppression = {
    schemaVersion: 1,
    createdAt: '2026-06-19T00:00:00.000Z',
    sourceEntryCount: 30,
    recipientHashes: Array.from({ length: 30 }, (_, index) => `recipient_hash_${index}`),
    domainHashes: Array.from({ length: 30 }, (_, index) => `domain_hash_${index}`),
    businessFingerprints: Array.from({ length: 30 }, (_, index) => `business_hash_${index}`)
  };
}

function readCell(env, rowIndex, header) {
  const sheet = env.workbook.sheets.sales;
  const columnIndex = sheet.rows[0].indexOf(header);
  return sheet.rows[rowIndex - 1][columnIndex];
}

function writeCell(env, rowIndex, header, value) {
  const sheet = env.workbook.sheets.sales;
  const columnIndex = sheet.rows[0].indexOf(header);
  sheet.rows[rowIndex - 1][columnIndex] = value;
}

function formatDate(date, pattern) {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  if (pattern === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
  if (pattern === 'yyyy/MM/dd') return `${year}/${month}/${day}`;
  if (pattern === 'HH:mm') return `${hour}:${minute}`;
  return value.toISOString();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sha256(value) {
  return hashValue(value);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortObject(value[key]);
    return acc;
  }, {});
}

class MockSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getDataRange() {
    return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }

  getRange(row, column, numRows = 1, numColumns = 1) {
    return new MockRange(this, row, column, numRows, numColumns);
  }

  clearContents() {
    if (this.env) {
      this.env.clearCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows = [];
  }

  clear() {
    if (this.env) {
      this.env.clearCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows = [];
  }

  appendRow(row) {
    if (this.env) {
      this.env.appendRowCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows.push((row || []).slice());
  }

  insertRows() {
    if (this.env) {
      this.env.insertRowsCount += 1;
      this.env.sheetWriteCount += 1;
    }
  }

  deleteRows() {
    if (this.env) {
      this.env.deleteRowsCount += 1;
      this.env.sheetWriteCount += 1;
    }
  }
}

class MockRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    if (this.sheet.env) this.sheet.env.sheetReadCount += 1;
    return Array.from({ length: this.numRows }, (_, r) => Array.from({ length: this.numColumns }, (_, c) => {
      const row = this.sheet.rows[this.row + r - 1] || [];
      return row[this.column + c - 1] ?? '';
    }));
  }

  setValues(values) {
    if (this.sheet.env) this.sheet.env.setValuesCount += 1;
    values.forEach((rowValues, r) => {
      const targetRowIndex = this.row + r - 1;
      if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
      rowValues.forEach((value, c) => {
        this.assertCanWrite(targetRowIndex, this.column + c - 1, value);
        this.sheet.rows[targetRowIndex][this.column + c - 1] = value;
      });
    });
  }

  setValue(value) {
    if (this.sheet.env) this.sheet.env.setValueCount += 1;
    const targetRowIndex = this.row - 1;
    const targetColumnIndex = this.column - 1;
    if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
    this.assertCanWrite(targetRowIndex, targetColumnIndex, value);
    this.sheet.rows[targetRowIndex][targetColumnIndex] = value;
  }

  assertCanWrite(_targetRowIndex, targetColumnIndex, value) {
    const env = this.sheet.env;
    if (env) env.sheetWriteCount += 1;
    if (env && this.sheet.name === '_gmail_maintenance') env.leaseWriteCount += 1;
    if (env?.failSentUpdate && this.sheet.name === 'sales' && this.sheet.rows[0][targetColumnIndex] === 'sendState' && value === 'SENT') {
      throw new Error('mock_sent_update_failed');
    }
  }
}

for (const [name, mutate, verify] of scenarios) {
  const env = createEnvironment();
  mutate(env);
  if (env.props.APPROVED_SEND_MANIFEST_JSON !== undefined) {
    env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  }
  installSuppressionProps(env);
  if (typeof env.afterInstall === 'function') env.afterInstall();
  const result = runEntry(env);
  if (typeof env.afterRun === 'function') env.afterRun();
  try {
    verify(env, result);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

console.log(JSON.stringify({
  runtimeTestScenarioCount: scenarios.length,
  passed: true,
  mailAppCallsInTestsOnly: true,
  realGmailSendExecuted: false,
  realGoogleSheetsUpdated: false,
  realScriptPropertiesUpdated: false,
  appsScriptExecuted: false
}, null, 2));
