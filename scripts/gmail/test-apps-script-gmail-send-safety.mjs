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
  'runGmailSalesPreSendDryRun',
  'manifest_property_missing',
  'manifest_expired',
  'manifest_candidate_digest_mismatch',
  'manifest_candidate_count_mismatch',
  'candidate_digest_mismatch',
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
  'attemptLimitExceededCount'
]);

const executorBody = functionBody('executeApprovedGmailSalesBatch_');
assertBodyOrder(executorBody, 'reserveCandidateBeforeSend_', 'MailApp.sendEmail');
assertBodyOrder(executorBody, 'reservationCheck', 'MailApp.sendEmail');
const reserveBody = functionBody('reserveCandidateBeforeSend_');
assert.equal(reserveBody.includes('sendState: GMAIL_SEND_STATE.reserved'), true);
assert.equal(reserveBody.includes('SpreadsheetApp.flush();'), true);
assertOrder('sendState: GMAIL_SEND_STATE.sent', 'markBatchSent_');

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

const analyzeBody = functionBody('analyzeApprovedGmailSalesBatch_');
assert.equal(/findPossibleGmailSentMatch_/.test(analyzeBody) || /validateSingleCandidatePreSend_/.test(analyzeBody), true);
assert.equal(/isSuppressedByLedger_/.test(code), true);
assert.equal(/hasSheetSentHistory_/.test(code), true);

const logFunction = functionBody('appendSafeLog_');
assert.equal(/delete safe\.candidateDigest/.test(logFunction), true);
assert.equal(/delete safe\.approvedCandidateDigest/.test(logFunction), true);
assert.equal(/delete safe\.manifest/.test(logFunction), true);

console.log(JSON.stringify({
  syntheticTestCount: 24,
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

function assertOrder(first, second) {
  const firstIndex = code.indexOf(first);
  const secondIndex = code.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} missing`);
  assert.notEqual(secondIndex, -1, `${second} missing`);
  assert.equal(firstIndex < secondIndex, true, `${first} should appear before ${second}`);
}

function assertBodyOrder(body, first, second) {
  const firstIndex = body.indexOf(first);
  const secondIndex = body.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} missing`);
  assert.notEqual(secondIndex, -1, `${second} missing`);
  assert.equal(firstIndex < secondIndex, true, `${first} should appear before ${second}`);
}
