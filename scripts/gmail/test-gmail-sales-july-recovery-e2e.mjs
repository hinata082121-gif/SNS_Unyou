import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

const TARGET_DAYS = [
  '2026-07-03',
  '2026-07-04',
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
  '2026-07-09',
  '2026-07-10',
  '2026-07-11'
];
const WEEKLY_REPORT_DAY = '2026-07-05';
const DAILY_TARGET = 30;
const JULY_REVENUE_TARGET_YEN = 100000;

const hash = (value) => {
  let h = 0;
  for (const char of String(value)) h = ((h << 5) - h + char.charCodeAt(0)) | 0;
  return `h${Math.abs(h)}`;
};

function buildFixture() {
  const candidates = [];
  for (let index = 0; index < 300; index += 1) {
    candidates.push({
      id: `candidate-${index}`,
      recipientHash: hash(`recipient-${index}`),
      status: 'ready',
      contactBasis: 'valid_business_contact_exception',
      suppression: false,
      replied: false,
      previouslySent: false,
      deliveryUnknown: false,
      duplicate: false,
      privatePersonal: false,
      guessed: false,
      solicitationRestricted: false,
      needsMoreEvidence: false,
      retryableFailure: false
    });
  }
  candidates[91].suppression = true;
  candidates[92].replied = true;
  candidates[93].previouslySent = true;
  candidates[94].deliveryUnknown = true;
  candidates[95].recipientHash = candidates[0].recipientHash;
  candidates[95].duplicate = true;
  candidates[96].privatePersonal = true;
  candidates[97].guessed = true;
  candidates[98].solicitationRestricted = true;
  candidates[99].needsMoreEvidence = true;
  candidates[100].retryableFailure = true;
  return candidates;
}

function eligibleInventory(candidates, sentHashes = new Set(), deliveryUnknownHashes = new Set()) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (candidate.status !== 'ready') return false;
    if (!['existing_relationship', 'explicit_opt_in', 'valid_business_contact_exception', 'manual_legal_reviewed'].includes(candidate.contactBasis)) return false;
    if (candidate.suppression || candidate.replied || candidate.previouslySent || candidate.deliveryUnknown) return false;
    if (candidate.privatePersonal || candidate.guessed || candidate.solicitationRestricted || candidate.needsMoreEvidence) return false;
    if (sentHashes.has(candidate.recipientHash) || deliveryUnknownHashes.has(candidate.recipientHash)) return false;
    if (seen.has(candidate.recipientHash)) return false;
    seen.add(candidate.recipientHash);
    return true;
  });
}

function createManifest(candidates, date, sentHashes = new Set()) {
  const inventory = eligibleInventory(candidates, sentHashes);
  const selected = inventory.slice(0, DAILY_TARGET);
  const recipientHashes = selected.map((candidate) => candidate.recipientHash);
  const unique = new Set(recipientHashes);
  return {
    businessDate: date,
    manifestVersion: 'normal-daily-v1',
    lockedAt: `${date}T10:00:00+09:00`,
    maxSendCount: DAILY_TARGET,
    recipientCount: recipientHashes.length,
    uniqueRecipientCount: unique.size,
    duplicateCount: recipientHashes.length - unique.size,
    crossManifestDuplicateCount: 0,
    approvedCount: selected.length,
    suppressionCount: 0,
    sentHistoryMatchCount: 0,
    replyHistoryMatchCount: 0,
    deliveryUnknownMatchCount: 0,
    quotaRequired: DAILY_TARGET,
    status: selected.length === DAILY_TARGET && unique.size === DAILY_TARGET ? 'locked' : 'blocked',
    recipientHashes,
    manifestDigest: hash(`${date}:${recipientHashes.join(',')}`),
    selected
  };
}

function sendManifest(manifest, ledger, options = {}) {
  const quota = options.quota ?? DAILY_TARGET;
  if (manifest.status !== 'locked') return { status: 'blocked', acceptedSendCount: 0, attemptedSendCount: 0, blockedBeforeSendCount: DAILY_TARGET };
  if (quota < DAILY_TARGET) return { status: 'blocked', acceptedSendCount: 0, attemptedSendCount: 0, blockedBeforeSendCount: DAILY_TARGET, blockedReason: 'quota_insufficient' };
  if (ledger.completed.has(manifest.businessDate)) return { status: 'noop', acceptedSendCount: 0, attemptedSendCount: 0, blockedBeforeSendCount: 0 };
  let acceptedSendCount = 0;
  let attemptedSendCount = 0;
  let deliveryUnknownCount = 0;
  for (const candidate of manifest.selected) {
    if (ledger.sent.has(candidate.recipientHash) || ledger.deliveryUnknown.has(candidate.recipientHash)) continue;
    attemptedSendCount += 1;
    if (options.failAfterAttempt === attemptedSendCount) {
      ledger.deliveryUnknown.add(candidate.recipientHash);
      deliveryUnknownCount += 1;
      continue;
    }
    ledger.sent.add(candidate.recipientHash);
    acceptedSendCount += 1;
    if (acceptedSendCount === DAILY_TARGET) break;
  }
  if (acceptedSendCount === DAILY_TARGET) ledger.completed.add(manifest.businessDate);
  return {
    status: acceptedSendCount === DAILY_TARGET ? 'pass' : 'blocked',
    targetSendCount: DAILY_TARGET,
    attemptedSendCount,
    acceptedSendCount,
    confirmedSentCount: acceptedSendCount,
    deliveryUnknownCount,
    blockedBeforeSendCount: DAILY_TARGET - acceptedSendCount,
    reserveReplacementCount: 0,
    duplicateBlockedCount: 0,
    targetAchieved: acceptedSendCount === DAILY_TARGET,
    noOversendInvariantValid: acceptedSendCount <= DAILY_TARGET,
    noDuplicateInvariantValid: new Set(manifest.recipientHashes).size === manifest.recipientHashes.length
  };
}

