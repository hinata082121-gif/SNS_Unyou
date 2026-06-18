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
  ['dry-run does not write Sheet or Properties', (env) => { env.entry = 'dryRun'; }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.flushCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(result.wouldAttemptCount, 1);
  }],
  ['manual then manual rerun sends only once', (env) => { env.afterRun = () => env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false }); }, (env) => {
    assert.equal(env.mailSendCount, 1);
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
  }]
];

function createEnvironment() {
  const rows = Array.from({ length: 30 }, (_, index) => buildRow(index + 1));
  const env = {
    props: {
      SHEET_ID: 'mock-sheet',
      SHEET_NAME: 'sales',
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
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [HEADERS, ...rows.map(rowToCells)]),
        _gmail_maintenance: new MockSheet('_gmail_maintenance', [MAINTENANCE_HEADERS])
      },
      getSheetByName(name) {
        return this.sheets[name] || null;
      },
      insertSheet(name) {
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
    sheetWriteCount: 0,
    propertyWriteCount: 0,
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
          env.propertyWriteCount += 1;
          env.props[key] = String(value);
        },
        deleteProperty: (key) => {
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
      openById: () => env.workbook,
      flush: () => { env.flushCount += 1; }
    },
    GmailApp: {
      search: () => {
        if (env.gmailSearchThrows) throw new Error('mock_gmail_search_failed');
        return Array.from({ length: env.gmailSearchResultCount }, () => ({}));
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
      deleteTrigger: () => {},
      newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ nearMinute: () => ({ create: () => {} }), create: () => {} }) }) }) })
    }
  };
}

function runEntry(env) {
  if (env.entry === 'scheduled') return env.context.executeDailyGmailSalesSend_({ source: 'scheduled', requireAutoSend: true, dryRun: false });
  if (env.entry === 'dryRun') return env.context.runGmailSalesPreSendDryRun();
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

function assertBlockedNoMail(env, result, reason) {
  assert.equal(result.status, 'blocked');
  assert.equal((result.blockedReasons || []).includes(reason), true);
  assert.equal(env.mailSendCount, 0);
}

function assertBlockedNoMailCount(env, result, mailCount) {
  assert.equal(result.status, 'blocked');
  assert.equal(env.mailSendCount, mailCount);
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
    this.rows = [];
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
    return Array.from({ length: this.numRows }, (_, r) => Array.from({ length: this.numColumns }, (_, c) => {
      const row = this.sheet.rows[this.row + r - 1] || [];
      return row[this.column + c - 1] ?? '';
    }));
  }

  setValues(values) {
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
    const targetRowIndex = this.row - 1;
    const targetColumnIndex = this.column - 1;
    if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
    this.assertCanWrite(targetRowIndex, targetColumnIndex, value);
    this.sheet.rows[targetRowIndex][targetColumnIndex] = value;
  }

  assertCanWrite(_targetRowIndex, targetColumnIndex, value) {
    const env = this.sheet.env;
    if (env) env.sheetWriteCount += 1;
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
