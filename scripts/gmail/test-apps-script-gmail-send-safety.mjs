import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const codePath = path.join(ROOT, 'apps-script', 'gmail-sales-automation', 'Code.gs');
const code = fs.readFileSync(codePath, 'utf8');

assert.equal(count(/MailApp\.sendEmail\s*\(/g), 1);
assert.equal(/GmailApp\.createDraft\s*\(/.test(code), false);
assert.equal(/GmailApp\.sendEmail\s*\(/.test(code), false);

assertBodyCallsExecutor('dailySalesEmailJob', 'executeApprovedGmailSalesBatch_');
assertBodyCallsExecutor('runScheduledDailySend', 'executeApprovedGmailSalesBatch_');
assertBodyCallsExecutor('runDailyGmailSalesSend', 'executeApprovedGmailSalesBatch_');
assert.equal(/function\s+executeDailyGmailSalesSend_\s*\([^)]*\)\s*\{\s*return executeApprovedGmailSalesBatch_/.test(code), true);

assert.equal(/liveSendEnabled:\s*props\.getProperty\('LIVE_SEND_ENABLED'\)\s*===\s*'true'/.test(code), true);
assert.equal(/autoSendEnabled:\s*props\.getProperty\('AUTO_SEND_ENABLED'\)\s*===\s*'true'/.test(code), true);
assert.equal(/const GMAIL_SEND_DEFAULT_MAX_SEND_COUNT = 1;/.test(code), true);
assert.equal(/const GMAIL_SEND_MAX_ATTEMPTS = 1;/.test(code), true);
assert.equal(/LockService\.getScriptLock\(\)/.test(code), true);
assert.equal(/if \(!lock\.tryLock\(30000\)\)/.test(code), true);

assertIncludesAll([
  'APPROVED_SEND_MANIFEST_JSON',
  'loadApprovedSendManifest_',
  'validateApprovedSendManifest_',
  'computeCandidateDigest_',
  'buildCandidateDigestInput_',
  'runGmailSalesPreSendDryRun',
  'runGmailSalesRecoveryPreSendDryRun',
  'runGmailSalesRecoverySendOnce',
  'runGmailSalesRecoveryDigestDiagnostic',
  'runGmailSalesRecoveryReissueManifestDigests',
  'runGmailSalesRecoveryReissueSourceCandidateContentHash',
  'runGmailSalesRecoveryRepairDerivedCandidateHash',
  'GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION',
  'analyzeApprovedGmailSalesRecoveryBatch_',
  'same_day_manual_recovery_not_approved',
  'manifest_property_missing',
  'manifest_expired',
  'manifest_candidate_digest_mismatch',
  'manifest_candidate_count_mismatch',
  'candidate_digest_mismatch',
  'derived_candidate_hash_mismatch',
  'manifest_source_candidate_content_hash_mismatch',
  'manifest_source_candidate_content_hash_reissue_safe',
  'suppression_ledger_missing',
  'gmail_sent_search_failed',
  'suppression_match',
  'gmail_sent_history_match',
  'sheet_history_match'
]);
assertIncludesAll([
  'GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM',
  "'_CHECKSUM'",
  'acquireSheetMaintenanceLease_',
  'releaseSheetMaintenanceLease_',
  'GMAIL_SALES_SHEET_MAINTENANCE',
  'send_attempt_limit_exceeded',
  'attemptLimitExceededCount',
  'runGmailSuppressionLedgerReadOnlyDiagnostic',
  'diagnoseSuppressionLedgerProperties_',
  'GMAIL_SUPPRESSION_LEDGER_REQUIRED_PROPERTIES',
  'handleConnectedSheetSyncDryRun_',
  'handleSheetSyncReadOnlySnapshot_',
  'sheetSyncSnapshotSafeLog_',
  'compareSheetSyncRows_',
  'resolveSheetSyncOperationMode_',
  'runGmailSalesDailyAutomationTrigger',
  'runGmailSalesDailyAutomationHealthCheck',
  'runGmailSalesSameDaySend20260624Once',
  'prepareGmailSalesSameDay20260624Once',
  'inspectGmailSalesSameDay20260624Readiness',
  'verifyGmailSalesSameDayProperties20260624',
  'inspectGmailSalesSameDayCandidateRejections20260624',
  'repairGmailSalesSameDayCandidateMetadata20260624Once',
  'same_day_emergency_20260624',
  'GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624',
  'handleGmailSalesNormalDailyPrepareWebhook_',
  'verifyGmailDailyAutomationWebhook_',
  'GMAIL_DAILY_AUTOMATION_STATE_JSON',
  'automatic_strict_gate'
]);

const executorBody = functionBody('executeApprovedGmailSalesBatch_');
assert.equal(executorBody.includes('sendApprovedGmailSalesRow_'), true);
const sharedSendBody = functionBody('sendApprovedGmailSalesRow_');
assertBodyOrder(sharedSendBody, 'reserveCandidateBeforeSend_', 'MailApp.sendEmail');
assertBodyOrder(sharedSendBody, 'reservationCheck', 'MailApp.sendEmail');
const reserveBody = functionBody('reserveCandidateBeforeSend_');
assert.equal(reserveBody.includes('sendState: GMAIL_SEND_STATE.reserved'), true);
assert.equal(reserveBody.includes('SpreadsheetApp.flush();'), true);
assertBodyOrder(executorBody, 'sendApprovedGmailSalesRow_', 'markBatchSent_');
assertBodyOrder(sharedSendBody, 'sendState: GMAIL_SEND_STATE.sent', 'return { ok: true');

assert.equal(/state === GMAIL_SEND_STATE\.reserved/.test(code), true);
assert.equal(/state === GMAIL_SEND_STATE\.deliveryUnknown/.test(code), true);
assert.equal(/state === GMAIL_SEND_STATE\.sent/.test(code), true);
assert.equal(/manualReviewRequired/.test(code), true);
assert.equal(/sendAttemptCount:\s*reservation\.attemptCount/.test(code), true);
assert.equal(/Number\(row\.sendAttemptCount \|\| 0\) >=/.test(code), true);
assert.equal(/Number\(row\.sendAttemptCount \|\| 0\) \+ 1/.test(code), true);

const dryRunFunction = functionBody('runGmailSalesPreSendDryRun');
assert.equal(/MailApp\.sendEmail/.test(dryRunFunction), false);
assert.equal(/setValue|setValues|setProperty|deleteProperty|newTrigger|deleteTrigger/.test(dryRunFunction), false);
assert.equal(dryRunFunction.includes('executeApprovedGmailSalesPreSendDryRun_'), true);
assert.equal(dryRunFunction.includes('executeApprovedGmailSalesBatch_'), false);
const dryRunExecutorBody = functionBody('executeApprovedGmailSalesPreSendDryRun_');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft/.test(dryRunExecutorBody), false);
assert.equal(/setValue|setValues|setProperty|setProperties|deleteProperty|newTrigger|deleteTrigger|SpreadsheetApp\.flush|acquireSheetMaintenanceLease_/.test(dryRunExecutorBody), false);
assert.equal(/if \(settings\.dryRun === true\) \{\s*return executeApprovedGmailSalesPreSendDryRun_/.test(executorBody), true);
assert.equal(/if \(configForReset && settings\.dryRun !== true\)/.test(executorBody), true);
const sameDayEmergencyBody = functionBody('runGmailSalesSameDaySend20260624Once');
const sameDayPrepareBody = functionBody('prepareGmailSalesSameDay20260624Once');
const sameDayReadinessBody = functionBody('inspectGmailSalesSameDay20260624Readiness');
const sameDayPropertyVerifyBody = functionBody('verifyGmailSalesSameDayProperties20260624');
const sameDayCandidateInspectBody = functionBody('inspectGmailSalesSameDayCandidateRejections20260624');
const sameDayMetadataRepairBody = functionBody('repairGmailSalesSameDayCandidateMetadata20260624Once');
const sameDayEmergencyExecutorBody = functionBody('activateAndRunGmailSalesSameDayEmergencyOnce_');
const sameDayEmergencyValidatorBody = functionBody('validateGmailSalesSameDayEmergencySend_');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(sameDayEmergencyBody), false);
assert.equal(sameDayEmergencyBody.includes('activateAndRunGmailSalesSameDayEmergencyOnce_'), true);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(sameDayPrepareBody), false);
assert.equal(sameDayPrepareBody.includes('prepareGmailSalesSameDayEmergencyOnce_'), true);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|setProperty|setProperties|deleteProperty|deleteAllProperties|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(sameDayReadinessBody), false);
assert.equal(sameDayReadinessBody.includes('inspectGmailSalesSameDayReadiness_'), true);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|setProperty|setProperties|deleteProperty|deleteAllProperties|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(sameDayPropertyVerifyBody), false);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|setProperty|setProperties|deleteProperty|deleteAllProperties|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger|setValue|setValues|clearContents|insertSheet/.test(sameDayCandidateInspectBody), false);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|setProperty|setProperties|deleteProperty|deleteAllProperties|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(sameDayMetadataRepairBody), false);
assert.equal(sameDayEmergencyExecutorBody.includes('executeApprovedGmailSalesPreSendDryRun_'), true);
assert.equal(sameDayEmergencyExecutorBody.includes('executeApprovedGmailSalesBatch_'), true);
assert.equal(sameDayEmergencyExecutorBody.includes('skipDailySendWindow: true'), true);
assert.equal(sameDayEmergencyExecutorBody.includes('oneWeekCatchUpSendCount: 0'), true);
assert.equal(sameDayEmergencyExecutorBody.includes('pastDateSendCount: 0'), true);
assert.equal(sameDayEmergencyValidatorBody.includes("targetDate !== GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624"), true);
assert.equal(sameDayEmergencyValidatorBody.includes("state.state === 'sent'"), true);
assert.equal(sameDayEmergencyValidatorBody.includes('candidate_count_not_30'), true);
assert.equal(sameDayEmergencyValidatorBody.includes('manifest_max_send_count_not_30'), true);
assert.equal(sameDayEmergencyValidatorBody.includes('auto_send_not_disabled_before_emergency'), true);
assert.equal(sameDayEmergencyValidatorBody.includes('live_send_not_at_rest_before_emergency'), true);
const recoveryDryRunFunction = functionBody('runGmailSalesRecoveryPreSendDryRun');
assert.equal(recoveryDryRunFunction.includes('executeApprovedGmailSalesRecoveryPreSendDryRun_'), true);
assert.equal(recoveryDryRunFunction.includes('executeApprovedGmailSalesBatch_'), false);
const recoveryDryRunExecutorBody = functionBody('executeApprovedGmailSalesRecoveryPreSendDryRun_');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft/.test(recoveryDryRunExecutorBody), false);
assert.equal(/setValue|setValues|setProperty|setProperties|deleteProperty|newTrigger|deleteTrigger|SpreadsheetApp\.flush|acquireSheetMaintenanceLease_|resetLiveSendAfterRun_/.test(recoveryDryRunExecutorBody), false);
const recoveryAnalysisBody = functionBody('analyzeApprovedGmailSalesRecoveryBatch_');
assert.equal(recoveryAnalysisBody.includes('loadCandidateRows_(config)'), true);
assert.equal(recoveryAnalysisBody.includes('buildRecoverySendConfig_'), true);
assert.equal(recoveryAnalysisBody.includes('validateRecoveryOutboxRows_'), true);
assert.equal(recoveryAnalysisBody.includes('acquireSheetMaintenanceLease_'), false);
assert.equal(recoveryAnalysisBody.includes('resetLiveSendAfterRun_'), false);

