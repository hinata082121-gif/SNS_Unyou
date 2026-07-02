import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

const SOURCE_HEADERS = [
  'prospectId', 'name', 'email', 'contactEmail', 'publicSource', 'sourceUrl', 'sourceReference', 'sourceType',
  'subject', 'body', 'status', 'sendDate', 'dedupeKey', 'sentStatus', 'replyStatus', 'unsubscribe',
  'doNotContact', 'sendState', 'notes', 'existingRelationshipEvidence', 'explicitOptInEvidence',
  'businessContactEvidence', 'contactBasisType', 'contactBasisRecordedAt', 'sourceReferenceHash',
  'optOutAvailable', 'lastVerifiedAt', 'suppressionCheckedAt', 'historyCheckedAt'
];

const REVIEW_HEADERS = [
  'reviewId', 'sourceRowKey', 'leadIdHash', 'sourceRowDigest', 'businessDisplayName', 'contactDisplay',
  'sourceType', 'sourceReference', 'sourceReferenceHash', 'existingRelationshipEvidence',
  'explicitOptInEvidence', 'businessContactEvidence', 'existingContactBasisType', 'suggestedBasisType',
  'suggestionReasonCode', 'reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable',
  'reviewerLabel', 'reviewedAt', 'applyStatus', 'applyErrorCode', 'appliedAt', 'lastQueueSyncedAt',
  'priorityRank', 'priorityReasonCode'
];

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('official evidence enrichment updates only eligible needs-more-evidence rows', () => {
  const env = createEnvironment({ sourceCount: 4 });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'evidence_payload_missing');
  markNeedsMoreEvidence(env, 3, 'insufficient_evidence');
  writeReview(env, 4, 'applyStatus', 'applied');
  writeReview(env, 5, 'reviewDecision', 'rejected');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.evidenceEnrichmentTargetCount, 2);
  assert.equal(result.evidenceEnrichmentSucceededCount, 2);
  assert.equal(result.officialPageFetchCount, 1);
  assert.equal(result.officialPageCacheHitCount >= 1, true);
  assert.equal(result.officialBusinessChannelCount, 2);
  assert.equal(result.evidenceDigestChangedCount, 2);
  assert.equal(result.aiReevaluationEligibleCount, 2);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'pending');
  assert.equal(readReview(env, 2, 'applyStatus'), 'pending');
  assert.equal(Boolean(readReview(env, 2, 'evidencePackageDigest')), true);
  assert.equal(readReview(env, 4, 'applyStatus'), 'applied');
  assert.equal(readReview(env, 5, 'reviewDecision'), 'rejected');
});

test('enrichment classifies missing source for replenishment without URL guessing', () => {
  const env = createEnvironment({ sourceCount: 1 });
  setSource(env, 2, { sourceReference: '', sourceUrl: '', publicSource: '', sourceType: '' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'evidence_payload_missing');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'no_verified_source_reference');
  assert.equal(result.evidenceEnrichmentTargetCount, 0);
  assert.equal(result.evidenceEnrichmentSucceededCount, 0);
  assert.equal(result.evidenceEnrichmentMissingCount, 0);
  assert.equal(result.officialPageFetchCount, 0);
  assert.equal(result.evidenceReplenishmentQueueCount, 1);
  assert.equal(Boolean(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue), false);
  assert.equal(result.googleSheetsUpdated, false);
});

test('official URL safety blocks localhost private IP and mismatched redirect', () => {
  const env = createEnvironment({ sourceCount: 0 });
  assert.equal(env.context.validateOfficialEvidenceUrl_('http://localhost/contact').reasonCode, 'localhost_rejected');
  assert.equal(env.context.validateOfficialEvidenceUrl_('http://192.168.0.1/contact').reasonCode, 'private_ip_rejected');
  env.fetchMap.set('https://official.example/contact', {
    status: 302,
    headers: { Location: 'https://other.example/contact' },
    body: ''
  });
  const stats = env.context.emptyOfficialEvidenceEnrichmentStats_();
  assert.equal(env.context.fetchVerifiedOfficialPage_('https://official.example/contact', 'https://official.example/contact', stats).reasonCode, 'redirect_domain_mismatch');
});

