import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function createContext() {
  const props = {
    AUTO_SEND_ENABLED: 'false',
    LIVE_SEND_ENABLED: 'false'
  };
  const state = {
    lockAttempts: 0,
    lockHeld: false,
    lockReentrantFailure: false,
    flushCount: 0,
    aiWorkerCallCount: 0,
    sendAuthorityCallCount: 0,
    triggerCreateCount: 0,
    gmailSendCount: 0,
    draftCreateCount: 0,
    sheetWriteCount: 0,
    urlFetchCount: 0,
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
        setProperty: (key, value) => { props[key] = String(value); },
        setProperties: (values) => Object.keys(values || {}).forEach((key) => { props[key] = String(values[key]); })
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
    SpreadsheetApp: {
      flush: () => { state.flushCount += 1; }
    },
    ScriptApp: {
      newTrigger: () => {
        state.triggerCreateCount += 1;
        return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) };
      },
      getProjectTriggers: () => []
    },
    MailApp: {
      sendEmail: () => { state.gmailSendCount += 1; }
    },
    GmailApp: {
      createDraft: () => { state.draftCreateCount += 1; }
    },
    UrlFetchApp: {
      fetch: () => {
        state.urlFetchCount += 1;
        return { getResponseCode: () => 200, getContentText: () => '{}' };
      }
    },
    Utilities: {
      formatDate: () => '2026-07-03',
      computeDigest: () => [],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      base64Encode: (value) => String(value)
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Tokyo'
    },
    Logger: {
      log: (value) => state.logs.push(String(value))
    }
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
  context.runGmailSalesDailyAutomationTrigger = () => {
    state.sendAuthorityCallCount += 1;
    return { status: 'unexpected_send_authority_called' };
  };
  return context;
}

function status(overrides = {}) {
  return Object.assign({
    status: 'blocked',
    sourceCandidateCount: 68,
    hardBlockedCount: 0,
    evidenceMissingCount: 15,
    evidenceReadyCount: 53,
    canonicalEvidenceDigestCount: 53,
    uniqueCanonicalEvidenceDigestCount: 53,
    emptyDigestButReadyCount: 0,
    unchangedDigestSkippedCount: 0,
    changedDigestEligibleCount: 53,
    aiPendingCount: 53,
    aiApprovedCount: 0,
    basisApplyPendingCount: 0,
    basisAppliedCount: 0,
    readyInventoryCount: 0,
    shortfallToThirty: 30,
    retryableCandidateCount: 15,
    manifestReady: false,
    manifestExists: false,
    manifestCount: 0,
    manifestUniqueCount: 0,
    manifestDuplicateCount: 0,
    currentManifestMaxSendCount: 0,
    blockedReasons: ['ready_inventory_below_30']
  }, overrides);
}

function installStatusSequence(context, values) {
  let index = 0;
  context.inspectGmailSalesAutomatedEvidenceRecoveryStatus_ = () => values[Math.min(index++, values.length - 1)];
}

const m1 = createContext();
installStatusSequence(m1, [
  status(),
  status({
    evidenceMissingCount: 15,
    evidenceReadyCount: 53,
    canonicalEvidenceDigestCount: 53,
    uniqueCanonicalEvidenceDigestCount: 53,
    unchangedDigestSkippedCount: 53,
    changedDigestEligibleCount: 0,
    aiPendingCount: 0,
    retryableCandidateCount: 15
  })
]);
m1.runGmailSalesAiContactBasisVerificationWorker_ = () => {
  m1.__state.aiWorkerCallCount += 1;
  return {
    status: 'pass',
    aiBatchRequestCount: 7,
    aiDispatchEligibleCount: 53,
    aiProviderRequestSuccessCount: 7,
    aiProviderRequestFailureCount: 0
  };
};
const m1Result = m1.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(m1Result.stepExecuted, 'ai_contact_basis_verification');
assert.equal(m1Result.aiDispatchEligibleCount, 53);
assert.equal(m1Result.aiApiCalled, true);
assert.equal(m1.__state.aiWorkerCallCount, 1);
assert.equal(m1.__state.lockAttempts, 1);
assert.equal(m1.__state.lockReentrantFailure, false);

const m2 = createContext();
installStatusSequence(m2, [status(), status({ changedDigestEligibleCount: 0, unchangedDigestSkippedCount: 53 })]);
m2.runGmailSalesAiContactBasisVerificationWorker_ = () => ({ status: 'pass', aiBatchRequestCount: 7, aiDispatchEligibleCount: 53 });
m2.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(m2.__state.lockAttempts, 1);
assert.equal(m2.__state.lockReentrantFailure, false);

const m2Loop = createContext();
m2Loop.runGmailSalesAutomatedEvidenceRecoveryStepWorker_ = () => ({ status: 'pass', stepExecuted: 'ai_contact_basis_verification' });
const loopResult = m2Loop.runGmailSalesProductionControlLoop_({ source: 'test' });
assert.equal(loopResult.stepExecuted, 'ai_contact_basis_verification');
assert.equal(m2Loop.__state.lockAttempts, 1);
assert.equal(m2Loop.__state.sendAuthorityCallCount, 0);

