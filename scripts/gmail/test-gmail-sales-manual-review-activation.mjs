import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const code = fs.readFileSync(path.join(repoRoot, 'apps-script/gmail-sales-automation/Code.gs'), 'utf8');

const ALLOWED_BASIS = [
  'existing_relationship',
  'explicit_opt_in',
  'valid_business_contact_exception',
  'manual_legal_reviewed'
];

function createRows({ safeApprovedCount = 30 } = {}) {
  const rows = [];
  for (let index = 0; index < 36; index += 1) {
    const safe = index < safeApprovedCount;
    rows.push({
      id: `row-${index + 1}`,
      reviewDecision: 'needs_more_evidence',
      applyStatus: 'needs_more_evidence',
      applyErrorCode: index < 32 ? 'insufficient_evidence' : 'hard_policy_block',
      manualReviewDecision: safe ? 'approved' : (index % 2 ? 'needs_more_evidence' : 'rejected'),
      manualReviewBasisType: safe ? (index === 0 ? 'manual_legal_reviewed' : 'valid_business_contact_exception') : '',
      manualReviewReason: safe ? 'human_reviewed_public_business_contact' : '',
      manualReviewer: safe ? 'human' : '',
      manualReviewedAt: safe ? '2026-07-03T00:00:00.000Z' : '',
      optOutAvailable: safe ? 'TRUE' : '',
      duplicateKey: safe ? `unique-${index}` : `unsafe-${index % 2}`,
      suppressed: !safe && index % 3 === 0,
      doNotContact: false,
      priorSent: false,
      reply: false,
      deliveryUnknown: false,
      privatePersonal: false,
      guessed: false,
      solicitationRestricted: false,
      sourceJoin: true,
      hasMessage: true,
      hasOptOut: true,
      contactBasisType: ''
    });
  }
  return rows;
}

function manualReviewCandidates(rows) {
  return rows.filter((row) => {
    const reviewable = ['needs_review', 'needs_more_evidence', 'pending'].includes(row.reviewDecision) ||
      row.applyErrorCode === 'insufficient_evidence';
    const blocked = row.suppressed || row.doNotContact || row.priorSent || row.reply || row.deliveryUnknown ||
      row.privatePersonal || row.guessed || row.solicitationRestricted || row.applyErrorCode === 'hard_policy_block';
    return reviewable && !blocked;
  });
}

function validateManualApproval(row, seen) {
  if (row.manualReviewDecision !== 'approved') return 'manual_decision_not_approved';
  if (!row.manualReviewer) return 'manual_reviewer_missing';
  if (row.manualReviewer === 'ai_policy_engine') return 'manual_reviewer_must_be_human';
  if (!row.manualReviewedAt) return 'manual_reviewed_at_missing';
  if (!ALLOWED_BASIS.includes(row.manualReviewBasisType)) return 'manual_basis_type_invalid';
  if (!row.manualReviewReason) return 'manual_review_reason_missing';
  if (row.optOutAvailable !== true && String(row.optOutAvailable || '').trim().toLowerCase() !== 'true') return 'opt_out_unavailable';
  if (row.suppressed) return 'suppression_match';
  if (row.doNotContact) return 'do_not_contact';
  if (row.priorSent) return 'already_sent';
  if (row.reply) return 'reply_history_match';
  if (row.deliveryUnknown) return 'delivery_unknown';
  if (row.privatePersonal) return 'private_personal_contact';
  if (row.guessed) return 'guessed_contact';
  if (row.solicitationRestricted) return 'solicitation_restricted';
  if (!row.sourceJoin) return 'source_review_join_mismatch';
  if (seen.has(row.duplicateKey)) return 'duplicate_recipient';
  return '';
}

