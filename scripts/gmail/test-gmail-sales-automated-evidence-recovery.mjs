import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');
const appsScriptManifest = JSON.parse(readFileSync('apps-script/gmail-sales-automation/appsscript.json', 'utf8'));

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1, state) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
    this.state = state;
  }
  getValues() {
    const values = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const rowValues = [];
      for (let c = 0; c < this.numCols; c += 1) {
        rowValues.push(this.sheet.getCell(this.row + r, this.col + c));
      }
      values.push(rowValues);
    }
    return values;
  }
  getFormula() { return ''; }
  getDataValidation() { return null; }
  getDisplayValue() { return String(this.sheet.getCell(this.row, this.col) || ''); }
  isPartOfMerge() { return false; }
  setValue(value) {
    this.state.sheetWriteCount += 1;
    this.sheet.setCell(this.row, this.col, value);
    return this;
  }
  setValues(values) {
    this.state.sheetWriteCount += 1;
    (values || []).forEach((rowValues, r) => {
      (rowValues || []).forEach((value, c) => this.sheet.setCell(this.row + r, this.col + c, value));
    });
    return this;
  }
  clearContent() {
    this.state.sheetWriteCount += 1;
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numCols; c += 1) this.sheet.setCell(this.row + r, this.col + c, '');
    }
    return this;
  }
}

class FakeSheet {
  constructor(name, headers, rows, state) {
    this.name = name;
    this.state = state;
    this.values = [headers.slice()].concat((rows || []).map((row) => headers.map((header) => row[header] === undefined ? '' : row[header])));
  }
  getName() { return this.name; }
  getLastRow() { return this.values.length; }
  getLastColumn() { return this.values[0] ? this.values[0].length : 0; }
  getProtections() { return []; }
  getRange(row, col, numRows = 1, numCols = 1) { return new FakeRange(this, row, col, numRows, numCols, this.state); }
  getCell(row, col) { return ((this.values[row - 1] || [])[col - 1]) || ''; }
  setCell(row, col, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < col) this.values[row - 1].push('');
    this.values[row - 1][col - 1] = value;
  }
}

class FakeSpreadsheet {
  constructor(sheets = []) {
    this.sheets = {};
    sheets.forEach((sheet) => {
      this.sheets[sheet.getName()] = sheet;
    });
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    const state = Object.values(this.sheets)[0]?.state || { sheetWriteCount: 0 };
    const sheet = new FakeSheet(name, ['A', 'B', 'C'], [], state);
    this.sheets[name] = sheet;
    return sheet;
  }
}

function createContext() {
  const cache = {};
  const props = {
    AUTO_SEND_ENABLED: 'false',
    LIVE_SEND_ENABLED: 'false',
    GMAIL_SALES_AI_ENABLED: 'true',
    GMAIL_SALES_AI_PROVIDER: 'mock',
    GMAIL_SALES_AI_MODEL: 'mock-model',
    GMAIL_SALES_AI_MAX_DAILY_COST_YEN: '100',
    GMAIL_SALES_AI_MAX_DAILY_REQUESTS: '100',
    GMAIL_SALES_AI_BATCH_SIZE: '8',
    GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED: 'false',
    GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY: 'false'
  };
  const state = {
    lockAttempts: 0,
    lockHeld: false,
    lockReentrantFailure: false,
    flushCount: 0,
    sendAuthorityCallCount: 0,
    triggerCreateCount: 0,
    gmailSendCount: 0,
    draftCreateCount: 0,
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    urlFetchCount: 0,
    evidenceActionCallCount: 0,
    aiWorkerCallCount: 0,
    groundedDiscoveryCallCount: 0,
    probeCallCount: 0,
    logs: []
  };
  function formatDateForTimezone(dateValue, timezone, pattern) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue || '2026-07-03T00:00:00.000Z');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    const normalizedHour = parts.hour === '24' ? '00' : parts.hour;
    const offsetMinutes = Math.round((Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(normalizedHour), Number(parts.minute), Number(parts.second)) - date.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offset = `${sign}${String(Math.floor(absOffset / 60)).padStart(2, '0')}:${String(absOffset % 60).padStart(2, '0')}`;
    const yyyyMMdd = `${parts.year}-${parts.month}-${parts.day}`;
    if (pattern === 'yyyy-MM-dd') return yyyyMMdd;
    if (pattern === 'HH:mm') return `${normalizedHour}:${parts.minute}`;
    if (pattern === 'yyyy-MM-dd HH:mm') return `${yyyyMMdd} ${normalizedHour}:${parts.minute}`;
    if (String(pattern || '').includes("yyyy-MM-dd'T'HH:mm:ssXXX")) return `${yyyyMMdd}T${normalizedHour}:${parts.minute}:${parts.second}${offset}`;
    return yyyyMMdd;
  }
  function fixedJstNoonMs() {
    const jstDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    return Date.parse(`${jstDate}T12:00:00+09:00`);
  }
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixedJstNoonMs()]));
    }
    static now() { return fixedJstNoonMs(); }
    static parse(value) { return Date.parse(value); }
    static UTC(...args) { return Date.UTC(...args); }
  }

  const context = {
    console,
    Date: FixedDate,
    JSON,
    Math,
    Number,
    Object,
    String,
    Array,
    Boolean,
    RegExp,
    URL,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => props[key] || '',
        setProperty: (key, value) => { state.propertyWriteCount += 1; props[key] = String(value); },
        setProperties: (values) => Object.keys(values || {}).forEach((key) => { state.propertyWriteCount += 1; props[key] = String(values[key]); })
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          state.lockAttempts += 1;
          if (state.lockHeld) {
            state.lockReentrantFailure = true;
            return false;
          }
          state.lockHeld = true;
          return true;
        },
        releaseLock: () => { state.lockHeld = false; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache[key] || '',
        put: (key, value) => { cache[key] = String(value); }
      })
    },
    SpreadsheetApp: {
      flush: () => { state.flushCount += 1; },
      ProtectionType: { RANGE: 'RANGE' },
      openById: () => context.__spreadsheet
    },
    ScriptApp: {
      newTrigger: () => { state.triggerCreateCount += 1; return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }; },
      getProjectTriggers: () => []
    },
    MailApp: { sendEmail: () => { state.gmailSendCount += 1; } },
    GmailApp: { createDraft: () => { state.draftCreateCount += 1; } },
    UrlFetchApp: { fetch: () => { state.urlFetchCount += 1; return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    Utilities: {
      formatDate: formatDateForTimezone,
      getUuid: () => '00000000-0000-4000-8000-000000000001',
      computeDigest: (_algorithm, value) => Array.from(createHash('sha256').update(String(value || ''), 'utf8').digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      base64Encode: (value) => String(value)
    },
    Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
    Logger: { log: (value) => state.logs.push(String(value)) }
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'Code.gs' });
  context.__props = props;
  context.__state = state;
  context.logGmailSalesJsonResult_ = (result) => state.logs.push(JSON.stringify(result));
  context.appendSafeLog_ = () => {};
  context.getConfig_ = () => ({ currentJstDate: '2026-07-03' });
  context.getGmailSalesProductionPhase_ = () => 'ai_verification';
  context.runGmailSalesDailyAutomationTrigger = () => { state.sendAuthorityCallCount += 1; return { status: 'unexpected_send_authority_called' }; };
  return context;
}

function makeSourceRows(count, options = {}) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const ready = options.ready !== false;
    return {
      name: `masked-business-${suffix}`,
      sourceType: ready ? 'official_site' : '',
      sourceReference: ready ? `masked official reference ${suffix}` : '',
      publicSource: ready ? 'official public inquiry page' : '',
      businessContactEvidence: ready ? 'official inquiry contact form for business partnerships' : '',
      sourceSafetyVerified: ready ? 'true' : '',
      sourceIdentityVerified: ready ? 'true' : '',
      sourceVerificationStatus: ready ? 'verified' : '',
      sourceSafetyValidatorVersion: ready ? 'source-safety-v1' : '',
      sourceIdentityValidatorVersion: ready ? 'source-identity-v1' : '',
      sourceVerificationPolicyVersion: ready ? 'source-verification-policy-v1' : '',
      sourceVerifiedAt: ready ? '2026-07-03T00:00:00.000Z' : '',
      sentStatus: '',
      replyStatus: '',
      sendState: '',
      doNotContact: '',
      unsubscribe: ''
    };
  });
}

function installSheets(context, sourceRows, reviewRows = []) {
  const headers = Array.from(new Set([
    'reviewId', 'sourceRowKey', 'leadIdHash', 'sourceRowDigest', 'businessDisplayName', 'contactDisplay',
    'sourceType', 'sourceReference', 'sourceReferenceHash', 'sourceEvidenceDigest', 'canonicalSourceUrl',
    'canonicalSourceUrlHash', 'canonicalSourceUrlStatus', 'canonicalSourceUrlParserVersion', 'canonicalSourceUrlVerifiedAt',
    'sourceVerificationStatus', 'sourceSafetyVerified', 'sourceIdentityVerified', 'sourceSafetyValidatorVersion',
    'sourceIdentityValidatorVersion', 'sourceVerificationPolicyVersion', 'sourceVerificationDigest',
    'sourceIdentityDigestVersion', 'sourceEvidenceDigestVersion', 'officialDomainHash', 'sourceVerifiedAt',
    'sourceVerificationVersion', 'sourceDiscoveryConfidence', 'sourceDiscoveryReasonCodes',
    'sourceDiscoveryCitationDigest', 'sourceDiscoveryStatus', 'sourceDiscoveredAt', 'existingRelationshipEvidence',
    'explicitOptInEvidence', 'businessContactEvidence', 'existingContactBasisType', 'suggestedBasisType',
    'suggestionReasonCode', 'reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable',
    'reviewerLabel', 'reviewedAt', 'applyStatus', 'applyErrorCode', 'appliedAt', 'lastQueueSyncedAt',
    'priorityRank', 'priorityReasonCode', 'aiVerificationStatus', 'aiProvider', 'aiModel', 'aiConfidence',
    'aiPolicyVersion', 'aiPromptVersion', 'aiEvidenceDigest', 'aiVerifiedAt', 'aiReasonCodes', 'aiRiskFlags',
    'aiAutoApproved', 'aiRequiresHumanReview', 'lastAiEvaluatedEvidenceDigest', 'contactBasisType',
    'contactBasisRecordedAt', 'lastVerifiedAt', 'suppressionCheckedAt', 'historyCheckedAt',
    'contactBasisSourceType', 'contactBasisSourceReferenceHash', 'recoveredFrom', 'deterministicRuleId',
    'noApiDecisionReason', 'email', 'contactEmail', 'name',
    'publicSource', 'sentStatus', 'replyStatus', 'sendState', 'doNotContact', 'unsubscribe',
    'privatePersonalContactFlag', 'guessed', 'solicitationRestricted'
  ]));
  const sourceSheet = new FakeSheet('Source', headers, sourceRows, context.__state);
  const reviewSheet = new FakeSheet('Review', headers, reviewRows, context.__state);
  const spreadsheet = new FakeSpreadsheet([sourceSheet, reviewSheet]);
  context.__sourceSheet = sourceSheet;
  context.__reviewSheet = reviewSheet;
  context.__spreadsheet = spreadsheet;
  context.getGmailSalesContactBasisReviewContext_ = () => ({
    ok: true,
    config: {},
    spreadsheet,
    sourceSheet,
    reviewSheet,
    reviewTabName: 'Review'
  });
  return { headers, sourceSheet, reviewSheet, spreadsheet };
}

function installSecretRepairSheet(context, apiKeyValue = '', modelValue = '') {
  if (!context.__spreadsheet) installSheets(context, makeSourceRows(1), []);
  const sheet = new FakeSheet('__ICHI_SECRET_REPAIR__', ['A', 'B', 'C'], [{ B: apiKeyValue }, { B: modelValue }], context.__state);
  context.__spreadsheet.sheets.__ICHI_SECRET_REPAIR__ = sheet;
  return sheet;
}

function setSheetValueByHeader(sheet, rowIndex, headerName, value) {
  const columnIndex = sheet.values[0].indexOf(headerName) + 1;
  assert.equal(columnIndex > 0, true);
  sheet.setCell(rowIndex, columnIndex, value);
}

function buildReviewRowsWithDigests(context, sourceRows, evaluatedCount, missingCount) {
  installSheets(context, sourceRows, []);
  const rows = [];
  sourceRows.forEach((row, index) => {
    const sourceItem = { row, rowIndex: index + 2 };
    const queue = context.buildContactBasisReviewQueueRow_(sourceItem, '2026-07-03T00:00:00.000Z');
    if (!queue.include) return;
    const evidence = context.collectGmailSalesContactBasisEvidence_(row, queue.row);
    const isEvaluated = rows.length < evaluatedCount;
    rows.push(Object.assign({}, queue.row, {
      reviewDecision: isEvaluated ? 'needs_more_evidence' : 'pending',
      applyStatus: isEvaluated ? 'needs_more_evidence' : 'pending',
      applyErrorCode: isEvaluated ? (rows.length < evaluatedCount - 8 ? 'insufficient_evidence' : 'needs_review') : '',
      aiReasonCodes: isEvaluated ? (rows.length < evaluatedCount - 8 ? 'insufficient_evidence' : 'needs_review') : '',
      aiRiskFlags: isEvaluated ? 'evidence_missing' : '',
      lastAiEvaluatedEvidenceDigest: isEvaluated ? evidence.canonicalEvidenceDigest : '',
      aiEvidenceDigest: isEvaluated ? evidence.canonicalEvidenceDigest : ''
    }));
  });
  return rows.slice(0, evaluatedCount + missingCount);
}

function installLegacyPromotionFixture(context, options = {}) {
  const count = options.count || 5;
  const eligibleCount = options.eligibleCount === undefined ? count : options.eligibleCount;
  const sourceTypes = options.sourceTypes || [];
  const sourceReferences = options.sourceReferences || [];
  const sourceRowOverrides = options.sourceRowOverrides || [];
  const currentVerification = options.currentVerification !== false;
  const sourceRows = makeSourceRows(count, { ready: true }).map((row, index) => Object.assign({}, row, {
    sourceType: '',
    sourceReference: '',
    sourceReferenceHash: '',
    sourceVerificationStatus: '',
    sourceSafetyVerified: '',
    sourceIdentityVerified: '',
    sourceSafetyValidatorVersion: '',
    sourceIdentityValidatorVersion: '',
    sourceVerificationPolicyVersion: '',
    sourceVerifiedAt: '',
    sourceVerificationDigest: ''
  }, sourceRowOverrides[index] || {}));
  const reviewRows = buildReviewRowsWithDigests(context, sourceRows, count, 0).map((row, index) => {
    const sourceType = sourceTypes[index] || options.sourceType || 'official_site';
    const sourceReference = sourceReferences[index] || ['https:', '', `legacy-${index + 1}.example.invalid`, 'contact'].join('/');
    const sourceReferenceHash = context.buildGmailSalesSourceReferenceHash_(sourceType, sourceReference);
    const sourceVerifiedAt = '2026-07-03T00:00:00.000Z';
    const next = Object.assign({}, row, {
      sourceType,
      sourceReference,
      sourceReferenceHash,
      sourceVerificationStatus: 'verified',
      sourceSafetyVerified: currentVerification ? 'true' : 'false',
      sourceIdentityVerified: currentVerification ? 'true' : 'false',
      sourceSafetyValidatorVersion: currentVerification ? 'grounding-citation-safety-v3' : 'legacy-source-safety-v1',
      sourceIdentityValidatorVersion: currentVerification ? 'grounding-citation-identity-v1' : 'legacy-source-identity-v1',
      sourceVerificationPolicyVersion: 'source-verification-policy-v1',
      sourceVerifiedAt
    });
    next.sourceVerificationDigest = currentVerification ? context.computeGmailSalesSourceVerificationDigest_(next, {
      sourceType,
      sourceReferenceHash,
      sourceVerifiedAt
    }) : 'legacy-verification-digest';
    if (index >= eligibleCount) next.sourceSafetyVerified = 'false';
    return next;
  });
  installSheets(context, sourceRows, reviewRows);
  installSourceReferenceReadiness(context, {
    sourceReferenceCellContractLastProbeValid: false,
    transactionReadinessValid: true,
    eligibleTransactionTargetCount: 0,
    sourceReferenceEligibleCellCount: 0,
    sourceReferenceStructurallyWritableCellCount: 0
  });
  return { sourceRows, reviewRows };
}

function installSourceReferenceReadiness(context, overrides = {}) {
  const readiness = () => Object.assign({
    transactionReadinessValid: true,
    sourceReferenceCellContractLastProbeValid: false,
    eligibleTransactionTargetCount: 44,
    sourceReferenceEligibleCellCount: 44,
    sourceReferenceStructurallyWritableCellCount: 44,
    sourceReferenceFormulaCellCount: 0,
    sourceReferenceArrayFormulaCellCount: 0,
    sourceReferenceMergedCellCount: 0,
    sourceReferenceProtectedCellCount: 0,
    recommendedNextAction: 'run_source_reference_cell_write_probe',
    gmailSendExecuted: false,
    gmailDraftCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false,
    aiApiCalled: false
  }, overrides);
  context.inspectGmailSalesSourceReferenceTransactionReadiness = readiness;
  context.inspectGmailSalesSourceReferenceTransactionReadiness_ = readiness;
}

function seedRecoveryUsage(context, operations) {
  context.__props.GMAIL_SALES_RECOVERY_USAGE_LEDGER_JSON = JSON.stringify({
    '2026-07-03': {
      operations: operations.reduce((acc, operation) => {
        acc[operation.operationId] = operation;
        return acc;
      }, {})
    }
  });
}

function markFirstReviewDigestEvaluated(context) {
  const sourceItem = context.readSheetObjects_(context.__sourceSheet).items[0];
  const queue = context.buildContactBasisReviewQueueRow_(sourceItem, '2026-07-03T00:00:00.000Z');
  const evidence = context.collectGmailSalesContactBasisEvidence_(sourceItem.row, queue.row);
  const headers = context.__reviewSheet.values[0];
  const reviewIdColumn = headers.indexOf('reviewId') + 1;
  const lastDigestColumn = headers.indexOf('lastAiEvaluatedEvidenceDigest') + 1;
  const aiDigestColumn = headers.indexOf('aiEvidenceDigest') + 1;
  for (let row = 2; row <= context.__reviewSheet.getLastRow(); row += 1) {
    if (String(context.__reviewSheet.getCell(row, reviewIdColumn) || '') === queue.row.reviewId) {
      context.__reviewSheet.setCell(row, lastDigestColumn, evidence.canonicalEvidenceDigest);
      context.__reviewSheet.setCell(row, aiDigestColumn, evidence.canonicalEvidenceDigest);
      return evidence.canonicalEvidenceDigest;
    }
  }
  throw new Error('review row not found for digest update');
}

function setGroundingLastRunSummary(context, summary) {
  context.__props.GMAIL_SALES_GROUNDING_LAST_RUN_SUMMARY_JSON = JSON.stringify(summary);
}

const r1 = createContext();
assert.equal(typeof r1.constantTimeEquals_, 'function');
assert.equal(r1.constantTimeEquals_('same', 'same'), true);
assert.equal(r1.constantTimeEquals_('same', 'diff'), false);
assert.equal(r1.constantTimeEquals_(null, undefined), true);

const sourceRows = makeSourceRows(53).concat(makeSourceRows(15, { ready: false }));
const r2 = createContext();
const reviewRows = buildReviewRowsWithDigests(r2, sourceRows, 53, 15);
installSheets(r2, sourceRows, reviewRows);
r2.__props.GMAIL_SALES_AI_LAST_RUN_SUMMARY_JSON = JSON.stringify({ estimatedCostYen: 7 });
const inspected = r2.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(inspected.unchangedDigestSkippedCount, 53);
assert.equal(inspected.changedDigestEligibleCount, 0);
assert.equal(inspected.evidenceMissingCount, 15);
assert.equal(inspected.aiPendingCount, 0);
assert.equal(inspected.checkpointState, 'EVIDENCE_PACKAGE_READY');
assert.equal(inspected.evidenceRecoveryEligibleCount > 0, true);
assert.equal(inspected.estimatedCostYen, 7);
assert.equal(inspected.budgetRemainingYen, 93);
assert.equal(r2.__state.urlFetchCount, 0);
assert.equal(r2.__state.sheetWriteCount, 0);
assert.equal(r2.__state.propertyWriteCount, 0);

const r3 = createContext();
const r3Source = makeSourceRows(1);
installSheets(r3, r3Source, []);
const aiResult = r3.runGmailSalesAiContactBasisVerificationOnce();
assert.equal(aiResult.status, 'pass');
assert.equal(aiResult.aiEvaluatedCount, 1);
const r3Review = r3.readSheetObjects_(r3.__reviewSheet).items[0].row;
assert.equal(String(r3Review.lastAiEvaluatedEvidenceDigest || '').length > 0, true);
const r3Inspect = r3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(r3Inspect.changedDigestEligibleCount, 0);
assert.equal(r3Inspect.unchangedDigestSkippedCount, 1);

const r4 = createContext();
r4.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
r4.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
r4.UrlFetchApp.fetch = () => { r4.__state.urlFetchCount += 1; return { getResponseCode: () => 500, getContentText: () => '{}' }; };
installSheets(r4, makeSourceRows(1), []);
const providerFailure = r4.runGmailSalesAiContactBasisVerificationOnce();
assert.equal(providerFailure.aiEvaluatedCount, 0);
assert.equal(String((r4.readSheetObjects_(r4.__reviewSheet).items[0] || { row: {} }).row.lastAiEvaluatedEvidenceDigest || ''), '');

const r5 = createContext();
r5.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
r5.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
r5.UrlFetchApp.fetch = () => { r5.__state.urlFetchCount += 1; return { getResponseCode: () => 200, getContentText: () => '{"candidates":[{"content":{"parts":[{"text":"not json"}]}}]}' }; };
installSheets(r5, makeSourceRows(1), []);
const parseFailure = r5.runGmailSalesAiContactBasisVerificationOnce();
assert.equal(parseFailure.aiEvaluatedCount, 0);
assert.equal(String((r5.readSheetObjects_(r5.__reviewSheet).items[0] || { row: {} }).row.lastAiEvaluatedEvidenceDigest || ''), '');

const r6 = createContext();
installSheets(r6, sourceRows, reviewRows);
const productionLike = r6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(productionLike.nextAction, 'EVIDENCE_PACKAGE_READY');
assert.equal(productionLike.changedDigestEligibleCount, 0);
assert.equal(productionLike.unchangedDigestSkippedCount, 53);