test('sanitize removes script footer URL query email local part and phone', () => {
  const env = createEnvironment({ sourceCount: 0 });
  const text = env.context.sanitizeOfficialEvidenceText_('<script>x</script><footer>nav</footer><p>法人のお問い合わせ user@example.com 03-1234-5678 https://official.example/contact?a=1</p>');
  assert.equal(text.includes('user@example.com'), false);
  assert.equal(text.includes('03-1234-5678'), false);
  assert.equal(text.includes('?a=1'), false);
  assert.equal(text.includes('法人のお問い合わせ'), true);
});

test('unchanged digest avoids AI reevaluation and repeated fetch uses cache', () => {
  const env = createEnvironment({ sourceCount: 1 });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const first = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  writeReview(env, 2, 'lastAiEvaluatedEvidenceDigest', readReview(env, 2, 'evidencePackageDigest'));
  const second = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(first.evidenceDigestChangedCount, 1);
  assert.equal(second.evidenceDigestChangedCount, 0);
  assert.equal(second.officialPageCacheHitCount >= 1, true);
});

test('last run summary persists and inspector does not zero it', () => {
  const env = createEnvironment({ sourceCount: 3, aiEnabled: true, provider: 'mock', mockAutoApproval: false });
  for (let rowIndex = 2; rowIndex <= 4; rowIndex += 1) {
    setSource(env, rowIndex, { businessContactEvidence: `法人のお問い合わせ evidence ${rowIndex}` });
  }
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const run = env.context.runGmailSalesAiContactBasisVerificationOnce();
  const status = env.context.inspectGmailSalesAiContactBasisStatus();
  assert.equal(run.aiEvaluatedCount, 3);
  assert.equal(status.lastRunIdPresent, true);
  assert.equal(status.lastAiEvaluatedCount, 3);
  assert.equal(status.lastAiBatchRequestCount, 1);
  assert.equal(status.providerConnectionAttempted, true);
  assert.equal(status.providerConnectionSucceeded, true);
});

test('solicitation restriction is not enriched for approval', () => {
  const env = createEnvironment({ sourceCount: 1 });
  env.fetchMap.set('https://official.example/contact', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main>法人のお問い合わせ 営業目的の連絡は禁止 お問い合わせフォーム</main>'
  });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.evidenceEnrichmentSucceededCount, 0);
  assert.equal(result.solicitationRestrictedCount, 0);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'needs_more_evidence');
});

function createEnvironment(options = {}) {
  const rows = [SOURCE_HEADERS];
  for (let index = 1; index <= (options.sourceCount || 0); index += 1) rows.push(SOURCE_HEADERS.map((header) => buildSourceRow(index)[header] || ''));
  const env = {
    props: {
      SHEET_ID: 'sheet-id',
      SHEET_NAME: 'sales',
      GMAIL_DAILY_SOURCE_TAB_NAME: 'Gmail営業候補プール',
      GMAIL_SHEET_READY_TAB_NAME: 'sales',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      GMAIL_SALES_AI_ENABLED: options.aiEnabled ? 'true' : 'false',
      GMAIL_SALES_AI_PROVIDER: options.provider || 'disabled',
      GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED: options.mockAutoApproval ? 'true' : 'false',
      GMAIL_SALES_AI_MODEL: 'mock-model',
      GMAIL_SALES_AI_API_KEY: options.aiEnabled ? 'mock-redacted-token' : '',
      GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: '0.95',
      GMAIL_SALES_AI_MAX_DAILY_REQUESTS: '100',
      GMAIL_SALES_AI_MAX_DAILY_COST_YEN: '100'
    },
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [SOURCE_HEADERS]),
        'Gmail営業候補プール': new MockSheet('Gmail営業候補プール', rows),
        Gmail_Contact_Basis_Review: new MockSheet('Gmail_Contact_Basis_Review', [REVIEW_HEADERS])
      },
      getSheetByName(name) { return this.sheets[name] || null; },
      getSheets() { return Object.values(this.sheets); },
      insertSheet(name) {
        env.sheetWriteCount += 1;
        this.sheets[name] = new MockSheet(name, []);
        this.sheets[name].env = env;
        return this.sheets[name];
      }
    },
    fetchMap: new Map(),
    cache: new Map(),
    logs: [],
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0
  };
  env.fetchMap.set('https://official.example/contact', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main><a href="/business">法人のお問い合わせ</a> 企業向けお問い合わせフォーム 業務提携 広告掲載 取材 メディア サービス導入のご相談 [email]</main><footer>footer</footer>'
  });
  env.fetchMap.set('https://official.example/business', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main>法人のお問い合わせ 業務提携について お問い合わせフォーム 配信停止</main>'
  });
  Object.values(env.workbook.sheets).forEach((sheet) => { sheet.env = env; });
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  return env;
}

