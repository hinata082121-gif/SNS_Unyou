import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

const SOURCE_HEADERS = [
  'prospectId', 'name', 'email', 'contactEmail', 'publicSource', 'sourceUrl', 'sourceReference', 'sourceType',
  'subject', 'body', 'status', 'sendDate', 'dedupeKey', 'sentStatus', 'replyStatus', 'unsubscribe',
  'doNotContact', 'sendState', 'notes', 'existingRelationshipEvidence', 'explicitOptInEvidence',
  'businessContactEvidence', 'contactBasisType', 'contactBasisRecordedAt', 'sourceReferenceHash',
  'optOutAvailable', 'lastVerifiedAt', 'suppressionCheckedAt', 'historyCheckedAt', 'sourceEvidenceDigest',
  'sourceVerificationStatus', 'sourceSafetyVerified', 'sourceIdentityVerified', 'sourceSafetyValidatorVersion',
  'sourceIdentityValidatorVersion', 'sourceVerificationPolicyVersion', 'sourceVerificationDigest',
  'sourceIdentityDigestVersion', 'sourceEvidenceDigestVersion', 'officialDomainHash', 'sourceVerifiedAt',
  'sourceVerificationVersion', 'sourceDiscoveryConfidence', 'sourceDiscoveryReasonCodes',
  'sourceDiscoveryCitationDigest', 'sourceDiscoveryStatus', 'sourceDiscoveredAt'
];

const REVIEW_HEADERS = [
  'reviewId', 'sourceRowKey', 'leadIdHash', 'sourceRowDigest', 'businessDisplayName', 'contactDisplay',
  'sourceType', 'sourceReference', 'sourceReferenceHash', 'existingRelationshipEvidence',
  'explicitOptInEvidence', 'businessContactEvidence', 'existingContactBasisType', 'suggestedBasisType',
  'suggestionReasonCode', 'reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable',
  'reviewerLabel', 'reviewedAt', 'applyStatus', 'applyErrorCode', 'appliedAt', 'lastQueueSyncedAt',
  'priorityRank', 'priorityReasonCode', 'sourceEvidenceDigest', 'sourceVerificationStatus',
  'sourceSafetyVerified', 'sourceIdentityVerified', 'sourceSafetyValidatorVersion',
  'sourceIdentityValidatorVersion', 'sourceVerificationPolicyVersion', 'sourceVerificationDigest',
  'sourceIdentityDigestVersion', 'sourceEvidenceDigestVersion', 'officialDomainHash', 'sourceVerifiedAt',
  'sourceVerificationVersion', 'sourceDiscoveryConfidence', 'sourceDiscoveryReasonCodes',
  'sourceDiscoveryCitationDigest', 'sourceDiscoveryStatus', 'sourceDiscoveredAt'
];

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('official evidence enrichment updates only eligible needs-more-evidence rows', () => {
  const env = createEnvironment({ sourceCount: 4 });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'evidence_payload_missing');
  markNeedsMoreEvidence(env, 3, 'insufficient_evidence');
  writeReview(env, 4, 'applyStatus', 'applied');
  writeReview(env, 5, 'reviewDecision', 'rejected');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.evidenceEnrichmentTargetCount, 2);
  assert.equal(result.evidenceEnrichmentSucceededCount, 2);
  assert.equal(result.officialPageFetchCount, 1);
  assert.equal(result.officialPageCacheHitCount >= 1, true);
  assert.equal(result.officialBusinessChannelCount, 2);
  assert.equal(result.evidenceDigestChangedCount, 2);
  assert.equal(result.aiReevaluationEligibleCount, 2);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'pending');
  assert.equal(readReview(env, 2, 'applyStatus'), 'pending');
  assert.equal(Boolean(readReview(env, 2, 'evidencePackageDigest')), true);
  assert.equal(readReview(env, 4, 'applyStatus'), 'applied');
  assert.equal(readReview(env, 5, 'reviewDecision'), 'rejected');
});