const r7 = createContext();
installSheets(r7, sourceRows, reviewRows);
installSourceReferenceReadiness(r7, {
  sourceReferenceCellContractLastProbeValid: true,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
const r7EnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 1, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
const r7FetchReadiness = () => ({ fetchReadinessValid: true, fetchEligibleCount: 1, fetchReadinessInvariantValid: true });
r7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = r7EnrichmentReadiness;
r7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = r7EnrichmentReadiness;
r7.inspectGmailSalesOfficialEvidenceFetchReadiness = r7FetchReadiness;
r7.inspectGmailSalesOfficialEvidenceFetchReadiness_ = r7FetchReadiness;
r7.runGmailSalesOfficialEvidenceEnrichmentOnce = (options) => {
  assert.equal(options.lockAlreadyHeld, true);
  r7.__state.evidenceActionCallCount += 1;
  return { status: 'pass', evidenceDigestChangedCount: 0, aiReevaluationEligibleCount: 0, googleSheetsUpdated: true, aiApiCalled: false };
};
const r7Step = r7.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(r7Step.stepExecuted, 'official_evidence_enrichment');
assert.equal(r7.__state.evidenceActionCallCount, 1);
assert.equal(r7.__state.urlFetchCount, 0);
assert.equal(r7.__state.sendAuthorityCallCount, 0);
assert.equal(r7.__state.lockAttempts, 1);
assert.equal(r7.__state.lockReentrantFailure, false);

const r8 = createContext();
const r8Rows = makeSourceRows(53);
const r8Review = buildReviewRowsWithDigests(r8, r8Rows, 53, 0);
for (let index = 0; index < 3; index += 1) r8Rows[index].businessContactEvidence += ' updated evidence';
installSheets(r8, r8Rows, r8Review);
const r8Inspect = r8.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(r8Inspect.changedDigestEligibleCount, 3);
assert.equal(r8Inspect.unchangedDigestSkippedCount, 50);

const r9 = createContext();
const terminalReview = buildReviewRowsWithDigests(r9, makeSourceRows(1), 1, 0);
terminalReview[0].applyErrorCode = 'solicitation_restricted';
terminalReview[0].aiReasonCodes = 'solicitation_restricted';
installSheets(r9, makeSourceRows(1), terminalReview);
const r9Inspect = r9.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(r9Inspect.aiTerminalPolicyHoldCount, 1);

const noManifest = r2.inspectGmailSalesAutomatedEvidenceManifestStatus_();
assert.equal(noManifest.manifestReady, false);
const validManifest = {
  targetDate: '2026-07-03',
  candidateCount: 30,
  maxSendCount: 30,
  approvalStatus: 'approved',
  approvalType: 'automatic_strict_gate',
  targetAutoApproved: true,
  candidateDigests: Array.from({ length: 30 }, (_, index) => `digest-${index}`)
};
r2.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(validManifest);
assert.equal(r2.inspectGmailSalesAutomatedEvidenceManifestStatus_().manifestReady, true);
r2.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(Object.assign({}, validManifest, { candidateCount: 29, candidateDigests: validManifest.candidateDigests.slice(0, 29) }));
assert.equal(r2.inspectGmailSalesAutomatedEvidenceManifestStatus_().manifestReady, false);
r2.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(Object.assign({}, validManifest, { candidateCount: 31, candidateDigests: validManifest.candidateDigests.concat('extra') }));
assert.equal(r2.inspectGmailSalesAutomatedEvidenceManifestStatus_().manifestReady, false);

const flushIndex = code.indexOf('SpreadsheetApp.flush();');
const readbackIndex = code.indexOf('const readBackPassed = sourceUpdates.every');
const rollbackFlushIndex = code.indexOf('SpreadsheetApp.flush();', readbackIndex);
assert.equal(flushIndex !== -1 && readbackIndex !== -1 && flushIndex < readbackIndex, true);
assert.equal(rollbackFlushIndex !== -1, true);
assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesProductionControlLoop\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesDailyAutomationTrigger\s*\(/g) || []).length, 1);
assert.equal(/approvedBasisType:\s*['"]manual_legal_reviewed['"]/.test(code), false);

const s1 = createContext();
installSheets(s1, sourceRows, reviewRows);
installSourceReferenceReadiness(s1);
s1.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  s1.__state.groundedDiscoveryCallCount += 1;
  return { status: 'blocked', blockedReason: 'unexpected_discovery_called' };
};
const s1Step = s1.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(s1Step.stepExecuted, 'source_reference_cell_write_probe');
assert.equal(s1Step.evidenceRecoveryAction, 'source_reference_cell_write_probe');
assert.equal(s1.__state.groundedDiscoveryCallCount, 0);
assert.equal(s1Step.aiApiCalled, false);
assert.equal(s1.__state.gmailSendCount, 0);
assert.equal(s1.__state.triggerCreateCount, 0);

const s2 = s1Step;
assert.equal(s2.sourceReferenceCellContractLastProbeValid, true);
assert.equal(s2.evidenceRecoverySucceededCount, 1);
assert.equal(s2.scriptPropertiesUpdated, true);
assert.equal(s2.recommendedNextAction, 'run_single_candidate_source_discovery');

const s3 = createContext();
installSheets(s3, sourceRows, reviewRows);
installSourceReferenceReadiness(s3);
s3.testGmailSalesSourceReferenceCellWriteContractOnce = () => ({
  status: 'blocked',
  blockedReason: 'source_cell_hash_mismatch',
  probeContractValid: false,
  writeAttempted: true,
  flushExecuted: true,
  freshReadBackAttempted: true,
  freshReadBackMatched: false,
  restoreAttempted: true,
  restoreSucceeded: true,
  googleSheetsUpdated: true,
  scriptPropertiesUpdated: false,
  aiApiCalled: false,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  triggerChanged: false
});
s3.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  s3.__state.groundedDiscoveryCallCount += 1;
  return { status: 'blocked', blockedReason: 'unexpected_discovery_called' };
};
const s3Step = s3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(s3Step.stepExecuted, 'source_reference_cell_write_probe');
assert.equal(s3Step.sourceReferenceCellContractLastProbeValid, false);
assert.equal(s3Step.evidenceRecoveryFailedCount, 1);
assert.equal(s3.__state.groundedDiscoveryCallCount, 0);
assert.equal(s3Step.aiApiCalled, false);

const s4 = createContext();
installSheets(s4, sourceRows, reviewRows);
installSourceReferenceReadiness(s4, {
  sourceReferenceCellContractLastProbeValid: true,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
const s4EnrichmentReadiness = () => ({
  evidenceEnrichmentEligibleCount: 0,
  enrichmentEligibilityReasonCounts: {},
  enrichmentReadinessInvariantValid: true
});
s4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = s4EnrichmentReadiness;
s4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = s4EnrichmentReadiness;
s4.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = (options) => {
  assert.equal(options.lockAlreadyHeld, true);
  s4.__state.groundedDiscoveryCallCount += 1;
  return { status: 'blocked', blockedReason: 'source_not_found_after_grounded_search', googleSheetsUpdated: false, aiApiCalled: false };
};
const s4Step = s4.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(s4Step.stepExecuted, 'grounded_official_source_discovery');
assert.equal(s4.__state.groundedDiscoveryCallCount, 1);

const s5 = createContext();
installSheets(s5, sourceRows, reviewRows);
installSourceReferenceReadiness(s5, {
  sourceReferenceCellContractLastProbeValid: false,
  recommendedNextAction: 'run_source_reference_cell_write_probe'
});
s5.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  s5.__state.groundedDiscoveryCallCount += 1;
  return { status: 'blocked', blockedReason: 'source_reference_cell_contract_not_verified' };
};
const s5Step = s5.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(s5Step.stepExecuted, 'source_reference_cell_write_probe');
assert.equal(s5.__state.groundedDiscoveryCallCount, 0);

const s6 = createContext();
installSheets(s6, sourceRows, reviewRows);
installSourceReferenceReadiness(s6, {
  transactionReadinessValid: false,
  sourceReferenceCellContractLastProbeValid: false,
  recommendedNextAction: 'fix_source_reference_row_resolution'
});
s6.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  s6.__state.groundedDiscoveryCallCount += 1;
  return { status: 'blocked', blockedReason: 'unexpected_discovery_called' };
};
const s6Step = s6.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(s6Step.stepExecuted, 'no_safe_recovery_action');
assert.equal(s6Step.evidenceRecoveryAction, 'no_safe_recovery_action');
assert.equal(s6Step.blockedReason, 'source_reference_cell_contract_probe_not_safe');
assert.equal(s6Step.recommendedNextAction, 'inspect_source_reference_transaction_readiness');
assert.equal(s6.__state.groundedDiscoveryCallCount, 0);

const s7 = createContext();
installSheets(s7, sourceRows, reviewRows);
s7.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify({
  targetDate: '2026-07-02',
  candidateCount: 1,
  maxSendCount: 1,
  approvalStatus: 'approved',
  approvalType: 'automatic_strict_gate',
  targetAutoApproved: true,
  candidateDigests: ['stale-digest']
});
const s7Manifest = s7.inspectGmailSalesAutomatedEvidenceManifestStatus_();
assert.equal(s7Manifest.manifestReady, false);
assert.equal(s7Manifest.manifestExists, true);
assert.equal(s7Manifest.manifestStale, true);
const s7Inspect = s7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.notEqual(s7Inspect.checkpointState, 'READY');
assert.equal(s7.__state.sendAuthorityCallCount, 0);