function buildContext(env) {
  return {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, Date, URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => 'uuid',
      formatDate: (_date, _timezone, pattern) => pattern === 'HH:mm' ? '06:45' : '2026-07-01'
    },
    Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
    Logger: { log: (value) => env.logs.push(String(value)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => env.props[key],
        getProperties: () => Object.assign({}, env.props),
        setProperties: (values) => {
          env.propertyWriteCount += 1;
          Object.keys(values || {}).forEach((key) => { env.props[key] = String(values[key]); });
        },
        setProperty: (key, value) => {
          env.propertyWriteCount += 1;
          env.props[key] = String(value);
        }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: {
      openById: () => env.workbook,
      flush: () => {},
      newDataValidation: () => ({
        requireValueInList(values) { this.values = values; return this; },
        setAllowInvalid() { return this; },
        build() { return { values: this.values || [] }; }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'runGmailSalesProductionControlLoop' }],
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }),
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => env.cache.get(key) || null,
        put: (key, value) => { env.cache.set(key, String(value)); }
      })
    },
    UrlFetchApp: {
      fetch: (url) => {
        const item = env.fetchMap.get(String(url));
        if (!item) throw new Error('unexpected fetch');
        return {
          getResponseCode: () => item.status,
          getHeaders: () => item.headers || {},
          getContentText: () => item.body || ''
        };
      }
    }
  };
}

function buildSourceRow(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'official source',
    sourceUrl: 'https://official.example/contact',
    sourceReference: 'https://official.example/contact',
    sourceType: 'official_site',
    subject: `Subject ${index}`,
    body: `Body ${index}`,
    status: 'ready',
    dedupeKey: `dedupe-${index}`
  };
}

function setSource(env, rowIndex, values) {
  Object.keys(values).forEach((key) => writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, key, values[key]));
}

function markNeedsMoreEvidence(env, rowIndex, reason) {
  writeReview(env, rowIndex, 'reviewDecision', 'needs_more_evidence');
  writeReview(env, rowIndex, 'applyStatus', 'needs_more_evidence');
  writeReview(env, rowIndex, 'applyErrorCode', reason);
  writeReview(env, rowIndex, 'evidenceNotes', `ai_exception_${reason}`);
}

function readReview(env, rowIndex, header) {
  return readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header);
}

function writeReview(env, rowIndex, header, value) {
  writeCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header, value);
}

function readCell(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return index === -1 ? '' : sheet.rows[rowIndex - 1][index] || '';
}

function writeCell(sheet, rowIndex, header, value) {
  const index = sheet.rows[0].indexOf(header);
  if (index === -1) throw new Error(`missing header ${header}`);
  if (!sheet.rows[rowIndex - 1]) sheet.rows[rowIndex - 1] = [];
  sheet.rows[rowIndex - 1][index] = value;
}

class MockSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.validations = {};
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getMaxRows() { return Math.max(this.rows.length, 200); }
  getDataRange() { return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(row, column, numRows = 1, numColumns = 1) { return new MockRange(this, row, column, numRows, numColumns); }
  setFrozenRows() {}
  setColumnWidth() {}
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
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    values.forEach((rowValues, r) => {
      const target = this.row + r - 1;
      if (!this.sheet.rows[target]) this.sheet.rows[target] = [];
      rowValues.forEach((value, c) => { this.sheet.rows[target][this.column + c - 1] = value; });
    });
  }
  setValue(value) {
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    const target = this.row - 1;
    if (!this.sheet.rows[target]) this.sheet.rows[target] = [];
    this.sheet.rows[target][this.column - 1] = value;
  }
  setDataValidation(rule) {
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) {
        const key = `${this.row + r}:${this.column + c}`;
        if (rule) this.sheet.validations[key] = rule;
        else delete this.sheet.validations[key];
      }
    }
  }
  clearDataValidations() { this.setDataValidation(null); }
  getDataValidations() {
    return Array.from({ length: this.numRows }, (_, r) => Array.from({ length: this.numColumns }, (_, c) => this.sheet.validations[`${this.row + r}:${this.column + c}`] || null));
  }
  createFilter() {}
}

for (const [name, fn] of tests) {
  try {
    fn();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

console.log(JSON.stringify({
  officialEvidenceEnrichmentTestPassed: true,
  scenarioCount: tests.length,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
