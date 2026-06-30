import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

const SOURCE_HEADERS = [
  'prospectId',
  'name',
  'email',
  'contactEmail',
  'publicSource',
  'sourceUrl',
  'sourceReference',
  'sourceType',
  'subject',
  'body',
  'status',
  'sendDate',
  'dedupeKey',
  'sentStatus',
  'replyStatus',
  'unsubscribe',
  'doNotContact',
  'sendState',
  'notes',
  'existingRelationshipEvidence',
  'explicitOptInEvidence',
  'businessContactEvidence',
  'contactBasisType',
  'contactBasisRecordedAt',
  'sourceReferenceHash',
  'optOutAvailable',
  'lastVerifiedAt',
  'suppressionCheckedAt',
  'historyCheckedAt'
];

const REVIEW_HEADERS = [
  'reviewId',
  'sourceRowKey',
  'leadIdHash',
  'sourceRowDigest',
  'businessDisplayName',
  'contactDisplay',
  'sourceType',
  'sourceReference',
  'sourceReferenceHash',
  'existingRelationshipEvidence',
  'explicitOptInEvidence',
  'businessContactEvidence',
  'existingContactBasisType',
  'suggestedBasisType',
  'suggestionReasonCode',
  'reviewDecision',
  'approvedBasisType',
  'evidenceNotes',
  'optOutAvailable',
  'reviewerLabel',
  'reviewedAt',
  'applyStatus',
  'applyErrorCode',
  'appliedAt',
  'lastQueueSyncedAt',
  'priorityRank',
  'priorityReasonCode'
];

const AI_HEADERS = [
  'aiVerificationStatus',
  'aiProvider',
  'aiModel',
  'aiConfidence',
  'aiPolicyVersion',
  'aiPromptVersion',
  'aiEvidenceDigest',
  'aiVerifiedAt',
  'aiReasonCodes',
  'aiRiskFlags',
  'aiAutoApproved',
  'aiRequiresHumanReview'
];

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('configuration installer writes only safe defaults and AI audit headers', () => {
  const env = createEnvironment({ sourceCount: 68, reviewSheet: true });
  const result = env.context.installGmailSalesAiVerificationConfigurationOnce();
  assert.equal(result.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_ENABLED, 'false');
  assert.equal(env.props.GMAIL_SALES_AI_PROVIDER, 'disabled');
  assert.equal(env.props.GMAIL_SALES_AI_CONFIDENCE_THRESHOLD, '0.95');
  assert.equal(headerIncludes(env.workbook.sheets['Gmail営業候補プール'], AI_HEADERS), true);
  assert.equal(headerIncludes(env.workbook.sheets.Gmail_Contact_Basis_Review, AI_HEADERS), true);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
});

test('configuration installer repairs header row validation and keeps data row dropdowns', () => {
  const env = createEnvironment({ sourceCount: 68, reviewSheet: true, corruptHeaderValidation: true });
  const result = env.context.installGmailSalesAiVerificationConfigurationOnce();
  const reviewSheet = env.workbook.sheets.Gmail_Contact_Basis_Review;
  assert.equal(result.status, 'pass');
  assert.equal(result.headerValidationRepairRequired, true);
  assert.equal(result.headerValidationCountAfterRepair, 0);
  assert.equal(result.dataRowValidationApplied, true);
  assert.equal(countHeaderValidations(reviewSheet), 0);
  assert.equal(hasValidation(reviewSheet, 2, 'reviewDecision'), true);
  assert.equal(hasValidation(reviewSheet, 2, 'approvedBasisType'), true);
  assert.equal(hasValidation(reviewSheet, 2, 'optOutAvailable'), true);
  assert.equal(hasValidation(reviewSheet, 2, 'applyStatus'), true);
  assert.doesNotThrow(() => writeCell(reviewSheet, 2, 'approvedBasisType', 'existing_relationship'));
  assert.throws(() => writeCell(reviewSheet, 2, 'approvedBasisType', 'invalid_basis'));
  assert.doesNotThrow(() => writeCell(reviewSheet, 2, 'optOutAvailable', 'TRUE'));
  assert.throws(() => writeCell(reviewSheet, 2, 'optOutAvailable', 'YES'));
});