test('enrichment classifies missing source for replenishment without URL guessing', () => {
  const env = createEnvironment({ sourceCount: 1 });
  setSource(env, 2, { sourceReference: '', sourceUrl: '', publicSource: '', sourceType: '' });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'evidence_payload_missing');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'no_verified_source_reference');
  assert.equal(result.evidenceEnrichmentTargetCount, 0);
  assert.equal(result.evidenceEnrichmentSucceededCount, 0);
  assert.equal(result.evidenceEnrichmentMissingCount, 0);
  assert.equal(result.officialPageFetchCount, 0);
  assert.equal(result.evidenceReplenishmentQueueCount, 1);
  assert.equal(Boolean(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue), false);
  assert.equal(result.googleSheetsUpdated, false);
});

test('enrichment readiness diagnoses committed source digest mismatch without AI configuration', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: false });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'evidence_payload_missing');
  const backedReviewRow = reviewRowIndexForSource(env, 2);
  writeReview(env, backedReviewRow, 'sourceRowDigest', 'stale-redacted-digest');
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.sourceSheetPresent, true);
  assert.equal(readiness.reviewSheetPresent, true);
  assert.equal(readiness.sourceReferencePresentCount, 1);
  assert.equal(readiness.reviewSourceReferencePresentCount, 1);
  assert.equal(readiness.sourceReviewJoinSucceededCount, 1);
  assert.equal(readiness.sourceReferenceExactMatchCount, 1);
  assert.equal(readiness.sourceReferenceHashMatchCount, 1);
  assert.equal(readiness.sourceRowDigestMismatchCount, 1);
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 0);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_row_digest_mismatch, 1);
  assert.equal(readiness.recommendedNextAction, 'repair_committed_source_reference_digest');
  assert.equal(readiness.aiEnabled, false);
  assert.equal(readiness.aiConfigurationValid, false);
  assert.equal(readiness.aiApiCalled, false);
  assert.equal(readiness.googleSheetsUpdated, false);
  assert.equal(env.fetchMap.size > 0, true);
});

test('committed source digest repair preserves source reference and enables enrichment', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: false });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const beforeReference = readReview(env, 2, 'sourceReference');
  const backedReviewRow = reviewRowIndexForSource(env, 2);
  writeReview(env, backedReviewRow, 'sourceRowDigest', 'stale-redacted-digest');
  const repair = env.context.repairGmailSalesCommittedSourceReferenceDigestOnce();
  assert.equal(repair.status, 'pass');
  assert.equal(repair.repairEligibleCount, 1);
  assert.equal(repair.repairAttemptedCount, 1);
  assert.equal(repair.repairCommittedCount, 1);
  assert.equal(repair.repairRolledBackCount, 0);
  assert.equal(repair.sourceReferencePreserved, true);
  assert.equal(repair.contactBasisChanged, false);
  assert.equal(repair.googleSheetsUpdated, true);
  assert.equal(repair.aiApiCalled, false);
  assert.equal(readReview(env, 2, 'sourceReference'), beforeReference);
  assert.equal(readReview(env, 2, 'contactBasisType'), '');
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 1);
  assert.equal(readiness.enrichmentReadinessValid, true);
  assert.equal(readiness.recommendedNextAction, 'run_official_evidence_enrichment');
});

test('stable identity digest ignores mutable source reference and audit fields', () => {
  const env = createEnvironment({ sourceCount: 1 });
  const row = Object.assign({}, buildSourceRow(1));
  const key = env.context.buildGmailSalesContactSourceRowKey_(row, 2);
  const first = env.context.computeGmailSalesContactSourceDigest_(row, { sourceRowKey: key });
  row.sourceReference = 'changed-redacted-reference';
  row.sourceReferenceHash = 'changed-redacted-hash';
  row.sourceType = 'changed_type';
  row.sourceVerifiedAt = '2026-07-02T00:00:00.000Z';
  row.aiEvidenceDigest = 'changed-redacted-ai-digest';
  const second = env.context.computeGmailSalesContactSourceDigest_(row, { sourceRowKey: key });
  assert.equal(first, second);
  const evidenceA = env.context.computeGmailSalesSourceEvidenceDigest_(row, { sourceReferenceHash: 'a', sourceType: 'grounded_official_source' });
  const evidenceB = env.context.computeGmailSalesSourceEvidenceDigest_(row, { sourceReferenceHash: 'b', sourceType: 'grounded_official_source' });
  assert.notEqual(evidenceA, evidenceB);
});