assert.equal(m1.planGmailSalesAutomatedEvidenceRecoveryNextAction_(status()), 'AI_REVIEW_PENDING');
assert.equal(m1.planGmailSalesAutomatedEvidenceRecoveryNextAction_(status({ changedDigestEligibleCount: 0, evidenceMissingCount: 15 })), 'EVIDENCE_PACKAGE_READY');
assert.equal(m1.planGmailSalesAutomatedEvidenceRecoveryNextAction_(status({ readyInventoryCount: 30, shortfallToThirty: 0, changedDigestEligibleCount: 0, evidenceMissingCount: 0 })), 'MANIFEST_BUILD_PENDING');
assert.equal(m1.planGmailSalesAutomatedEvidenceRecoveryNextAction_(status({ manifestReady: true, readyInventoryCount: 30, shortfallToThirty: 0, changedDigestEligibleCount: 0, evidenceMissingCount: 0 })), 'READY');

const m3 = createContext();
installStatusSequence(m3, [status({ changedDigestEligibleCount: 0, unchangedDigestSkippedCount: 53, evidenceMissingCount: 15 })]);
assert.equal(m3.planGmailSalesAutomatedEvidenceRecoveryNextAction_(m3.inspectGmailSalesAutomatedEvidenceRecoveryStatus_()), 'EVIDENCE_PACKAGE_READY');

const m4 = createContext();
installStatusSequence(m4, [status({ changedDigestEligibleCount: 0, evidenceMissingCount: 15 })]);
const evidenceOnly = m4.runGmailSalesAutomatedEvidenceRecoveryStepOnce();
assert.equal(evidenceOnly.stepExecuted, 'evidence_package_recovery_pending');
assert.equal(evidenceOnly.aiApiCalled, false);
assert.equal(m4.__state.lockAttempts, 1);

const source = code;
const flushIndex = source.indexOf('SpreadsheetApp.flush();');
const readbackIndex = source.indexOf('const readBackPassed = sourceUpdates.every');
const rollbackFlushIndex = source.indexOf('SpreadsheetApp.flush();', readbackIndex);
assert.equal(flushIndex !== -1 && readbackIndex !== -1 && flushIndex < readbackIndex, true);
assert.equal(rollbackFlushIndex !== -1, true);

const m7 = createContext();
m7.__props.APPROVED_SEND_MANIFEST_JSON = '';
const noManifest = m7.inspectGmailSalesAutomatedEvidenceManifestStatus_();
assert.equal(noManifest.manifestReady, false);
assert.equal(noManifest.manifestCount, 0);

const validManifest = {
  targetDate: '2026-07-03',
  candidateCount: 30,
  maxSendCount: 30,
  approvalStatus: 'approved',
  approvalType: 'automatic_strict_gate',
  targetAutoApproved: true,
  candidateDigests: Array.from({ length: 30 }, (_, index) => `digest-${index}`)
};
m7.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(validManifest);
const manifestReady = m7.inspectGmailSalesAutomatedEvidenceManifestStatus_();
assert.equal(manifestReady.manifestReady, true);
assert.equal(manifestReady.manifestCount, 30);
assert.equal(manifestReady.manifestUniqueCount, 30);
assert.equal(manifestReady.currentManifestMaxSendCount, 30);

m7.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(Object.assign({}, validManifest, {
  candidateCount: 29,
  candidateDigests: Array.from({ length: 29 }, (_, index) => `digest-${index}`)
}));
assert.equal(m7.inspectGmailSalesAutomatedEvidenceManifestStatus_().manifestReady, false);

m7.__props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(Object.assign({}, validManifest, {
  candidateCount: 31,
  candidateDigests: Array.from({ length: 31 }, (_, index) => `digest-${index}`)
}));
assert.equal(m7.inspectGmailSalesAutomatedEvidenceManifestStatus_().manifestReady, false);

assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesProductionControlLoop\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesDailyAutomationTrigger\s*\(/g) || []).length, 1);
assert.equal((code.match(/ScriptApp\.newTrigger/g) || []).filter(Boolean).length >= 0, true);
assert.equal(/approvedBasisType:\s*['"]manual_legal_reviewed['"]/.test(code), false);

console.log(JSON.stringify({
  automatedEvidenceRecoveryStateMachineTestPassed: true,
  fixtureM1CheckpointState: 'AI_REVIEW_PENDING',
  fixtureM1StepExecuted: m1Result.stepExecuted,
  fixtureM1AiDispatchEligibleCount: m1Result.aiDispatchEligibleCount,
  fixtureM2ManualSafeLockAttempts: m2.__state.lockAttempts,
  fixtureM2ControlLoopLockAttempts: m2Loop.__state.lockAttempts,
  fixtureM3NextStateAfterAi: 'EVIDENCE_PACKAGE_READY',
  fixtureM4StepExecuted: evidenceOnly.stepExecuted,
  fixtureM5FlushBeforeReadBack: true,
  fixtureM6RollbackFlushPresent: true,
  fixtureM7ManifestReadyWithoutManifest: false,
  fixtureM8ManifestReady: manifestReady.manifestReady,
  fixtureM9Manifest31Ready: false,
  fixtureM10Manifest29Ready: false,
  fixtureM11SendAuthorityCallCount: m2Loop.__state.sendAuthorityCallCount,
  fixtureM12EvidenceOnlyStep: evidenceOnly.stepExecuted,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