const t1 = createContext();
installSheets(t1, sourceRows, reviewRows);
seedRecoveryUsage(t1, [
  { operationId: 'initial-ai', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 7 },
  { operationId: 'grounded-discovery', event: 'gmail_sales_grounded_official_source_discovery', completedAt: '2026-07-03T00:01:00.000Z', estimatedCostYen: 3 },
  { operationId: 'ai-retry', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:02:00.000Z', estimatedCostYen: 1 }
]);
const t1Inspect = t1.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(t1Inspect.cumulativeEstimatedCostYen, 11);
assert.equal(t1Inspect.estimatedCostYen, 11);
assert.equal(t1Inspect.budgetRemainingYen, 89);
assert.equal(t1Inspect.recoveryUsageOperationCount, 3);

const t2 = createContext();
t2.recordGmailSalesRecoveryUsageOperation_({ operationId: 'same-operation', event: 'one', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 7 });
t2.recordGmailSalesRecoveryUsageOperation_({ operationId: 'same-operation', event: 'one', completedAt: '2026-07-03T00:01:00.000Z', estimatedCostYen: 7 });
const t2Usage = t2.summarizeGmailSalesRecoveryDailyUsage_(t2.getGmailSalesAiConfig_());
assert.equal(t2Usage.cumulativeEstimatedCostYen, 7);
assert.equal(t2Usage.recoveryUsageOperationCount, 1);

const t3 = createContext();
installSheets(t3, sourceRows, reviewRows);
installSourceReferenceReadiness(t3, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 44,
  sourceReferenceEligibleCellCount: 44,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
const t3DirectReadiness = t3.inspectGmailSalesSourceReferenceTransactionReadiness_({ skipLog: true });
const t3Inspect = t3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(t3Inspect.sourceReferenceCellContractLastProbeValid, t3DirectReadiness.sourceReferenceCellContractLastProbeValid);
assert.equal(t3Inspect.transactionReadinessValid, t3DirectReadiness.transactionReadinessValid);
assert.equal(t3Inspect.sourceReferenceEligibleCellCount, t3DirectReadiness.sourceReferenceEligibleCellCount);
assert.equal(t3Inspect.eligibleTransactionTargetCount, t3DirectReadiness.eligibleTransactionTargetCount);

const t4 = createContext();
installSheets(t4, sourceRows, reviewRows);
installSourceReferenceReadiness(t4, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
const t4EnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 0, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
t4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = t4EnrichmentReadiness;
t4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = t4EnrichmentReadiness;
seedRecoveryUsage(t4, [
  { operationId: 'spent-99', event: 'gmail_sales_grounded_official_source_discovery', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 99 }
]);
t4.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  t4.__state.groundedDiscoveryCallCount += 1;
  return { status: 'pass', estimatedCostYen: 3 };
};
const t4Step = t4.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(t4Step.evidenceRecoveryAction, 'grounded_official_source_discovery');
assert.equal(t4Step.actionStatus, 'blocked');
assert.equal(t4Step.actionBlockedReason, 'budget_limit_reached');
assert.equal(t4Step.cumulativeEstimatedCostYen, 99);
assert.equal(t4Step.budgetRemainingYen, 1);
assert.equal(t4.__state.groundedDiscoveryCallCount, 0);

const u1 = createContext();
u1.__props.GMAIL_SALES_AI_LAST_RUN_SUMMARY_JSON = JSON.stringify({
  event: 'gmail_sales_ai_contact_basis_verification',
  completedAt: '2026-07-03T01:00:00.000Z',
  estimatedCostYen: 7,
  aiBatchRequestCount: 7
});
const u1Ledger = u1.inspectGmailSalesRecoveryUsageLedger();
assert.equal(u1Ledger.cumulativeEstimatedCostYen, 7);
assert.equal(u1Ledger.operationTypeCounts.ai_contact_basis_verification, 1);
assert.equal(u1.__state.propertyWriteCount, 0);

const u2 = createContext();
setGroundingLastRunSummary(u2, {
  event: 'gmail_sales_grounded_official_source_discovery',
  completedAt: '2026-07-03T02:00:00.000Z',
  estimatedCostYen: 3,
  sourceReferenceCommittedCount: 1
});
const u2Ledger = u2.inspectGmailSalesRecoveryUsageLedger();
assert.equal(u2Ledger.cumulativeEstimatedCostYen, 3);
assert.equal(u2Ledger.operationTypeCounts.grounded_official_source_discovery, 1);
assert.equal(u2.__state.propertyWriteCount, 0);

const u3 = createContext();
installSheets(u3, sourceRows, reviewRows);
installSourceReferenceReadiness(u3, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
const u3EnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 0, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
u3.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
u3.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
seedRecoveryUsage(u3, [
  { operationId: 'previous-ai-retry', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 1 },
  { operationId: 'previous-grounding', event: 'gmail_sales_grounded_official_source_discovery', completedAt: '2026-07-03T00:01:00.000Z', estimatedCostYen: 3 }
]);
u3.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  u3.__state.groundedDiscoveryCallCount += 1;
  u3.recordGmailSalesRecoveryUsageOperation_({
    operationId: 'current-grounding',
    event: 'gmail_sales_grounded_official_source_discovery',
    completedAt: '2026-07-03T00:02:00.000Z',
    estimatedCostYen: 3
  });
  return { status: 'pass', estimatedCostYen: 3, sourceReferenceCommittedCount: 1, googleSheetsUpdated: true, aiApiCalled: true };
};
const u3Step = u3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(u3Step.actionCostYen, 3);
assert.equal(u3Step.cumulativeEstimatedCostYen, 7);
assert.equal(u3Step.budgetRemainingYen, 93);
assert.equal(u3Step.recoveryUsageOperationCount, 3);

const u4 = createContext();
u4.__props.GMAIL_SALES_AI_LAST_RUN_SUMMARY_JSON = JSON.stringify({
  event: 'gmail_sales_ai_contact_basis_verification',
  completedAt: '2026-07-03T03:00:00.000Z',
  estimatedCostYen: 1,
  aiBatchRequestCount: 1
});
const u4First = u4.summarizeGmailSalesRecoveryDailyUsage_(u4.getGmailSalesAiConfig_());
const u4Second = u4.summarizeGmailSalesRecoveryDailyUsage_(u4.getGmailSalesAiConfig_());
assert.equal(u4First.cumulativeEstimatedCostYen, u4Second.cumulativeEstimatedCostYen);
assert.equal(u4Second.recoveryUsageOperationCount, 1);

const u5 = createContext();
setGroundingLastRunSummary(u5, {
  event: 'gmail_sales_grounded_official_source_discovery',
  completedAt: '2026-07-03T04:00:00.000Z',
  estimatedCostYen: 3,
  groundingHttpRequestCount: 3,
  sourceReferenceCommittedCount: 1
});
const u5First = u5.summarizeGmailSalesRecoveryDailyUsage_(u5.getGmailSalesAiConfig_());
const u5Second = u5.summarizeGmailSalesRecoveryDailyUsage_(u5.getGmailSalesAiConfig_());
assert.equal(u5First.cumulativeEstimatedCostYen, 3);
assert.equal(u5Second.cumulativeEstimatedCostYen, 3);

const u6 = createContext();
const u6Silent = u6.buildGmailSalesGroundingResult_('pass', {
  __skipLog: true,
  sourceReferenceCommittedCount: 1,
  estimatedCostYen: 3
});
assert.equal(u6Silent.__skipLog, undefined);
assert.equal(u6.__state.logs.length, 0);
assert.equal(JSON.stringify(u6Silent).indexOf('providerErrorCategoryCounts') !== -1, true);

const u7 = createContext();
u7.buildGmailSalesGroundingResult_('pass', { sourceReferenceCommittedCount: 1 });
assert.equal(u7.__state.logs.length, 1);

const u8 = createContext();
installSheets(u8, sourceRows, reviewRows);
installSourceReferenceReadiness(u8, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
u8.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
u8.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
seedRecoveryUsage(u8, [
  { operationId: 'spent-98', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 98 }
]);
u8.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  u8.__state.groundedDiscoveryCallCount += 1;
  return { status: 'pass', estimatedCostYen: 3 };
};
const u8Step = u8.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(u8Step.actionStatus, 'blocked');
assert.equal(u8Step.actionBlockedReason, 'budget_limit_reached');
assert.equal(u8.__state.groundedDiscoveryCallCount, 0);

const u9 = createContext();
const u9Rows = makeSourceRows(53).concat(makeSourceRows(15, { ready: false }));
const u9Review = buildReviewRowsWithDigests(u9, u9Rows, 53, 15);
const u9Sheets = installSheets(u9, u9Rows, u9Review);
installSourceReferenceReadiness(u9, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
u9.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
u9.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
u9.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  const evidenceColumn = u9Sheets.headers.indexOf('businessContactEvidence') + 1;
  u9.__sourceSheet.setCell(2, evidenceColumn, 'updated official inquiry evidence');
  u9.recordGmailSalesRecoveryUsageOperation_({
    operationId: 'u9-grounding',
    event: 'gmail_sales_grounded_official_source_discovery',
    completedAt: '2026-07-03T00:02:00.000Z',
    estimatedCostYen: 3
  });
  return { status: 'pass', estimatedCostYen: 3, sourceReferenceCommittedCount: 1, googleSheetsUpdated: true, aiApiCalled: true };
};
const u9Step = u9.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(u9Step.checkpointState, 'AI_REVIEW_PENDING');
assert.equal(u9Step.changedDigestEligibleCount, 1);
assert.equal(u9Step.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(u9.__state.aiWorkerCallCount, 0);

const vRows = makeSourceRows(53).concat(makeSourceRows(15, { ready: false }));
const vBase = createContext();
const vReview = buildReviewRowsWithDigests(vBase, vRows, 53, 15);
vRows[0].businessContactEvidence += ' updated for ai safe step';

function installAiPendingFixture(context) {
  installSheets(context, vRows.map((row) => Object.assign({}, row)), vReview.map((row) => Object.assign({}, row)));
  installSourceReferenceReadiness(context, {
    sourceReferenceCellContractLastProbeValid: true,
    transactionReadinessValid: true,
    eligibleTransactionTargetCount: 1,
    sourceReferenceEligibleCellCount: 1,
    recommendedNextAction: 'run_single_candidate_source_discovery'
  });
  const enrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 0, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
  context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = enrichmentReadiness;
  context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = enrichmentReadiness;
}

function installFiveAiPendingRows(context) {
  installSheets(context, makeSourceRows(5), []);
}

function setAiProviderCooldown(context, untilIso = '2099-01-01T00:00:00.000Z') {
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_UNTIL = untilIso;
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_REASON = 'ai_provider_http_429';
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_PROVIDER = 'gemini';
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_OPERATION = 'ai_contact_basis_verification';
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_LAST_AT = '2026-07-06T00:00:00.000Z';
  context.__props.GMAIL_SALES_AI_PROVIDER_COOLDOWN_FAILURE_COUNT = '1';
}

function seedHistoricalAi429Summary(context, overrides = {}) {
  context.__props.GMAIL_SALES_AI_LAST_RUN_SUMMARY_JSON = JSON.stringify(Object.assign({
    event: 'gmail_sales_ai_contact_basis_verification',
    runId: 'historical-ai-429',
    completedAt: '2026-07-03T00:00:00.000Z',
    estimatedCostYen: 1,
    aiBatchRequestCount: 1,
    aiProviderRequestSuccessCount: 0,
    aiProviderRequestFailureCount: 1,
    aiProviderCandidateResponseCount: 0,
    aiProviderRateLimitedRequestCount: 1,
    aiProviderRateLimitedDigestCount: 5,
    rejectionReasonCounts: { ai_provider_http_429: 5 }
  }, overrides));
}

function seedPermissionErrorAiSummary(context, overrides = {}) {
  context.__props.GMAIL_SALES_AI_LAST_RUN_SUMMARY_JSON = JSON.stringify(Object.assign({
    event: 'gmail_sales_ai_contact_basis_verification',
    runId: 'historical-ai-permission-error',
    completedAt: new Date().toISOString(),
    estimatedCostYen: 1,
    attemptedCostYen: 1,
    successfulEvaluationCostYen: 0,
    failedProviderRequestCostYen: 1,
    aiBatchRequestCount: 1,
    aiProviderRequestSuccessCount: 0,
    aiProviderRequestFailureCount: 1,
    aiProviderCandidateResponseCount: 0,
    aiProviderFailureReasonCounts: { ai_provider_exception_permission_error: 1 },
    rejectionReasonCounts: { ai_provider_exception_permission_error: 5 },
    aiProviderPermissionErrorRequestCount: 1,
    aiProviderPermissionErrorDigestCount: 5,
    aiProviderNonRetryableFailureCostYen: 1
  }, overrides));
}

function seedUrlFetchAuthorizationVerified(context) {
  const targetDate = context.Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  context.__props.GMAIL_SALES_URLFETCH_AUTHORIZATION_PROBE_JSON = JSON.stringify({
    targetDate,
    urlFetchAuthorizationProbeAttemptCountToday: 1,
    urlFetchAuthorizationProbeLastAt: '2026-07-03T00:00:00.000Z',
    urlFetchAuthorizationProbeLastHttpStatus: 204,
    urlFetchAuthorizationProbeLastTransportExceptionCategory: '',
    urlFetchAuthorizationProbeSuccessfulRequestCount: 1,
    urlFetchAuthorizationProbeFailedRequestCount: 0,
    urlFetchAuthorizationVerified: true,
    urlFetchAuthorizationVerifiedAt: '2026-07-03T00:00:00.000Z'
  });
}

function seedGeminiQuotaBillingDiagnosticState(context, overrides = {}) {
  const targetDate = context.Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  context.__props.GMAIL_SALES_GEMINI_PERMISSION_DIAGNOSTICS_JSON = JSON.stringify(Object.assign({
    targetDate,
    aiProviderDiagnosticProbeAttemptCountToday: 3,
    aiProviderDiagnosticProbeLastAt: '2026-07-03T00:00:00.000Z',
    aiProviderDiagnosticProbeLastHttpStatus: 429,
    aiProviderDiagnosticProbeLastGoogleApiErrorStatus: 'RESOURCE_EXHAUSTED',
    aiProviderDiagnosticProbeLastGoogleApiErrorReason: '',
    aiProviderDiagnosticProbeLastPermissionDiagnosisCategory: 'billing_or_quota_project_required',
    aiProviderDiagnosticProbeLastRecommendedFix: 'verify_billing_or_project_quota_requirements',
    aiProviderDiagnosticProbeLastTransportExceptionCategory: '',
    aiProviderDiagnosticProbeLastTransportExceptionMessageCategory: '',
    aiProviderDiagnosticProbeLastBlockedReason: 'gemini_api_error_response',
    aiProviderDiagnosticProbeLastEndpointPathSanitized: '/v1beta/models/{model}:generateContent',
    aiProviderDiagnosticProbeLastAuthPlacement: 'header',
    aiProviderDiagnosticProbeLastResponseJsonParseSucceeded: true,
    aiProviderDiagnosticProbeSuccessfulRequestCount: 0,
    aiProviderDiagnosticProbeFailedRequestCount: 3
  }, overrides));
}

function applyTodayTargetDate(context) {
  const today = context.Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  context.getConfig_ = () => ({ currentJstDate: today });
  return today;
}

function minutesAgoIso(minutes) {
  const jstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return new Date(Date.parse(`${jstDate}T12:00:00+09:00`) - (Number(minutes || 0) * 60000)).toISOString();
}

const v1 = createContext();
installAiPendingFixture(v1);
seedRecoveryUsage(v1, [
  { operationId: 'previous-grounding-1', event: 'gmail_sales_grounded_official_source_discovery', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 3 },
  { operationId: 'previous-grounding-2', event: 'gmail_sales_grounded_official_source_discovery', completedAt: '2026-07-03T00:01:00.000Z', estimatedCostYen: 3 },
  { operationId: 'previous-ai-retry', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:02:00.000Z', estimatedCostYen: 1 }
]);
v1.runGmailSalesAiContactBasisVerificationWorker_ = () => {
  v1.__state.aiWorkerCallCount += 1;
  markFirstReviewDigestEvaluated(v1);
  return {
    status: 'pass',
    completedAt: '2026-07-03T00:03:00.000Z',
    estimatedCostYen: 1,
    aiBatchRequestCount: 1,
    aiDispatchEligibleCount: 1,
    aiProviderRequestSuccessCount: 1,
    aiProviderRequestFailureCount: 0,
    aiProviderCandidateResponseCount: 1,
    googleSheetsUpdated: true
  };
};
const v1Step = v1.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(v1Step.stepExecuted, 'ai_contact_basis_verification');
assert.equal(v1Step.executedAction, 'ai_contact_basis_verification');
assert.equal(v1Step.actionCostYen, 1);
assert.equal(v1Step.cumulativeEstimatedCostYen, 8);
assert.equal(v1Step.budgetRemainingYen, 92);
assert.equal(v1Step.recoveryUsageOperationCount, 4);
assert.equal(v1Step.operationTypeCounts.ai_contact_basis_verification, 2);
assert.equal(v1Step.operationCostByType.ai_contact_basis_verification, 2);
assert.equal(v1.__state.aiWorkerCallCount, 1);
assert.equal(v1.__state.gmailSendCount, 0);
assert.equal(v1.__state.draftCreateCount, 0);
assert.equal(v1.__state.triggerCreateCount, 0);

const v2 = createContext();
installAiPendingFixture(v2);
const v2Before = v2.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
const v2State = v2.readGmailSalesAutomatedEvidenceRecoveryState_();
const v2AiResult = {
  status: 'pass',
  completedAt: '2026-07-03T00:03:00.000Z',
  estimatedCostYen: 1,
  aiBatchRequestCount: 1,
  aiDispatchEligibleCount: 1,
  aiProviderRequestSuccessCount: 1,
  aiProviderCandidateResponseCount: 1
};
v2.recordGmailSalesAiSafeStepUsage_(v2Before, v2State, v2AiResult);
v2.recordGmailSalesAiSafeStepUsage_(v2Before, v2State, v2AiResult);
const v2Usage = v2.summarizeGmailSalesRecoveryDailyUsage_(v2.getGmailSalesAiConfig_());
assert.equal(v2Usage.cumulativeEstimatedCostYen, 1);
assert.equal(v2Usage.recoveryUsageOperationCount, 1);

const v3 = createContext();
installAiPendingFixture(v3);
v3.runGmailSalesAiContactBasisVerificationWorker_ = () => {
  v3.__state.aiWorkerCallCount += 1;
  markFirstReviewDigestEvaluated(v3);
  return {
    status: 'pass',
    completedAt: '2026-07-03T00:03:00.000Z',
    estimatedCostYen: 1,
    aiBatchRequestCount: 1,
    aiDispatchEligibleCount: 1,
    aiProviderRequestSuccessCount: 1,
    aiProviderCandidateResponseCount: 1,
    googleSheetsUpdated: true
  };
};
const v3Step = v3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(v3Step.stepExecuted, 'ai_contact_basis_verification');
assert.equal(v3Step.executedAction, 'ai_contact_basis_verification');
assert.equal(v3Step.checkpointState, 'EVIDENCE_PACKAGE_READY');
assert.equal(v3Step.plannedNextAction, 'grounded_official_source_discovery');
assert.equal(v3Step.plannedExpectedApiClass, 'gemini_grounding');
assert.equal(v3Step.actionStatus, 'pass');

const v4 = createContext();
installSheets(v4, sourceRows, reviewRows);
installSourceReferenceReadiness(v4, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
v4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
v4.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
const v4Inspect = v4.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(v4Inspect.checkpointState, 'EVIDENCE_PACKAGE_READY');
assert.equal(v4Inspect.actionStatus, 'pending');
assert.equal(v4Inspect.evidenceRecoveryAction, 'grounded_official_source_discovery');
assert.equal(v4Inspect.plannedNextAction, 'grounded_official_source_discovery');

const v5 = createContext();
installAiPendingFixture(v5);
seedRecoveryUsage(v5, [
  { operationId: 'spent-100', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 100 }
]);
v5.runGmailSalesAiContactBasisVerificationWorker_ = () => {
  v5.__state.aiWorkerCallCount += 1;
  return { status: 'pass', estimatedCostYen: 1, aiBatchRequestCount: 1 };
};
const v5Step = v5.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(v5Step.stepExecuted, 'ai_contact_basis_verification');
assert.equal(v5Step.actionStatus, 'blocked');
assert.equal(v5Step.actionBlockedReason, 'budget_limit_reached');
assert.equal(v5Step.aiApiCalled, false);
assert.equal(v5.__state.aiWorkerCallCount, 0);

const v6 = createContext();
installSheets(v6, sourceRows, reviewRows);
installSourceReferenceReadiness(v6, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
v6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
v6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
v6.__props.GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY = '30';
v6.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '29';
const v6Inspect = v6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(v6Inspect.evidenceRecoveryAction, 'grounded_official_source_discovery');
assert.equal(v6Inspect.safeToExecute, false);
assert.equal(['grounding_daily_prompt_limit_reached', 'free_tier_grounding_daily_candidate_limit_reached', 'grounding_prompt_reserve_reached'].includes(v6Inspect.actionBlockedReason), true);
assert.equal(v6Inspect.plannedGroundingPromptRequestCount, 3);
assert.equal(v6Inspect.groundingPromptBudgetSufficient, false);
v6.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  v6.__state.groundedDiscoveryCallCount += 1;
  return { status: 'pass', estimatedCostYen: 3 };
};
const v6Step = v6.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(v6Step.actionStatus, 'blocked');
assert.equal(['grounding_daily_prompt_limit_reached', 'free_tier_grounding_daily_candidate_limit_reached', 'grounding_prompt_reserve_reached'].includes(v6Step.actionBlockedReason), true);
assert.equal(v6.__state.groundedDiscoveryCallCount, 0);

const v7 = createContext();
installSheets(v7, sourceRows, reviewRows);
installSourceReferenceReadiness(v7, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
v7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
v7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
v7.__props.GMAIL_SALES_OPERATIONAL_TIER = 'paid';
v7.__props.GMAIL_SALES_RECOVERY_MODE = 'paid_tier';
v7.__props.GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY = '30';
v7.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '20';
const v7Inspect = v7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(v7Inspect.safeToExecute, true);
assert.equal(v7Inspect.groundingPromptBudgetSufficient, true);

const w1 = createContext();
installSheets(w1, sourceRows, reviewRows);
installSourceReferenceReadiness(w1, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1,
  recommendedNextAction: 'run_single_candidate_source_discovery'
});
w1.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
w1.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
const w1WritesBefore = w1.__state.propertyWriteCount + w1.__state.sheetWriteCount + w1.__state.triggerCreateCount + w1.__state.gmailSendCount;
const w1Preflight = w1.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', skipLog: true });
assert.equal(w1Preflight.event, 'gmail_sales_monday_recovery_preflight');
assert.equal(w1Preflight.mode, 'read_only');
assert.equal(w1Preflight.googleSheetsUpdated, false);
assert.equal(w1Preflight.scriptPropertiesUpdated, false);
assert.equal(w1Preflight.triggerChanged, false);
assert.equal(w1Preflight.aiApiCalled, false);
assert.equal(w1Preflight.gmailSendExecuted, false);
assert.equal(w1.__state.propertyWriteCount + w1.__state.sheetWriteCount + w1.__state.triggerCreateCount + w1.__state.gmailSendCount, w1WritesBefore);

assert.equal(Boolean(w1Preflight.nowJst), true);
assert.equal(Boolean(w1Preflight.nowPacific), true);
assert.equal(Boolean(w1Preflight.pacificQuotaDate), true);
assert.equal(Boolean(w1Preflight.pacificQuotaResetAtJst), true);
assert.equal(Number.isFinite(w1Preflight.minutesUntilPacificReset), true);
assert.equal(w1Preflight.geminiRateLimitResetBasis, 'pacific_midnight');

const w3 = createContext();
installSheets(w3, sourceRows, reviewRows);
const w3Preflight = w3.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-05T12:00:00+09:00', targetDate: '2026-07-05', skipLog: true });
assert.equal(w3Preflight.isBusinessDayJst, false);
assert.equal(w3Preflight.isSundayNoSend, true);
assert.equal(w3Preflight.sendAllowed, false);

const w4 = createContext();
installSheets(w4, sourceRows, reviewRows);
const w4Preflight = w4.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(w4Preflight.isBusinessDayJst, true);
assert.equal(w4Preflight.recoveryAllowed, true);
assert.equal(w4Preflight.readyInventoryCount, 0);
assert.equal(w4Preflight.sendAllowed, false);
assert.notEqual(w4Preflight.recommendedMondayAction, 'run_production_send');

const w5 = createContext();
installSheets(w5, sourceRows, reviewRows);
installSourceReferenceReadiness(w5, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
w5.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
w5.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
w5.__props.GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY = '30';
w5.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '29';
const w5Preflight = w5.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(w5Preflight.safeToExecute, false);
assert.equal(w5Preflight.recommendedMondayAction, 'wait_for_grounding_quota_reset');
assert.equal(['grounding_daily_prompt_limit_reached', 'free_tier_grounding_daily_candidate_limit_reached', 'grounding_prompt_reserve_reached'].includes(w5Preflight.recommendedMondayActionReasonCode), true);

const w6 = createContext();
installSheets(w6, sourceRows, reviewRows);
installSourceReferenceReadiness(w6, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
w6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
w6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
w6.__props.GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY = '30';
w6.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '0';
const w6Preflight = w6.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(w6Preflight.groundingPromptBudgetSufficient, true);
assert.equal(w6Preflight.safeToExecute, true);
assert.equal(['run_recovery_safe_step_once', 'run_grounded_discovery_fallback_once'].includes(w6Preflight.recommendedMondayAction), true);

const w7 = createContext();
installSheets(w7, sourceRows, reviewRows);
installSourceReferenceReadiness(w7, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true
});
w7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 1, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
w7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = w7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness;
w7.inspectGmailSalesOfficialEvidenceFetchReadiness = () => ({ fetchReadinessValid: false, fetchEligibleCount: 0, fetchIneligibleCount: 1, fetchEligibilityReasonCounts: { canonical_source_url_not_committed: 1 }, fetchReadinessInvariantValid: true, canonicalSourceUrlRepairEligibleCount: 1 });
w7.inspectGmailSalesOfficialEvidenceFetchReadiness_ = w7.inspectGmailSalesOfficialEvidenceFetchReadiness;
const w7Inspect = w7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
const w7Preflight = w7.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(w7Inspect.plannedNextAction, 'canonical_source_url_repair');
assert.equal(w7Preflight.recommendedMondayAction, 'run_canonical_source_url_repair_safe_step');

const w8 = createContext();
installSheets(w8, sourceRows, reviewRows);
installSourceReferenceReadiness(w8, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true
});
w8.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 1, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
w8.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = w8.inspectGmailSalesOfficialEvidenceEnrichmentReadiness;
w8.inspectGmailSalesOfficialEvidenceFetchReadiness = () => ({ fetchReadinessValid: false, fetchEligibleCount: 0, fetchIneligibleCount: 1, fetchEligibilityReasonCounts: { explicit_url_candidate_missing: 1 }, fetchReadinessInvariantValid: true, canonicalSourceUrlRepairEligibleCount: 0 });
w8.inspectGmailSalesOfficialEvidenceFetchReadiness_ = w8.inspectGmailSalesOfficialEvidenceFetchReadiness;
w8.inspectGmailSalesCommittedSourceReferenceFormat = () => ({ event: 'gmail_sales_committed_source_reference_format', mode: 'read_only', sourceReferenceUrlSyntaxInvalidCount: 1, canonicalSourceUrlRepairEligibleCount: 0, canonicalRepairEligibleCount: 0, fetchIneligibleCount: 1, fetchEligibilityReasonCounts: { explicit_url_candidate_missing: 1 }, sampleValuesIncluded: false, piiOrUrlLogged: false });
const w8Preflight = w8.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(w8Preflight.aiApiCalled, false);
assert.equal(['operator_review_before_control_loop', 'operator_diagnostic_required', 'run_recovery_safe_step_once', 'run_grounded_discovery_fallback_once'].includes(w8Preflight.recommendedMondayAction), true);

const w9 = createContext();
installSheets(w9, sourceRows, reviewRows);
installSourceReferenceReadiness(w9, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true
});
w9.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = w7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness;
w9.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = w9.inspectGmailSalesOfficialEvidenceEnrichmentReadiness;
w9.inspectGmailSalesOfficialEvidenceFetchReadiness = w7.inspectGmailSalesOfficialEvidenceFetchReadiness;
w9.inspectGmailSalesOfficialEvidenceFetchReadiness_ = w9.inspectGmailSalesOfficialEvidenceFetchReadiness;
w9.repairGmailSalesCommittedCanonicalSourceUrlOnce = () => ({
  status: 'pass',
  canonicalRepairEligibleCount: 1,
  canonicalRepairAttempted: true,
  canonicalRepairCommitted: true,
  canonicalUrlReadBackMatched: true,
  googleSheetsUpdated: true,
  aiApiCalled: false,
  urlFetchExecuted: false,
  gmailSendExecuted: false,
  triggerChanged: false
});
const w9Step = w9.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(w9Step.stepExecuted, 'canonical_source_url_repair');
assert.equal(w9Step.actionStatus, 'pass');
assert.equal(w9Step.canonicalUrlReadBackMatched, true);
assert.equal(w9.__state.urlFetchCount, 0);
assert.equal(w9.__state.aiWorkerCallCount, 0);
assert.equal(w9.__state.gmailSendCount, 0);
assert.equal(w9.__state.triggerCreateCount, 0);

const w10 = createContext();
installSheets(w10, sourceRows, reviewRows);
installSourceReferenceReadiness(w10, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
w10.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
w10.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
const w10Before = w10.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
const w10Fingerprint = w10.buildGmailSalesRecoveryNoOpFingerprint_(w10Before, w10Before.checkpointState);
w10.__props.GMAIL_SALES_AUTOMATED_EVIDENCE_RECOVERY_NOOP_LOOP_JSON = JSON.stringify({ fingerprint: w10Fingerprint, consecutiveCount: 1, updatedAt: '2026-07-06T00:00:00.000Z' });
w10.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  w10.__state.groundedDiscoveryCallCount += 1;
  return { status: 'pass', estimatedCostYen: 3 };
};
const w10Step = w10.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(w10Step.actionStatus, 'blocked');
assert.equal(w10Step.actionBlockedReason, 'no_progress_loop_detected');
assert.equal(w10Step.operatorActionRequired, true);
assert.equal(w10.__state.groundedDiscoveryCallCount, 0);

const w11Free = createContext();
const w11FreeConfig = w11Free.getGmailSalesGeminiOperationalConfig_();
assert.equal(['unknown', 'free'].includes(w11FreeConfig.operationalTier), true);
assert.equal(w11FreeConfig.effectiveGroundingDailyPromptLimit, 30);
const w11Paid = createContext();
w11Paid.__props.GEMINI_OPERATIONAL_TIER = 'paid_tier_1';
w11Paid.__props.GMAIL_SALES_GROUNDING_DAILY_PROMPT_LIMIT = '90';
const w11PaidConfig = w11Paid.getGmailSalesGeminiOperationalConfig_();
assert.equal(w11PaidConfig.operationalTier, 'paid_tier_1');
assert.equal(w11PaidConfig.effectiveGroundingDailyPromptLimit, 90);

const ft1 = createContext();
const ft1Config = ft1.getGmailSalesRecoveryOperationalConfig_();
assert.equal(ft1Config.recoveryMode, 'free_tier');
assert.equal(ft1Config.freeTierMode, true);
assert.equal(ft1Config.groundingFallbackOnly, true);
assert.equal(ft1Config.maxGroundingCandidatesPerDay <= 3, true);
assert.equal(ft1Config.maxGroundingCandidatesPerSafeStep, 1);
assert.equal(ft1Config.groundingModelCascadeSuppressed, true);
assert.equal(ft1Config.legacyReferencePromotionPreferred, true);
assert.equal(ft1Config.urlFetchEnrichmentPreferred, true);

const ft2 = createContext();
installLegacyPromotionFixture(ft2, { count: 5 });
const ft2Readiness = ft2.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(ft2Readiness.event, 'gmail_sales_review_legacy_reference_promotion_readiness');
assert.equal(ft2Readiness.legacyPromotionCandidateCount, 5);
assert.equal(ft2Readiness.legacyPromotionEligibleCount, 5);
assert.equal(ft2Readiness.googleSheetsUpdated, false);
assert.equal(ft2Readiness.aiApiCalled, false);
assert.equal(ft2Readiness.urlFetchExecuted, false);

const ft3 = createContext();
installLegacyPromotionFixture(ft3, { count: 5 });
const ft3Inspect = ft3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(ft3Inspect.plannedNextAction, 'legacy_review_reference_promotion');
assert.equal(ft3Inspect.safeToExecute, true);
const ft3Step = ft3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(ft3Step.stepExecuted, 'legacy_review_reference_promotion');
assert.equal(ft3Step.succeededPromotionCount, 5);
assert.equal(ft3.__state.aiWorkerCallCount, 0);
assert.equal(ft3.__state.groundedDiscoveryCallCount, 0);
assert.equal(ft3.__state.urlFetchCount, 0);
assert.equal(ft3.__state.gmailSendCount, 0);

const ft4 = createContext();
installLegacyPromotionFixture(ft4, { count: 5, sourceTypes: ['official_site', 'official_site', 'official_site', 'official_site', 'instagram'] });
const ft4Readiness = ft4.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(ft4Readiness.legacyPromotionEligibleCount, 4);
assert.equal(ft4Readiness.legacyPromotionIneligibleCount, 1);
assert.equal(Boolean(ft4Readiness.legacyPromotionBlockedReasonCounts.social_network), true);

const ft5 = createContext();
installLegacyPromotionFixture(ft5, { count: 5 });
const ft5Preflight = ft5.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(ft5Preflight.recommendedMondayAction, 'run_legacy_reference_promotion_safe_step');
assert.equal(ft5Preflight.legacyPromotionRecommended, true);
assert.equal(ft5Preflight.groundingFallbackOnly, true);

const ft6 = createContext();
installSheets(ft6, sourceRows, reviewRows);
installSourceReferenceReadiness(ft6, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
ft6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
ft6.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
ft6.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '29';
const ft6Inspect = ft6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(ft6Inspect.safeToExecute, false);
assert.equal(ft6Inspect.groundingFallbackOnly, true);
assert.equal(['free_tier_grounding_daily_candidate_limit_reached', 'grounding_prompt_reserve_reached'].includes(ft6Inspect.groundingBlockedReason), true);
assert.equal(ft6Inspect.groundingCandidatesRemainingToday >= 0, true);

const ft7 = createContext();
ft7.__props.GMAIL_SALES_OPERATIONAL_TIER = 'paid';
ft7.__props.GMAIL_SALES_RECOVERY_MODE = 'paid_tier';
ft7.__props.GMAIL_SALES_FREE_TIER_GROUNDING_MODEL_FAILOVER_MAX = '4';
const ft7Config = ft7.getGmailSalesRecoveryOperationalConfig_();
assert.equal(ft7Config.freeTierMode, false);
assert.equal(ft7Config.groundingFallbackOnly, false);

const ft8 = createContext();
installLegacyPromotionFixture(ft8, { count: 2 });
ft8.__props.GMAIL_SALES_LEGACY_PROMOTION_BATCH_SIZE = '1';
const ft8Step = ft8.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(ft8Step.attemptedPromotionCount, 1);
assert.equal(ft8Step.succeededPromotionCount, 1);

const ft9 = createContext();
installLegacyPromotionFixture(ft9, { count: 1 });
const ft9BeforeWrites = ft9.__state.propertyWriteCount + ft9.__state.triggerCreateCount + ft9.__state.gmailSendCount + ft9.__state.draftCreateCount;
ft9.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(ft9.__state.propertyWriteCount + ft9.__state.triggerCreateCount + ft9.__state.gmailSendCount + ft9.__state.draftCreateCount, ft9BeforeWrites);

const ft10 = createContext();
installLegacyPromotionFixture(ft10, { count: 1 });
const ft10Preflight = ft10.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(ft10Preflight.freeTierPrimaryAction, 'legacy_review_reference_promotion');
assert.equal(ft10Preflight.estimatedLegacyPromotionsAvailable, 1);

const ft11 = createContext();
installLegacyPromotionFixture(ft11, { count: 1 });
ft11.__props.GMAIL_SALES_AUTOMATED_EVIDENCE_RECOVERY_NOOP_LOOP_JSON = JSON.stringify({ fingerprint: 'different', consecutiveCount: 5 });
const ft11Preflight = ft11.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-06T09:00:00+09:00', targetDate: '2026-07-06', skipLog: true });
assert.equal(ft11Preflight.noOpLoopAction, 'continue');
assert.equal(ft11Preflight.quotaWaitDetected, false);

const ft12 = createContext();
installLegacyPromotionFixture(ft12, { count: 1 });
const ft12Result = ft12.promoteGmailSalesReviewLegacyReferencesOnce({ skipLog: true });
assert.equal(ft12Result.gmailSendExecuted, false);
assert.equal(ft12Result.aiApiCalled, false);
assert.equal(ft12Result.urlFetchExecuted, false);
assert.equal(ft12Result.scriptPropertiesUpdated, false);

const ft13 = createContext();
installSheets(ft13, sourceRows, reviewRows);
installSourceReferenceReadiness(ft13, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
ft13.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
ft13.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
ft13.__props.GMAIL_SALES_FREE_TIER_GROUNDING_ENABLED = 'false';
const ft13Inspect = ft13.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(ft13Inspect.actionBlockedReason, 'free_tier_grounding_disabled');
assert.equal(ft13.__state.groundedDiscoveryCallCount, 0);

const fx1 = createContext();
installLegacyPromotionFixture(fx1, {
  count: 3,
  sourceTypes: ['homepage', 'contact_page', 'business_profile']
});
const fx1Inspect = fx1.inspectGmailSalesLegacySourceTypeCompatibility({ skipLog: true });
assert.equal(fx1Inspect.legacySourceTypeNormalizationEligibleCount, 3);
assert.equal(fx1Inspect.legacySourceTypeNormalizedCounts.official_website, 1);
assert.equal(fx1Inspect.legacySourceTypeNormalizedCounts.official_contact_page, 1);
assert.equal(fx1Inspect.legacySourceTypeNormalizedCounts.official_company_profile, 1);
assert.equal(fx1Inspect.googleSheetsUpdated, false);
assert.equal(fx1Inspect.urlFetchExecuted, false);

const fx2 = createContext();
const fx2SafeRef = ['https:', '', 'legacy-fx2.example.invalid', 'contact'].join('/');
assert.equal(fx2.normalizeGmailSalesLegacySourceType_('homepage', fx2SafeRef, {}).normalizedSourceType, 'official_website');
assert.equal(fx2.normalizeGmailSalesLegacySourceType_('official_contact', fx2SafeRef, {}).normalizedSourceType, 'official_contact_page');
assert.equal(fx2.normalizeGmailSalesLegacySourceType_('', fx2SafeRef, {}).normalizedSourceType, 'official_contact_page');
assert.equal(fx2.normalizeGmailSalesLegacySourceType_('instagram', fx2SafeRef, {}).ok, false);

const fx3 = createContext();
installLegacyPromotionFixture(fx3, {
  count: 1,
  sourceTypes: ['instagram'],
  currentVerification: false
});
const fx3Readiness = fx3.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fx3Readiness.legacyPromotionEligibleCount, 0);
assert.equal(Boolean(fx3Readiness.legacyPromotionAllBlockedReasonCounts.social_network), true);
assert.equal(Boolean(fx3Readiness.legacyPromotionAllBlockedReasonCounts.review_validator_version_stale), true);

const fx4 = createContext();
installLegacyPromotionFixture(fx4, {
  count: 1,
  sourceTypes: ['homepage'],
  currentVerification: false
});
const fx4Readiness = fx4.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fx4Readiness.deterministicLocalReverificationEligibleCount, 1);
assert.equal(fx4Readiness.promotionEligibleAfterLocalReverificationCount, 1);
assert.equal(fx4Readiness.legacyPromotionEligibleCount, 1);

const fx5 = createContext();
installLegacyPromotionFixture(fx5, {
  count: 4,
  sourceTypes: ['homepage', 'homepage', 'homepage', 'homepage'],
  sourceReferences: [
    ['http:', '', 'legacy-fx5.example.invalid'].join('/'),
    ['https:', '', 'localhost'].join('/'),
    ['https:', '', '127.0.0.1'].join('/'),
    ['https:', '', 'legacy-fx5.example.invalid', 'contact'].join('/')
  ],
  currentVerification: false
});
fx5.__sourceSheet.values[4][fx5.__sourceSheet.values[0].indexOf('unsubscribe')] = 'true';
const fx5Readiness = fx5.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fx5Readiness.legacyPromotionEligibleCount, 1);
assert.equal(fx5Readiness.noApiHttpHttpsPublicOrgPageEligibleCount, 1);
assert.equal(Boolean(fx5Readiness.legacyPromotionAllBlockedReasonCounts.localhost), true);
assert.equal(Boolean(fx5Readiness.legacyPromotionAllBlockedReasonCounts.private_ip), true);
assert.equal(Boolean(fx5Readiness.legacyPromotionAllBlockedReasonCounts.suppression_present), true);

const fx6 = createContext();
installLegacyPromotionFixture(fx6, {
  count: 65,
  sourceTypes: Array.from({ length: 65 }, (_, index) => index % 2 === 0 ? 'homepage' : 'contact_page'),
  currentVerification: false
});
fx6.__props.GMAIL_SALES_LEGACY_PROMOTION_BATCH_SIZE = '65';
const fx6Step = fx6.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(fx6Step.stepExecuted, 'legacy_review_reference_promotion');
assert.equal(fx6Step.legacyPromotionAttemptedCount, 5);
assert.equal(fx6Step.legacyPromotionSucceededCount, 5);
assert.equal(fx6Step.legacyPromotionViaLocalReverificationCount, 5);
assert.equal(fx6.__state.groundedDiscoveryCallCount, 0);
assert.equal(fx6.__state.urlFetchCount, 0);
assert.equal(fx6.__state.gmailSendCount, 0);

const fx7 = createContext();
installLegacyPromotionFixture(fx7, { count: 5, sourceTypes: ['homepage', 'homepage', 'homepage', 'homepage', 'homepage'], currentVerification: false });
installSourceReferenceReadiness(fx7, {
  sourceReferenceCellContractLastProbeValid: true,
  transactionReadinessValid: true,
  eligibleTransactionTargetCount: 1,
  sourceReferenceEligibleCellCount: 1
});
fx7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = u3EnrichmentReadiness;
fx7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness_ = u3EnrichmentReadiness;
const fx7Inspect = fx7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(fx7Inspect.plannedNextAction, 'legacy_review_reference_promotion');
assert.equal(fx7Inspect.plannedNextActionReasonCode, 'legacy_reference_promotion_available');

const fx8 = createContext();
installLegacyPromotionFixture(fx8, { count: 5, sourceTypes: ['homepage', 'homepage', 'homepage', 'homepage', 'homepage'], currentVerification: false });
const fx8Sunday = fx8.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-05T09:00:00+09:00', targetDate: '2026-07-05', skipLog: true });
assert.equal(fx8Sunday.todayRecommendedAction, 'wait_for_next_business_day');
assert.equal(fx8Sunday.nextBusinessDayRecoveryAction, 'legacy_review_reference_promotion');

const fx9 = createContext();
installLegacyPromotionFixture(fx9, { count: 5, sourceTypes: ['homepage', 'homepage', 'homepage', 'homepage', 'homepage'], currentVerification: false });
fx9.inspectGmailSalesCommittedSourceReferenceFormat = () => ({
  event: 'gmail_sales_committed_source_reference_format',
  sourceReferenceUrlSyntaxInvalidCount: 1,
  canonicalSourceUrlRepairEligibleCount: 0,
  gmailSendExecuted: false,
  googleSheetsUpdated: false
});
const fx9Status = fx9.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(fx9Status.plannedNextAction, 'legacy_review_reference_promotion');

const fy1 = createContext();
const fy1Types = Array.from({ length: 65 }, (_, index) => ['https:', '', `misfiled-${index + 1}.example.invalid`].join('/'));
installLegacyPromotionFixture(fy1, {
  count: 65,
  sourceTypes: fy1Types,
  currentVerification: false
});
const fy1Diagnostic = fy1.inspectGmailSalesLegacySourceTypeCompatibility({ skipLog: false });
assert.equal(fy1Diagnostic.sourceTypeLooksMisfiledCount > 0, true);
assert.equal(fy1Diagnostic.possibleHeaderContractMismatch, true);
assert.equal(fy1Diagnostic.sourceReferenceClassifierSucceededCount, 65);
assert.equal(fy1.__state.logs.some((entry) => /example\.invalid/.test(entry)), false);

const fy2 = createContext();
installLegacyPromotionFixture(fy2, {
  count: 1,
  sourceTypes: [['https:', '', 'raw-type-fy2.example.invalid'].join('/')],
  currentVerification: false
});
const fy2Readiness = fy2.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy2Readiness.sourceReferenceClassifierSucceededCount, 1);
assert.equal(fy2Readiness.sourceTypeDerivedFromSourceReferenceCount, 1);
assert.equal(fy2Readiness.legacyPromotionNormalizedSourceTypeCounts.official_contact_page, 1);
assert.equal(fy2Readiness.legacyPromotionEligibleCount, 1);

const fy3 = createContext();
installLegacyPromotionFixture(fy3, {
  count: 1,
  sourceTypes: [['https:', '', 'raw-type-fy3.example.invalid'].join('/')],
  sourceReferences: [['https:', '', 'legacy-fy3.example.invalid', 'inquiry'].join('/')],
  currentVerification: false
});
const fy3Readiness = fy3.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy3Readiness.sourceReferenceClassCounts.official_contact_page, 1);
assert.equal(fy3Readiness.legacyPromotionEligibleCount, 1);

const fy4 = createContext();
installLegacyPromotionFixture(fy4, {
  count: 5,
  sourceTypes: fy1Types.slice(0, 5),
  sourceReferences: [
    'mailto:safe-redacted',
    'tel:0000000000',
    'javascript:void(0)',
    ['https:', '', 'localhost'].join('/'),
    ['https:', '', '127.0.0.1'].join('/')
  ],
  currentVerification: false
});
const fy4Readiness = fy4.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy4Readiness.legacyPromotionEligibleCount, 0);
assert.equal(Boolean(fy4Readiness.legacyPromotionAllBlockedReasonCounts.unsupported_scheme), true);
assert.equal(Boolean(fy4Readiness.legacyPromotionAllBlockedReasonCounts.localhost), true);
assert.equal(Boolean(fy4Readiness.legacyPromotionAllBlockedReasonCounts.private_ip), true);