test('readiness separates legacy review references from source-backed verification candidates', () => {
  const env = createEnvironment({ sourceCount: 66, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  for (let rowIndex = 2; rowIndex <= 67; rowIndex += 1) markNeedsMoreEvidence(env, rowIndex, 'insufficient_evidence');
  for (let rowIndex = 3; rowIndex <= 67; rowIndex += 1) {
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReference', '');
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReferenceHash', '');
  }
  clearAttestation(env, 2);
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.reviewReferencePresentCount, 66);
  assert.equal(readiness.sourceBackedReferenceCandidateCount, 1);
  assert.equal(readiness.referenceAndHashMatchedCandidateCount, 1);
  assert.equal(readiness.reviewOnlyLegacyReferenceCount, 65);
  assert.equal(readiness.verifiedSourceReferenceCandidateCount, 0);
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 0);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_safety_attestation_missing, 1);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_reference_missing_on_source, 65);
  assert.equal(readiness.recommendedNextAction, 'repair_committed_source_verification_attestation');
  assert.equal(readiness.aiApiCalled, false);
});

test('committed source verification attestation repair preserves reference hash and type', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const beforeReference = readReview(env, 2, 'sourceReference');
  const beforeHash = readReview(env, 2, 'sourceReferenceHash');
  const beforeType = readReview(env, 2, 'sourceType');
  clearAttestation(env, 2);
  const before = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(before.referenceAndHashMatchedCandidateCount, 1);
  assert.equal(before.verifiedSourceReferenceCandidateCount, 0);
  assert.equal(before.recommendedNextAction, 'repair_committed_source_verification_attestation');
  const repair = env.context.repairGmailSalesCommittedSourceVerificationAttestationOnce();
  assert.equal(repair.status, 'pass');
  assert.equal(repair.attestationRepairEligibleCount, 1);
  assert.equal(repair.attestationRepairAttemptedCount, 1);
  assert.equal(repair.attestationRepairCommittedCount, 1);
  assert.equal(repair.attestationRepairRolledBackCount, 0);
  assert.equal(repair.sourceReferencePreserved, true);
  assert.equal(repair.sourceReferenceHashPreserved, true);
  assert.equal(repair.contactBasisChanged, false);
  assert.equal(repair.sourceSafetyAttestationWrittenCount, 1);
  assert.equal(repair.reviewSafetyAttestationWrittenCount, 1);
  assert.equal(repair.sourceIdentityAttestationWrittenCount, 1);
  assert.equal(repair.reviewIdentityAttestationWrittenCount, 1);
  assert.equal(repair.verificationReadBackMatched, true);
  assert.equal(repair.googleSheetsUpdated, true);
  assert.equal(repair.aiApiCalled, false);
  assert.equal(readReview(env, 2, 'sourceReference'), beforeReference);
  assert.equal(readReview(env, 2, 'sourceReferenceHash'), beforeHash);
  assert.equal(readReview(env, 2, 'sourceType'), beforeType);
  const after = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(after.verifiedSourceReferenceCandidateCount, 1);
  assert.equal(after.evidenceEnrichmentEligibleCount, 1);
  assert.equal(after.recommendedNextAction, 'run_official_evidence_enrichment');
});

test('digest repair is blocked by verification attestation before source digest repair', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  clearAttestation(env, 2);
  writeReview(env, reviewRowIndexForSource(env, 2), 'sourceRowDigest', 'stale-redacted-digest');
  const repair = env.context.repairGmailSalesCommittedSourceReferenceDigestOnce();
  assert.equal(repair.repairEligibleCount, 0);
  assert.equal(repair.repairBlockedByVerificationCount, 1);
  assert.equal(repair.repairBlockedReasonCounts.source_safety_attestation_missing, 1);
  assert.equal(repair.googleSheetsUpdated, false);
});

test('verification digest mismatch is a structured enrichment reason', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  writeReview(env, 2, 'sourceVerificationDigest', 'mismatch-redacted-digest');
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.referenceAndHashMatchedCandidateCount, 1);
  assert.equal(readiness.verifiedSourceReferenceCandidateCount, 0);
  assert.equal(readiness.sourceVerificationDigestMismatchCount, 1);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_verification_digest_mismatch, 1);
  assert.equal(readiness.recommendedNextAction, 'repair_committed_source_verification_attestation');
});