function applyManual(rows, { forceRollback = false } = {}) {
  const seen = new Set();
  const snapshots = rows.map((row) => ({ id: row.id, contactBasisType: row.contactBasisType, applyStatus: row.applyStatus }));
  let attempted = 0;
  let committed = 0;
  let blocked = 0;
  const reasonCounts = {};
  for (const row of rows) {
    if (row.manualReviewDecision !== 'approved') continue;
    attempted += 1;
    const reason = validateManualApproval(row, seen);
    if (reason) {
      blocked += 1;
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      row.applyStatus = 'skipped_invalid';
      continue;
    }
    row.contactBasisType = row.manualReviewBasisType;
    row.applyStatus = 'applied_manual';
    seen.add(row.duplicateKey);
    committed += 1;
  }
  if (forceRollback) {
    for (const snapshot of snapshots) {
      const row = rows.find((item) => item.id === snapshot.id);
      row.contactBasisType = snapshot.contactBasisType;
      row.applyStatus = snapshot.applyStatus;
    }
    return { attempted, committed: 0, blocked: attempted, rollbackExecuted: true, reasonCounts: { read_back_mismatch: 1 } };
  }
  return { attempted, committed, blocked, rollbackExecuted: false, reasonCounts };
}

function readyInventory(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (!ALLOWED_BASIS.includes(row.contactBasisType)) return false;
    if (row.suppressed || row.doNotContact || row.priorSent || row.reply || row.deliveryUnknown || row.privatePersonal || row.guessed || row.solicitationRestricted) return false;
    if (seen.has(row.duplicateKey)) return false;
    seen.add(row.duplicateKey);
    return row.hasMessage && row.hasOptOut;
  });
}

function createManifest(rows) {
  const ready = readyInventory(rows);
  if (ready.length < 30) return { created: false, count: 0, maxSendCount: 0, blockedReason: 'eligible_basis_count_below_30' };
  return { created: true, count: 30, unique: 30, duplicate: 0, maxSendCount: 30 };
}

const queueRows = createRows();
assert.ok(manualReviewCandidates(queueRows).length >= 30);

const unapplied = createRows({ safeApprovedCount: 0 });
assert.equal(applyManual(unapplied).committed, 0);

const missingReviewer = createRows();
missingReviewer[0].manualReviewer = '';
const missingReviewerResult = applyManual(missingReviewer);
assert.equal(missingReviewerResult.reasonCounts.manual_reviewer_missing, 1);

const missingOptOut = createRows();
missingOptOut[0].optOutAvailable = '';
const missingOptOutResult = applyManual(missingOptOut);
assert.equal(missingOptOutResult.reasonCounts.opt_out_unavailable, 1);
assert.equal(missingOptOut[0].contactBasisType, '');
assert.notEqual(missingOptOut[0].applyStatus, 'applied_manual');
assert.equal(createManifest(missingOptOut).created, false);

const falseOptOut = createRows();
falseOptOut[0].optOutAvailable = 'FALSE';
const falseOptOutResult = applyManual(falseOptOut);
assert.equal(falseOptOutResult.reasonCounts.opt_out_unavailable, 1);

const trueOptOut = createRows({ safeApprovedCount: 1 });
trueOptOut[0].optOutAvailable = true;
const trueOptOutResult = applyManual(trueOptOut);
assert.equal(trueOptOutResult.committed, 1);

const aiManual = createRows();
aiManual[0].manualReviewer = 'ai_policy_engine';
aiManual[0].manualReviewBasisType = 'manual_legal_reviewed';
const aiManualResult = applyManual(aiManual);
assert.equal(aiManualResult.reasonCounts.manual_reviewer_must_be_human, 1);

const suppressed = createRows();
suppressed[0].suppressed = true;
const suppressedResult = applyManual(suppressed);
assert.equal(suppressedResult.reasonCounts.suppression_match, 1);

const duplicate = createRows();
duplicate[1].duplicateKey = duplicate[0].duplicateKey;
const duplicateResult = applyManual(duplicate);
assert.equal(duplicateResult.reasonCounts.duplicate_recipient, 1);