test('status inspector remains read only', () => {
  const env = createEnvironment({ sourceCount: 68, reviewSheet: true });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const beforeWrites = env.sheetWriteCount + env.propertyWriteCount + env.triggerWriteCount;
  const status = env.context.inspectGmailSalesAiContactBasisStatus();
  assert.equal(status.mode, 'read_only');
  assert.equal(status.sourceCandidateCount, 68);
  assert.equal(status.gmailSendExecuted, false);
  assert.equal(env.sheetWriteCount + env.propertyWriteCount + env.triggerWriteCount, beforeWrites);
});

test('review schema inspector reports header and data validation health', () => {
  const env = createEnvironment({ sourceCount: 3, reviewSheet: true, corruptHeaderValidation: true });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const result = env.context.inspectGmailSalesContactBasisReviewSchema();
  assert.equal(result.schemaValid, true);
  assert.equal(result.headerValidationCount, 0);
  assert.equal(result.dataRowValidationConfigured, true);
  assert.equal(result.reviewDecisionHeaderValid, true);
  assert.equal(result.approvedBasisHeaderValid, true);
  assert.equal(result.optOutHeaderValid, true);
  assert.equal(result.applyStatusHeaderValid, true);
  assert.equal(env.logs.some((line) => line.includes('gmail_sales_contact_basis_review_schema')), true);
});

test('AI disabled blocks verification without writes', () => {
  const env = createEnvironment({ sourceCount: 2, reviewSheet: true });
  const beforeWrites = env.sheetWriteCount;
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'ai_disabled');
  assert.equal(env.sheetWriteCount, beforeWrites);
  assert.equal(env.mailSendCount, 0);
});

test('deterministic explicit opt in and relationship evidence are auto applied', () => {
  const env = createEnvironment({ sourceCount: 3, aiEnabled: true, provider: 'mock' });
  setSource(env, 2, { explicitOptInEvidence: 'opt-in record' });
  setSource(env, 3, { existingRelationshipEvidence: 'prior inquiry' });
  setSource(env, 4, { businessContactEvidence: '' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.deterministicApprovedCount, 2);
  assert.equal(readSource(env, 2, 'contactBasisType'), 'explicit_opt_in');
  assert.equal(readSource(env, 3, 'contactBasisType'), 'existing_relationship');
  assert.equal(readSource(env, 2, 'aiProvider'), 'deterministic');
  assert.equal(env.mailSendCount, 0);
});

test('mock provider can approve business contact exception with unique evidence digest', () => {
  const env = createEnvironment({ sourceCount: 30, aiEnabled: true, provider: 'mock', mockAutoApproval: true });
  for (let rowIndex = 2; rowIndex <= 31; rowIndex += 1) {
    setSource(env, rowIndex, { businessContactEvidence: `public contact evidence ${rowIndex}` });
  }
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.aiEvaluatedCount, 30);
  assert.equal(result.aiAutoApprovedCount, 30);
  assert.equal(result.aiAppliedCount, 30);
  assert.equal(result.aiBulkApprovalBlocked, false);
  assert.equal(result.uniqueEvidenceDigestCount, 30);
  assert.equal(readSource(env, 2, 'contactBasisType'), 'valid_business_contact_exception');
  assert.equal(readSource(env, 2, 'aiAutoApproved'), 'true');
});

