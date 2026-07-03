import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

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
    GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED: 'false'
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
  const context = {
    console,
    Date,
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
      ProtectionType: { RANGE: 'RANGE' }
    },
    ScriptApp: {
      newTrigger: () => { state.triggerCreateCount += 1; return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }; },
      getProjectTriggers: () => []
    },
    MailApp: { sendEmail: () => { state.gmailSendCount += 1; } },
    GmailApp: { createDraft: () => { state.draftCreateCount += 1; } },
    UrlFetchApp: { fetch: () => { state.urlFetchCount += 1; return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    Utilities: {
      formatDate: () => '2026-07-03',
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
  context.getGmailSalesOperationalDayPolicy_ = () => ({ isWeeklyReviewDay: false, isOperationalDay: true, reason: 'monday_to_saturday' });
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
    'contactBasisRecordedAt', 'contactBasisSourceType', 'contactBasisSourceReferenceHash', 'name',
    'publicSource', 'sentStatus', 'replyStatus', 'sendState', 'doNotContact', 'unsubscribe'
  ]));
  const sourceSheet = new FakeSheet('Source', headers, sourceRows, context.__state);
  const reviewSheet = new FakeSheet('Review', headers, reviewRows, context.__state);
  context.__sourceSheet = sourceSheet;
  context.__reviewSheet = reviewSheet;
  context.getGmailSalesContactBasisReviewContext_ = () => ({
    ok: true,
    config: {},
    spreadsheet: {},
    sourceSheet,
    reviewSheet,
    reviewTabName: 'Review'
  });
  return { headers, sourceSheet, reviewSheet };
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
assert.equal(v6Inspect.actionBlockedReason, 'grounding_daily_prompt_limit_reached');
assert.equal(v6Inspect.plannedGroundingPromptRequestCount, 3);
assert.equal(v6Inspect.groundingPromptBudgetSufficient, false);
v6.runGmailSalesGroundedOfficialSourceDiscoveryInternal_ = () => {
  v6.__state.groundedDiscoveryCallCount += 1;
  return { status: 'pass', estimatedCostYen: 3 };
};
const v6Step = v6.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(v6Step.actionStatus, 'blocked');
assert.equal(v6Step.actionBlockedReason, 'grounding_daily_prompt_limit_reached');
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
v7.__props.GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY = '30';
v7.__props.GMAIL_SALES_GROUNDING_PROMPT_REQUEST_COUNT_TODAY = '20';
const v7Inspect = v7.inspectGmailSalesAutomatedEvidenceRecoveryStatus_({ skipLog: true });
assert.equal(v7Inspect.safeToExecute, true);
assert.equal(v7Inspect.groundingPromptBudgetSufficient, true);

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