const fy5 = createContext();
installLegacyPromotionFixture(fy5, {
  count: 1,
  sourceTypes: [['https:', '', 'raw-type-fy5.example.invalid'].join('/')],
  sourceReferences: [['https:', '', 'yelp.com', 'biz', 'masked'].join('/')],
  currentVerification: false
});
const fy5Readiness = fy5.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy5Readiness.legacyPromotionEligibleCount, 0);
assert.equal(Boolean(fy5Readiness.legacyPromotionAllBlockedReasonCounts.business_directory), true);

const fy6 = createContext();
installLegacyPromotionFixture(fy6, {
  count: 1,
  sourceTypes: [['https:', '', 'raw-type-fy6.example.invalid'].join('/')],
  currentVerification: false
});
setSheetValueByHeader(fy6.__sourceSheet, 2, 'privatePersonalContactFlag', 'true');
const fy6Readiness = fy6.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy6Readiness.legacyPromotionEligibleCount, 0);
assert.equal(Boolean(fy6Readiness.legacyPromotionAllBlockedReasonCounts.private_personal_contact), true);

const fy7 = createContext();
const fy7Refs = Array.from({ length: 66 }, (_, index) => index < 6 ? ['https:', '', `legacy-fy7-${index + 1}.example.invalid`, 'contact'].join('/') : `mailto:redacted-${index + 1}`);
installLegacyPromotionFixture(fy7, {
  count: 66,
  sourceTypes: Array.from({ length: 66 }, (_, index) => ['https:', '', `raw-type-fy7-${index + 1}.example.invalid`].join('/')),
  sourceReferences: fy7Refs,
  currentVerification: false
});
setSheetValueByHeader(fy7.__sourceSheet, 2, 'sourceReference', fy7Refs[0]);
const fy7Compat = fy7.inspectGmailSalesLegacySourceTypeCompatibility({ skipLog: true });
const fy7Ready = fy7.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
const fy7Plan = fy7.planGmailSalesEvidenceRecoveryAction_({}, { legacyPromotionReadiness: fy7Ready });
assert.equal(fy7Compat.reviewOnlyCompatibilityCandidateCount, 65);
assert.equal(fy7Compat.reviewOnlyPromotionEligibleAfterLocalReverificationCount, 5);
assert.equal(fy7Ready.legacyPromotionEligibleCount, 5);
assert.equal(fy7Ready.promotionEligibleViaSourceReferenceClassificationCount, 5);
assert.equal(fy7Plan.evidenceRecoveryAction, 'legacy_review_reference_promotion');
assert.equal(fy7Plan.evidenceRecoveryActionReasonCode, 'legacy_source_reference_classification_available');