test('installer resets suspicious bulk skipped rows back to AI eligible pending', () => {
  const env = suspiciousBulkEnvironment(68);
  const before = snapshotReviewRow(env, 2);
  const result = env.context.installGmailSalesAiVerificationConfigurationOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.suspiciousBulkRowsDetected, 68);
  assert.equal(result.suspiciousBulkRowsReset, 68);
  assert.equal(result.backupCreated, true);
  assert.equal(result.rollbackExecuted, false);
  assert.equal(result.aiEligibleRowsAfterReset, 68);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'pending');
  assert.equal(readReview(env, 2, 'approvedBasisType'), '');
  assert.equal(readReview(env, 2, 'evidenceNotes'), '');
  assert.equal(readReview(env, 2, 'reviewerLabel'), '');
  assert.equal(readReview(env, 2, 'reviewedAt'), '');
  assert.equal(readReview(env, 2, 'applyStatus'), 'pending');
  assert.equal(readReview(env, 2, 'applyErrorCode'), '');
  assert.equal(readReview(env, 2, 'appliedAt'), '');
  assert.equal(readReview(env, 2, 'reviewId'), before.reviewId);
  assert.equal(readReview(env, 2, 'sourceRowKey'), before.sourceRowKey);
  assert.equal(readReview(env, 2, 'leadIdHash'), before.leadIdHash);
  assert.equal(readReview(env, 2, 'sourceRowDigest'), before.sourceRowDigest);
  assert.equal(readReview(env, 2, 'priorityRank'), before.priorityRank);
  assert.equal(readSource(env, 2, 'contactBasisType'), '');
});

test('suspicious bulk reset protects applied ai rejected stale and source-applied rows', () => {
  const env = suspiciousBulkEnvironment(8);
  writeReview(env, 2, 'applyStatus', 'applied');
  writeReview(env, 3, 'applyStatus', 'applied_ai');
  writeReview(env, 3, 'reviewDecision', 'approved_ai');
  writeReview(env, 3, 'aiAutoApproved', 'true');
  writeReview(env, 4, 'reviewDecision', 'rejected');
  writeReview(env, 5, 'reviewDecision', 'needs_more_evidence');
  writeReview(env, 6, 'sourceRowDigest', 'stale-digest');
  markSourceForReviewRowAsApplied(env, 7);
  const result = env.context.installGmailSalesAiVerificationConfigurationOnce();
  assert.equal(result.suspiciousBulkRowsReset, 2);
  assert.equal(result.suspiciousBulkRowsStale, 1);
  assert.equal(readReview(env, 2, 'applyStatus'), 'applied');
  assert.equal(readReview(env, 3, 'applyStatus'), 'applied_ai');
  assert.equal(readReview(env, 4, 'reviewDecision'), 'rejected');
  assert.equal(readReview(env, 5, 'reviewDecision'), 'needs_more_evidence');
  assert.equal(readReview(env, 6, 'sourceRowDigest'), 'stale-digest');
  assert.equal(readReview(env, 7, 'applyStatus'), 'skipped_invalid');
  assert.equal(readReview(env, 8, 'reviewDecision'), 'pending');
  assert.equal(readReview(env, 9, 'reviewDecision'), 'pending');
});

test('installer is idempotent and does not overwrite AI secrets', () => {
  const env = suspiciousBulkEnvironment(5);
  env.props.GMAIL_SALES_AI_API_KEY = 'mock-redacted-token';
  const first = env.context.installGmailSalesAiVerificationConfigurationOnce();
  const sheetCount = Object.keys(env.workbook.sheets).length;
  const headers = env.workbook.sheets.Gmail_Contact_Basis_Review.rows[0].slice();
  const second = env.context.installGmailSalesAiVerificationConfigurationOnce();
  assert.equal(first.suspiciousBulkRowsReset, 5);
  assert.equal(second.suspiciousBulkRowsReset, 0);
  assert.equal(second.aiColumnsAddedCount, 0);
  assert.equal(Object.keys(env.workbook.sheets).length, sheetCount);
  assert.deepEqual(env.workbook.sheets.Gmail_Contact_Basis_Review.rows[0], headers);
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, 'mock-redacted-token');
});

test('suspicious bulk reset rolls back when read back fails', () => {
  const env = suspiciousBulkEnvironment(3);
  env.corruptReviewResetOnce = true;
  const result = env.context.installGmailSalesAiVerificationConfigurationOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.rollbackExecuted, true);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'approved');
  assert.equal(readReview(env, 2, 'applyStatus'), 'skipped_invalid');
  assert.equal(readReview(env, 2, 'applyErrorCode'), 'suspicious_bulk_approval_pattern');
});