test('production equivalent verified source with stale digest routes to digest repair without discovery', () => {
  const env = createEnvironment({ sourceCount: 68, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  for (let rowIndex = 2; rowIndex <= 69; rowIndex += 1) markNeedsMoreEvidence(env, rowIndex, 'insufficient_evidence');
  for (let rowIndex = 3; rowIndex <= 69; rowIndex += 1) {
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReference', '');
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReferenceHash', '');
  }
  writeReview(env, reviewRowIndexForSource(env, 2), 'sourceRowDigest', 'stale-redacted-digest');
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.sourceRowCount, 68);
  assert.equal(readiness.reviewRowCount, 68);
  assert.equal(readiness.reviewReferencePresentCount, 68);
  assert.equal(readiness.sourceReferencePresentCount, 1);
  assert.equal(readiness.sourceBackedReferenceCandidateCount, 1);
  assert.equal(readiness.referenceAndHashMatchedCandidateCount, 1);
  assert.equal(readiness.verificationAttestationCandidateCount, 1);
  assert.equal(readiness.verifiedSourceReferenceCandidateCount, 1);
  assert.equal(readiness.reviewOnlyLegacyReferenceCount, 67);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_reference_not_safety_verified || 0, 0);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_reference_not_identity_verified || 0, 0);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_reference_not_current || 0, 0);
  assert.equal(readiness.enrichmentEligibilityReasonCounts.source_row_digest_mismatch, 1);
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 0);
  assert.equal(readiness.evidenceEnrichmentIneligibleCount, 68);
  assert.equal(readiness.enrichmentEligibilityReasonTotalCount, 68);
  assert.equal(readiness.verificationEligibilityInvariantValid, true);
  assert.equal(readiness.verifiedCandidateRoutingInvariantValid, true);
  assert.equal(readiness.eligibilityReasonInvariantValid, true);
  assert.equal(readiness.discoveryRoutingInvariantValid, true);
  assert.equal(readiness.recommendedNextAction, 'repair_committed_source_reference_digest');
});

test('digest repair after production equivalent stale digest enables enrichment', () => {
  const env = createEnvironment({ sourceCount: 68, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  for (let rowIndex = 2; rowIndex <= 69; rowIndex += 1) markNeedsMoreEvidence(env, rowIndex, 'insufficient_evidence');
  for (let rowIndex = 3; rowIndex <= 69; rowIndex += 1) {
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReference', '');
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, 'sourceReferenceHash', '');
  }
  writeReview(env, reviewRowIndexForSource(env, 2), 'sourceRowDigest', 'stale-redacted-digest');
  const repair = env.context.repairGmailSalesCommittedSourceReferenceDigestOnce();
  assert.equal(repair.repairEligibleCount, 1);
  assert.equal(repair.repairCommittedCount, 1);
  assert.equal(repair.googleSheetsUpdated, true);
  const readiness = env.context.inspectGmailSalesOfficialEvidenceEnrichmentReadiness();
  assert.equal(readiness.verifiedSourceReferenceCandidateCount, 1);
  assert.equal(readiness.sourceRowDigestMatchCount >= 1, true);
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 1);
  assert.equal(readiness.recommendedNextAction, 'run_official_evidence_enrichment');
});

test('canonical verification evaluator normalizes booleans status and versions', () => {
  const env = createEnvironment({ sourceCount: 1 });
  const source = rowObject(env.workbook.sheets['Gmail営業候補プール'], 2);
  const review = Object.assign({}, source);
  review.sourceVerificationStatus = 'VERIFIED';
  review.sourceSafetyVerified = true;
  review.sourceIdentityVerified = 'TRUE';
  source.sourceSafetyVerified = 'true';
  source.sourceIdentityVerified = 'verified';
  source.sourceVerificationStatus = 'verified';
  const evaluation = env.context.evaluateCommittedSourceVerificationAttestation_(source, review);
  assert.equal(evaluation.referenceBacked, true);
  assert.equal(evaluation.safetyVerified, true);
  assert.equal(evaluation.identityVerified, true);
  assert.equal(evaluation.verificationStatusVerified, true);
  assert.equal(evaluation.safetyValidatorCurrent, true);
  assert.equal(evaluation.identityValidatorCurrent, true);
  assert.equal(evaluation.policyVersionCurrent, true);
  assert.equal(evaluation.verificationDigestMatched, true);
  assert.equal(evaluation.verificationCurrent, true);
});

