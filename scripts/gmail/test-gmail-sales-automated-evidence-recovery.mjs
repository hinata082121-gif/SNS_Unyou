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
  getRange(row, col, numRows = 1, numCols = 1) { return new FakeRange(this, row, col, numRows, numCols, this.state); }
  getCell(row, col) { return ((this.values[row - 1] || [])[col - 1]) || ''; }
  setCell(row, col, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < col) this.values[row - 1].push('');
    this.values[row - 1][col - 1] = value;
  }
}

function createContext() {
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
    SpreadsheetApp: { flush: () => { state.flushCount += 1; } },
    ScriptApp: {
      newTrigger: () => { state.triggerCreateCount += 1; return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }; },
      getProjectTriggers: () => []
    },
    MailApp: { sendEmail: () => { state.gmailSendCount += 1; } },
    GmailApp: { createDraft: () => { state.draftCreateCount += 1; } },
    UrlFetchApp: { fetch: () => { state.urlFetchCount += 1; return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    Utilities: {
      formatDate: () => '2026-07-03',
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
r7.inspectGmailSalesOfficialEvidenceEnrichmentReadiness = () => ({ evidenceEnrichmentEligibleCount: 1, enrichmentEligibilityReasonCounts: {}, enrichmentReadinessInvariantValid: true });
r7.inspectGmailSalesOfficialEvidenceFetchReadiness = () => ({ fetchReadinessValid: true, fetchEligibleCount: 1 });
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
  actualGmailSend: r7.__state.gmailSendCount,
  actualDraftCreate: r7.__state.draftCreateCount,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