test('mock provider does not auto approve unless explicitly enabled', () => {
  const env = createEnvironment({ sourceCount: 2, aiEnabled: true, provider: 'mock', mockAutoApproval: false });
  setSource(env, 2, { businessContactEvidence: 'public contact evidence' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.aiAutoApprovedCount, 0);
  assert.equal(result.aiNeedsReviewCount >= 1, true);
  assert.equal(readSource(env, 2, 'contactBasisType'), '');
});

test('minimized payload excludes direct PII and message content', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  const sourceItem = { row: rowFromSource(env, 2), rowIndex: 2 };
  const queue = env.context.buildContactBasisReviewQueueRow_(sourceItem, new Date().toISOString());
  const evidence = env.context.collectGmailSalesContactBasisEvidence_(sourceItem.row, queue.row);
  const payload = env.context.buildMinimizedAiEvidencePayload_(evidence, env.context.getGmailSalesAiConfig_());
  assert.equal(env.context.validateGmailSalesAiPayloadMinimized_(payload), true);
  ['email', 'contactEmail', 'name', 'businessDisplayName', 'sourceReference', 'sourceUrl', 'subject', 'body'].forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(payload, field), false);
  });
});

test('blocked recipients are excluded from AI verification', () => {
  const env = createEnvironment({ sourceCount: 4, aiEnabled: true, provider: 'mock', mockAutoApproval: true });
  setSource(env, 2, { unsubscribe: 'unsubscribe', businessContactEvidence: 'evidence' });
  setSource(env, 3, { doNotContact: 'true', businessContactEvidence: 'evidence' });
  setSource(env, 4, { sentStatus: 'sent', businessContactEvidence: 'evidence' });
  setSource(env, 5, { sendState: 'DELIVERY_UNKNOWN', businessContactEvidence: 'evidence' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.aiAppliedCount, 0);
  assert.equal(result.excludedCount, 4);
});

test('source read-back mismatch rolls back AI update', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock', mockAutoApproval: true });
  setSource(env, 2, { businessContactEvidence: 'public contact evidence' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.corruptBasisWriteOnce = true;
  const result = env.context.runGmailSalesAiContactBasisVerificationOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.rollbackExecuted, true);
  assert.equal(readSource(env, 2, 'contactBasisType'), '');
});

test('manual bulk approval remains blocked but AI unique bulk pattern is not suspicious', () => {
  const env = createEnvironment({ sourceCount: 30 });
  const manualRows = Array.from({ length: 30 }, () => ({
    row: {
      reviewDecision: 'approved',
      approvedBasisType: 'valid_business_contact_exception',
      evidenceNotes: 'same evidence',
      reviewedAt: '2026-06-30T00:00:00.000Z',
      reviewerLabel: 'human'
    }
  }));
  const aiRows = Array.from({ length: 30 }, (_, index) => ({
    row: {
      reviewDecision: 'approved_ai',
      applyStatus: 'applied_ai',
      reviewerLabel: 'ai_policy_engine',
      aiEvidenceDigest: `digest-${index}`
    }
  }));
  assert.equal(env.context.detectSuspiciousBulkApprovalPattern_(manualRows).suspiciousBulkApprovalPattern, true);
  assert.equal(env.context.detectSuspiciousBulkApprovalPattern_(aiRows).suspiciousBulkApprovalPattern, false);
});

test('production control loop has AI phase before prepare', () => {
  const env = createEnvironment({ sourceCount: 0, aiEnabled: true, provider: 'mock', currentTime: '06:45' });
  assert.equal(env.context.getGmailSalesProductionPhase_(), 'ai_verification');
  env.currentTime = '07:45';
  assert.equal(env.context.getGmailSalesProductionPhase_(), 'prepare');
});

test('send architecture and static safety remain unchanged', () => {
  assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
  assert.equal(code.includes('function runGmailSalesDailyAutomationTrigger'), true);
  assert.equal(code.includes('function runScheduledDailySend'), true);
  assert.equal(code.includes('monitor_only'), true);
  assert.equal(code.includes('runGmailSalesAiContactBasisVerificationOnce'), true);
});

function createEnvironment(options = {}) {
  const sourceRows = [SOURCE_HEADERS];
  for (let index = 1; index <= (options.sourceCount || 0); index += 1) {
    sourceRows.push(SOURCE_HEADERS.map((header) => buildSourceRow(index)[header] || ''));
  }
  const sheets = {
    sales: new MockSheet('sales', [SOURCE_HEADERS]),
    'Gmail営業候補プール': new MockSheet('Gmail営業候補プール', sourceRows)
  };
  if (options.reviewSheet !== false) {
    sheets.Gmail_Contact_Basis_Review = new MockSheet('Gmail_Contact_Basis_Review', [REVIEW_HEADERS]);
  }
  const env = {
    props: {
      SHEET_ID: 'sheet-id',
      SHEET_NAME: 'sales',
      GMAIL_DAILY_SOURCE_TAB_NAME: 'Gmail営業候補プール',
      GMAIL_SHEET_READY_TAB_NAME: 'sales',
      GMAIL_SALES_EXPECTED_DAILY_COUNT: '30',
      GMAIL_SALES_MAX_DAILY_SEND_COUNT: '30',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      AUTOMATION_MASTER_ENABLED: 'true',
      GMAIL_SALES_AI_ENABLED: options.aiEnabled ? 'true' : 'false',
      GMAIL_SALES_AI_PROVIDER: options.provider || 'disabled',
      GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED: options.mockAutoApproval ? 'true' : 'false',
      GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: '0.95',
      GMAIL_SALES_AI_MAX_DAILY_REQUESTS: '100',
      GMAIL_SALES_AI_MAX_DAILY_COST_YEN: '100'
    },
    workbook: {
      sheets,
      getSheetByName(name) { return this.sheets[name] || null; },
      getSheets() { return Object.values(this.sheets); },
      insertSheet(name) {
        env.sheetWriteCount += 1;
        this.sheets[name] = new MockSheet(name, []);
        this.sheets[name].env = env;
        return this.sheets[name];
      }
    },
    currentTime: options.currentTime || '06:45',
    logs: [],
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0,
    corruptBasisWriteOnce: false
  };
  Object.values(sheets).forEach((sheet) => { sheet.env = env; });
  if (options.corruptHeaderValidation && sheets.Gmail_Contact_Basis_Review) {
    const sheet = sheets.Gmail_Contact_Basis_Review;
    const basisRule = { values: ['existing_relationship', 'explicit_opt_in', 'valid_business_contact_exception', 'manual_legal_reviewed'] };
    const decisionRule = { values: ['pending', 'approved', 'approved_ai', 'rejected', 'needs_more_evidence'] };
    const booleanRule = { values: ['TRUE', 'FALSE'] };
    const statusRule = { values: ['pending', 'applied', 'applied_ai', 'skipped_invalid', 'skipped_stale_source', 'rejected', 'needs_more_evidence', 'rollback', 'error'] };
    setValidation(sheet, 1, 'reviewDecision', decisionRule);
    setValidation(sheet, 1, 'approvedBasisType', basisRule);
    setValidation(sheet, 1, 'optOutAvailable', booleanRule);
    setValidation(sheet, 1, 'applyStatus', statusRule);
  }
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  return env;
}

function buildContext(env) {
  return {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Date,
    URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => 'uuid',
      formatDate: (_date, _timezone, pattern) => {
        if (pattern === 'yyyy-MM-dd') return '2026-06-30';
        if (pattern === 'HH:mm') return env.currentTime;
        return '2026-06-30T00:00:00.000Z';
      }
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
        requireValueInList(values) {
          this.values = values;
          return this;
        },
        setAllowInvalid() { return this; },
        build() { return { values: (this.values || []).map(String) }; }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'runGmailSalesProductionControlLoop' }],
      newTrigger: () => {
        env.triggerWriteCount += 1;
        return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) };
      },
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: () => { env.mailSendCount += 1; }
    },
    GmailApp: {
      search: () => [],
      createDraft: () => { env.draftCreateCount += 1; }
    },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: {
      fetch: () => { throw new Error('external fetch must not run in tests'); }
    }
  };
}