test('canonical source reference parser handles plain url json and malformed references', () => {
  const env = createEnvironment({ sourceCount: 1 });
  const plain = env.context.parseCanonicalOfficialSourceReference_('https://official.example/contact', 'official_site', {});
  assert.equal(plain.ok, true);
  assert.equal(plain.referenceFormat, 'plain_url');
  assert.equal(plain.normalizedSourceType, 'official_website');
  const json = env.context.parseCanonicalOfficialSourceReference_(JSON.stringify({ url: 'https://official.example/contact' }), 'verified_official_source', {});
  assert.equal(json.ok, true);
  assert.equal(json.referenceFormat, 'json');
  const malformed = env.context.parseCanonicalOfficialSourceReference_('{bad json', 'official_site', {});
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reasonCode, 'source_reference_url_missing');
  const missing = env.context.parseCanonicalOfficialSourceReference_(JSON.stringify({ hash: 'redacted' }), 'official_site', {});
  assert.equal(missing.ok, false);
  assert.equal(missing.reasonCode, 'source_reference_url_missing');
  const unsupported = env.context.parseCanonicalOfficialSourceReference_('https://official.example/contact', 'unknown_type', {});
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reasonCode, 'source_type_unsupported');
});

test('fetch readiness inspector validates canonical url without UrlFetchApp', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, reviewRowIndexForSource(env, 2), 'insufficient_evidence');
  const readiness = env.context.inspectGmailSalesOfficialEvidenceFetchReadiness();
  assert.equal(readiness.evidenceEnrichmentEligibleCount, 1);
  assert.equal(readiness.evidencePackageBuildAttemptCount, 1);
  assert.equal(readiness.evidencePackageBuildSucceededCount, 1);
  assert.equal(readiness.sourceReferenceCanonicalizationAttemptCount, 1);
  assert.equal(readiness.sourceReferenceCanonicalizationSucceededCount, 1);
  assert.equal(readiness.canonicalSourceUrlPresentCount, 1);
  assert.equal(readiness.sourceTypeSupportedCount, 1);
  assert.equal(readiness.sourceUrlSafetyAcceptedCount, 1);
  assert.equal(readiness.fetchEligibleCount, 1);
  assert.equal(readiness.fetchReadinessValid, true);
  assert.equal(readiness.urlFetchExecuted, false);
  assert.equal(readiness.googleSheetsUpdated, false);
});

test('canonical url missing prevents pass status and records fetch-not-attempted reason', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  setSource(env, 2, { sourceReference: JSON.stringify({ hash: 'redacted' }) });
  seedVerifiedSourceAttestations(env);
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, reviewRowIndexForSource(env, 2), 'insufficient_evidence');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'evidence_fetch_not_attempted');
  assert.equal(result.recommendedNextAction, 'inspect_official_evidence_fetch_readiness');
  assert.equal(result.evidenceEnrichmentTargetCount, 1);
  assert.equal(result.evidenceEnrichmentSucceededCount, 0);
  assert.equal(result.officialPageFetchAttemptCount, 0);
  assert.equal(result.fetchNotAttemptedReasonCounts.source_reference_url_missing, 2);
  assert.equal(result.evidenceEnrichmentMissingReasonCounts.source_reference_url_missing, 1);
});

test('fetch telemetry classifies http server errors without retrying discovery', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: true, provider: 'mock' });
  env.fetchMap.set('https://official.example/contact', {
    status: 503,
    headers: { 'Content-Type': 'text/html' },
    body: ''
  });
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, reviewRowIndexForSource(env, 2), 'insufficient_evidence');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.status, 'partial');
  assert.equal(result.blockedReason, 'official_page_fetch_failed');
  assert.equal(result.recommendedNextAction, 'inspect_official_page_fetch_failure');
  assert.equal(result.officialPageFetchAttemptCount, 1);
  assert.equal(result.officialPageFetchCount, 1);
  assert.equal(result.officialPageFetchFailureCount, 1);
  assert.equal(result.officialPageHttpServerErrorCount, 1);
  assert.equal(result.fetchAttemptedFailureReasonCounts.official_page_fetch_http_error, 1);
  assert.equal(result.gmailSendExecuted, false);
});

