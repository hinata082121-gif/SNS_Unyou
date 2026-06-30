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

const REPLENISHMENT_HEADERS = [
  'candidateToken', 'failureReasonCode', 'requiredEvidenceType', 'existingSourceType',
  'sourceReferencePresent', 'officialDomainPresent', 'eligibleForAutomatedReplenishment',
  'queuedAt', 'status'
];

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('grounded source discovery applies verified citation sources with one Gemini request per attempted candidate', () => {
  const env = createEnvironment({ sourceCount: 12 });
  seedGroundingReviewAndQueue(env, 12);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.candidatesAttemptedCount, 10);
  assert.equal(result.searchQueryCount, 10);
  assert.equal(result.searchRequestSuccessCount, 10);
  assert.equal(result.verifiedOfficialSourceCount, 10);
  assert.equal(result.sourceReferencesAppliedCount, 10);
  assert.equal(result.googleSheetsUpdated, true);
  assert.equal(result.scriptPropertiesUpdated, true);
  assert.equal(env.fetchCalls.length, 10);
  assert.equal(env.propertyWriteCount, 1);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  env.fetchCalls.forEach((call) => {
    assert.equal(call.url.includes(env.props.GMAIL_SALES_AI_API_KEY), false);
    assert.equal(call.options.headers['x-goog-api-key'], env.props.GMAIL_SALES_AI_API_KEY);
    const payload = JSON.parse(call.options.payload);
    assert.deepEqual(payload.tools, [{ type: 'google_search' }]);
    assert.equal(payload.input.includes('@example.invalid'), false);
    assert.equal(payload.input.includes('Subject'), false);
    assert.equal(payload.input.includes('Body'), false);
  });
  assert.equal(readCell(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue, 2, 'status'), 'source_discovered');
  assert.equal(Boolean(readCell(env.workbook.sheets['Gmail営業候補プール'], 2, 'sourceReference')), true);
  assert.equal(readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, 2, 'sourceDiscoveryStatus'), 'verified');
  const status = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(status.sourceReferencesAppliedCount, 10);
  assert.equal(status.recommendedNextAction, 'run_source_discovery');
});

test('grounding is fail-closed when Gemini configuration is not valid', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: false });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'grounding_configuration_invalid');
  assert.equal(result.searchQueryCount, 0);
  assert.equal(env.fetchCalls.length, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.propertyWriteCount, 0);
});

test('citation selection requires grounded citation URL, official confidence, identity match, and safe domain', () => {
  const env = createEnvironment({ sourceCount: 0 });
  const target = buildSelectionTarget(env, 'token');
  const grounding = { minOfficialConfidence: 0.98, version: 'test' };
  assert.equal(env.context.parseGeminiGroundingCitations_(mockGeminiResponse({
    token: 'token',
    url: '',
    bodyUrlOnly: 'https://body-only.example/contact',
    confidence: 0.99,
    identity: true
  }), target).length, 0);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.97,
    businessIdentityMatched: true,
    riskFlags: [],
    reasonCodes: []
  }], grounding).ok, false);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.98,
    businessIdentityMatched: false,
    riskFlags: [],
    reasonCodes: []
  }], grounding).ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('http://localhost/contact').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('http://192.168.0.1/contact').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://bit.ly/path').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://instagram.com/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://www.google.com/maps/place/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://indeed.com/jobs/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://prtimes.jp/main/html/example').ok, false);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.98,
    businessIdentityMatched: true,
    contactPageDiscovered: true,
    businessInquiryEvidencePresent: true,
    solicitationRestrictionPresent: false,
    riskFlags: [],
    reasonCodes: ['official_site_verified']
  }], grounding).ok, true);
});

test('production AI verification phase runs grounded discovery before enrichment and AI verification', () => {
  const env = createEnvironment({ sourceCount: 1 });
  let order = [];
  env.context.refreshGmailSalesContactBasisReviewQueueOnce = () => { order.push('refresh'); return { status: 'pass' }; };
  env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce = () => { order.push('grounding'); return { status: 'pass' }; };
  env.context.runGmailSalesOfficialEvidenceEnrichmentOnce = () => { order.push('enrichment'); return { status: 'pass' }; };
  env.context.runGmailSalesAiContactBasisVerificationOnce = () => { order.push('verification'); return { status: 'pass' }; };
  env.context.runGmailSalesAiVerificationPhase_();
  assert.deepEqual(order, ['refresh', 'grounding', 'enrichment', 'verification']);
});