const fy8 = createContext();
installLegacyPromotionFixture(fy8, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-fy8-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
const fy8Step = fy8.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(fy8Step.stepExecuted, 'legacy_review_reference_promotion');
assert.equal(fy8Step.legacyPromotionAttemptedCount, 5);
assert.equal(fy8Step.legacyPromotionSucceededCount, 5);
assert.equal(fy8Step.legacyPromotionViaSourceReferenceClassificationCount, 5);
assert.equal(Boolean(fy8Step.aiApiCalled), false);
assert.equal(Boolean(fy8Step.urlFetchExecuted), false);
assert.equal(Boolean(fy8Step.gmailSendExecuted), false);
assert.equal(Boolean(fy8Step.triggerChanged), false);

const fy9 = createContext();
installLegacyPromotionFixture(fy9, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-fy9-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
const fy9Sunday = fy9.inspectGmailSalesMondayRecoveryPreflight({ now: '2026-07-05T09:00:00+09:00', targetDate: '2026-07-05', skipLog: true });
assert.equal(fy9Sunday.todayRecommendedAction, 'wait_for_next_business_day');
assert.equal(fy9Sunday.nextBusinessDayRecoveryAction, 'legacy_review_reference_promotion');
assert.equal(fy9Sunday.mondayExpectedPrimaryAction, 'legacy_review_reference_promotion');

const fy10 = createContext();
installLegacyPromotionFixture(fy10, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-fy10-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
fy10.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '30';
const fy10Status = fy10.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(fy10Status.plannedNextAction, 'legacy_review_reference_promotion');
assert.equal(fy10Status.safeToExecute, true);

const fy11 = createContext();
installLegacyPromotionFixture(fy11, {
  count: 3,
  sourceTypes: Array.from({ length: 3 }, (_, index) => ['https:', '', `raw-type-fy11-${index + 1}.example.invalid`].join('/')),
  sourceReferences: [
    'mailto:redacted',
    ['https:', '', 'yelp.com', 'biz', 'masked'].join('/'),
    ['https:', '', 'legacy-fy11.example.invalid', 'contact'].join('/')
  ],
  currentVerification: false
});
setSheetValueByHeader(fy11.__sourceSheet, 4, 'privatePersonalContactFlag', 'true');
const fy11Ready = fy11.inspectGmailSalesReviewLegacyReferencePromotionReadiness({ skipLog: true });
assert.equal(fy11Ready.legacyPromotionEligibleCount, 0);
assert.equal(fy11Ready.legacyPromotionViaSourceReferenceClassificationCount, 0);
assert.equal(/approvedBasisType:\s*['"]manual_legal_reviewed['"]/.test(code), false);

const g4291 = createContext();
g4291.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
g4291.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
g4291.UrlFetchApp.fetch = () => { g4291.__state.urlFetchCount += 1; return { getResponseCode: () => 429, getContentText: () => '{}' }; };
installFiveAiPendingRows(g4291);
const g4291Result = g4291.runGmailSalesAiContactBasisVerificationOnce();
assert.equal(g4291Result.aiProviderRequestSuccessCount, 0);
assert.equal(g4291Result.aiProviderRequestFailureCount, 1);
assert.equal(g4291Result.aiProviderRateLimitedRequestCount, 1);
assert.equal(g4291Result.aiProviderCooldownActive, true);
assert.equal(g4291Result.aiProviderCooldownReason, 'ai_provider_http_429');
assert.equal(g4291Result.changedDigestEligibleCount, 5);
assert.equal(g4291Result.aiProviderRateLimitedDigestCount, 5);
assert.equal(g4291Result.aiEvaluatedCount, 0);
assert.equal(g4291Result.aiAppliedCount, 0);
assert.equal(g4291Result.gmailSendExecuted, false);
assert.equal(g4291Result.triggerChanged, false);

const g4292 = createContext();
g4292.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
g4292.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
g4292.UrlFetchApp.fetch = () => { g4292.__state.urlFetchCount += 1; return { getResponseCode: () => 429, getContentText: () => '{}' }; };
installFiveAiPendingRows(g4292);
const g4292Step = g4292.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(g4292Step.executedAction, 'ai_contact_basis_verification');
assert.equal(g4292Step.executedActionStatus, 'provider_blocked');
assert.equal(g4292Step.executedActionBlockedReason, 'ai_provider_rate_limited');
assert.notEqual(g4292Step.actionStatus, 'pass');
assert.equal(g4292Step.aiProviderRequestSuccessCount, 0);
assert.equal(g4292Step.aiProviderRequestFailureCount, 1);
assert.equal(g4292Step.aiProviderRateLimitedRequestCount, 1);
assert.equal(g4292Step.aiProviderCooldownActive, true);

const g4293 = createContext();
installFiveAiPendingRows(g4293);
setAiProviderCooldown(g4293);
installLegacyPromotionFixture(g4293, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-g4293-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
for (let rowIndex = 2; rowIndex <= 6; rowIndex += 1) setSheetValueByHeader(g4293.__sourceSheet, rowIndex, 'businessContactEvidence', 'updated official inquiry evidence');
const g4293Inspect = g4293.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g4293Inspect.aiPendingBlockedByCooldown, true);
assert.equal(g4293Inspect.aiRetrySafeToExecute, false);
assert.equal(g4293Inspect.plannedNextAction, 'legacy_review_reference_promotion');
assert.equal(g4293Inspect.plannedNextActionReasonCode, 'ai_cooldown_non_ai_recovery_available');
assert.equal(g4293Inspect.plannedExpectedApiClass, 'none');
assert.equal(g4293Inspect.plannedSafeToExecute, true);

const g4295 = createContext();
installFiveAiPendingRows(g4295);
setAiProviderCooldown(g4295);
const g4295Inspect = g4295.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g4295Inspect.plannedNextAction, 'wait_for_ai_provider_cooldown');
assert.equal(g4295Inspect.plannedSafeToExecute, false);
assert.equal(g4295Inspect.operatorShouldRunSafeStepNow, false);
assert.equal(g4295Inspect.operatorShouldWaitReason, 'wait_for_ai_provider_cooldown');

const g4296 = createContext();
installFiveAiPendingRows(g4296);
setAiProviderCooldown(g4296, '2000-01-01T00:00:00.000Z');
const g4296Inspect = g4296.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g4296Inspect.aiProviderCooldownActive, false);
assert.equal(g4296Inspect.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(g4296Inspect.aiRetrySafeToExecute, true);

const g4297Ledger = JSON.parse(g4292.__props.GMAIL_SALES_RECOVERY_USAGE_LEDGER_JSON || '{}');
const g4297Operations = Object.values(g4297Ledger).flatMap((day) => Object.values((day || {}).operations || {}));
const g4297Operation = g4297Operations.find((operation) => operation.operationType === 'ai_contact_basis_verification') || {};
assert.equal(g4297Operation.attemptedCostYen, 1);
assert.equal(g4297Operation.failedProviderRequestCostYen, 1);
assert.equal(g4297Operation.successfulEvaluationCostYen, 0);
assert.equal(g4297Operation.aiProviderFailedRequestCount, 1);
assert.equal(g4297Operation.aiProviderRateLimitedRequestCount, 1);

const g429b1 = createContext();
installFiveAiPendingRows(g429b1);
applyTodayTargetDate(g429b1);
seedHistoricalAi429Summary(g429b1, { completedAt: minutesAgoIso(120) });
const g429b1Inspect = g429b1.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429b1Inspect.aiProviderLastRunSummaryFound, true);
assert.equal(g429b1Inspect.aiProviderLastRunHadHttp429, true);
assert.equal(g429b1Inspect.aiProviderLastRunRateLimitedDigestCount, 5);
assert.equal(g429b1Inspect.aiProviderLastRunRequestFailureCount, 1);
assert.equal(g429b1Inspect.aiProviderLastRunRequestSuccessCount, 0);
assert.equal(g429b1Inspect.aiProviderLastRunCandidateResponseCount, 0);
assert.equal(g429b1Inspect.aiProviderRateLimitedToday, true);
assert.equal(g429b1Inspect.aiProviderCooldownInferredFromLastRunSummary, true);
assert.equal(g429b1Inspect.aiProviderLastFailureCategory, 'ai_provider_http_429');
assert.equal(g429b1Inspect.aiPendingBlockedByCooldown, true);
assert.equal(g429b1Inspect.aiRetrySafeToExecute, false);
assert.equal(g429b1Inspect.aiProviderRetryProbeEligible, false);
assert.equal(g429b1Inspect.aiProviderRetryProbeBlockedReason, 'cooldown_elapsed_below_minimum');
assert.equal(g429b1Inspect.plannedNextAction, 'wait_for_ai_provider_cooldown');
assert.equal(g429b1Inspect.operatorShouldWaitReason, 'wait_for_ai_provider_cooldown');

const g429b2 = createContext();
installLegacyPromotionFixture(g429b2, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-g429b2-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
for (let rowIndex = 2; rowIndex <= 6; rowIndex += 1) setSheetValueByHeader(g429b2.__sourceSheet, rowIndex, 'businessContactEvidence', 'updated official inquiry evidence');
seedHistoricalAi429Summary(g429b2);
const g429b2Inspect = g429b2.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429b2Inspect.aiProviderRateLimitedToday, true);
assert.equal(g429b2Inspect.plannedNextAction, 'legacy_review_reference_promotion');
assert.equal(g429b2Inspect.plannedNextActionReasonCode, 'ai_recent_rate_limit_non_ai_recovery_available');
assert.equal(g429b2Inspect.plannedExpectedApiClass, 'none');
assert.equal(g429b2Inspect.plannedExpectedWriteClass, 'sheet_update');
assert.equal(g429b2Inspect.plannedSafeToExecute, true);
assert.equal(g429b2Inspect.operatorRecommendedNextFunctionReason, 'ai_recent_rate_limit_but_legacy_promotion_available');

const g429b3 = createContext();
installLegacyPromotionFixture(g429b3, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-g429b3-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
for (let rowIndex = 2; rowIndex <= 6; rowIndex += 1) setSheetValueByHeader(g429b3.__sourceSheet, rowIndex, 'businessContactEvidence', 'updated official inquiry evidence');
seedHistoricalAi429Summary(g429b3);
const g429b3Step = g429b3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(g429b3Step.executedAction, 'legacy_review_reference_promotion');
assert.equal(g429b3Step.executedExpectedApiClass, 'none');
assert.equal(g429b3Step.aiApiCalled, false);
assert.equal(g429b3.__state.aiWorkerCallCount, 0);
assert.equal(g429b3.__state.urlFetchCount, 0);

const g429b4 = createContext();
installFiveAiPendingRows(g429b4);
seedHistoricalAi429Summary(g429b4, { runId: 'ai-old-ledger' });
seedRecoveryUsage(g429b4, [
  { operationId: 'ai-old-ledger', event: 'gmail_sales_ai_contact_basis_verification', completedAt: '2026-07-03T00:00:00.000Z', estimatedCostYen: 1 }
]);
const g429b4Usage = g429b4.summarizeGmailSalesRecoveryDailyUsage_(g429b4.getGmailSalesAiConfig_());
assert.equal(g429b4Usage.cumulativeEstimatedCostYen, 1);
assert.equal(g429b4Usage.attemptedCostYen, 1);
assert.equal(g429b4Usage.successfulEvaluationCostYen, 0);
assert.equal(g429b4Usage.failedProviderRequestCostYen, 1);
assert.equal(g429b4Usage.aiProviderAttemptedRequestCount, 1);
assert.equal(g429b4Usage.aiProviderSuccessfulRequestCount, 0);
assert.equal(g429b4Usage.aiProviderFailedRequestCount, 1);
assert.equal(g429b4Usage.aiProviderRateLimitedRequestCount, 1);
assert.equal(g429b4Usage.providerFailureBackfilledOperationCount, 1);
assert.equal(g429b4Usage.providerFailureBackfillSource, 'summary');
assert.equal(g429b4Usage.aiProviderLastRunSummaryFound, true);
assert.equal(g429b4Usage.aiProviderLastRunSummaryMatchedLedger, true);
assert.equal(g429b4Usage.aiProviderFailureAccountingComplete, true);

const g429b5 = createContext();
installFiveAiPendingRows(g429b5);
seedHistoricalAi429Summary(g429b5, { completedAt: '2026-07-02T00:00:00.000Z' });
const g429b5Inspect = g429b5.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429b5Inspect.aiProviderRateLimitedToday, false);
assert.equal(g429b5Inspect.aiProviderCooldownInferredFromLastRunSummary, false);
assert.equal(g429b5Inspect.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(g429b5Inspect.aiRetrySafeToExecute, true);

const g429c1 = createContext();
installSheets(g429c1, makeSourceRows(38), []);
applyTodayTargetDate(g429c1);
seedHistoricalAi429Summary(g429c1, { completedAt: minutesAgoIso(361) });
const g429c1Inspect = g429c1.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429c1Inspect.aiProviderRetryProbeEligible, true);
assert.equal(g429c1Inspect.aiProviderSameDayRetryAllowed, true);
assert.equal(g429c1Inspect.aiRetrySafeToExecute, true);
assert.equal(g429c1Inspect.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(g429c1Inspect.plannedNextActionReasonCode, 'ai_retry_probe_after_cooldown_elapsed');
assert.equal(g429c1Inspect.plannedExpectedApiClass, 'gemini_ai_review');
assert.equal(g429c1Inspect.plannedExpectedWriteClass, 'sheet_update');
assert.equal(g429c1Inspect.plannedSafeToExecute, true);
assert.equal(g429c1Inspect.operatorRecommendedNextFunctionReason, 'ai_retry_probe_after_cooldown_elapsed');
assert.equal(g429c1Inspect.operatorShouldRunSafeStepNow, true);

const g429c2 = createContext();
installSheets(g429c2, makeSourceRows(38), []);
applyTodayTargetDate(g429c2);
seedHistoricalAi429Summary(g429c2, { completedAt: minutesAgoIso(361) });
const g429c2Step = g429c2.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(g429c2Step.stepExecuted, 'ai_contact_basis_verification');
assert.equal(g429c2Step.aiApiCalled, true);
assert.equal(g429c2Step.aiBatchRequestCount, 1);
assert.equal(g429c2Step.aiProviderCandidateResponseCount, 5);
assert.equal(g429c2Step.aiProviderRetryProbeCandidateLimit, 5);
assert.equal(g429c2Step.aiProviderRetryProbeCandidateCount, 5);
assert.equal(g429c2.__state.gmailSendCount, 0);
assert.equal(g429c2.__state.draftCreateCount, 0);
assert.equal(g429c2.__state.triggerCreateCount, 0);

const g429c3 = createContext();
installFiveAiPendingRows(g429c3);
const g429c3Date = applyTodayTargetDate(g429c3);
seedHistoricalAi429Summary(g429c3, { completedAt: minutesAgoIso(361) });
g429c3.recordGmailSalesRecoveryUsageOperation_({
  operationId: 'retry-probe-used',
  event: 'gmail_sales_ai_contact_basis_verification',
  completedAt: new Date().toISOString(),
  targetDate: g429c3Date,
  estimatedCostYen: 1,
  aiProviderRetryProbeAttemptCount: 1,
  aiProviderRetryProbeCostYen: 1
});
const g429c3Inspect = g429c3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429c3Inspect.aiProviderRetryProbeAlreadyUsedToday, true);
assert.equal(g429c3Inspect.aiProviderRetryProbeEligible, false);
assert.equal(g429c3Inspect.aiRetrySafeToExecute, false);
assert.equal(g429c3Inspect.plannedNextAction, 'wait_for_ai_provider_cooldown');

const g429c4 = createContext();
g429c4.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
g429c4.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
g429c4.UrlFetchApp.fetch = () => { g429c4.__state.urlFetchCount += 1; return { getResponseCode: () => 429, getContentText: () => '{}' }; };
installFiveAiPendingRows(g429c4);
applyTodayTargetDate(g429c4);
seedHistoricalAi429Summary(g429c4, { completedAt: minutesAgoIso(361) });
const g429c4Step = g429c4.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(g429c4Step.executedAction, 'ai_contact_basis_verification');
assert.equal(g429c4Step.executedActionStatus, 'provider_blocked');
assert.equal(g429c4Step.aiProviderRetryProbeAttemptCountToday, 1);
assert.equal(g429c4Step.aiProviderRetryProbe429CountToday, 1);
assert.equal(g429c4Step.aiProviderHardCooldownForTargetDate, true);
assert.equal(g429c4Step.aiProviderHardCooldownReason, 'ai_retry_probe_http_429');
const g429c4After = g429c4.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(g429c4After.aiProviderHardCooldownForTargetDate, true);
assert.equal(g429c4After.aiRetrySafeToExecute, false);
assert.equal(g429c4After.operatorShouldRunSafeStepNow, false);

const gperm1 = createContext();
installFiveAiPendingRows(gperm1);
applyTodayTargetDate(gperm1);
seedPermissionErrorAiSummary(gperm1);
const gperm1Inspect = gperm1.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gperm1Inspect.aiProviderLastRunHadPermissionError, true);
assert.equal(gperm1Inspect.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gperm1Inspect.aiProviderPermissionFixRequired, true);
assert.equal(gperm1Inspect.aiProviderPermissionRetrySafeToExecute, false);
assert.equal(gperm1Inspect.aiRetrySafeToExecute, false);
assert.equal(gperm1Inspect.plannedNextAction, 'wait_for_ai_provider_permission_fix');
assert.equal(gperm1Inspect.plannedNextActionReasonCode, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm1Inspect.plannedSafeToExecute, false);
assert.equal(gperm1Inspect.operatorShouldRunSafeStepNow, false);
assert.equal(gperm1Inspect.operatorShouldWaitReason, 'ai_provider_permission_error_requires_fix');

const gperm2 = createContext();
installFiveAiPendingRows(gperm2);
applyTodayTargetDate(gperm2);
seedPermissionErrorAiSummary(gperm2);
const gperm2Step = gperm2.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(gperm2Step.executedAction, '');
assert.equal(gperm2Step.executedActionStatus, 'blocked');
assert.equal(gperm2Step.executedActionBlockedReason, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm2Step.actionStatus, 'blocked');
assert.equal(gperm2Step.actionBlockedReason, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm2Step.aiApiCalled, false);
assert.equal(gperm2Step.googleSheetsUpdated, false);
assert.equal(gperm2.__state.urlFetchCount, 0);
assert.equal(gperm2.__state.gmailSendCount, 0);
assert.equal(gperm2.__state.draftCreateCount, 0);
assert.equal(gperm2.__state.triggerCreateCount, 0);

const gperm3 = createContext();
installFiveAiPendingRows(gperm3);
applyTodayTargetDate(gperm3);
seedPermissionErrorAiSummary(gperm3);
const gperm3Usage = gperm3.summarizeGmailSalesRecoveryDailyUsage_(gperm3.getGmailSalesAiConfig_());
assert.equal(gperm3Usage.aiProviderPermissionErrorRequestCount >= 1, true);
assert.equal(gperm3Usage.aiProviderPermissionErrorDigestCount >= 5, true);
assert.equal(gperm3Usage.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gperm3Usage.aiProviderPermissionFixRequired, true);
assert.equal(gperm3Usage.aiProviderNonRetryableFailureCostYen >= 1, true);
assert.equal(gperm3Usage.aiProviderHardCooldownForTargetDate, false);

const gperm4 = createContext();
gperm4.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gperm4.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
gperm4.UrlFetchApp.fetch = () => { gperm4.__state.urlFetchCount += 1; return { getResponseCode: () => 403, getContentText: () => '{}' }; };
installFiveAiPendingRows(gperm4);
applyTodayTargetDate(gperm4);
seedUrlFetchAuthorizationVerified(gperm4);
seedHistoricalAi429Summary(gperm4, { completedAt: minutesAgoIso(361) });
const gperm4Step = gperm4.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(gperm4Step.executedAction, 'ai_contact_basis_verification');
assert.equal(gperm4Step.executedActionStatus, 'provider_blocked');
assert.equal(gperm4Step.executedActionBlockedReason, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm4Step.aiProviderPermissionErrorRequestCount, 1);
assert.equal(gperm4Step.aiProviderPermissionErrorDigestCount, 5);
assert.equal(gperm4Step.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gperm4Step.aiProviderHardCooldownForTargetDate, false);
const gperm4After = gperm4.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gperm4After.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gperm4After.aiRetrySafeToExecute, false);
assert.equal(gperm4After.plannedNextAction, 'wait_for_ai_provider_permission_fix');
assert.equal(gperm4After.operatorShouldRunSafeStepNow, false);
assert.equal(gperm4After.operatorShouldWaitReason, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm4.__state.gmailSendCount, 0);
assert.equal(gperm4.__state.draftCreateCount, 0);
assert.equal(gperm4.__state.triggerCreateCount, 0);

const gperm5 = createContext();
gperm5.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gperm5.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gperm5.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
installFiveAiPendingRows(gperm5);
applyTodayTargetDate(gperm5);
seedUrlFetchAuthorizationVerified(gperm5);
seedPermissionErrorAiSummary(gperm5);
const gperm5Readiness = gperm5.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(gperm5Readiness.event, 'gmail_sales_ai_provider_permission_repair_readiness');
assert.equal(gperm5Readiness.mode, 'read_only');
assert.equal(gperm5Readiness.provider, 'gemini');
assert.equal(gperm5Readiness.modelConfigured, true);
assert.equal(gperm5Readiness.apiKeyPresent, true);
assert.equal(gperm5Readiness.aiProviderRepairProbeEligible, true);
assert.equal(gperm5Readiness.aiProviderRepairProbeMaxAttemptsPerDay, 3);
assert.equal(gperm5Readiness.aiProviderRepairProbeMaxAttemptsPerEpoch, 1);
assert.equal(gperm5Readiness.gmailSendExecuted, false);
assert.equal(gperm5Readiness.googleSheetsUpdated, false);
assert.equal(gperm5Readiness.aiApiCalled, false);

const gperm6 = createContext();
gperm6.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gperm6.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gperm6.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
gperm6.UrlFetchApp.fetch = () => {
  gperm6.__state.urlFetchCount += 1;
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
  };
};
installFiveAiPendingRows(gperm6);
applyTodayTargetDate(gperm6);
seedUrlFetchAuthorizationVerified(gperm6);
seedPermissionErrorAiSummary(gperm6);
const gperm6Probe = gperm6.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gperm6Probe.status, 'pass');
assert.equal(gperm6Probe.aiApiCalled, true);
assert.equal(gperm6Probe.aiProviderRepairProbeAttemptCountToday, 1);
assert.equal(gperm6Probe.aiProviderRepairProbeSuccessfulRequestCount, 1);
assert.equal(gperm6Probe.aiProviderRepairProbeFailedRequestCount, 0);
assert.equal(gperm6Probe.aiProviderPermissionRepairVerified, true);
assert.equal(gperm6Probe.aiProviderPermissionBlockedForTargetDate, false);
assert.equal(gperm6Probe.aiProviderPermissionFixRequired, false);
assert.equal(gperm6Probe.gmailSendExecuted, false);
assert.equal(gperm6Probe.gmailDraftCreated, false);
assert.equal(gperm6Probe.googleSheetsUpdated, false);
assert.equal(gperm6Probe.triggerChanged, false);
const gperm6After = gperm6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gperm6After.aiProviderPermissionBlockedForTargetDate, false);
assert.equal(gperm6After.aiProviderPermissionFixRequired, false);
assert.equal(gperm6After.aiProviderPermissionRetrySafeToExecute, true);
assert.equal(gperm6After.aiProviderRepairProbeSuccessfulRequestCount, 1);
assert.equal(gperm6After.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(gperm6After.plannedNextActionReasonCode, 'ai_permission_repair_verified');
assert.equal(gperm6After.plannedSafeToExecute, true);
assert.equal(gperm6After.aiRetrySafeToExecute, true);
assert.equal(gperm6After.operatorRecommendedNextFunction, 'runGmailSalesAutomatedEvidenceRecoveryStepOnce');
assert.equal(gperm6After.operatorRecommendedNextFunctionReason, 'ai_permission_repair_verified');
assert.equal(gperm6After.operatorShouldRunSafeStepNow, true);
const gperm6Usage = gperm6.inspectGmailSalesRecoveryUsageLedger();
assert.equal(gperm6Usage.aiProviderRepairProbeAttemptCountToday, 1);
assert.equal(gperm6Usage.aiProviderRepairProbeSuccessfulRequestCount, 1);
assert.equal(gperm6Usage.aiProviderPermissionRepairVerified, true);
assert.equal(gperm6.__state.gmailSendCount, 0);
assert.equal(gperm6.__state.draftCreateCount, 0);
assert.equal(gperm6.__state.triggerCreateCount, 0);
assert.equal(JSON.stringify(gperm6.__state.logs).includes('configured-key-value-for-test'), false);

const gperm7 = createContext();
gperm7.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gperm7.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gperm7.__props.GMAIL_SALES_AI_API_KEY = 'configured-key-value-for-test';
gperm7.UrlFetchApp.fetch = () => {
  gperm7.__state.urlFetchCount += 1;
  return { getResponseCode: () => 403, getContentText: () => '{}' };
};
installFiveAiPendingRows(gperm7);
applyTodayTargetDate(gperm7);
seedUrlFetchAuthorizationVerified(gperm7);
seedPermissionErrorAiSummary(gperm7);
const gperm7Probe = gperm7.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gperm7Probe.status, 'blocked');
assert.equal(gperm7Probe.aiApiCalled, true);
assert.equal(gperm7Probe.aiProviderRepairProbeAttemptCountToday, 1);
assert.equal(gperm7Probe.aiProviderRepairProbeSuccessfulRequestCount, 0);
assert.equal(gperm7Probe.aiProviderRepairProbeFailedRequestCount, 1);
assert.equal(gperm7Probe.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gperm7Probe.aiProviderPermissionFixRequired, true);
const gperm7Second = gperm7.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gperm7Second.status, 'blocked');
assert.equal(gperm7Second.blockedReason, 'repair_probe_already_used_for_current_epoch');
assert.equal(gperm7.__state.urlFetchCount, 1);
const gperm7After = gperm7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gperm7After.plannedNextAction, 'wait_for_ai_provider_permission_fix');
assert.equal(gperm7After.plannedNextActionReasonCode, 'ai_provider_permission_error_requires_fix');
assert.equal(gperm7After.plannedSafeToExecute, false);
assert.equal(gperm7After.aiRetrySafeToExecute, false);
assert.equal(gperm7After.operatorShouldRunSafeStepNow, false);
assert.equal(gperm7After.gmailSendExecuted, false);
assert.equal(gperm7After.googleSheetsUpdated, false);
assert.equal(gperm7.__state.gmailSendCount, 0);
assert.equal(gperm7.__state.draftCreateCount, 0);
assert.equal(gperm7.__state.triggerCreateCount, 0);

const replacementSecret = ['valid', 'replacement', 'placeholder', '0123456789'].join('-');

const gkey1 = createContext();
gkey1.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey1.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gkey1.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
installFiveAiPendingRows(gkey1);
applyTodayTargetDate(gkey1);
seedPermissionErrorAiSummary(gkey1);
const gkey1Readiness = gkey1.inspectGmailSalesAiProviderApiKeyReplacementReadiness({ skipLog: true });
assert.equal(gkey1Readiness.status, 'blocked');
assert.equal(gkey1Readiness.secretInputSheetPresent, false);
assert.equal(gkey1Readiness.aiProviderApiKeyReplacementBlockedReason, 'secret_input_sheet_missing');
assert.equal(gkey1Readiness.willCreateNewApiKeyProperty, false);
assert.equal(gkey1Readiness.gmailSendExecuted, false);
assert.equal(gkey1Readiness.scriptPropertiesUpdated, false);

const gkey2 = createContext();
gkey2.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey2.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gkey2.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
installFiveAiPendingRows(gkey2);
installSecretRepairSheet(gkey2, '', '');
applyTodayTargetDate(gkey2);
seedPermissionErrorAiSummary(gkey2);
const gkey2Result = gkey2.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
assert.equal(gkey2Result.status, 'blocked');
assert.equal(gkey2Result.blockedReason, 'api_key_input_empty');
assert.equal(gkey2Result.apiKeyReplaced, false);
assert.equal(gkey2Result.scriptPropertiesUpdated, false);
assert.equal(gkey2.__props.GMAIL_SALES_AI_API_KEY, 'old-placeholder-value');

const gkey3 = createContext();
gkey3.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey3.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gkey3.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
installFiveAiPendingRows(gkey3);
const gkey3Sheet = installSecretRepairSheet(gkey3, 'bad key with spaces', 'gemini-2.5-flash-lite');
applyTodayTargetDate(gkey3);
seedPermissionErrorAiSummary(gkey3);
const gkey3BeforeWrites = gkey3.__state.propertyWriteCount;
const gkey3Result = gkey3.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
assert.equal(gkey3Result.status, 'blocked');
assert.equal(gkey3Result.blockedReason, 'api_key_input_invalid');
assert.equal(gkey3Result.apiKeyReplaced, false);
assert.equal(gkey3Result.secretInputCleared, true);
assert.equal(gkey3Result.googleSheetsUpdated, true);
assert.equal(gkey3Result.scriptPropertiesUpdated, false);
assert.equal(gkey3.__state.propertyWriteCount, gkey3BeforeWrites);
assert.equal(gkey3.__props.GMAIL_SALES_AI_API_KEY, 'old-placeholder-value');
assert.equal(gkey3Sheet.getCell(2, 2), '');
assert.equal(gkey3Sheet.getCell(3, 2), '');

const gkey4 = createContext();
gkey4.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey4.__props.GMAIL_SALES_AI_MODEL = 'gemini-1.5-flash';
gkey4.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
installFiveAiPendingRows(gkey4);
const gkey4Sheet = installSecretRepairSheet(gkey4, replacementSecret, 'gemini-2.5-flash-lite');
applyTodayTargetDate(gkey4);
seedUrlFetchAuthorizationVerified(gkey4);
seedPermissionErrorAiSummary(gkey4);
const gkey4KeysBefore = Object.keys(gkey4.__props).filter((key) => key.indexOf('API_KEY') !== -1).sort();
const gkey4Result = gkey4.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
assert.equal(gkey4Result.status, 'pass');
assert.equal(gkey4Result.apiKeyReplaced, true);
assert.equal(gkey4Result.modelReplaced, true);
assert.equal(gkey4Result.secretInputCleared, true);
assert.equal(gkey4Result.googleSheetsUpdated, true);
assert.equal(gkey4Result.scriptPropertiesUpdated, true);
assert.equal(gkey4Result.aiProviderPermissionFixRequired, true);
assert.equal(gkey4Result.aiProviderPermissionRepairVerified, false);
assert.equal(gkey4.__props.GMAIL_SALES_AI_API_KEY, replacementSecret);
assert.equal(gkey4.__props.GMAIL_SALES_AI_MODEL, 'gemini-2.5-flash-lite');
assert.deepEqual(Object.keys(gkey4.__props).filter((key) => key.indexOf('API_KEY') !== -1).sort(), gkey4KeysBefore);
assert.equal(gkey4Sheet.getCell(2, 2), '');
assert.equal(gkey4Sheet.getCell(3, 2), '');
assert.equal(JSON.stringify(gkey4.__state.logs).includes(replacementSecret), false);
const gkey4After = gkey4.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gkey4After.plannedNextAction, 'wait_for_ai_provider_permission_fix');
assert.equal(gkey4After.aiRetrySafeToExecute, false);
const gkey4RepairReadiness = gkey4.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(gkey4RepairReadiness.aiProviderApiKeyReplacementCountToday >= 1, true);
assert.equal(gkey4RepairReadiness.aiProviderApiKeyReplacementEpoch, 1);
assert.equal(gkey4RepairReadiness.aiProviderRepairProbeAttemptCountForCurrentEpoch, 0);
assert.equal(gkey4RepairReadiness.aiProviderRepairProbeEligible, true);

const gkey5 = createContext();
gkey5.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey5.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gkey5.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
gkey5.UrlFetchApp.fetch = () => {
  gkey5.__state.urlFetchCount += 1;
  return { getResponseCode: () => 403, getContentText: () => '{}' };
};
installFiveAiPendingRows(gkey5);
installSecretRepairSheet(gkey5, replacementSecret, '');
applyTodayTargetDate(gkey5);
seedUrlFetchAuthorizationVerified(gkey5);
seedPermissionErrorAiSummary(gkey5);
const gkey5Replace1 = gkey5.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
assert.equal(gkey5Replace1.aiProviderApiKeyReplacementEpoch, 1);
const gkey5Probe1 = gkey5.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gkey5Probe1.status, 'blocked');
assert.equal(gkey5Probe1.aiProviderRepairProbeAttemptCountForCurrentEpoch, 1);
const gkey5Probe2 = gkey5.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gkey5Probe2.status, 'blocked');
assert.equal(gkey5Probe2.blockedReason, 'repair_probe_already_used_for_current_epoch');
assert.equal(gkey5.__state.urlFetchCount, 1);
installSecretRepairSheet(gkey5, replacementSecret, '');
const gkey5Replace2 = gkey5.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
assert.equal(gkey5Replace2.aiProviderApiKeyReplacementEpoch, 2);
const gkey5Readiness2 = gkey5.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(gkey5Readiness2.aiProviderRepairProbeAttemptCountForCurrentEpoch, 0);
assert.equal(gkey5Readiness2.aiProviderRepairProbeEligible, true);
const gkey5Probe3 = gkey5.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gkey5Probe3.status, 'blocked');
installSecretRepairSheet(gkey5, replacementSecret, '');
gkey5.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
const gkey5Probe4 = gkey5.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gkey5Probe4.status, 'blocked');
assert.equal(gkey5Probe4.aiProviderRepairProbeAttemptCountToday, 3);
installSecretRepairSheet(gkey5, replacementSecret, '');
gkey5.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
const gkey5Limit = gkey5.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(gkey5Limit.aiProviderRepairProbeEligible, false);
assert.equal(gkey5Limit.aiProviderRepairProbeBlockedReason, 'repair_probe_daily_limit_reached');
assert.equal(gkey5.__state.gmailSendCount, 0);
assert.equal(gkey5.__state.draftCreateCount, 0);
assert.equal(gkey5.__state.triggerCreateCount, 0);

const gkey6 = createContext();
gkey6.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gkey6.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gkey6.__props.GMAIL_SALES_AI_API_KEY = 'old-placeholder-value';
gkey6.UrlFetchApp.fetch = () => {
  gkey6.__state.urlFetchCount += 1;
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
  };
};
installFiveAiPendingRows(gkey6);
installSecretRepairSheet(gkey6, replacementSecret, '');
applyTodayTargetDate(gkey6);
seedUrlFetchAuthorizationVerified(gkey6);
seedPermissionErrorAiSummary(gkey6);
gkey6.runGmailSalesAiProviderApiKeyReplacementFromSheetOnce();
const gkey6Probe = gkey6.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(gkey6Probe.status, 'pass');
const gkey6After = gkey6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gkey6After.plannedNextAction, 'ai_contact_basis_verification');
assert.equal(gkey6After.plannedNextActionReasonCode, 'ai_permission_repair_verified');
assert.equal(gkey6After.operatorShouldRunSafeStepNow, true);
assert.equal(JSON.stringify(gkey6.__state.logs).includes(replacementSecret), false);
assert.equal(gkey6.__state.gmailSendCount, 0);
assert.equal(gkey6.__state.draftCreateCount, 0);
assert.equal(gkey6.__state.triggerCreateCount, 0);

const diagnosticSecret = ['diagnostic', 'secret', 'placeholder', '0123456789'].join('-');
function makeGoogleApiError(status, code, reason, metadata = {}, message = 'provider error') {
  return {
    error: {
      code,
      status,
      message,
      details: [{
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason,
        domain: 'googleapis.com',
        metadata
      }]
    }
  };
}
function installGeminiDiagnosticContext(responseBody, httpStatus = 403) {
  const context = createContext();
  context.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
  context.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
  context.__props.GMAIL_SALES_AI_API_KEY = diagnosticSecret;
  seedUrlFetchAuthorizationVerified(context);
  applyTodayTargetDate(context);
  seedPermissionErrorAiSummary(context);
  context.__state.lastFetch = null;
  context.UrlFetchApp.fetch = (url, options) => {
    context.__state.urlFetchCount += 1;
    context.__state.lastFetch = { url, options };
    return {
      getResponseCode: () => httpStatus,
      getContentText: () => JSON.stringify(responseBody)
    };
  };
  return context;
}