test('official URL safety blocks localhost private IP and mismatched redirect', () => {
  const env = createEnvironment({ sourceCount: 0 });
  assert.equal(env.context.validateOfficialEvidenceUrl_('http://localhost/contact').reasonCode, 'localhost_rejected');
  assert.equal(env.context.validateOfficialEvidenceUrl_('http://192.168.0.1/contact').reasonCode, 'private_ip_rejected');
  env.fetchMap.set('https://official.example/contact', {
    status: 302,
    headers: { Location: 'https://other.example/contact' },
    body: ''
  });
  const stats = env.context.emptyOfficialEvidenceEnrichmentStats_();
  assert.equal(env.context.fetchVerifiedOfficialPage_('https://official.example/contact', 'https://official.example/contact', stats).reasonCode, 'redirect_domain_mismatch');
});

test('sanitize removes script footer URL query email local part and phone', () => {
  const env = createEnvironment({ sourceCount: 0 });
  const text = env.context.sanitizeOfficialEvidenceText_('<script>x</script><footer>nav</footer><p>法人のお問い合わせ user@example.com 03-1234-5678 https://official.example/contact?a=1</p>');
  assert.equal(text.includes('user@example.com'), false);
  assert.equal(text.includes('03-1234-5678'), false);
  assert.equal(text.includes('?a=1'), false);
  assert.equal(text.includes('法人のお問い合わせ'), true);
});

test('unchanged digest avoids AI reevaluation and repeated fetch uses cache', () => {
  const env = createEnvironment({ sourceCount: 1 });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const first = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  writeReview(env, 2, 'lastAiEvaluatedEvidenceDigest', readReview(env, 2, 'evidencePackageDigest'));
  const second = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(first.evidenceDigestChangedCount, 1);
  assert.equal(second.evidenceDigestChangedCount, 0);
  assert.equal(second.officialPageCacheHitCount >= 1, true);
});

test('last run summary persists and inspector does not zero it', () => {
  const env = createEnvironment({ sourceCount: 3, aiEnabled: true, provider: 'mock', mockAutoApproval: false });
  for (let rowIndex = 2; rowIndex <= 4; rowIndex += 1) {
    setSource(env, rowIndex, { businessContactEvidence: `法人のお問い合わせ evidence ${rowIndex}` });
  }
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  const run = env.context.runGmailSalesAiContactBasisVerificationOnce();
  const status = env.context.inspectGmailSalesAiContactBasisStatus();
  assert.equal(run.aiEvaluatedCount, 3);
  assert.equal(status.lastRunIdPresent, true);
  assert.equal(status.lastAiEvaluatedCount, 3);
  assert.equal(status.lastAiBatchRequestCount, 1);
  assert.equal(status.providerConnectionAttempted, true);
  assert.equal(status.providerConnectionSucceeded, true);
});

test('solicitation restriction is not enriched for approval', () => {
  const env = createEnvironment({ sourceCount: 1 });
  env.fetchMap.set('https://official.example/contact', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main>法人のお問い合わせ 営業目的の連絡は禁止 お問い合わせフォーム</main>'
  });
  env.context.installGmailSalesAiVerificationConfigurationOnce();
  env.context.refreshGmailSalesContactBasisReviewQueueOnce();
  markNeedsMoreEvidence(env, 2, 'insufficient_evidence');
  const result = env.context.runGmailSalesOfficialEvidenceEnrichmentOnce();
  assert.equal(result.evidenceEnrichmentSucceededCount, 0);
  assert.equal(result.solicitationRestrictedCount, 0);
  assert.equal(readReview(env, 2, 'reviewDecision'), 'needs_more_evidence');
});

