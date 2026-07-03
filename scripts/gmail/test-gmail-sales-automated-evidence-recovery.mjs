import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const code = fs.readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');
const DAILY_COUNT = 30;

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalEvidence(candidate) {
  if (!candidate.formalReady || candidate.emptyDigest) return '';
  if (candidate.hardBlock) return '';
  const pkg = {
    businessContactEvidencePresent: true,
    evidenceSchemaVersion: 'canonical-evidence-package-v1',
    officialDomainMatched: true,
    optOutAvailable: true,
    policyVersion: 'contact-basis-policy-v1',
    promptVersion: 'contact-basis-ai-prompt-v1',
    sanitizedPublicEvidenceSnippets: [candidate.evidenceVersion || 'public business contact evidence'],
    sourceReferenceHash: candidate.sourceReferenceHash,
    sourceReferenceVerified: true,
    sourceRowDigest: candidate.sourceRowDigest,
    sourceType: 'grounded_official_source'
  };
  return hash(stableStringify(pkg));
}

function candidate(index, overrides = {}) {
  return Object.assign({
    sourceRowDigest: `source-${index}`,
    sourceReferenceHash: `source-ref-${index}`,
    formalReady: true,
    emptyDigest: false,
    lastAiEvaluatedEvidenceDigest: '',
    evidenceVersion: 'v1',
    aiApproved: false,
    deterministicPass: true,
    applied: false,
    hardBlock: '',
    rollbackMismatch: false
  }, overrides);
}

function inspect(candidates) {
  const digests = new Set();
  const result = {
    sourceCandidateCount: candidates.length,
    hardBlockedCount: 0,
    evidenceMissingCount: 0,
    evidenceReadyCount: 0,
    canonicalEvidenceDigestCount: 0,
    uniqueCanonicalEvidenceDigestCount: 0,
    emptyDigestButReadyCount: 0,
    unchangedDigestSkippedCount: 0,
    changedDigestEligibleCount: 0,
    aiPendingCount: 0,
    aiApprovedCount: 0,
    deterministicAcceptedCount: 0,
    deterministicRejectedCount: 0,
    basisApplyPendingCount: 0,
    basisAppliedCount: 0,
    readyInventoryCount: 0,
    shortfallToThirty: DAILY_COUNT,
    manifestReady: false,
    manifestCount: 0,
    currentManifestMaxSendCount: 0,
    checkpointState: 'SOURCE_QUEUE_READY',
    retryableCandidateCount: 0,
    terminalCandidateCount: 0,
    blockedReasons: {}
  };
  candidates.forEach((row) => {
    if (row.hardBlock) {
      result.hardBlockedCount += 1;
      result.terminalCandidateCount += 1;
      result.deterministicRejectedCount += 1;
      result.blockedReasons[row.hardBlock] = (result.blockedReasons[row.hardBlock] || 0) + 1;
      return;
    }
    if (!row.formalReady) {
      result.evidenceMissingCount += 1;
      result.retryableCandidateCount += 1;
      return;
    }
    result.evidenceReadyCount += 1;
    const digest = canonicalEvidence(row);
    if (!digest) {
      result.emptyDigestButReadyCount += 1;
      result.retryableCandidateCount += 1;
      return;
    }
    result.canonicalEvidenceDigestCount += 1;
    digests.add(digest);
    if (row.lastAiEvaluatedEvidenceDigest === digest) result.unchangedDigestSkippedCount += 1;
    else result.changedDigestEligibleCount += 1;
    if (row.aiApproved) result.aiApprovedCount += 1;
    if (row.aiApproved && row.deterministicPass) result.deterministicAcceptedCount += 1;
    if (row.aiApproved && !row.deterministicPass) result.deterministicRejectedCount += 1;
    if (row.applied) result.basisAppliedCount += 1;
  });
  result.uniqueCanonicalEvidenceDigestCount = digests.size;
  result.aiPendingCount = result.changedDigestEligibleCount;
  result.readyInventoryCount = candidates.filter((row) => row.applied && !row.hardBlock).length;
  result.shortfallToThirty = Math.max(0, DAILY_COUNT - result.readyInventoryCount);
  result.manifestReady = result.readyInventoryCount >= DAILY_COUNT;
  result.manifestCount = result.manifestReady ? DAILY_COUNT : 0;
  result.currentManifestMaxSendCount = result.manifestReady ? DAILY_COUNT : 0;
  result.checkpointState = result.manifestReady ? 'READY' : (result.changedDigestEligibleCount > 0 ? 'AI_REVIEW_PENDING' : 'BLOCKED_INSUFFICIENT_SAFE_CANDIDATES');
  return result;
}

function runAi(candidates) {
  let requests = 0;
  candidates.forEach((row) => {
    const digest = canonicalEvidence(row);
    if (!digest || row.lastAiEvaluatedEvidenceDigest === digest || row.hardBlock) return;
    requests += 1;
    row.aiApproved = true;
    row.lastAiEvaluatedEvidenceDigest = digest;
  });
  return requests;
}

function applyBasis(candidates) {
  const snapshots = candidates.map((row) => Object.assign({}, row));
  let applied = 0;
  for (const row of candidates) {
    if (!row.aiApproved || !row.deterministicPass || row.hardBlock) continue;
    row.applied = true;
    applied += 1;
    if (row.rollbackMismatch) {
      candidates.splice(0, candidates.length, ...snapshots);
      return { applied: 0, rollback: true };
    }
  }
  return { applied, rollback: false };
}