const analyzeBody = functionBody('analyzeApprovedGmailSalesBatch_');
assert.equal(/findPossibleGmailSentMatch_/.test(analyzeBody) || /validateSingleCandidatePreSend_/.test(analyzeBody), true);
assert.equal(/isSuppressedByLedger_/.test(code), true);
assert.equal(/hasSheetSentHistory_/.test(code), true);
const diagnosticBody = functionBody('runGmailSuppressionLedgerReadOnlyDiagnostic');
const diagnosticValidatorBody = functionBody('diagnoseSuppressionLedgerProperties_');
assert.equal(/setProperty|setProperties|deleteProperty|deleteAllProperties|MailApp\.sendEmail|GmailApp\.createDraft|SpreadsheetApp\.flush|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(diagnosticBody), false);
assert.equal(/setProperty|setProperties|deleteProperty|deleteAllProperties|MailApp\.sendEmail|GmailApp\.createDraft|SpreadsheetApp\.flush|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(diagnosticValidatorBody), false);
assert.equal(/getProperty/.test(diagnosticValidatorBody), true);
const recoveryDigestDiagnosticBody = functionBody('runGmailSalesRecoveryDigestDiagnostic');
assert.equal(/setProperty|setProperties|deleteProperty|deleteAllProperties|MailApp\.sendEmail|GmailApp\.createDraft|SpreadsheetApp\.flush|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(recoveryDigestDiagnosticBody), false);
assert.equal(/diagnoseGmailSalesRecoveryDigestRuntime_/.test(recoveryDigestDiagnosticBody), true);
const recoveryDigestReissueBody = functionBody('runGmailSalesRecoveryReissueManifestDigests');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|SpreadsheetApp\.flush|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(recoveryDigestReissueBody), false);
assert.equal(/setProperty\('APPROVED_SEND_MANIFEST_JSON'/.test(recoveryDigestReissueBody), true);
const recoverySourceHashReissueBody = functionBody('runGmailSalesRecoveryReissueSourceCandidateContentHash');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|SpreadsheetApp\.flush|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(recoverySourceHashReissueBody), false);
assert.equal(/setProperty\('APPROVED_SEND_MANIFEST_JSON'/.test(recoverySourceHashReissueBody), true);
assert.equal(/setProperty\('(?!APPROVED_SEND_MANIFEST_JSON)/.test(recoverySourceHashReissueBody), false);
assert.equal(/sourceOutboxIdentity\.candidateContentHash = runtimeContentHash/.test(recoverySourceHashReissueBody), true);
assert.equal(/candidateDigests =/.test(recoverySourceHashReissueBody), false);
assert.equal(/manual_execution_required/.test(recoverySourceHashReissueBody), true);
const recoveryHashRepairBody = functionBody('runGmailSalesRecoveryRepairDerivedCandidateHash');
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|setProperty|setProperties|deleteProperty|deleteAllProperties|newTrigger|deleteTrigger|executeApprovedGmailSalesBatch_|resetLiveSendAfterRun_/.test(recoveryHashRepairBody), false);
assert.equal(/getRange\(2, matchingColumns\[0\]\)\.setValue/.test(recoveryHashRepairBody), true);
assert.equal(/updatedCellCount = 1/.test(recoveryHashRepairBody), true);
assert.equal(/APPROVED_SEND_MANIFEST_JSON/.test(recoveryHashRepairBody), false);
const connectedDryRunBody = functionBody('handleConnectedSheetSyncDryRun_');
const readOnlySnapshotBody = functionBody('handleSheetSyncReadOnlySnapshot_');
const connectedCompareBody = functionBody('compareSheetSyncRows_');
const dailyPrepareWebhookBody = functionBody('handleGmailSalesNormalDailyPrepareWebhook_');
const dailyHealthCheckBody = functionBody('runGmailSalesDailyAutomationHealthCheck');
assert.equal(/clear|clearContents|clearFormat|setValue|setValues|appendRow|insertRow|insertRows|deleteRow|deleteRows|sort|moveRows|protect|insertSheet|deleteSheet|SpreadsheetApp\.flush|setProperty|setProperties|deleteProperty|deleteAllProperties|acquireSheetMaintenanceLease_|releaseSheetMaintenanceLease_|LockService|MailApp\.sendEmail|GmailApp\.createDraft|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger|writeGmailOutboxRowsToSheet_/.test(connectedDryRunBody), false);
assert.equal(/clear|clearContents|clearFormat|setValue|setValues|appendRow|insertRow|insertRows|deleteRow|deleteRows|sort|moveRows|protect|insertSheet|deleteSheet|SpreadsheetApp\.flush|setProperty|setProperties|deleteProperty|deleteAllProperties|acquireSheetMaintenanceLease_|releaseSheetMaintenanceLease_|LockService|MailApp\.sendEmail|GmailApp\.createDraft|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger|writeGmailOutboxRowsToSheet_/.test(readOnlySnapshotBody), false);
assert.equal(/clear|clearContents|setValue|setValues|appendRow|insertRow|insertRows|deleteRow|deleteRows|SpreadsheetApp\.flush|setProperty|setProperties|deleteProperty|deleteAllProperties|acquireSheetMaintenanceLease_|releaseSheetMaintenanceLease_|LockService|MailApp\.sendEmail|GmailApp\.createDraft|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger|writeGmailOutboxRowsToSheet_/.test(connectedCompareBody), false);
assert.equal(/MailApp\.sendEmail|GmailApp\.createDraft|executeApprovedGmailSalesBatch_|runScheduledDailySend|runDailyGmailSalesSend|dailySalesEmailJob|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(dailyPrepareWebhookBody), false);
assert.equal(/setProperty|setProperties|deleteProperty|deleteAllProperties|clear|clearContents|setValue|setValues|appendRow|insertRows|deleteRows|MailApp\.sendEmail|GmailApp\.createDraft|executeApprovedGmailSalesBatch_|ScriptApp\.newTrigger|ScriptApp\.deleteTrigger/.test(dailyHealthCheckBody), false);
assertBodyOrder(functionBody('handleGmailOutboxSheetSync_'), 'handleConnectedSheetSyncDryRun_', 'acquireSheetMaintenanceLease_');
assertBodyOrder(functionBody('handleGmailOutboxSheetSync_'), 'handleSheetSyncReadOnlySnapshot_', 'acquireSheetMaintenanceLease_');
assert.equal(/delete safe\.headers/.test(functionBody('sheetSyncSnapshotSafeLog_')), true);
assert.equal(/delete safe\.rows/.test(functionBody('sheetSyncSnapshotSafeLog_')), true);

const logFunction = functionBody('appendSafeLog_');
assert.equal(/delete safe\.candidateDigest/.test(logFunction), true);
assert.equal(/delete safe\.approvedCandidateDigest/.test(logFunction), true);
assert.equal(/delete safe\.manifest/.test(logFunction), true);

console.log(JSON.stringify({
  syntheticTestCount: 61,
  passed: true,
  mailSendCallSiteCount: count(/MailApp\.sendEmail\s*\(/g),
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  appsScriptExecuted: false
}, null, 2));

function count(regex) {
  return (code.match(regex) || []).length;
}

function assertIncludesAll(values) {
  values.forEach((value) => assert.equal(code.includes(value), true, value));
}

function assertBodyCallsExecutor(functionName, executorName) {
  const body = functionBody(functionName);
  assert.equal(body.includes(executorName), true, `${functionName} should call ${executorName}`);
}

function functionBody(functionName) {
  const start = code.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} missing`);
  const open = code.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    const char = code[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, index);
    }
  }
  throw new Error(`${functionName} body not found`);
}

function assertBodyOrder(body, first, second) {
  const firstIndex = body.indexOf(first);
  const secondIndex = body.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} missing`);
  assert.notEqual(secondIndex, -1, `${second} missing`);
  assert.equal(firstIndex < secondIndex, true, `${first} should appear before ${second}`);
}