const manifestScopes = Array.isArray(appsScriptManifest.oauthScopes) ? appsScriptManifest.oauthScopes : [];
assert.equal(manifestScopes.includes('https://www.googleapis.com/auth/script.external_request'), true);
assert.equal(manifestScopes.includes('https://www.googleapis.com/auth/gmail.modify'), true);
assert.equal(manifestScopes.includes('https://www.googleapis.com/auth/gmail.send'), true);
assert.equal(manifestScopes.includes('https://www.googleapis.com/auth/spreadsheets'), true);
assert.equal(manifestScopes.includes('https://www.googleapis.com/auth/script.scriptapp'), true);
assert.equal(manifestScopes.filter((scope) => scope === 'https://www.googleapis.com/auth/script.external_request').length, 1);

const urlAuthReadiness = createContext();
const urlAuthReadinessWrites = urlAuthReadiness.__state.propertyWriteCount + urlAuthReadiness.__state.sheetWriteCount + urlAuthReadiness.__state.urlFetchCount;
const urlAuthReadinessResult = urlAuthReadiness.inspectGmailSalesUrlFetchAuthorizationReadiness({ skipLog: true });
assert.equal(urlAuthReadinessResult.event, 'gmail_sales_urlfetch_authorization_readiness');
assert.equal(urlAuthReadinessResult.mode, 'read_only');
assert.equal(urlAuthReadinessResult.urlFetchScopeRequired, 'https://www.googleapis.com/auth/script.external_request');
assert.equal(urlAuthReadinessResult.urlFetchScopeDeclaredInManifest, true);
assert.equal(urlAuthReadinessResult.manifestOauthScopesPresent, true);
assert.equal(urlAuthReadinessResult.externalRequestScopePresent, true);
assert.equal(urlAuthReadinessResult.authorizationProbeMaxAttemptsPerDay, 3);
assert.equal(urlAuthReadinessResult.urlFetchExecuted, false);
assert.equal(urlAuthReadiness.__state.propertyWriteCount + urlAuthReadiness.__state.sheetWriteCount + urlAuthReadiness.__state.urlFetchCount, urlAuthReadinessWrites);

const urlAuthPass = createContext();
urlAuthPass.__state.lastFetch = null;
urlAuthPass.UrlFetchApp.fetch = (url, options) => {
  urlAuthPass.__state.urlFetchCount += 1;
  urlAuthPass.__state.lastFetch = { url, options };
  return { getResponseCode: () => 204, getContentText: () => '' };
};
const urlAuthPassProbe = urlAuthPass.runGmailSalesUrlFetchAuthorizationProbeOnce();
assert.equal(urlAuthPassProbe.event, 'gmail_sales_urlfetch_authorization_probe');
assert.equal(urlAuthPassProbe.status, 'pass');
assert.equal(urlAuthPassProbe.urlFetchExecuted, true);
assert.equal(urlAuthPassProbe.httpStatus, 204);
assert.equal(urlAuthPassProbe.transportExceptionPresent, false);
assert.equal(urlAuthPassProbe.fetchReturnedResponse, true);
assert.equal(urlAuthPassProbe.fetchResponseCodeAvailable, true);
assert.equal(urlAuthPassProbe.responseBodyLogged, false);
assert.equal(urlAuthPassProbe.requestUrlLogged, false);
assert.equal(urlAuthPassProbe.endpointHostSanitized, 'www.gstatic.com');
assert.equal(urlAuthPassProbe.endpointPathSanitized, '/generate_204');
assert.equal(urlAuthPassProbe.authorizationProbeAttemptCountToday, 1);
assert.equal(urlAuthPassProbe.authorizationProbeSuccessfulRequestCount, 1);
assert.equal(urlAuthPassProbe.authorizationProbeFailedRequestCount, 0);
assert.equal(urlAuthPassProbe.urlFetchAuthorizationVerified, true);
assert.equal(urlAuthPassProbe.scriptPropertiesUpdated, true);
assert.equal(urlAuthPassProbe.aiApiCalled, false);
assert.equal(urlAuthPass.__state.lastFetch.url, 'https://www.gstatic.com/generate_204');
assert.equal(urlAuthPass.__state.lastFetch.options.method, 'get');
assert.equal(urlAuthPass.__state.lastFetch.options.muteHttpExceptions, true);
assert.equal(JSON.stringify(urlAuthPass.__state.logs).includes('https://www.gstatic.com/generate_204'), false);
const urlAuthPassUsage = urlAuthPass.inspectGmailSalesRecoveryUsageLedger();
assert.equal(urlAuthPassUsage.urlFetchAuthorizationProbeAttemptCountToday, 1);
assert.equal(urlAuthPassUsage.urlFetchAuthorizationProbeLastHttpStatus, 204);
assert.equal(urlAuthPassUsage.urlFetchAuthorizationVerified, true);

const urlAuthDenied = createContext();
urlAuthDenied.UrlFetchApp.fetch = () => {
  urlAuthDenied.__state.urlFetchCount += 1;
  throw new Error('Permission denied for external request');
};
const urlAuthDeniedProbe = urlAuthDenied.runGmailSalesUrlFetchAuthorizationProbeOnce();
assert.equal(urlAuthDeniedProbe.status, 'blocked');
assert.equal(urlAuthDeniedProbe.blockedReason, 'urlfetch_permission_denied');
assert.equal(urlAuthDeniedProbe.transportExceptionPresent, true);
assert.equal(urlAuthDeniedProbe.transportExceptionCategory, 'urlfetch_permission_denied');
assert.equal(urlAuthDeniedProbe.urlFetchAuthorizationVerified, false);
assert.equal(urlAuthDeniedProbe.responseBodyLogged, false);
assert.equal(urlAuthDeniedProbe.requestUrlLogged, false);
assert.equal(urlAuthDeniedProbe.aiApiCalled, false);

const gdiagUrlAuthRequired = createContext();
gdiagUrlAuthRequired.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gdiagUrlAuthRequired.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gdiagUrlAuthRequired.__props.GMAIL_SALES_AI_API_KEY = diagnosticSecret;
applyTodayTargetDate(gdiagUrlAuthRequired);
seedPermissionErrorAiSummary(gdiagUrlAuthRequired);
const gdiagUrlAuthRequiredReadiness = gdiagUrlAuthRequired.inspectGmailSalesGeminiPermissionDiagnosticsReadiness({ skipLog: true });
assert.equal(gdiagUrlAuthRequiredReadiness.status, 'blocked');
assert.equal(gdiagUrlAuthRequiredReadiness.aiProviderDiagnosticProbeEligible, false);
assert.equal(gdiagUrlAuthRequiredReadiness.aiProviderDiagnosticProbeBlockedReason, 'urlfetch_authorization_required');
assert.equal(gdiagUrlAuthRequiredReadiness.urlFetchAuthorizationRequired, true);
assert.equal(gdiagUrlAuthRequiredReadiness.urlFetchAuthorizationVerified, false);
assert.equal(gdiagUrlAuthRequiredReadiness.urlFetchAuthorizationRecommendedAction, 'run_urlfetch_authorization_probe_after_oauth_reauthorization');
const gdiagUrlAuthRequiredProbe = gdiagUrlAuthRequired.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiagUrlAuthRequiredProbe.status, 'blocked');
assert.equal(gdiagUrlAuthRequiredProbe.blockedReason, 'urlfetch_authorization_required');
assert.equal(gdiagUrlAuthRequired.__state.urlFetchCount, 0);

const gdiagPlannerBlocked = createContext();
gdiagPlannerBlocked.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gdiagPlannerBlocked.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gdiagPlannerBlocked.__props.GMAIL_SALES_AI_API_KEY = diagnosticSecret;
applyTodayTargetDate(gdiagPlannerBlocked);
seedPermissionErrorAiSummary(gdiagPlannerBlocked);
installFiveAiPendingRows(gdiagPlannerBlocked);
const gdiagPlannerBlockedStatus = gdiagPlannerBlocked.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gdiagPlannerBlockedStatus.plannedNextAction, 'wait_for_urlfetch_authorization');
assert.equal(gdiagPlannerBlockedStatus.plannedNextActionReasonCode, 'urlfetch_authorization_required');
assert.equal(gdiagPlannerBlockedStatus.plannedExpectedApiClass, 'gemini_ai_review');
assert.equal(gdiagPlannerBlockedStatus.plannedExpectedWriteClass, 'none');
assert.equal(gdiagPlannerBlockedStatus.plannedSafeToExecute, false);
assert.equal(gdiagPlannerBlockedStatus.aiRetrySafeToExecute, false);
assert.equal(gdiagPlannerBlockedStatus.operatorRecommendedNextFunction, '');
assert.equal(gdiagPlannerBlockedStatus.operatorShouldRunSafeStepNow, false);
assert.equal(gdiagPlannerBlockedStatus.operatorShouldWaitReason, 'urlfetch_authorization_required');
assert.equal(gdiagPlannerBlocked.__state.urlFetchCount, 0);
assert.equal(gdiagPlannerBlocked.__state.gmailSendCount, 0);
assert.equal(gdiagPlannerBlocked.__state.draftCreateCount, 0);
assert.equal(gdiagPlannerBlocked.__state.triggerCreateCount, 0);

const gquota1 = createContext();
gquota1.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
gquota1.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
gquota1.__props.GMAIL_SALES_AI_API_KEY = diagnosticSecret;
applyTodayTargetDate(gquota1);
seedUrlFetchAuthorizationVerified(gquota1);
seedPermissionErrorAiSummary(gquota1);
seedGeminiQuotaBillingDiagnosticState(gquota1);
installFiveAiPendingRows(gquota1);
const gquota1Usage = gquota1.inspectGmailSalesRecoveryUsageLedger();
assert.equal(gquota1Usage.urlFetchAuthorizationVerified, true);
assert.equal(gquota1Usage.aiProviderQuotaBillingBlockedForTargetDate, true);
assert.equal(gquota1Usage.aiProviderQuotaBillingBlockedReason, 'ai_provider_quota_or_billing_required');
assert.equal(gquota1Usage.aiProviderQuotaBillingFixRequired, true);
assert.equal(gquota1Usage.aiProviderQuotaBillingRetrySafeToExecute, false);
assert.equal(gquota1Usage.aiProviderLastRunHadResourceExhausted, true);
assert.equal(gquota1Usage.aiProviderLastResourceExhaustedHttpStatus, 429);
assert.equal(gquota1Usage.aiProviderLastResourceExhaustedStatus, 'RESOURCE_EXHAUSTED');
assert.equal(gquota1Usage.aiProviderQuotaBillingRecommendedAction, 'verify_billing_quota_usage_tier_or_wait_for_rate_limit_reset');
assert.equal(gquota1Usage.aiProviderQuotaBillingBlockSource, 'gemini_diagnostics_probe');
const gquota1Status = gquota1.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gquota1Status.aiProviderPermissionBlockedForTargetDate, true);
assert.equal(gquota1Status.aiProviderQuotaBillingBlockedForTargetDate, true);
assert.equal(gquota1Status.plannedNextAction, 'wait_for_ai_provider_quota_or_billing_fix');
assert.equal(gquota1Status.plannedNextActionReasonCode, 'ai_provider_quota_or_billing_required');
assert.equal(gquota1Status.plannedExpectedApiClass, 'gemini_ai_review');
assert.equal(gquota1Status.plannedExpectedWriteClass, 'none');
assert.equal(gquota1Status.plannedSafeToExecute, false);
assert.equal(gquota1Status.aiRetrySafeToExecute, false);
assert.equal(gquota1Status.operatorRecommendedNextFunction, '');
assert.equal(gquota1Status.operatorShouldRunSafeStepNow, false);
assert.equal(gquota1Status.operatorShouldWaitReason, 'ai_provider_quota_or_billing_required');
const gquota1Step = gquota1.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(gquota1Step.status, 'blocked');
assert.equal(gquota1Step.actionBlockedReason, 'ai_provider_quota_or_billing_required');
assert.equal(gquota1Step.executedActionStatus, 'blocked');
assert.equal(gquota1Step.aiApiCalled, false);
assert.equal(gquota1.__state.urlFetchCount, 0);
assert.equal(gquota1.__state.gmailSendCount, 0);
assert.equal(gquota1.__state.draftCreateCount, 0);
assert.equal(gquota1.__state.triggerCreateCount, 0);
assert.equal(JSON.stringify(gquota1.__state.logs).includes(diagnosticSecret), false);

const gquotaReadiness = gquota1.inspectGmailSalesGeminiPermissionDiagnosticsReadiness({ skipLog: true });
assert.equal(gquotaReadiness.status, 'blocked');
assert.equal(gquotaReadiness.aiProviderDiagnosticProbeEligible, false);
assert.equal(gquotaReadiness.aiProviderDiagnosticProbeBlockedReason, 'ai_provider_quota_or_billing_required');
assert.equal(gquotaReadiness.aiProviderQuotaBillingBlockedForTargetDate, true);
assert.equal(gquotaReadiness.aiProviderQuotaBillingRecommendedAction, 'verify_billing_quota_usage_tier_or_wait_for_rate_limit_reset');
const gquotaRepairReadiness = gquota1.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(gquotaRepairReadiness.status, 'blocked');
assert.equal(gquotaRepairReadiness.aiProviderRepairProbeEligible, false);
assert.equal(gquotaRepairReadiness.aiProviderRepairProbeBlockedReason, 'ai_provider_quota_or_billing_required');
assert.equal(gquotaRepairReadiness.aiProviderPermissionRetrySafeToExecute, false);
const gquotaStatusReadOnly = gquota1.inspectGmailSalesAiProviderQuotaBillingStatus({ skipLog: true });
assert.equal(gquotaStatusReadOnly.event, 'gmail_sales_ai_provider_quota_billing_status');
assert.equal(gquotaStatusReadOnly.mode, 'read_only');
assert.equal(gquotaStatusReadOnly.status, 'blocked');
assert.equal(gquotaStatusReadOnly.aiProviderQuotaBillingBlockedForTargetDate, true);
assert.equal(gquotaStatusReadOnly.aiProviderDiagnosticProbeAttemptCountToday, 3);
assert.equal(gquotaStatusReadOnly.aiProviderDiagnosticProbeEligible, false);
assert.equal(gquotaStatusReadOnly.gmailSendExecuted, false);
assert.equal(gquotaStatusReadOnly.googleSheetsUpdated, false);
assert.equal(gquotaStatusReadOnly.scriptPropertiesUpdated, false);
assert.equal(gquotaStatusReadOnly.aiApiCalled, false);
assert.equal(gquota1.__state.urlFetchCount, 0);

const gdiag1 = installGeminiDiagnosticContext(makeGoogleApiError('PERMISSION_DENIED', 403, 'SERVICE_DISABLED', {
  service: 'generativelanguage.googleapis.com',
  method: 'google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent',
  activationUrl: 'https://example.invalid/activate',
  consumer: 'projects/redacted'
}));
const gdiag1ReadinessWrites = gdiag1.__state.propertyWriteCount + gdiag1.__state.sheetWriteCount + gdiag1.__state.urlFetchCount;
const gdiag1Readiness = gdiag1.inspectGmailSalesGeminiPermissionDiagnosticsReadiness({ skipLog: true });
assert.equal(gdiag1Readiness.event, 'gmail_sales_gemini_permission_diagnostics_readiness');
assert.equal(gdiag1Readiness.mode, 'read_only');
assert.equal(gdiag1Readiness.status, 'pass');
assert.equal(gdiag1Readiness.provider, 'gemini');
assert.equal(gdiag1Readiness.modelNameSanitized, 'gemini-2.5-flash-lite');
assert.equal(gdiag1Readiness.apiKeyPresent, true);
assert.equal(gdiag1Readiness.apiKeyValueLogged, false);
assert.equal(gdiag1Readiness.endpointHostSanitized, 'generativelanguage.googleapis.com');
assert.equal(gdiag1Readiness.endpointVersion, 'v1beta');
assert.equal(gdiag1Readiness.generateContentMethodConfigured, true);
assert.equal(gdiag1Readiness.authPlacement, 'header');
assert.equal(gdiag1Readiness.authValueLogged, false);
assert.equal(gdiag1Readiness.requestUsesApiKeyQuery, false);
assert.equal(gdiag1Readiness.requestUsesAuthorizationHeader, false);
assert.equal(gdiag1Readiness.requestPayloadFixedDiagnosticPrompt, true);
assert.equal(gdiag1Readiness.requestPayloadContainsBusinessData, false);
assert.equal(gdiag1Readiness.permissionBlockActive, true);
assert.equal(gdiag1Readiness.aiProviderDiagnosticProbeEligible, true);
assert.equal(gdiag1Readiness.aiProviderDiagnosticProbeMaxAttemptsPerDay, 3);
assert.equal(gdiag1.__state.propertyWriteCount + gdiag1.__state.sheetWriteCount + gdiag1.__state.urlFetchCount, gdiag1ReadinessWrites);

const gdiag1Probe = gdiag1.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag1Probe.event, 'gmail_sales_gemini_permission_diagnostics_probe');
assert.equal(gdiag1Probe.status, 'blocked');
assert.equal(gdiag1Probe.aiApiCalled, true);
assert.equal(gdiag1Probe.blockedReason, 'gemini_api_error_response');
assert.equal(gdiag1Probe.httpStatus, 403);
assert.equal(gdiag1Probe.transportExceptionPresent, false);
assert.equal(gdiag1Probe.fetchReturnedResponse, true);
assert.equal(gdiag1Probe.fetchResponseCodeAvailable, true);
assert.equal(gdiag1Probe.responseTextAvailable, true);
assert.equal(gdiag1Probe.responseJsonParseAttempted, true);
assert.equal(gdiag1Probe.responseJsonParseSucceeded, true);
assert.equal(gdiag1Probe.responseJsonParseErrorCategory, '');
assert.equal(gdiag1Probe.requestUrlLogged, false);
assert.equal(gdiag1Probe.endpointPathSanitized, '/v1beta/models/{model}:generateContent');
assert.equal(gdiag1Probe.endpointPathSanitized.includes(diagnosticSecret), false);
assert.equal(gdiag1Probe.requestMethod, 'post');
assert.equal(gdiag1Probe.muteHttpExceptionsEnabled, true);
assert.equal(gdiag1Probe.contentTypeConfigured, true);
assert.equal(gdiag1Probe.payloadShapeValid, true);
assert.equal(gdiag1Probe.payloadSizeBytesApprox > 0, true);
assert.equal(gdiag1Probe.authPlacement, 'header');
assert.equal(gdiag1Probe.authValueLogged, false);
assert.equal(gdiag1Probe.requestPayloadFixedDiagnosticPrompt, true);
assert.equal(gdiag1Probe.googleApiErrorStatus, 'PERMISSION_DENIED');
assert.equal(gdiag1Probe.googleApiErrorReason, 'SERVICE_DISABLED');
assert.equal(gdiag1Probe.googleApiErrorService, 'generativelanguage.googleapis.com');
assert.equal(gdiag1Probe.googleApiErrorMethod, 'google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent');
assert.deepEqual(gdiag1Probe.googleApiErrorMetadataKeys.sort(), ['activationUrl', 'consumer', 'method', 'service']);
assert.equal(gdiag1Probe.permissionDiagnosisCategory, 'generative_language_api_disabled');
assert.equal(gdiag1Probe.permissionDiagnosisRecommendedFix, 'enable_generative_language_api_for_key_project');
assert.equal(gdiag1Probe.responseBodyLogged, false);
assert.equal(gdiag1Probe.apiKeyLogged, false);
assert.equal(gdiag1Probe.requestPayloadContainsBusinessData, false);
const gdiag1Payload = JSON.parse(gdiag1.__state.lastFetch.options.payload);
assert.equal(gdiag1Payload.contents[0].parts[0].text, 'Return exactly this JSON: {"ok":true}');
assert.equal(JSON.stringify(gdiag1Payload).includes('candidate'), false);
assert.equal(JSON.stringify(gdiag1Payload).includes('evidence'), false);
assert.equal(JSON.stringify(gdiag1Payload).includes('digest'), false);
assert.equal(JSON.stringify(gdiag1Payload).includes('email'), false);
assert.equal(JSON.stringify(gdiag1Payload).includes('body'), false);
assert.equal(JSON.stringify(gdiag1Payload).includes('snippet'), false);
assert.equal(JSON.stringify(gdiag1.__state.logs).includes(diagnosticSecret), false);
assert.equal(JSON.stringify(gdiag1.__state.logs).includes('activationUrl'), true);
assert.equal(JSON.stringify(gdiag1.__state.logs).includes('https://example.invalid/activate'), false);
const gdiag1Usage = gdiag1.inspectGmailSalesRecoveryUsageLedger();
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeAttemptCountToday, 1);
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastHttpStatus, 403);
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastGoogleApiErrorStatus, 'PERMISSION_DENIED');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastGoogleApiErrorReason, 'SERVICE_DISABLED');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastPermissionDiagnosisCategory, 'generative_language_api_disabled');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastRecommendedFix, 'enable_generative_language_api_for_key_project');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastBlockedReason, 'gemini_api_error_response');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastEndpointPathSanitized, '/v1beta/models/{model}:generateContent');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastAuthPlacement, 'header');
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeLastResponseJsonParseSucceeded, true);
assert.equal(gdiag1Usage.aiProviderDiagnosticProbeFailedRequestCount, 1);

const gdiagException = installGeminiDiagnosticContext({}, 0);
gdiagException.UrlFetchApp.fetch = () => {
  gdiagException.__state.urlFetchCount += 1;
  throw new Error(`Permission denied for https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=${diagnosticSecret}`);
};
const gdiagExceptionProbe = gdiagException.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiagExceptionProbe.status, 'blocked');
assert.equal(gdiagExceptionProbe.blockedReason, 'transport_exception_before_http_response');
assert.equal(gdiagExceptionProbe.httpStatus, 0);
assert.equal(gdiagExceptionProbe.transportExceptionPresent, true);
assert.equal(gdiagExceptionProbe.transportExceptionCategory, 'urlfetch_permission_denied');
assert.equal(gdiagExceptionProbe.transportExceptionMessageCategory, 'urlfetch_permission_denied');
assert.equal(gdiagExceptionProbe.permissionDiagnosisCategory, 'transport_exception_before_http_response');
assert.equal(gdiagExceptionProbe.permissionDiagnosisRecommendedFix, 'inspect_apps_script_urlfetch_transport_and_endpoint_configuration');
assert.equal(gdiagExceptionProbe.fetchReturnedResponse, false);
assert.equal(gdiagExceptionProbe.responseBodyLogged, false);
assert.equal(gdiagExceptionProbe.apiKeyLogged, false);
assert.equal(gdiagExceptionProbe.requestUrlLogged, false);
assert.equal(JSON.stringify(gdiagException.__state.logs).includes(diagnosticSecret), false);
assert.equal(JSON.stringify(gdiagException.__state.logs).includes('generativelanguage.googleapis.com/v1beta/models/x'), false);

const gdiagNoResponse = installGeminiDiagnosticContext({}, 0);
gdiagNoResponse.UrlFetchApp.fetch = () => {
  gdiagNoResponse.__state.urlFetchCount += 1;
  return {};
};
const gdiagNoResponseProbe = gdiagNoResponse.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiagNoResponseProbe.status, 'blocked');
assert.equal(gdiagNoResponseProbe.blockedReason, 'no_http_response_available');
assert.equal(gdiagNoResponseProbe.httpStatus, 0);
assert.equal(gdiagNoResponseProbe.transportExceptionPresent, false);
assert.equal(gdiagNoResponseProbe.transportExceptionCategory, 'no_exception_response_missing');
assert.equal(gdiagNoResponseProbe.permissionDiagnosisCategory, 'malformed_request_before_http_response');