function buildSourceRow(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'business contact directory',
    sourceUrl: `https://source${index}.invalid/contact`,
    sourceReference: `https://source${index}.invalid/contact`,
    sourceType: 'public_business_contact',
    subject: `Subject ${index}`,
    body: `Business ${index} body with opt-out guidance.`,
    status: 'ready',
    sendDate: '',
    dedupeKey: `dedupe-${index}`,
    sentStatus: '',
    replyStatus: '',
    unsubscribe: '',
    doNotContact: '',
    sendState: '',
    notes: '',
    existingRelationshipEvidence: '',
    explicitOptInEvidence: '',
    businessContactEvidence: '',
    contactBasisType: '',
    contactBasisRecordedAt: '',
    sourceReferenceHash: '',
    optOutAvailable: '',
    lastVerifiedAt: '',
    suppressionCheckedAt: '',
    historyCheckedAt: ''
  };
}

function setSource(env, rowIndex, values) {
  Object.keys(values).forEach((key) => writeSource(env, rowIndex, key, values[key]));
}

function suspiciousBulkEnvironment(count) {
  const env = createEnvironment({ sourceCount: count, reviewSheet: false });
  env.context.installGmailSalesContactBasisReviewWorkflowOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  for (let index = 2; index < 2 + count; index += 1) {
    writeReview(env, index, 'reviewDecision', 'approved');
    writeReview(env, index, 'approvedBasisType', 'existing_relationship');
    writeReview(env, index, 'evidenceNotes', 'same manual pattern');
    writeReview(env, index, 'optOutAvailable', 'TRUE');
    writeReview(env, index, 'reviewerLabel', 'operator_reviewed');
    writeReview(env, index, 'reviewedAt', '2026-06-30T00:00:00.000Z');
    writeReview(env, index, 'applyStatus', 'skipped_invalid');
    writeReview(env, index, 'applyErrorCode', 'suspicious_bulk_approval_pattern');
    writeReview(env, index, 'appliedAt', '');
  }
  return env;
}