function createEnvironment(options = {}) {
  const rows = [SOURCE_HEADERS];
  for (let index = 1; index <= (options.sourceCount || 0); index += 1) {
    rows.push(SOURCE_HEADERS.map((header) => buildSourceRow(index)[header] || ''));
  }
  const env = {
    props: {
      SHEET_ID: 'sheet-id',
      SHEET_NAME: 'sales',
      GMAIL_DAILY_SOURCE_TAB_NAME: 'Gmail営業候補プール',
      GMAIL_SHEET_READY_TAB_NAME: 'sales',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      GMAIL_SALES_AI_ENABLED: options.aiEnabled === false ? 'false' : 'true',
      GMAIL_SALES_AI_PROVIDER: 'gemini',
      GMAIL_SALES_AI_MODEL: 'gemini-mock',
      GMAIL_SALES_AI_API_KEY: options.aiEnabled === false ? '' : 'mock-redacted-token',
      GMAIL_SALES_GROUNDING_MODEL: 'gemini-mock-grounded',
      GMAIL_SALES_GROUNDING_MAX_CANDIDATES_PER_RUN: '10',
      GMAIL_SALES_GROUNDING_MAX_SEARCH_QUERIES_PER_DAY: '30',
      GMAIL_SALES_GROUNDING_MAX_DAILY_COST_YEN: '100'
    },
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [SOURCE_HEADERS]),
        'Gmail営業候補プール': new MockSheet('Gmail営業候補プール', rows),
        Gmail_Contact_Basis_Review: new MockSheet('Gmail_Contact_Basis_Review', [REVIEW_HEADERS]),
        Gmail_Evidence_Replenishment_Queue: new MockSheet('Gmail_Evidence_Replenishment_Queue', [REPLENISHMENT_HEADERS])
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
    logs: [],
    fetchCalls: [],
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0
  };
  Object.values(env.workbook.sheets).forEach((sheet) => { sheet.env = env; });
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  return env;
}

function seedGroundingReviewAndQueue(env, count) {
  const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
  const reviewSheet = env.workbook.sheets.Gmail_Contact_Basis_Review;
  const queueSheet = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  for (let rowIndex = 2; rowIndex < 2 + count; rowIndex += 1) {
    const sourceRow = rowFromSheet(sourceSheet, rowIndex);
    const queue = env.context.buildContactBasisReviewQueueRow_({ row: sourceRow, rowIndex }, '2026-07-01T00:00:00.000Z');
    assert.equal(queue.include, true);
    const reviewRow = Object.assign({}, queue.row, {
      reviewDecision: 'needs_more_evidence',
      applyStatus: 'needs_more_evidence',
      applyErrorCode: 'no_source_reference',
      evidenceNotes: 'needs official source'
    });
    reviewSheet.rows.push(REVIEW_HEADERS.map((header) => reviewRow[header] || ''));
    const token = env.context.buildGroundingCandidateToken_(reviewRow);
    queueSheet.rows.push(REPLENISHMENT_HEADERS.map((header) => ({
      candidateToken: token,
      failureReasonCode: 'no_source_reference',
      requiredEvidenceType: 'official_source_reference',
      existingSourceType: '',
      sourceReferencePresent: 'false',
      officialDomainPresent: 'false',
      eligibleForAutomatedReplenishment: 'true',
      queuedAt: '2026-07-01T00:00:00.000Z',
      status: 'queued'
    }[header] || '')));
  }
}

function buildSelectionTarget(env, token) {
  return {
    candidateToken: token,
    sourceItem: { rowIndex: 2, row: buildSourceRow(1) },
    reviewItem: { rowIndex: 2, row: { sourceRowKey: 'key', sourceRowDigest: 'digest' } },
    queueItem: null
  };
}

function mockGeminiResponse({ token, url, bodyUrlOnly, confidence, identity }) {
  const payload = {
    output_text: JSON.stringify({
      candidateToken: token,
      officialConfidence: confidence,
      businessIdentityMatched: identity,
      contactPageDiscovered: true,
      businessInquiryEvidencePresent: true,
      solicitationRestrictionPresent: false,
      riskFlags: [],
      reasonCodes: ['official_site_verified'],
      ignoredText: bodyUrlOnly || ''
    })
  };
  if (url) {
    payload.groundingMetadata = {
      groundingChunks: [{ web: { uri: url, title: 'official contact' } }]
    };
  }
  return {
    response: {
      getContentText: () => JSON.stringify(payload)
    }
  };
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
        },
        deleteProperty: (key) => {
          env.propertyWriteCount += 1;
          delete env.props[key];
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
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { env.triggerWriteCount += 1; return {}; } }) }) }),
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: {
      fetch: (url, options = {}) => {
        env.fetchCalls.push({ url: String(url), options });
        const prompt = JSON.parse(options.payload).input;
        const parsedPrompt = JSON.parse(prompt);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            output_text: JSON.stringify({
              candidateToken: parsedPrompt.candidateToken,
              officialConfidence: 0.98,
              businessIdentityMatched: true,
              officialUrlFromCitationOnly: true,
              contactPageDiscovered: true,
              businessInquiryEvidencePresent: true,
              solicitationRestrictionPresent: false,
              riskFlags: [],
              reasonCodes: ['official_site_verified']
            }),
            groundingMetadata: {
              groundingChunks: [{
                web: {
                  uri: `https://official-${env.fetchCalls.length}.example/contact`,
                  title: 'official contact'
                }
              }]
            }
          })
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
    publicSource: '',
    sourceUrl: '',
    sourceReference: '',
    sourceType: '',
    subject: `Subject ${index}`,
    body: `Body ${index}`,
    status: 'ready',
    dedupeKey: `dedupe-${index}`,
    optOutAvailable: 'true'
  };
}

function rowFromSheet(sheet, rowIndex) {
  const headers = sheet.rows[0];
  const cells = sheet.rows[rowIndex - 1] || [];
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
}

function readCell(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return index === -1 ? '' : sheet.rows[rowIndex - 1][index] || '';
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
  groundedSourceDiscoveryTestPassed: true,
  scenarioCount: tests.length,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