const gdiagMalformed = installGeminiDiagnosticContext({}, 403);
gdiagMalformed.UrlFetchApp.fetch = (url, options) => {
  gdiagMalformed.__state.urlFetchCount += 1;
  gdiagMalformed.__state.lastFetch = { url, options };
  return {
    getResponseCode: () => 403,
    getContentText: () => 'not-json'
  };
};
const gdiagMalformedProbe = gdiagMalformed.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiagMalformedProbe.status, 'blocked');
assert.equal(gdiagMalformedProbe.blockedReason, 'gemini_api_error_response');
assert.equal(gdiagMalformedProbe.httpStatus, 403);
assert.equal(gdiagMalformedProbe.responseTextAvailable, true);
assert.equal(gdiagMalformedProbe.responseJsonParseAttempted, true);
assert.equal(gdiagMalformedProbe.responseJsonParseSucceeded, false);
assert.equal(gdiagMalformedProbe.responseJsonParseErrorCategory, 'response_json_parse_failed');

const gdiag2 = installGeminiDiagnosticContext(makeGoogleApiError('PERMISSION_DENIED', 403, 'API_KEY_SERVICE_BLOCKED', {
  service: 'generativelanguage.googleapis.com',
  method: 'google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent'
}, 'API key service blocked by key restrictions'));
const gdiag2Probe = gdiag2.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag2Probe.permissionDiagnosisCategory, 'api_key_restricted');
assert.equal(gdiag2Probe.permissionDiagnosisRecommendedFix, 'remove_or_correct_api_key_restrictions_for_apps_script');

const gdiag3 = installGeminiDiagnosticContext(makeGoogleApiError('UNAUTHENTICATED', 401, 'API_KEY_INVALID', {}, 'API key not valid'));
const gdiag3Probe = gdiag3.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag3Probe.permissionDiagnosisCategory, 'api_key_invalid_or_revoked');
assert.equal(gdiag3Probe.permissionDiagnosisRecommendedFix, 'create_new_ai_studio_auth_key');

const gdiag4 = installGeminiDiagnosticContext(makeGoogleApiError('NOT_FOUND', 404, 'MODEL_NOT_FOUND', {}, 'Model is not found or not available'), 404);
const gdiag4Probe = gdiag4.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag4Probe.permissionDiagnosisCategory, 'model_not_available_or_not_permitted');
assert.equal(gdiag4Probe.permissionDiagnosisRecommendedFix, 'switch_to_supported_public_model_gemini_2_5_flash_lite');

const gdiag5 = installGeminiDiagnosticContext(makeGoogleApiError('PERMISSION_DENIED', 403, 'ORG_RESTRICTION', {}, 'Request denied by organization policy'));
const gdiag5Probe = gdiag5.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag5Probe.permissionDiagnosisCategory, 'organization_policy_blocked');
assert.equal(gdiag5Probe.permissionDiagnosisRecommendedFix, 'use_personal_google_account_or_unrestricted_project');

const gdiag6 = installGeminiDiagnosticContext({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }, 200);
installFiveAiPendingRows(gdiag6);
const gdiag6Probe = gdiag6.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag6Probe.status, 'pass');
assert.equal(gdiag6Probe.permissionDiagnosisCategory, 'success');
assert.equal(gdiag6Probe.permissionDiagnosisRecommendedFix, 'diagnostics_success_no_permission_error_detected');
const gdiag6After = gdiag6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(gdiag6After.plannedNextAction, 'wait_for_ai_provider_permission_fix');
assert.equal(gdiag6After.plannedSafeToExecute, false);
assert.equal(gdiag6.__state.sheetWriteCount, 0);
assert.equal(gdiag6.__state.gmailSendCount, 0);
assert.equal(gdiag6.__state.draftCreateCount, 0);
assert.equal(gdiag6.__state.triggerCreateCount, 0);

const gdiag7 = installGeminiDiagnosticContext(makeGoogleApiError('PERMISSION_DENIED', 403, 'SERVICE_DISABLED', {
  service: 'generativelanguage.googleapis.com'
}));
gdiag7.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
gdiag7.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
gdiag7.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
const gdiag7Blocked = gdiag7.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(gdiag7Blocked.status, 'blocked');
assert.equal(gdiag7Blocked.blockedReason, 'diagnostic_probe_daily_limit_reached');
assert.equal(gdiag7.__state.urlFetchCount, 3);
assert.equal(gdiag7.__state.gmailSendCount, 0);
assert.equal(gdiag7.__state.draftCreateCount, 0);
assert.equal(gdiag7.__state.triggerCreateCount, 0);

const g429b6 = createContext();
installFiveAiPendingRows(g429b6);
const g429b6Inspect = g429b6.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
const g429b6Usage = g429b6.inspectGmailSalesRecoveryUsageLedger();
[
  'aiProviderRateLimitedToday',
  'aiProviderCooldownInferredFromLastRunSummary',
  'aiProviderLastRunHadHttp429',
  'aiProviderLastRunSummaryFound',
  'aiProviderRateLimitedTargetDate',
  'aiProviderLastRunRateLimitedDigestCount',
  'aiProviderLastRunRequestFailureCount',
  'aiProviderLastRunRequestSuccessCount',
  'aiProviderLastRunCandidateResponseCount',
  'aiProviderLastRunHadPermissionError',
  'aiProviderPermissionBlockedForTargetDate',
  'aiProviderPermissionFixRequired',
  'inspectGmailSalesAiProviderPermissionRepairReadiness',
  'runGmailSalesAiProviderPermissionRepairProbeOnce',
  'inspectGmailSalesAiProviderApiKeyReplacementReadiness',
  'runGmailSalesAiProviderApiKeyReplacementFromSheetOnce',
  'inspectGmailSalesGeminiPermissionDiagnosticsReadiness',
  'runGmailSalesGeminiPermissionDiagnosticsProbeOnce',
  'inspectGmailSalesNoApiRecoveryStatus',
  'inspectGmailSalesNoApiRecoveryBlockerDrilldown',
  'inspectGmailSalesNoApiResidualBlockerOpportunityDrilldown',
  'runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce',
  'gmail_sales_gemini_permission_diagnostics_probe',
  '__ICHI_SECRET_REPAIR__',
  'ai_permission_repair_verified',
  'providerFailureBackfilledOperationCount',
  'providerFailureBackfillSource',
  'aiProviderLastRunSummaryMatchedLedger',
  'aiProviderFailureAccountingComplete',
  'paid_ai_api_disabled_by_policy',
  'no_paid_ai_until_first_revenue',
  'no_api_legacy_evidence_recovery'
].forEach((fieldName) => {
  assert.equal(code.indexOf(fieldName) >= 0, true);
});
assert.equal(/^function inspectGmailSalesNoApiRecoveryBlockerDrilldown\(\) \{/m.test(code), true);
assert.equal(/^function inspectGmailSalesNoApiResidualBlockerOpportunityDrilldown\(\) \{/m.test(code), true);
[
  'ai_recent_rate_limit_non_ai_recovery_available',
  'ai_recent_rate_limit_but_legacy_promotion_available',
  'wait_for_ai_provider_cooldown'
].forEach((reasonCode) => {
  assert.equal(code.indexOf(reasonCode) >= 0, true);
});
[
  'aiProviderRateLimitedToday',
  'aiProviderCooldownInferredFromLastRunSummary',
  'aiProviderLastRunHadHttp429',
  'aiProviderLastRunSummaryFound',
  'aiProviderRateLimitedTargetDate',
  'aiProviderLastRunRateLimitedDigestCount',
  'aiProviderLastRunRequestFailureCount',
  'aiProviderLastRunRequestSuccessCount',
  'aiProviderLastRunCandidateResponseCount',
  'aiProviderPermissionErrorRequestCount',
  'aiProviderPermissionErrorDigestCount',
  'aiProviderPermissionBlockedForTargetDate',
  'aiProviderPermissionFixRequired',
  'aiProviderPermissionRepairVerified',
  'aiProviderPermissionRepairVerifiedAt',
  'aiProviderApiKeyReplacementCountToday',
  'aiProviderApiKeyReplacementLastAt',
  'aiProviderApiKeyReplacementEpoch',
  'aiProviderRepairProbeAttemptCountToday',
  'aiProviderRepairProbeAttemptCountForCurrentEpoch',
  'aiProviderRepairProbeSuccessfulRequestCount',
  'aiProviderRepairProbeFailedRequestCount',
  'aiProviderDiagnosticProbeAttemptCountToday',
  'aiProviderDiagnosticProbeLastPermissionDiagnosisCategory',
  'aiProviderDiagnosticProbeLastRecommendedFix',
  'aiProviderDiagnosticProbeLastBlockedReason',
  'aiProviderNonRetryableFailureCostYen'
].forEach((fieldName) => {
  assert.equal(Object.prototype.hasOwnProperty.call(g429b6Inspect, fieldName), true);
});
[
  'providerFailureBackfilledOperationCount',
  'providerFailureBackfillSource',
  'aiProviderLastRunSummaryFound',
  'aiProviderLastRunSummaryMatchedLedger',
  'aiProviderFailureAccountingComplete',
  'attemptedCostYen',
  'successfulEvaluationCostYen',
  'failedProviderRequestCostYen',
  'aiProviderAttemptedRequestCount',
  'aiProviderSuccessfulRequestCount',
  'aiProviderFailedRequestCount',
  'aiProviderRateLimitedRequestCount',
  'aiProviderPermissionErrorRequestCount',
  'aiProviderPermissionErrorDigestCount',
  'aiProviderPermissionBlockedForTargetDate',
  'aiProviderPermissionFixRequired',
  'aiProviderPermissionRepairVerified',
  'aiProviderPermissionRepairVerifiedAt',
  'aiProviderApiKeyReplacementCountToday',
  'aiProviderApiKeyReplacementLastAt',
  'aiProviderApiKeyReplacementEpoch',
  'aiProviderRepairProbeAttemptCountToday',
  'aiProviderRepairProbeAttemptCountForCurrentEpoch',
  'aiProviderRepairProbeSuccessfulRequestCount',
  'aiProviderRepairProbeFailedRequestCount',
  'aiProviderDiagnosticProbeAttemptCountToday',
  'aiProviderDiagnosticProbeLastAt',
  'aiProviderDiagnosticProbeLastHttpStatus',
  'aiProviderDiagnosticProbeLastGoogleApiErrorStatus',
  'aiProviderDiagnosticProbeLastGoogleApiErrorReason',
  'aiProviderDiagnosticProbeLastPermissionDiagnosisCategory',
  'aiProviderDiagnosticProbeLastRecommendedFix',
  'aiProviderDiagnosticProbeLastTransportExceptionCategory',
  'aiProviderDiagnosticProbeLastTransportExceptionMessageCategory',
  'aiProviderDiagnosticProbeLastBlockedReason',
  'aiProviderDiagnosticProbeLastEndpointPathSanitized',
  'aiProviderDiagnosticProbeLastAuthPlacement',
  'aiProviderDiagnosticProbeLastResponseJsonParseSucceeded',
  'aiProviderDiagnosticProbeSuccessfulRequestCount',
  'aiProviderDiagnosticProbeFailedRequestCount',
  'aiProviderNonRetryableFailureCostYen',
  'paidAiApiDisabledByPolicy',
  'paidAiApiDisabledReason',
  'noApiRecoveryRouteEnabled',
  'noApiRecoveryAttemptCountToday',
  'noApiRecoveryLastAt',
  'noApiRecoveredCountToday',
  'noApiRecoveredByBasis',
  'noApiQuarantineCountToday',
  'noApiShortfallToExact30',
  'noApiLastBlockedReason',
  'noApiAiApiCallPreventedCount'
].forEach((fieldName) => {
  assert.equal(Object.prototype.hasOwnProperty.call(g429b6Usage, fieldName), true);
});

const noapi1 = createContext();
noapi1.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
noapi1.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
noapi1.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
noapi1.__props.GMAIL_SALES_AI_API_KEY = 'x';
installLegacyPromotionFixture(noapi1, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-noapi-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
const noapi1Status = noapi1.inspectGmailSalesNoApiRecoveryStatus({ skipLog: true });
assert.equal(noapi1Status.paidAiApiDisabledByPolicy, true);
assert.equal(noapi1Status.paidAiApiDisabledReason, 'no_paid_ai_until_first_revenue');
assert.equal(Array.isArray(noapi1Status.allowedAiApiProviders), true);
assert.equal(noapi1Status.allowedAiApiProviders.length, 0);
assert.equal(noapi1Status.geminiApiAllowed, false);
assert.equal(noapi1Status.openAiApiAllowed, false);
assert.equal(noapi1Status.externalLlmApiAllowed, false);
assert.equal(noapi1Status.noApiRecoveryRouteEnabled, true);
assert.equal(noapi1Status.noApiSource, 'sheets_legacy_and_local_evidence_only');
assert.equal(noapi1Status.noApiRecoverableCandidateCount, 5);
assert.equal(noapi1Status.noApiManualReviewedRecoverableCount, 0);
assert.equal(noapi1Status.noApiQuarantineCount, 0);
assert.equal(noapi1Status.exact30Satisfied, false);
assert.equal(noapi1Status.noApiRecoverySafeToExecute, true);
assert.equal(noapi1Status.plannedNextAction, 'no_api_legacy_evidence_recovery');
assert.equal(noapi1Status.plannedNextActionReasonCode, 'no_paid_ai_api_policy_active');
assert.equal(noapi1Status.plannedExpectedApiClass, 'none');
assert.equal(noapi1Status.plannedExpectedWriteClass, 'sheets_review_recovery_only');
assert.equal(noapi1Status.operatorRecommendedNextFunction, 'runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce');
assert.equal(noapi1.__state.urlFetchCount, 0);
assert.equal(noapi1.__state.gmailSendCount, 0);
assert.equal(noapi1.__state.draftCreateCount, 0);
assert.equal(noapi1.__state.triggerCreateCount, 0);

const noapi2 = createContext();
noapi2.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
noapi2.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
noapi2.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
noapi2.__props.GMAIL_SALES_AI_API_KEY = 'x';
installLegacyPromotionFixture(noapi2, {
  count: 5,
  sourceTypes: Array.from({ length: 5 }, (_, index) => ['https:', '', `raw-type-noapi-step-${index + 1}.example.invalid`].join('/')),
  currentVerification: false
});
const noapi2Step = noapi2.runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce();
assert.equal(noapi2Step.status, 'pass');
assert.equal(noapi2Step.stepExecuted, 'no_api_legacy_evidence_recovery');
assert.equal(noapi2Step.executedExpectedApiClass, 'none');
assert.equal(noapi2Step.executedExpectedWriteClass, 'sheets_review_recovery_only');
assert.equal(noapi2Step.aiApiCalled, false);
assert.equal(noapi2Step.urlFetchExecuted, false);
assert.equal(noapi2Step.legacyPromotionSucceededCount, 5);
assert.equal(noapi2Step.noApiRecoveredCountToday, 5);
assert.equal(noapi2.__state.urlFetchCount, 0);
assert.equal(noapi2.__state.gmailSendCount, 0);
assert.equal(noapi2.__state.draftCreateCount, 0);
assert.equal(noapi2.__state.triggerCreateCount, 0);

const noapi3 = createContext();
noapi3.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
noapi3.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
noapi3.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
noapi3.__props.GMAIL_SALES_AI_API_KEY = 'x';
installFiveAiPendingRows(noapi3);
applyTodayTargetDate(noapi3);
seedUrlFetchAuthorizationVerified(noapi3);
const noapi3Inspect = noapi3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(noapi3Inspect.paidAiProviderBlocked, true);
assert.equal(noapi3Inspect.plannedNextAction, 'wait_for_no_api_recoverable_inventory_or_manual_exception_review');
assert.equal(noapi3Inspect.plannedNextActionReasonCode, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi3Inspect.plannedExpectedApiClass, 'none');
assert.equal(noapi3Inspect.plannedExpectedWriteClass, 'none');
assert.equal(noapi3Inspect.plannedSafeToExecute, false);
assert.equal(noapi3Inspect.safeToExecute, false);
assert.equal(noapi3Inspect.aiRetrySafeToExecute, false);
assert.equal(noapi3Inspect.operatorRecommendedNextFunction, '');
assert.equal(noapi3Inspect.operatorShouldRunSafeStepNow, false);
assert.equal(noapi3Inspect.operatorShouldWaitReason, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi3Inspect.noApiShortfallToExact30, 30);
const noapi3Status = noapi3.inspectGmailSalesNoApiRecoveryStatus({ skipLog: true });
assert.equal(noapi3Status.noApiProjectedReadyInventoryCount, 0);
assert.equal(noapi3Status.noApiShortfallToExact30, 30);
const noapi3Usage = noapi3.inspectGmailSalesRecoveryUsageLedger();
assert.equal(noapi3Usage.noApiProjectedReadyInventoryCount, 0);
assert.equal(noapi3Usage.noApiShortfallToExact30, 30);
const noapi3Step = noapi3.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(noapi3Step.status, 'blocked');
assert.equal(noapi3Step.executedActionBlockedReason, 'paid_ai_api_disabled_by_policy');
assert.equal(noapi3Step.aiApiCalled, false);
assert.equal(noapi3.__state.urlFetchCount, 0);
assert.equal(noapi3.__state.gmailSendCount, 0);
assert.equal(noapi3.__state.draftCreateCount, 0);
assert.equal(noapi3.__state.triggerCreateCount, 0);

const noapi4 = createContext();
noapi4.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
noapi4.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
noapi4.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
noapi4.__props.GMAIL_SALES_AI_API_KEY = 'x';
applyTodayTargetDate(noapi4);
seedUrlFetchAuthorizationVerified(noapi4);
seedPermissionErrorAiSummary(noapi4);
const noapi4Diag = noapi4.inspectGmailSalesGeminiPermissionDiagnosticsReadiness({ skipLog: true });
assert.equal(noapi4Diag.status, 'blocked');
assert.equal(noapi4Diag.aiProviderDiagnosticProbeBlockedReason, 'paid_ai_api_disabled_by_policy');
const noapi4DiagProbe = noapi4.runGmailSalesGeminiPermissionDiagnosticsProbeOnce();
assert.equal(noapi4DiagProbe.status, 'blocked');
assert.equal(noapi4DiagProbe.blockedReason, 'paid_ai_api_disabled_by_policy');
const noapi4Repair = noapi4.inspectGmailSalesAiProviderPermissionRepairReadiness({ skipLog: true });
assert.equal(noapi4Repair.status, 'blocked');
assert.equal(noapi4Repair.aiProviderRepairProbeBlockedReason, 'paid_ai_api_disabled_by_policy');
const noapi4RepairProbe = noapi4.runGmailSalesAiProviderPermissionRepairProbeOnce();
assert.equal(noapi4RepairProbe.status, 'blocked');
assert.equal(noapi4RepairProbe.blockedReason, 'paid_ai_api_disabled_by_policy');
assert.equal(noapi4.__state.urlFetchCount, 0);
assert.equal(noapi4.__state.gmailSendCount, 0);
assert.equal(noapi4.__state.draftCreateCount, 0);
assert.equal(noapi4.__state.triggerCreateCount, 0);

const noapi5 = createContext();
noapi5.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
noapi5.__props.GMAIL_SALES_AI_PROVIDER = 'gemini';
noapi5.__props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
noapi5.__props.GMAIL_SALES_AI_API_KEY = 'x';
installFiveAiPendingRows(noapi5);
applyTodayTargetDate(noapi5);
seedUrlFetchAuthorizationVerified(noapi5);
seedGeminiQuotaBillingDiagnosticState(noapi5);
const noapi5Inspect = noapi5.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(noapi5Inspect.aiProviderQuotaBillingBlockedForTargetDate, true);
assert.equal(noapi5Inspect.aiProviderQuotaBillingBlockedReason, 'ai_provider_quota_or_billing_required');
assert.equal(noapi5Inspect.paidAiProviderBlocked, true);
assert.equal(noapi5Inspect.plannedNextAction, 'wait_for_no_api_recoverable_inventory_or_manual_exception_review');
assert.equal(noapi5Inspect.plannedNextActionReasonCode, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi5Inspect.plannedExpectedApiClass, 'none');
assert.equal(noapi5Inspect.plannedExpectedWriteClass, 'none');
assert.equal(noapi5Inspect.plannedSafeToExecute, false);
assert.equal(noapi5Inspect.safeToExecute, false);
assert.equal(noapi5Inspect.aiRetrySafeToExecute, false);
assert.equal(noapi5Inspect.operatorRecommendedNextFunction, '');
assert.equal(noapi5Inspect.operatorShouldRunSafeStepNow, false);
assert.equal(noapi5Inspect.operatorShouldWaitReason, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi5Inspect.noApiShortfallToExact30, 30);
const noapi5Step = noapi5.runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce();
assert.equal(noapi5Step.status, 'blocked');
assert.equal(noapi5Step.blockedReason, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi5Step.actionBlockedReason, 'no_api_recoverable_inventory_insufficient');
assert.equal(noapi5Step.aiApiCalled, false);
assert.equal(noapi5.__state.urlFetchCount, 0);
assert.equal(noapi5.__state.gmailSendCount, 0);
assert.equal(noapi5.__state.draftCreateCount, 0);
assert.equal(noapi5.__state.triggerCreateCount, 0);

const noapi6 = createContext();
noapi6.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
installLegacyPromotionFixture(noapi6, {
  count: 4,
  sourceTypes: ['legacy-mail', 'legacy-directory', 'legacy-private', 'legacy-missing'],
  sourceReferences: [
    'mailto:masked-local@example.invalid',
    ['https:', '', 'yelp.com', 'biz', 'masked-place'].join('/'),
    ['https:', '', 'legacy-private.example.invalid', 'contact'].join('/'),
    ['https:', '', 'legacy-missing.example.invalid', 'contact'].join('/')
  ],
  currentVerification: false
});
setSheetValueByHeader(noapi6.__sourceSheet, 4, 'privatePersonalContactFlag', 'true');
setSheetValueByHeader(noapi6.__reviewSheet, 5, 'sourceRowKey', 'missing-source-row-key');
const noapi6BeforeWrites = noapi6.__state.propertyWriteCount + noapi6.__state.sheetWriteCount + noapi6.__state.urlFetchCount + noapi6.__state.gmailSendCount + noapi6.__state.draftCreateCount + noapi6.__state.triggerCreateCount;
const noapi6Drilldown = noapi6.inspectGmailSalesNoApiRecoveryBlockerDrilldown();
assert.equal(noapi6Drilldown.event, 'gmail_sales_no_api_recovery_blocker_drilldown');
assert.equal(noapi6Drilldown.mode, 'read_only');
assert.equal(noapi6Drilldown.paidAiApiDisabledByPolicy, true);
assert.equal(noapi6Drilldown.noApiRecoverableCandidateCount, 0);
assert.equal(noapi6Drilldown.noApiProjectedReadyInventoryCount, 0);
assert.equal(noapi6Drilldown.noApiShortfallToExact30, 30);
assert.equal(noapi6Drilldown.unsupportedSchemeCount >= 1, true);
assert.equal(noapi6Drilldown.businessDirectoryCount >= 1, true);
assert.equal(noapi6Drilldown.privatePersonalContactCount >= 1, true);
assert.equal(noapi6Drilldown.sourceRowNotFoundCount >= 1, true);
assert.equal(noapi6Drilldown.deterministicRuleExpansionSuggestions.includes('add_http_https_public_org_page_classifier'), true);
assert.equal(noapi6Drilldown.deterministicRuleExpansionSuggestions.includes('add_business_directory_strict_company_page_exception'), true);
assert.equal(noapi6Drilldown.deterministicRuleExpansionSuggestions.includes('add_source_row_relink_by_stable_candidate_hash'), true);
assert.equal(noapi6Drilldown.deterministicRuleExpansionSuggestions.includes('not_recoverable_private_personal_contact'), false);
const noapi6SamplesJson = JSON.stringify([
  noapi6Drilldown.unsupportedSchemeSampleSanitized,
  noapi6Drilldown.businessDirectorySampleSanitized,
  noapi6Drilldown.privatePersonalContactSampleSanitized,
  noapi6Drilldown.sourceRowNotFoundSampleSanitized
]);
assert.equal(noapi6SamplesJson.includes('masked-local@'), false);
assert.equal(noapi6SamplesJson.includes('/biz/'), false);
assert.equal(noapi6SamplesJson.includes('/contact'), false);
assert.equal(noapi6SamplesJson.includes('masked-place'), false);
assert.equal(noapi6SamplesJson.includes('mailto:masked-local'), false);
const noapi6LogsJson = JSON.stringify(noapi6.__state.logs);
assert.equal(noapi6LogsJson.includes('masked-local@'), false);
assert.equal(noapi6LogsJson.includes('/biz/'), false);
assert.equal(noapi6LogsJson.includes('/contact'), false);
assert.equal(noapi6LogsJson.includes('masked-place'), false);
assert.equal(noapi6LogsJson.includes('mailto:masked-local'), false);
assert.equal(noapi6.__state.propertyWriteCount + noapi6.__state.sheetWriteCount + noapi6.__state.urlFetchCount + noapi6.__state.gmailSendCount + noapi6.__state.draftCreateCount + noapi6.__state.triggerCreateCount, noapi6BeforeWrites);
assert.equal(noapi6Drilldown.gmailSendExecuted, false);
assert.equal(noapi6Drilldown.gmailDraftCreated, false);
assert.equal(noapi6Drilldown.googleSheetsUpdated, false);
assert.equal(noapi6Drilldown.scriptPropertiesUpdated, false);
assert.equal(noapi6Drilldown.triggerChanged, false);
assert.equal(noapi6Drilldown.aiApiCalled, false);
assert.equal(noapi6Drilldown.urlFetchExecuted, false);

const noapi7 = createContext();
noapi7.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
installLegacyPromotionFixture(noapi7, {
  count: 6,
  sourceTypes: Array.from({ length: 6 }, (_, index) => `legacy-http-public-org-${index + 1}`),
  sourceReferences: [
    'http://public-one.example.invalid/contact',
    'https://public-two.example.invalid/inquiry',
    'http://freemail-public.example.invalid/contact',
    ['https:', '', 'yelp.com', 'biz', 'masked-place'].join('/'),
    'http://suppressed-public.example.invalid/contact',
    'http://missing-public.example.invalid/contact'
  ],
  sourceRowOverrides: [
    { email: 'info@public-one.example.invalid' },
    { email: 'info@public-two.example.invalid' },
    { email: 'masked@gmail.com' },
    { email: 'info@directory.example.invalid' },
    { email: 'info@suppressed-public.example.invalid', unsubscribe: 'true', doNotContact: 'true' },
    { email: 'info@missing-public.example.invalid' }
  ],
  currentVerification: false
});
setSheetValueByHeader(noapi7.__reviewSheet, 6, 'sourceRowKey', 'missing-source-row-key');
const noapi7Status = noapi7.inspectGmailSalesNoApiRecoveryStatus({ skipLog: true });
assert.equal(noapi7Status.noApiHttpHttpsPublicOrgPageCandidateCount, 5);
assert.equal(noapi7Status.noApiHttpHttpsPublicOrgPageEligibleCount, 2);
assert.equal(noapi7Status.noApiHttpHttpsPublicOrgPageBlockedCount, 3);
assert.equal(noapi7Status.noApiHttpHttpsPublicOrgPageBlockedReasonCounts.freemail_domain, 1);
assert.equal(noapi7Status.noApiHttpHttpsPublicOrgPageBlockedReasonCounts.business_directory, 1);
assert.equal(noapi7Status.noApiRecoverableCandidateCount, 2);
assert.equal(noapi7Status.noApiValidBusinessContactExceptionRecoverableCount, 2);
assert.equal(noapi7Status.noApiProjectedReadyInventoryCount, 2);
assert.equal(noapi7Status.noApiShortfallToExact30, 28);
assert.equal(noapi7Status.plannedNextAction, 'no_api_legacy_evidence_recovery');
assert.equal(noapi7Status.operatorRecommendedNextFunction, 'runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce');
const noapi7Drilldown = noapi7.inspectGmailSalesNoApiRecoveryBlockerDrilldown_({ skipLog: true });
assert.equal(noapi7Drilldown.noApiHttpHttpsPublicOrgPageEligibilityRuleId, 'no_api_http_https_public_org_page_v1');
assert.equal(noapi7Drilldown.noApiHttpHttpsPublicOrgPageWouldRecoverCount, 2);
assert.equal(noapi7Drilldown.noApiHttpHttpsPublicOrgPageStillShortfallToExact30, 28);
assert.equal(noapi7Drilldown.noApiHttpHttpsPublicOrgPageSampleSanitized.length <= 5, true);
const noapi7SampleJson = JSON.stringify(noapi7Drilldown.noApiHttpHttpsPublicOrgPageSampleSanitized);
assert.equal(noapi7SampleJson.includes('info@'), false);
assert.equal(noapi7SampleJson.includes('/contact'), false);
assert.equal(noapi7SampleJson.includes('/inquiry'), false);
assert.equal(noapi7SampleJson.includes('/biz/'), false);
assert.equal(noapi7SampleJson.includes('masked-place'), false);
const noapi7Step = noapi7.runGmailSalesNoApiLegacyEvidenceRecoveryStepOnce();
assert.equal(noapi7Step.status, 'pass');
assert.equal(noapi7Step.noApiRecoveredCount, 2);
assert.equal(noapi7Step.noApiRecoveredByBasis.valid_business_contact_exception, 2);
assert.equal(noapi7Step.noApiRecoveredByRuleId.no_api_http_https_public_org_page_v1, 2);
assert.equal(noapi7Step.readyInventoryCountAfterRecovery, 2);
assert.equal(noapi7Step.noApiStillShortfallToExact30, 28);
assert.equal(noapi7Step.aiApiCalled, false);
assert.equal(noapi7Step.urlFetchExecuted, false);
assert.equal(noapi7Step.gmailSendExecuted, false);
assert.equal(noapi7Step.gmailDraftCreated, false);
assert.equal(noapi7Step.triggerChanged, false);
assert.equal(String(noapi7.readSheetObjects_(noapi7.__sourceSheet).items[0].row.contactBasisType || ''), 'valid_business_contact_exception');
assert.equal(String(noapi7.readSheetObjects_(noapi7.__sourceSheet).items[0].row.deterministicRuleId || ''), 'no_api_http_https_public_org_page_v1');
assert.equal(String(noapi7.readSheetObjects_(noapi7.__sourceSheet).items[0].row.recoveredFrom || ''), 'strict_http_https_public_org_page_reference');
assert.equal(/approvedBasisType:\s*['"]manual_legal_reviewed['"]/.test(code), false);
assert.equal(noapi7.__state.urlFetchCount, 0);
assert.equal(noapi7.__state.gmailSendCount, 0);
assert.equal(noapi7.__state.draftCreateCount, 0);
assert.equal(noapi7.__state.triggerCreateCount, 0);

const noapi8 = createContext();
noapi8.__props.GMAIL_SALES_PAID_AI_API_DISABLED_BY_POLICY = 'true';
const noapi8References = Array.from({ length: 30 }, (_, index) => ['https:', '', `ready-${index + 1}.example.invalid`, 'contact'].join('/'));
noapi8References[9] = 'public-relink-one.example.invalid';
noapi8References[10] = 'public-relink-two.example.invalid';
noapi8References[11] = ['https:', '', 'yelp.com', 'biz', 'masked-directory'].join('/');
noapi8References[12] = 'public-domain.example.invalid';
noapi8References[13] = 'www.public-url.example.invalid/contact';
noapi8References[14] = 'mailto:masked-local@example.invalid';
noapi8References[15] = 'tel:+810000000000';
noapi8References[16] = 'instagram.com/masked-business';
noapi8References[17] = 'legacy text reference';
noapi8References[18] = 'masked-map-reference';
for (let index = 19; index < 29; index += 1) noapi8References[index] = ['https:', '', `private-${index}.example.invalid`, 'contact'].join('/');
noapi8References[29] = ['https:', '', 'missing-signal.example.invalid', 'contact'].join('/');
const noapi8Overrides = Array.from({ length: 30 }, (_, index) => ({
  email: `info@ready-${index + 1}.example.invalid`,
  businessContactEvidence: 'official inquiry contact form for business partnerships',
  publicSource: 'official public inquiry page'
}));
noapi8Overrides[9].email = 'info@public-relink-one.example.invalid';
noapi8Overrides[10].email = 'info@public-relink-two.example.invalid';
noapi8Overrides[11].email = 'info@directory.example.invalid';
noapi8Overrides[12].email = 'info@public-domain.example.invalid';
noapi8Overrides[13].email = 'info@public-url.example.invalid';
noapi8Overrides[14].email = 'masked@gmail.com';
noapi8Overrides[15].email = 'info@tel-reference.example.invalid';
noapi8Overrides[16].email = 'info@social-reference.example.invalid';
noapi8Overrides[17].email = 'info@text-reference.example.invalid';
noapi8Overrides[18].email = 'info@map-reference.example.invalid';
for (let index = 19; index < 29; index += 1) {
  noapi8Overrides[index].email = `masked${index}@gmail.com`;
  noapi8Overrides[index].privatePersonalContactFlag = 'true';
}
noapi8Overrides[29].email = 'info@missing-signal.example.invalid';
noapi8Overrides[29].businessContactEvidence = '';
noapi8Overrides[29].publicSource = '';
installLegacyPromotionFixture(noapi8, {
  count: 30,
  sourceTypes: Array.from({ length: 30 }, (_, index) => index < 9 ? 'official_site' : `legacy-residual-${index + 1}`),
  sourceReferences: noapi8References,
  sourceRowOverrides: noapi8Overrides,
  currentVerification: false
});
for (let rowIndex = 2; rowIndex <= 10; rowIndex += 1) {
  const rowNumber = rowIndex - 1;
  const sourceReference = ['https:', '', `ready-${rowNumber}.example.invalid`, 'contact'].join('/');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'sourceReference', sourceReference);
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'sourceReferenceHash', noapi8.buildGmailSalesSourceReferenceHash_('official_site', sourceReference));
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'contactBasisType', 'valid_business_contact_exception');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'contactBasisRecordedAt', '2026-07-03T00:00:00.000Z');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'lastVerifiedAt', '2026-07-03T00:00:00.000Z');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'suppressionCheckedAt', '2026-07-03T00:00:00.000Z');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'historyCheckedAt', '2026-07-03T00:00:00.000Z');
  setSheetValueByHeader(noapi8.__sourceSheet, rowIndex, 'optOutAvailable', 'true');
}
setSheetValueByHeader(noapi8.__reviewSheet, 11, 'sourceRowKey', 'missing-source-row-key-1');
setSheetValueByHeader(noapi8.__reviewSheet, 12, 'sourceRowKey', 'missing-source-row-key-2');
noapi8.inspectGmailSalesContactBasisCoverage_ = () => ({
  event: 'gmail_sales_contact_basis_coverage',
  mode: 'read_only',
  sourceCandidateCount: 30,
  fieldsSupported: true,
  approvedBasisCount: 9,
  eligibleAfterBasisCheckCount: 9,
  operationalCandidateReady: false,
  blockedReasons: ['eligible_basis_count_below_30'],
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  scriptPropertiesUpdated: false
});
noapi8.buildGmailSalesNoApiRecoveryStatus_ = () => ({
  event: 'gmail_sales_no_api_recovery_status',
  mode: 'read_only',
  status: 'blocked',
  targetDate: '2026-07-03',
  paidAiApiDisabledByPolicy: true,
  paidAiApiDisabledReason: 'no_paid_ai_until_first_revenue',
  noApiRecoveryRouteEnabled: true,
  readyInventoryCount: 9,
  manifestReady: false,
  exactThirtyRequiredCount: 30,
  noApiRecoverableCandidateCount: 0,
  noApiProjectedReadyInventoryCount: 9,
  noApiShortfallToExact30: 21,
  exact30Satisfied: false,
  noApiRecoverySafeToExecute: false,
  noApiRecoveryBlockedReason: 'no_api_recoverable_inventory_insufficient',
  legacyPromotionPrimaryBlockedReasonCounts: {
    source_row_not_found: 2,
    business_directory: 1,
    unsupported_scheme: 7,
    private_personal_contact: 10
  },
  legacyPromotionSecondaryBlockedReasonCounts: {
    freemail_domain: 10,
    email_domain_host_mismatch: 1
  },
  legacyPromotionAllBlockedReasonCounts: {
    source_row_not_found: 2,
    business_directory: 1,
    unsupported_scheme: 7,
    private_personal_contact: 10,
    freemail_domain: 10,
    email_domain_host_mismatch: 1
  },
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  scriptPropertiesUpdated: false,
  triggerChanged: false,
  aiApiCalled: false,
  urlFetchExecuted: false
});
const noapi8BeforeWrites = noapi8.__state.propertyWriteCount + noapi8.__state.sheetWriteCount + noapi8.__state.urlFetchCount + noapi8.__state.gmailSendCount + noapi8.__state.draftCreateCount + noapi8.__state.triggerCreateCount;
const noapi8Residual = noapi8.inspectGmailSalesNoApiResidualBlockerOpportunityDrilldown();
assert.equal(noapi8Residual.event, 'gmail_sales_no_api_residual_blocker_opportunity_drilldown');
assert.equal(noapi8Residual.mode, 'read_only');
assert.equal(noapi8Residual.readyInventoryCount, 9);
assert.equal(noapi8Residual.noApiShortfallToExact30, 21);
assert.equal(noapi8Residual.noApiRecoverableCandidateCount, 0);
assert.equal(noapi8Residual.sourceRowNotFoundCount, 2);
assert.equal(noapi8Residual.sourceRowRelinkOpportunityCount, 2);
assert.equal(noapi8Residual.businessDirectoryCount >= 1, true);
assert.equal(noapi8Residual.businessDirectoryBlockedReasonCounts.business_directory_default_blocked >= 1, true);
assert.equal(noapi8Residual.unsupportedSchemeCount >= 7, true);
assert.equal(noapi8Residual.unsupportedSchemeClassCounts.domain_only >= 1, true);
assert.equal(noapi8Residual.unsupportedSchemeClassCounts.url_without_scheme >= 1, true);
assert.equal(noapi8Residual.privatePersonalContactExcludedCount >= 10, true);
assert.equal(noapi8Residual.freemailDomainExcludedCount >= 10, true);
assert.equal(noapi8Residual.estimatedAdditionalRecoverableUpperBound, noapi8Residual.sourceRowRelinkOpportunityCount + noapi8Residual.businessDirectoryStrictExceptionOpportunityCount + noapi8Residual.unsupportedSchemeOpportunityCount);
assert.equal(noapi8Residual.estimatedReadyInventoryIfAllSafeRulesAdded, noapi8Residual.readyInventoryCount + noapi8Residual.estimatedAdditionalRecoverableUpperBound);
assert.equal(noapi8Residual.estimatedShortfallAfterAllSafeRules, Math.max(0, 30 - noapi8Residual.estimatedReadyInventoryIfAllSafeRulesAdded));
assert.equal(noapi8Residual.deterministicRuleExpansionSuggestions.includes('keep_excluded_private_personal_contact'), true);
assert.equal(noapi8Residual.deterministicRuleExpansionSuggestions.includes('no_api_source_row_relink_by_stable_identity_v1'), true);
assert.equal(noapi8Residual.operatorRecommendedNextFunction, '');
assert.equal(noapi8Residual.operatorRecommendedNextFunctionReason, 'read_only_residual_blocker_diagnosis_only');
const noapi8ResidualJson = JSON.stringify(noapi8Residual);
[
  'masked-local@',
  'info@',
  '/contact',
  '/biz/',
  'masked-directory',
  '+810000000000',
  'AIza',
  'sk-'
].forEach((forbidden) => {
  assert.equal(noapi8ResidualJson.includes(forbidden), false);
});
assert.equal(noapi8.__state.propertyWriteCount + noapi8.__state.sheetWriteCount + noapi8.__state.urlFetchCount + noapi8.__state.gmailSendCount + noapi8.__state.draftCreateCount + noapi8.__state.triggerCreateCount, noapi8BeforeWrites);
assert.equal(noapi8Residual.gmailSendExecuted, false);
assert.equal(noapi8Residual.gmailDraftCreated, false);
assert.equal(noapi8Residual.googleSheetsUpdated, false);
assert.equal(noapi8Residual.scriptPropertiesUpdated, false);
assert.equal(noapi8Residual.triggerChanged, false);
assert.equal(noapi8Residual.aiApiCalled, false);
assert.equal(noapi8Residual.urlFetchExecuted, false);