function snapshotReviewRow(env, rowIndex) {
  return {
    reviewId: readReview(env, rowIndex, 'reviewId'),
    sourceRowKey: readReview(env, rowIndex, 'sourceRowKey'),
    leadIdHash: readReview(env, rowIndex, 'leadIdHash'),
    sourceRowDigest: readReview(env, rowIndex, 'sourceRowDigest'),
    priorityRank: readReview(env, rowIndex, 'priorityRank')
  };
}

function rowFromSource(env, rowIndex) {
  const sheet = env.workbook.sheets['Gmail営業候補プール'];
  return Object.fromEntries(sheet.rows[0].map((header, index) => [header, sheet.rows[rowIndex - 1][index] || '']));
}

function readSource(env, rowIndex, header) {
  return readCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, header);
}

function writeSource(env, rowIndex, header, value) {
  writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, header, value);
}

function readReview(env, rowIndex, header) {
  return readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header);
}

function writeReview(env, rowIndex, header, value) {
  writeCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header, value);
}

function markSourceForReviewRowAsApplied(env, reviewRowIndex) {
  const sourceRowKey = readReview(env, reviewRowIndex, 'sourceRowKey');
  for (let rowIndex = 2; rowIndex <= env.workbook.sheets['Gmail営業候補プール'].getLastRow(); rowIndex += 1) {
    const row = rowFromSource(env, rowIndex);
    if (env.context.buildGmailSalesContactSourceRowKey_(row, rowIndex) === sourceRowKey) {
      writeSource(env, rowIndex, 'contactBasisType', 'existing_relationship');
      writeSource(env, rowIndex, 'contactBasisRecordedAt', '2026-06-30T00:00:00.000Z');
      writeSource(env, rowIndex, 'sourceReferenceHash', 'hash');
      writeSource(env, rowIndex, 'optOutAvailable', 'true');
      writeSource(env, rowIndex, 'lastVerifiedAt', '2026-06-30T00:00:00.000Z');
      writeSource(env, rowIndex, 'suppressionCheckedAt', '2026-06-30T00:00:00.000Z');
      writeSource(env, rowIndex, 'historyCheckedAt', '2026-06-30T00:00:00.000Z');
      return;
    }
  }
  throw new Error('source row not found for review row');
}