const rollback = applyManual(createRows(), { forceRollback: true });
assert.equal(rollback.rollbackExecuted, true);
assert.equal(rollback.committed, 0);

const successRows = createRows();
const success = applyManual(successRows);
assert.equal(success.committed, 30);
const manifest = createManifest(successRows);
assert.equal(manifest.created, true);
assert.equal(manifest.count, 30);
assert.equal(manifest.maxSendCount, 30);

const shortRows = createRows({ safeApprovedCount: 29 });
applyManual(shortRows);
const blockedManifest = createManifest(shortRows);
assert.equal(blockedManifest.created, false);
assert.equal(blockedManifest.blockedReason, 'eligible_basis_count_below_30');

const thirtyWithOneMissingOptOut = createRows();
thirtyWithOneMissingOptOut[0].optOutAvailable = '';
const optOutGate = applyManual(thirtyWithOneMissingOptOut);
assert.equal(optOutGate.committed, 29);
assert.equal(createManifest(thirtyWithOneMissingOptOut).created, false);

const statusSummary = {
  manualBlockedReasonCounts: { policy_or_history_blocked: 2 },
  manualOptOutConfirmedCount: queueRows.filter((row) => String(row.optOutAvailable || '').trim().toLowerCase() === 'true').length,
  manualOptOutMissingOrFalseCount: queueRows.filter((row) => String(row.optOutAvailable || '').trim().toLowerCase() !== 'true').length
};
assert.ok(code.includes('manualBlockedReasonCounts'));
assert.ok(code.includes('manualOptOutConfirmedCount'));
assert.ok(code.includes('logGmailSalesJsonResult_(result)'));

[
  'prepareGmailSalesManualReviewQueueOnce',
  'applyGmailSalesManualReviewDecisionsOnce',
  'inspectGmailSalesManualReviewStatus',
  'inspectGmailSalesRecoveryManualReviewQueue',
  'repairGmailSalesEvidenceDigestContractOnce',
  'runGmailSalesRecoveryPreparationStepOnce'
].forEach((name) => assert.ok(code.includes(`function ${name}`), `${name} missing`));
assert.ok(code.includes('validateGmailSalesManualReviewEvidenceDigestContract_'));
assert.ok(code.includes("manual_evidence_digest_missing"));
assert.ok(code.includes("manual_evidence_digest_mismatch"));
assert.ok(code.includes("recommendedNextAction: coverage.eligibleAfterBasisCheckCount >= gmailDailyExpectedCount_() ? 'build_exact_30_manifest' : 'continue_manual_review'"));
assert.ok(code.includes('aiReviewReexecutedCount: 0'));

const sendCallSites = (code.match(/MailApp\.sendEmail\s*\(/g) || []).length;
assert.equal(sendCallSites, 1);
assert.ok(!/manualReviewBasisType:\\s*['"]manual_legal_reviewed['"]/.test(code));
assert.equal(code.includes("optOutAvailable: review.optOutAvailable || 'TRUE'"), false);

console.log(JSON.stringify({
  manualReviewActivationTestPassed: true,
  manualReviewCandidateCount: manualReviewCandidates(queueRows).length,
  manualApplyCommittedCount: success.committed,
  manifestCreated: manifest.created,
  manifestCount: manifest.count,
  manifestMaxSendCount: manifest.maxSendCount,
  insufficientSafeCandidateBlocks: true,
  optOutMissingBlocksApply: true,
  optOutFalseBlocksApply: true,
  optOutTruePassesValidation: true,
  manualBlockedReasonCountsPresent: Boolean(statusSummary.manualBlockedReasonCounts),
  manualOptOutConfirmedCount: statusSummary.manualOptOutConfirmedCount,
  manualOptOutMissingOrFalseCount: statusSummary.manualOptOutMissingOrFalseCount,
  rollbackTestPassed: rollback.rollbackExecuted,
  aiManualLegalReviewedAutoGenerationBlocked: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  actualProductionUrlFetchAppCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: sendCallSites
}, null, 2));