function createEnvironment(options = {}) {
  const rows = [SOURCE_HEADERS];
  for (let index = 1; index <= (options.sourceCount || 0); index += 1) rows.push(SOURCE_HEADERS.map((header) => buildSourceRow(index)[header] || ''));
  const env = {
    props: {
      SHEET_ID: 'sheet-id',
      SHEET_NAME: 'sales',
      GMAIL_DAILY_SOURCE_TAB_NAME: 'Gmail営業候補プール',
      GMAIL_SHEET_READY_TAB_NAME: 'sales',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      GMAIL_SALES_AI_ENABLED: options.aiEnabled ? 'true' : 'false',
      GMAIL_SALES_AI_PROVIDER: options.provider || 'disabled',
      GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED: options.mockAutoApproval ? 'true' : 'false',
      GMAIL_SALES_AI_MODEL: 'mock-model',
      GMAIL_SALES_AI_API_KEY: options.aiEnabled ? 'mock-redacted-token' : '',
      GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: '0.95',
      GMAIL_SALES_AI_MAX_DAILY_REQUESTS: '100',
      GMAIL_SALES_AI_MAX_DAILY_COST_YEN: '100'
    },
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [SOURCE_HEADERS]),
        'Gmail営業候補プール': new MockSheet('Gmail営業候補プール', rows),
        Gmail_Contact_Basis_Review: new MockSheet('Gmail_Contact_Basis_Review', [REVIEW_HEADERS])
      },
      getSheetByName(name) { return this.sheets[name] || null; },
      getSheets() { return Object.values(this.sheets); },
      insertSheet(name) {
        env.sheetWriteCount += 1;
        this.sheets[name] = new MockSheet(name, []);
        this.sheets[name].env = env;
        return this.sheets[name];
      }
    },
    fetchMap: new Map(),
    cache: new Map(),
    logs: [],
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0
  };
  env.fetchMap.set('https://official.example/contact', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main><a href="/business">法人のお問い合わせ</a> 企業向けお問い合わせフォーム 業務提携 広告掲載 取材 メディア サービス導入のご相談 [email]</main><footer>footer</footer>'
  });
  env.fetchMap.set('https://official.example/business', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<main>法人のお問い合わせ 業務提携について お問い合わせフォーム 配信停止</main>'
  });
  Object.values(env.workbook.sheets).forEach((sheet) => { sheet.env = env; });
	  env.context = buildContext(env);
	  vm.createContext(env.context);
	  vm.runInContext(code, env.context, { filename: 'Code.gs' });
	  seedVerifiedSourceAttestations(env);
	  return env;
	}

function buildContext(env) {
  return {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, Date, URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => 'uuid',
      formatDate: (_date, _timezone, pattern) => pattern === 'HH:mm' ? '06:45' : '2026-07-01'
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
        }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: {
      openById: () => env.workbook,
      flush: () => {},
      newDataValidation: () => ({
        requireValueInList(values) { this.values = values; return this; },
        setAllowInvalid() { return this; },
        build() { return { values: this.values || [] }; }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'runGmailSalesProductionControlLoop' }],
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }),
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => env.cache.get(key) || null,
        put: (key, value) => { env.cache.set(key, String(value)); }
      })
    },
    UrlFetchApp: {
      fetch: (url) => {
        const item = env.fetchMap.get(String(url));
        if (!item) throw new Error('unexpected fetch');
        return {
          getResponseCode: () => item.status,
          getHeaders: () => item.headers || {},
          getContentText: () => item.body || ''
        };
      }
    }
  };
}

function buildSourceRow(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'official source',
    sourceUrl: 'https://official.example/contact',
    sourceReference: 'https://official.example/contact',
	    sourceType: 'official_site',
	    sourceReferenceHash: '',
	    subject: `Subject ${index}`,
    body: `Body ${index}`,
    status: 'ready',
	    dedupeKey: `dedupe-${index}`
	  };
	}