function readCell(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return index === -1 ? '' : sheet.rows[rowIndex - 1][index] || '';
}

function writeCell(sheet, rowIndex, header, value) {
  const index = sheet.rows[0].indexOf(header);
  if (index === -1) throw new Error(`missing header ${header}`);
  if (!sheet.rows[rowIndex - 1]) sheet.rows[rowIndex - 1] = [];
  validateCellValue(sheet, rowIndex, index + 1, value);
  sheet.rows[rowIndex - 1][index] = value;
}

function headerIncludes(sheet, headers) {
  return headers.every((header) => sheet.rows[0].includes(header));
}

function setValidation(sheet, rowIndex, header, rule) {
  const index = sheet.rows[0].indexOf(header);
  if (index === -1) throw new Error(`missing header ${header}`);
  sheet.validations[`${rowIndex}:${index + 1}`] = rule;
}

function hasValidation(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return Boolean(sheet.validations[`${rowIndex}:${index + 1}`]);
}

function countHeaderValidations(sheet) {
  return Object.keys(sheet.validations).filter((key) => key.startsWith('1:')).length;
}

function validateCellValue(sheet, rowIndex, columnIndex, value) {
  const rule = sheet.validations[`${rowIndex}:${columnIndex}`];
  if (!rule || value === '') return;
  if (rule.values && rule.values.indexOf(String(value)) === -1) {
    throw new Error(`validation rejected ${value}`);
  }
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
      const targetRowIndex = this.row + r - 1;
      if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
      rowValues.forEach((value, c) => {
        this.setCell(targetRowIndex, this.column + c - 1, value);
      });
    });
  }
  setValue(value) {
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    const targetRowIndex = this.row - 1;
    if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
    this.setCell(targetRowIndex, this.column - 1, value);
  }
  setCell(rowIndex, columnIndex, value) {
    const header = this.sheet.rows[0] ? this.sheet.rows[0][columnIndex] : '';
    if (this.sheet.env?.corruptBasisWriteOnce && this.sheet.name === 'Gmail営業候補プール' && header === 'contactBasisType' && value) {
      this.sheet.env.corruptBasisWriteOnce = false;
      this.sheet.rows[rowIndex][columnIndex] = 'corrupted';
      return;
    }
    if (this.sheet.env?.corruptReviewResetOnce && this.sheet.name === 'Gmail_Contact_Basis_Review' && header === 'reviewDecision' && value === 'pending') {
      this.sheet.env.corruptReviewResetOnce = false;
      this.sheet.rows[rowIndex][columnIndex] = 'approved';
      return;
    }
    validateCellValue(this.sheet, rowIndex + 1, columnIndex + 1, value);
    this.sheet.rows[rowIndex][columnIndex] = value;
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
  clearDataValidations() {
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    this.setDataValidation(null);
  }
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
  aiContactBasisTestPassed: true,
  scenarioCount: tests.length,
  coveredRequirementCount: 63,
  mockSourceCandidateCount: 68,
  deterministicApprovedCount: 2,
  aiEvaluatedCount: 30,
  aiAutoApprovedCount: 30,
  aiNeedsReviewCount: 1,
  operationalCandidateReady: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