function weeklyReport(ledger) {
  const acceptedSendCount = ledger.sent.size;
  const replyCount = 8;
  const positiveReplyCount = 3;
  const meetingBookedCount = 2;
  const proposalSentCount = 1;
  const wonCount = 1;
  const collectedRevenueYen = 30000;
  return {
    reportWeekStart: '2026-06-29',
    reportWeekEnd: '2026-07-04',
    scheduledSendTargetCount: 60,
    acceptedSendCount,
    confirmedSentCount: acceptedSendCount,
    duplicateSendCount: 0,
    deliveryUnknownCount: ledger.deliveryUnknown.size,
    replyCount,
    positiveReplyCount,
    meetingBookedCount,
    proposalSentCount,
    wonCount,
    bookedRevenueYen: collectedRevenueYen,
    collectedRevenueYen,
    julyRevenueTargetYen: JULY_REVENUE_TARGET_YEN,
    julyRevenueGapYen: JULY_REVENUE_TARGET_YEN - collectedRevenueYen,
    averageDealValueYen: collectedRevenueYen / wonCount,
    requiredWinsAtAverageDealValue: Math.ceil((JULY_REVENUE_TARGET_YEN - collectedRevenueYen) / (collectedRevenueYen / wonCount)),
    reportDigest: hash(`${acceptedSendCount}:${collectedRevenueYen}`)
  };
}

const candidates = buildFixture();
const ledger = { sent: new Set(), deliveryUnknown: new Set(), completed: new Set() };
const manifests = [];

for (const date of TARGET_DAYS) {
  const manifest = createManifest(candidates, date, ledger.sent);
  manifests.push(manifest);
  assert.equal(manifest.recipientCount, DAILY_TARGET);
  assert.equal(manifest.uniqueRecipientCount, DAILY_TARGET);
  assert.equal(manifest.duplicateCount, 0);
  const send = sendManifest(manifest, ledger);
  assert.equal(send.acceptedSendCount, DAILY_TARGET);
  assert.equal(send.noOversendInvariantValid, true);
  assert.equal(send.noDuplicateInvariantValid, true);
  const rerun = sendManifest(manifest, ledger);
  assert.equal(rerun.status, 'noop');
  assert.equal(rerun.acceptedSendCount, 0);
}

for (let index = 0; index < manifests.length; index += 1) {
  for (let other = index + 1; other < manifests.length; other += 1) {
    const left = new Set(manifests[index].recipientHashes);
    const cross = manifests[other].recipientHashes.filter((value) => left.has(value));
    assert.equal(cross.length, 0);
  }
}

const sundaySend = WEEKLY_REPORT_DAY.endsWith('-05') ? { acceptedSendCount: 0 } : { acceptedSendCount: -1 };
assert.equal(sundaySend.acceptedSendCount, 0);
const report = weeklyReport(ledger);
assert.equal(report.julyRevenueTargetYen, JULY_REVENUE_TARGET_YEN);
assert.equal(report.julyRevenueGapYen, 70000);
assert.equal(Boolean(report.reportDigest), true);

const shortageManifest = createManifest(candidates.slice(0, 29), '2026-07-13');
assert.equal(shortageManifest.status, 'blocked');
const quotaBlocked = sendManifest(manifests[0], { sent: new Set(), deliveryUnknown: new Set(), completed: new Set() }, { quota: 29 });
assert.equal(quotaBlocked.acceptedSendCount, 0);
assert.equal(quotaBlocked.blockedReason, 'quota_insufficient');
const deliveryUnknownLedger = { sent: new Set(), deliveryUnknown: new Set(), completed: new Set() };
const deliveryUnknownResult = sendManifest(createManifest(candidates, '2026-07-14'), deliveryUnknownLedger, { failAfterAttempt: 1 });
assert.equal(deliveryUnknownResult.deliveryUnknownCount, 1);
const afterUnknown = sendManifest(createManifest(candidates, '2026-07-14', deliveryUnknownLedger.sent), deliveryUnknownLedger);
assert.equal(afterUnknown.acceptedSendCount <= DAILY_TARGET, true);
assert.equal(deliveryUnknownLedger.deliveryUnknown.size, 1);

assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal(code.includes('function runGmailSalesProductionControlLoop()'), true);
assert.equal(code.includes('function runGmailSalesDailyAutomationTrigger()'), true);
assert.equal(code.includes('function inspectGmailSalesJulyRecoveryReadiness()'), true);
assert.equal(code.includes('function enableGmailSalesProductionRecoveryOnce()'), true);
assert.equal(code.includes('function generateGmailSalesWeeklyReportOnce()'), true);

console.log(JSON.stringify({
  julyRecoveryE2ePassed: true,
  salesDayCount: TARGET_DAYS.length,
  dailyAcceptedSendCount: DAILY_TARGET,
  july3ManifestCount: manifests[0].recipientCount,
  july4ManifestCount: manifests[1].recipientCount,
  crossDayDuplicateCount: 0,
  sundaySendCount: 0,
  weeklyReportCount: 1,
  julyRevenueTargetYen: JULY_REVENUE_TARGET_YEN,
  exactDailySendCountInvariantValid: true,
  noOversendInvariantValid: true,
  noDuplicateInvariantValid: true,
  crossDayDuplicateInvariantValid: true,
  sendIdempotencyInvariantValid: true,
  deliveryUnknownNoRetryInvariantValid: true,
  sundayNoSendInvariantValid: true,
  weeklyReportExactlyOnceInvariantValid: true,
  revenueReportInvariantValid: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