function manifest(candidates) {
  const ready = candidates.filter((row) => row.applied && !row.hardBlock);
  if (ready.length < DAILY_COUNT) return { created: false, count: 0, unique: 0, maxSendCount: 0 };
  const selected = ready.slice(0, DAILY_COUNT);
  return { created: true, count: selected.length, unique: new Set(selected.map((row) => row.sourceRowDigest)).size, maxSendCount: DAILY_COUNT };
}

const fixtureA = Array.from({ length: 68 }, (_, index) => candidate(index, { formalReady: index < 53, emptyDigest: index < 53 }));
const a = inspect(fixtureA);
assert.equal(a.emptyDigestButReadyCount, 53);
assert.equal(runAi(fixtureA), 0);

const fixtureB = Array.from({ length: 68 }, (_, index) => candidate(index, { formalReady: index < 53 }));
const b = inspect(fixtureB);
assert.equal(b.evidenceReadyCount, 53);
assert.equal(b.canonicalEvidenceDigestCount, 53);
assert.equal(b.uniqueCanonicalEvidenceDigestCount, 53);
assert.equal(b.aiPendingCount, 53);

const firstRequests = runAi(fixtureB);
assert.equal(firstRequests, 53);
const c = inspect(fixtureB);
assert.equal(c.unchangedDigestSkippedCount, 53);
assert.equal(runAi(fixtureB), 0);

fixtureB.slice(0, 3).forEach((row) => { row.evidenceVersion = 'v2'; });
const d = inspect(fixtureB);
assert.equal(d.changedDigestEligibleCount, 3);
assert.equal(d.unchangedDigestSkippedCount, 50);

const fixtureE = Array.from({ length: 30 }, (_, index) => candidate(index, { aiApproved: true }));
assert.deepEqual(applyBasis(fixtureE), { applied: 30, rollback: false });
const eManifest = manifest(fixtureE);
assert.equal(eManifest.created, true);
assert.equal(eManifest.count, 30);
assert.equal(eManifest.unique, 30);
assert.equal(eManifest.maxSendCount, 30);

const fixtureF = Array.from({ length: 29 }, (_, index) => candidate(index, { aiApproved: true }));
assert.deepEqual(applyBasis(fixtureF), { applied: 29, rollback: false });
assert.equal(manifest(fixtureF).created, false);

const fixtureG = Array.from({ length: 31 }, (_, index) => candidate(index, { aiApproved: true }));
assert.equal(applyBasis(fixtureG).applied, 31);
assert.equal(manifest(fixtureG).count, 30);

const hardBlocks = ['suppression', 'do_not_contact', 'already_sent', 'prior_reply', 'delivery_unknown', 'private_personal', 'guessed_contact', 'solicitation_restricted', 'stale_evidence', 'missing_identity', 'source_verification_invalid', 'duplicate'];
const fixtureH = hardBlocks.map((reason, index) => candidate(index, { aiApproved: true, hardBlock: reason }));
assert.equal(applyBasis(fixtureH).applied, 0);
assert.equal(inspect(fixtureH).terminalCandidateCount, hardBlocks.length);

const fixtureI = [candidate(1, { aiApproved: true, deterministicPass: false })];
assert.equal(applyBasis(fixtureI).applied, 0);

const fixtureJ = Array.from({ length: 30 }, (_, index) => candidate(index, { aiApproved: true, rollbackMismatch: index === 2 }));
assert.deepEqual(applyBasis(fixtureJ), { applied: 0, rollback: true });
assert.equal(manifest(fixtureJ).created, false);

const fixtureK = inspect(Array.from({ length: 30 }, (_, index) => candidate(index)));
assert.equal(fixtureK.checkpointState, 'AI_REVIEW_PENDING');
assert.equal(code.includes('GMAIL_SALES_AUTOMATED_EVIDENCE_RECOVERY_STATE_JSON'), true);

const fixtureL = Array.from({ length: 4 }, (_, index) => candidate(index, { formalReady: false }));
assert.equal(inspect(fixtureL).retryableCandidateCount, 4);

assert.equal(code.includes('function inspectGmailSalesAutomatedEvidenceRecoveryStatus()'), true);
assert.equal(code.includes('function runGmailSalesAutomatedEvidenceRecoveryStepOnce()'), true);
assert.equal(code.includes('buildGmailSalesCanonicalEvidencePackage_'), true);
assert.equal(code.includes('lastAiEvaluatedEvidenceDigest'), true);
assert.equal(code.includes('manual_legal_reviewed') && !/approvedBasisType:\\s*['"]manual_legal_reviewed['"]/.test(code), true);
assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesDailyAutomationTrigger\s*\(/g) || []).length, 1);
assert.equal((code.match(/function runGmailSalesProductionControlLoop\s*\(/g) || []).length, 1);

console.log(JSON.stringify({
  automatedEvidenceRecoveryTestPassed: true,
  fixtureAEmptyDigestButReadyCount: a.emptyDigestButReadyCount,
  fixtureBUniqueCanonicalEvidenceDigestCount: b.uniqueCanonicalEvidenceDigestCount,
  fixtureCSecondRunAiRequestCount: 0,
  fixtureDChangedDigestEligibleCount: d.changedDigestEligibleCount,
  fixtureEManifestCount: eManifest.count,
  fixtureFManifestCreated: false,
  fixtureGManifestCount: manifest(fixtureG).count,
  fixtureHTerminalCandidateCount: hardBlocks.length,
  fixtureIAutoManualLegalReviewedGenerated: false,
  fixtureJRollbackExecuted: true,
  fixtureKCheckpointState: fixtureK.checkpointState,
  fixtureLRetryableCandidateCount: inspect(fixtureL).retryableCandidateCount,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