assert.equal(g4292.__state.gmailSendCount, 0);
assert.equal(g4292.__state.draftCreateCount, 0);
assert.equal(g4292.__state.triggerCreateCount, 0);

assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesProductionControlLoop\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesDailyAutomationTrigger\s*\(/g) || []).length, 1);
assert.equal(/approvedBasisType:\s*['"]manual_legal_reviewed['"]/.test(code), false);

assert.equal(JSON.stringify(s1Step).indexOf('providerErrorCategoryCounts'), -1);
assert.equal(s1.__state.lockAttempts, 1);
assert.equal(s1.__state.urlFetchCount, 0);
assert.equal(s1.__state.gmailSendCount, 0);
assert.equal(s1.__state.draftCreateCount, 0);
assert.equal(s1.__state.triggerCreateCount, 0);

console.log(JSON.stringify({
  automatedEvidenceRecoveryStateMachineTestPassed: true,
  fixtureR1ConstantTimeEqualsDefined: true,
  fixtureR2UnchangedDigestSkippedCount: inspected.unchangedDigestSkippedCount,
  fixtureR2ChangedDigestEligibleCount: inspected.changedDigestEligibleCount,
  fixtureR3RejectedDigestPersisted: true,
  fixtureR4ProviderFailureDigestPersisted: false,
  fixtureR5ParseFailureDigestPersisted: false,
  fixtureR6NextAction: productionLike.nextAction,
  fixtureR7StepExecuted: r7Step.stepExecuted,
  fixtureR8ChangedDigestEligibleCount: r8Inspect.changedDigestEligibleCount,
  fixtureR9TerminalPolicyHoldCount: r9Inspect.aiTerminalPolicyHoldCount,
  fixtureR10EstimatedCostYen: inspected.estimatedCostYen,
  fixtureR10BudgetRemainingYen: inspected.budgetRemainingYen,
  fixtureR11SafeStepLockAttempts: r7.__state.lockAttempts,
  fixtureR12SendAuthorityCallCount: r7.__state.sendAuthorityCallCount,
  fixtureS1StepExecuted: s1Step.stepExecuted,
  fixtureS1GroundedDiscoveryCallCount: s1.__state.groundedDiscoveryCallCount,
  fixtureS2ProbeValid: s2.sourceReferenceCellContractLastProbeValid,
  fixtureS3ProbeFailed: s3Step.evidenceRecoveryFailedCount,
  fixtureS4NextStepDiscoveryCallCount: s4.__state.groundedDiscoveryCallCount,
  fixtureS5DiscoveryLoopPrevented: s5.__state.groundedDiscoveryCallCount === 0,
  fixtureS6BlockedReason: s6Step.blockedReason,
  fixtureS7StaleManifestReady: s7Manifest.manifestReady,
  fixtureT1CumulativeEstimatedCostYen: t1Inspect.cumulativeEstimatedCostYen,
  fixtureT1BudgetRemainingYen: t1Inspect.budgetRemainingYen,
  fixtureT2DuplicateUsageDeduped: t2Usage.cumulativeEstimatedCostYen === 7,
  fixtureT3ReadinessCountsMatch: t3Inspect.sourceReferenceEligibleCellCount === t3DirectReadiness.sourceReferenceEligibleCellCount,
  fixtureT4BudgetGateBlockedDiscovery: t4.__state.groundedDiscoveryCallCount === 0,
  fixtureU1BackfilledAiCostYen: u1Ledger.cumulativeEstimatedCostYen,
  fixtureU2BackfilledGroundingCostYen: u2Ledger.cumulativeEstimatedCostYen,
  fixtureU3CurrentActionIncludedCostYen: u3Step.cumulativeEstimatedCostYen,
  fixtureU4MissingOperationIdStable: u4Second.recoveryUsageOperationCount === 1,
  fixtureU5GroundingStableKeyDeduped: u5Second.cumulativeEstimatedCostYen === 3,
  fixtureU6GroundingLogSuppressed: u6.__state.logs.length === 0,
  fixtureU7PublicGroundingLogPreserved: u7.__state.logs.length === 1,
  fixtureU8BudgetGateUsesCumulative: u8.__state.groundedDiscoveryCallCount === 0,
  fixtureU9PlannedNextAction: u9Step.plannedNextAction,
  fixtureV1AiSafeStepCostRecorded: v1Step.cumulativeEstimatedCostYen,
  fixtureV2AiSafeStepDeduped: v2Usage.recoveryUsageOperationCount === 1,
  fixtureV3ExecutedAction: v3Step.executedAction,
  fixtureV3PlannedNextAction: v3Step.plannedNextAction,
  fixtureV4ReadOnlyPlannedNextAction: v4Inspect.plannedNextAction,
  fixtureV5AiBudgetGateBlocked: v5.__state.aiWorkerCallCount === 0,
  fixtureV6GroundingPromptGateBlocked: v6.__state.groundedDiscoveryCallCount === 0,
  fixtureV7GroundingPromptGateAllows: v7Inspect.groundingPromptBudgetSufficient,
  fixtureW1MondayPreflightReadOnly: w1Preflight.mode === 'read_only',
  fixtureW2PacificResetBasis: w1Preflight.geminiRateLimitResetBasis,
  fixtureW3SundayNoSend: w3Preflight.isSundayNoSend && !w3Preflight.sendAllowed,
  fixtureW4MondayRecoveryAllowedSendGated: w4Preflight.recoveryAllowed && !w4Preflight.sendAllowed,
  fixtureW5PromptInsufficientAction: w5Preflight.recommendedMondayAction,
  fixtureW6PromptSufficientAction: w6Preflight.recommendedMondayAction,
  fixtureW7CanonicalRepairPlanned: w7Inspect.plannedNextAction,
  fixtureW8SourceReferenceNotRepairableNoApi: w8Preflight.aiApiCalled === false,
  fixtureW9CanonicalRepairSafeStep: w9Step.stepExecuted,
  fixtureW10NoOpLoopBlocked: w10Step.actionBlockedReason,
  fixtureW11FreePromptLimit: w11FreeConfig.effectiveGroundingDailyPromptLimit,
  fixtureW11PaidPromptLimit: w11PaidConfig.effectiveGroundingDailyPromptLimit,
  fixtureS8SummaryLogCompact: JSON.stringify(s1Step).indexOf('providerErrorCategoryCounts') === -1,
  fixtureS9SafeStepLockAttempts: s1.__state.lockAttempts,
  fixtureS10UrlFetchCount: s1.__state.urlFetchCount,
  actualGmailSend: r7.__state.gmailSendCount,
  actualDraftCreate: r7.__state.draftCreateCount,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