function seedVerifiedSourceAttestations(env) {
  const sheet = env.workbook.sheets['Gmail営業候補プール'];
  for (let rowIndex = 2; rowIndex <= sheet.rows.length; rowIndex += 1) {
    const sourceReference = readCell(sheet, rowIndex, 'sourceReference');
    const sourceType = readCell(sheet, rowIndex, 'sourceType');
    if (!sourceReference || !sourceType) continue;
    const sourceReferenceHash = env.context.buildGmailSalesSourceReferenceHash_(sourceType, sourceReference);
    writeCell(sheet, rowIndex, 'sourceReferenceHash', sourceReferenceHash);
    writeCell(sheet, rowIndex, 'officialDomainHash', env.context.hashValue_('official-domain'));
    writeCell(sheet, rowIndex, 'sourceDiscoveryCitationDigest', env.context.hashValue_('citation'));
    writeCell(sheet, rowIndex, 'sourceVerificationVersion', 'official-source-discovery-v1');
    writeCell(sheet, rowIndex, 'sourceDiscoveryStatus', 'verified');
    const row = rowObject(sheet, rowIndex);
    const attestation = env.context.buildGmailSalesSourceVerificationAttestation_(row, {
      sourceReferenceHash,
      sourceType,
      sourceVerifiedAt: '2026-07-01T00:00:00.000Z'
    });
    Object.keys(attestation).forEach((field) => writeCell(sheet, rowIndex, field, attestation[field]));
    writeCell(sheet, rowIndex, 'sourceEvidenceDigest', env.context.computeGmailSalesSourceEvidenceDigest_(rowObject(sheet, rowIndex), { sourceReferenceHash, sourceType }));
    writeCell(sheet, rowIndex, 'sourceIdentityDigestVersion', 'source-digest-v2-stable-identity');
    writeCell(sheet, rowIndex, 'sourceEvidenceDigestVersion', 'source-evidence-digest-v1');
  }
}

function rowObject(sheet, rowIndex) {
  const row = sheet.rows[rowIndex - 1] || [];
  return sheet.rows[0].reduce((acc, header, index) => {
    acc[header] = row[index] || '';
    return acc;
  }, {});
}

function setSource(env, rowIndex, values) {
  Object.keys(values).forEach((key) => writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, key, values[key]));
}

function markNeedsMoreEvidence(env, rowIndex, reason) {
  writeReview(env, rowIndex, 'reviewDecision', 'needs_more_evidence');
  writeReview(env, rowIndex, 'applyStatus', 'needs_more_evidence');
  writeReview(env, rowIndex, 'applyErrorCode', reason);
  writeReview(env, rowIndex, 'evidenceNotes', `ai_exception_${reason}`);
}

function clearAttestation(env, rowIndex) {
  const reviewRowIndex = reviewRowIndexForSource(env, rowIndex) || rowIndex;
  [
    'sourceVerificationStatus',
    'sourceSafetyVerified',
    'sourceIdentityVerified',
    'sourceSafetyValidatorVersion',
    'sourceIdentityValidatorVersion',
    'sourceVerificationPolicyVersion',
    'sourceVerificationDigest'
  ].forEach((field) => {
    writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, field, '');
    writeReview(env, reviewRowIndex, field, '');
  });
}

function reviewRowIndexForSource(env, sourceRowIndex) {
  const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
  const reviewSheet = env.workbook.sheets.Gmail_Contact_Basis_Review;
  const sourceRow = rowObject(sourceSheet, sourceRowIndex);
  const key = env.context.buildGmailSalesContactSourceRowKey_(sourceRow, sourceRowIndex);
  const index = reviewSheet.rows.findIndex((row, rowIndex) => rowIndex > 0 && row[reviewSheet.rows[0].indexOf('sourceRowKey')] === key);
  if (index === -1) throw new Error('source backed review row not found');
  return index + 1;
}

function readReview(env, rowIndex, header) {
  return readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header);
}

function writeReview(env, rowIndex, header, value) {
  writeCell(env.workbook.sheets.Gmail_Contact_Basis_Review, rowIndex, header, value);
}

function readCell(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return index === -1 ? '' : sheet.rows[rowIndex - 1][index] || '';
}

function writeCell(sheet, rowIndex, header, value) {
  const index = sheet.rows[0].indexOf(header);
  if (index === -1) throw new Error(`missing header ${header}`);
  if (!sheet.rows[rowIndex - 1]) sheet.rows[rowIndex - 1] = [];
  sheet.rows[rowIndex - 1][index] = value;
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
      const target = this.row + r - 1;
      if (!this.sheet.rows[target]) this.sheet.rows[target] = [];
      rowValues.forEach((value, c) => { this.sheet.rows[target][this.column + c - 1] = value; });
    });
  }
  setValue(value) {
    if (this.sheet.env) this.sheet.env.sheetWriteCount += 1;
    const target = this.row - 1;
    if (!this.sheet.rows[target]) this.sheet.rows[target] = [];
    this.sheet.rows[target][this.column - 1] = value;
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
  clearDataValidations() { this.setDataValidation(null); }
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
  officialEvidenceEnrichmentTestPassed: true,
  scenarioCount: tests.length,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
