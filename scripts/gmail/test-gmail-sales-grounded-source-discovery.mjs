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
  'optOutAvailable', 'lastVerifiedAt', 'suppressionCheckedAt', 'historyCheckedAt',
  'companyName', 'brandName', 'serviceName', '会社名', 'ブランド名', 'サービス名', 'personName', 'domain'
];

const REVIEW_HEADERS = [
  'reviewId', 'sourceRowKey', 'leadIdHash', 'sourceRowDigest', 'businessDisplayName', 'contactDisplay',
  'sourceType', 'sourceReference', 'sourceReferenceHash', 'existingRelationshipEvidence',
  'explicitOptInEvidence', 'businessContactEvidence', 'existingContactBasisType', 'suggestedBasisType',
  'suggestionReasonCode', 'reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable',
  'reviewerLabel', 'reviewedAt', 'applyStatus', 'applyErrorCode', 'appliedAt', 'lastQueueSyncedAt',
  'priorityRank', 'priorityReasonCode'
];

const REPLENISHMENT_HEADERS = [
  'candidateToken', 'failureReasonCode', 'requiredEvidenceType', 'existingSourceType',
  'sourceReferencePresent', 'officialDomainPresent', 'eligibleForAutomatedReplenishment',
  'queuedAt', 'status', 'reviewId', 'leadIdHash', 'sourceRowKey', 'sourceRowDigest',
  'sourceRowKeyHash', 'reviewIdHash', 'publicBusinessIdentityPresent', 'publicBusinessIdentityDigest',
  'identityJoinStatus', 'identityJoinReasonCode', 'lastDiscoveryEligibilityCheckedAt', 'queueSchemaVersion'
];

const OLD_REPLENISHMENT_HEADERS = [
  'candidateToken', 'failureReasonCode', 'requiredEvidenceType', 'existingSourceType',
  'sourceReferencePresent', 'officialDomainPresent', 'eligibleForAutomatedReplenishment',
  'queuedAt', 'status'
];

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('grounded source discovery applies verified citation sources with one Gemini request per attempted candidate', () => {
  const env = createEnvironment({ sourceCount: 12 });
  seedGroundingReviewAndQueue(env, 12);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.candidatesAttemptedCount, 10);
  assert.equal(result.searchQueryCount, 10);
  assert.equal(result.searchRequestSuccessCount, 10);
  assert.equal(result.verifiedOfficialSourceCount, 10);
  assert.equal(result.sourceReferencesAppliedCount, 10);
  assert.equal(result.replenishmentQueueCount, 12);
  assert.equal(result.queueRowsWithJoinKeyCount, 12);
  assert.equal(result.sourceJoinSucceededCount, 12);
  assert.equal(result.reviewJoinSucceededCount, 12);
  assert.equal(result.publicBusinessIdentityPresentCount, 12);
  assert.equal(result.eligibleDiscoveryTargetCount, 12);
  assert.equal(result.googleSheetsUpdated, true);
  assert.equal(result.scriptPropertiesUpdated, true);
  assert.equal(result.verifiedOfficialSourceDetectedCount, 10);
  assert.equal(result.sourceReferenceWriteAttemptedCount, 10);
  assert.equal(result.sourceReferenceCommittedCount, 10);
  assert.equal(result.sourceReferenceWriteRolledBackCount, 0);
  assert.equal(result.sourceReadBackAttemptCount, 10);
  assert.equal(result.sourceReadBackMatchedCount, 10);
  assert.equal(result.reviewReadBackAttemptCount, 10);
  assert.equal(result.reviewReadBackMatchedCount, 10);
  assert.equal(result.queueReadBackAttemptCount, 10);
  assert.equal(result.queueReadBackMatchedCount, 10);
  assert.equal(result.sourceReferenceTransactionInvariantValid, true);
  assert.equal(env.fetchCalls.length, 10);
  assert.equal(env.propertyWriteCount, 4);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  env.fetchCalls.forEach((call) => {
    assert.equal(call.url.includes(env.props.GMAIL_SALES_AI_API_KEY), false);
    assert.equal(call.options.headers['x-goog-api-key'], env.props.GMAIL_SALES_AI_API_KEY);
    const payload = JSON.parse(call.options.payload);
    assert.deepEqual(payload.tools, [{ type: 'google_search' }]);
    assert.equal(payload.store, false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'previous_interaction_id'), false);
    assert.equal(call.url.includes(env.props.GMAIL_SALES_AI_API_KEY), false);
    assert.equal(payload.input.includes('@example.invalid'), false);
    assert.equal(payload.input.includes('Subject'), false);
    assert.equal(payload.input.includes('Body'), false);
    assert.equal(payload.input.includes('Person'), false);
    assert.equal(payload.input.includes('Business'), true);
  });
  assert.equal(readCell(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue, 2, 'status'), 'source_discovered');
  assert.equal(Boolean(readCell(env.workbook.sheets['Gmail営業候補プール'], 2, 'sourceReference')), true);
  assert.equal(readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, 2, 'sourceDiscoveryStatus'), 'verified');
  const status = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(status.sourceReferencesAppliedCount, 10);
  assert.equal(status.replenishmentQueuePhysicalCount, 12);
  assert.equal(status.replenishmentQueueFinalEligibleCount, 2);
  assert.equal(status.replenishmentQueueCount, 2);
  assert.equal(status.sourceJoinSucceededCount, 2);
  assert.equal(status.publicBusinessIdentityPresentCount, 2);
  assert.equal(status.eligibleDiscoveryTargetCount, 2);
  assert.equal(status.recommendedNextAction, 'run_source_discovery');
  assert.equal(env.logs.some((line) => line.includes('Business 1')), false);
});

test('source reference transaction rolls back when fresh source read-back does not match', () => {
  const env = createEnvironment({ sourceCount: 1 });
  seedGroundingReviewAndQueue(env, 1);
  env.ignoreSourceReferenceSet = true;
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoverySingleCandidateOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'source_discovery_read_back_failed');
  assert.equal(result.recommendedNextAction, 'inspect_source_reference_transaction');
  assert.equal(result.verifiedOfficialSourceDetectedCount, 1);
  assert.equal(result.verifiedOfficialSourceCount, 0);
  assert.equal(result.candidateSuccessCount, 0);
  assert.equal(result.sourceReferencesAppliedCount, 0);
  assert.equal(result.sourceReferenceWriteAttemptedCount, 1);
  assert.equal(result.sourceReferenceSourceRowWriteAttemptedCount, 1);
  assert.equal(result.sourceReferenceSourceRowWriteConfirmedCount, 0);
  assert.equal(result.sourceReferenceReviewRowWriteCount, 0);
  assert.equal(result.sourceReferenceQueueRowWriteCount, 0);
  assert.equal(result.sourceReferenceCommittedCount, 0);
  assert.equal(result.sourceReferenceWriteRolledBackCount, 1);
  assert.equal(result.sourceReferenceRollbackSucceededCount, 1);
  assert.equal(result.sourceReadBackAttemptCount, 1);
  assert.equal(result.sourceReadBackMismatchCount, 1);
  assert.equal(result.reviewReadBackAttemptCount, 0);
  assert.equal(result.reviewReadBackMatchedCount, 0);
  assert.equal(result.queueReadBackAttemptCount, 0);
  assert.equal(result.queueReadBackMatchedCount, 0);
  assert.equal(result.readBackFailureReasonCounts.source_reference_blank_after_write, 1);
  assert.equal(result.sourceReferenceTransactionInvariantValid, true);
  assert.equal(result.groundingEnabled, true);
  assert.equal(result.groundingModelConfigured, true);
  assert.equal(result.providerConfigurationValid, true);
  assert.equal(result.aiApiCalled, true);
  assert.equal(result.googleSheetsUpdated, true);
  assert.equal(result.scriptPropertiesUpdated, true);
  assert.equal(result.groundingHttpRequestCount, 1);
  assert.equal(result.candidateDiscoveryPromptRequestCount, 1);
  assert.equal(result.groundingPromptRequestCountToday, 1);
  assert.equal(readCell(env.workbook.sheets['Gmail営業候補プール'], 2, 'sourceReference'), '');
  assert.equal(readCell(env.workbook.sheets.Gmail_Contact_Basis_Review, 2, 'sourceReference'), '');
  assert.equal(readCell(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue, 2, 'status'), 'queued');
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.logs.some((line) => line.includes('recipient1')), false);
});

test('source reference transaction readiness inspector is read-only and reports aggregate join health', () => {
  const env = createEnvironment({ sourceCount: 3 });
  seedGroundingReviewAndQueue(env, 3);
  const beforeWrites = env.sheetWriteCount + env.propertyWriteCount + env.triggerWriteCount + env.mailSendCount + env.draftCreateCount;
  const result = env.context.inspectGmailSalesSourceReferenceTransactionReadiness();
  const afterWrites = env.sheetWriteCount + env.propertyWriteCount + env.triggerWriteCount + env.mailSendCount + env.draftCreateCount;
  assert.equal(result.mode, 'read_only');
  assert.equal(result.sourceSheetPresent, true);
  assert.equal(result.reviewSheetPresent, true);
  assert.equal(result.queueSheetPresent, true);
  assert.equal(result.sourceRequiredHeadersValid, true);
  assert.equal(result.reviewRequiredHeadersValid, true);
  assert.equal(result.queueRequiredHeadersValid, true);
  assert.equal(result.sourceReviewResolvableJoinCount, 3);
  assert.equal(result.reviewQueueResolvableJoinCount, 3);
  assert.equal(result.eligibleTransactionTargetCount, 3);
  assert.equal(result.transactionReadinessValid, true);
  assert.equal(result.googleSheetsUpdated, false);
  assert.equal(result.scriptPropertiesUpdated, false);
  assert.equal(result.aiApiCalled, false);
  assert.equal(afterWrites, beforeWrites);
  assert.equal(JSON.stringify(result).includes('Business'), false);
});

test('source reference cell write probe writes reads back and restores without API calls', () => {
  const env = createEnvironment({ sourceCount: 1, sourceProbeValid: false });
  writeCell(env.workbook.sheets['Gmail営業候補プール'], 2, 'sourceReference', 'existing-redacted-value');
  const result = env.context.testGmailSalesSourceReferenceCellWriteContractOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.flushExecuted, true);
  assert.equal(result.freshReadBackAttempted, true);
  assert.equal(result.freshReadBackMatched, true);
  assert.equal(result.restoreAttempted, true);
  assert.equal(result.restoreSucceeded, true);
  assert.equal(result.probeContractValid, true);
  assert.equal(result.googleSheetsUpdated, true);
  assert.equal(result.scriptPropertiesUpdated, false);
  assert.equal(result.aiApiCalled, false);
  assert.equal(result.gmailSendExecuted, false);
  assert.equal(result.triggerChanged, false);
  assert.equal(readCell(env.workbook.sheets['Gmail営業候補プール'], 2, 'sourceReference'), 'existing-redacted-value');
  assert.equal(env.fetchCalls.length, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(Boolean(JSON.parse(env.cache.gmail_sales_source_reference_cell_contract_last_probe).probeContractValid), true);
});

test('source reference cell write probe blocks formula cells without writing', () => {
  const env = createEnvironment({ sourceCount: 1, sourceProbeValid: false });
  const sheet = env.workbook.sheets['Gmail営業候補プール'];
  sheet.formulas[`2:${sheet.rows[0].indexOf('sourceReference') + 1}`] = '=ARRAYFORMULA("redacted")';
  const result = env.context.testGmailSalesSourceReferenceCellWriteContractOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'source_cell_formula_present');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.googleSheetsUpdated, false);
  assert.equal(result.aiApiCalled, false);
});

test('source reference schema repair adds missing headers and blocks duplicates', () => {
  const env = createEnvironment({ sourceCount: 1 });
  const sheet = env.workbook.sheets['Gmail営業候補プール'];
  const sourceReferenceIndex = sheet.rows[0].indexOf('sourceReference');
  sheet.rows[0].splice(sourceReferenceIndex, 1);
  sheet.rows.slice(1).forEach((row) => row.splice(sourceReferenceIndex, 1));
  const repaired = env.context.repairGmailSalesSourceReferenceSchemaOnce();
  assert.equal(repaired.status, 'pass');
  assert.equal(repaired.missingHeaderAddedCount, 1);
  assert.equal(repaired.headerReadBackPassed, true);
  assert.equal(repaired.googleSheetsUpdated, true);

  const duplicateEnv = createEnvironment({ sourceCount: 1 });
  duplicateEnv.workbook.sheets['Gmail営業候補プール'].rows[0].push('sourceReference');
  const blocked = duplicateEnv.context.repairGmailSalesSourceReferenceSchemaOnce();
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.blockedReason, 'source_reference_header_duplicate');
  assert.equal(blocked.googleSheetsUpdated, false);
});

test('source discovery hard gate blocks Gemini calls until source cell probe passes', () => {
  const env = createEnvironment({ sourceCount: 1, sourceProbeValid: false });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoverySingleCandidateOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'source_reference_cell_contract_not_verified');
  assert.equal(result.candidatesAttemptedCount, 0);
  assert.equal(result.groundingHttpRequestCount, 0);
  assert.equal(result.aiApiCalled, false);
  assert.equal(result.recommendedNextAction, 'run_source_reference_cell_write_probe');
  assert.equal(env.fetchCalls.length, 0);
});

test('single candidate grounded source discovery attempts at most one candidate', () => {
  const env = createEnvironment({ sourceCount: 12 });
  seedGroundingReviewAndQueue(env, 12);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoverySingleCandidateOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.singleCandidateDiscovery, true);
  assert.equal(result.singleCandidateMaxCandidates, 1);
  assert.equal(result.candidatesAttemptedCount, 1);
  assert.equal(result.searchQueryCount, 1);
  assert.equal(result.groundingHttpRequestCount, 1);
  assert.equal(result.sourceReferencesAppliedCount, 1);
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.logs.some((line) => line.includes('Business 1')), false);
});

test('grounded source discovery validates citation URLs when citation spans are invalid', () => {
  const env = createEnvironment({ sourceCount: 1, invalidCitationSpan: true });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoverySingleCandidateOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.candidatesAttemptedCount, 1);
  assert.equal(result.modelsAttemptedCount, 1);
  assert.equal(result.uniqueModelsAttemptedCount, 1);
  assert.equal(result.responseContractHealthyModelCount, 1);
  assert.equal(result.allGroundingModelsUnavailable, false);
  assert.equal(result.localValidationBlocked, false);
  assert.equal(result.citationSpanInvalidCount, 1);
  assert.equal(result.citationUrlEligibleForSafetyDespiteInvalidSpanCount, 1);
  assert.equal(result.citationUrlSafetyValidationAttemptCount, 1);
  assert.equal(result.citationUrlIdentityValidationAttemptCount, 1);
  assert.equal(result.citationUrlFinalAcceptedCount, 1);
  assert.equal(result.sourceReferencesAppliedCount, 1);
  assert.equal(result.recommendedNextAction, 'run_evidence_enrichment');
  assert.equal(env.fetchCalls.length, 1);
});

test('runtime join handles 66 non-identifying queue rows without storing business identity in the queue', () => {
  const env = createEnvironment({ sourceCount: 66 });
  seedGroundingReviewAndQueue(env, 66);
  const status = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(status.replenishmentQueueCount, 66);
  assert.equal(status.queueRowsWithJoinKeyCount, 66);
  assert.equal(status.sourceJoinSucceededCount, 66);
  assert.equal(status.reviewJoinSucceededCount, 66);
  assert.equal(status.publicBusinessIdentityPresentCount, 66);
  assert.equal(status.eligibleDiscoveryTargetCount, 66);
  assert.equal(status.recommendedNextAction, 'run_source_discovery');
  assert.equal(JSON.stringify(status).includes('Business 1'), false);
  const queueHeaders = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue.rows[0];
  assert.equal(queueHeaders.includes('companyName'), false);
  assert.equal(queueHeaders.includes('email'), false);
});

test('invalid source reference rows use shared eligibility snapshot and continue grounded discovery', () => {
  const env = createEnvironment({ sourceCount: 66 });
  seedGroundingReviewAndQueue(env, 66, { failureReasonCode: 'invalid_source_reference', stableKeys: false, invalidSourceReference: true });
  const queueStatus = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(queueStatus.queuePhysicalDataRowCount, 66);
  assert.equal(queueStatus.queueFailureReasonCounts.invalid_source_reference, 66);
  assert.equal(queueStatus.queueFailureReasonEligibleCount, 66);
  assert.equal(queueStatus.queueRowsWithRawCandidateTokenCount, 66);
  assert.equal(queueStatus.queueRowsWithStableJoinKeyCount, 0);
  assert.equal(queueStatus.queueCandidateTokenResolvedCount, 66);
  assert.equal(queueStatus.finalDiscoveryEligibleCount, 66);
  assert.equal(queueStatus.recommendedNextAction, 'run_source_discovery');

  const inspect = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(inspect.replenishmentQueuePhysicalCount, 66);
  assert.equal(inspect.replenishmentQueueStatusEligibleCount, 66);
  assert.equal(inspect.replenishmentQueueReasonEligibleCount, 66);
  assert.equal(inspect.queueCandidateTokenResolvedCount, 66);
  assert.equal(inspect.sourceJoinSucceededCount, 66);
  assert.equal(inspect.reviewJoinSucceededCount, 66);
  assert.equal(inspect.publicBusinessIdentityPresentCount, 66);
  assert.equal(inspect.finalDiscoveryEligibleCount, 66);
  assert.equal(inspect.eligibilitySnapshotInvariantFailed, false);
  assert.equal(Object.keys(inspect.exclusionReasonCounts).length, 0);
  assert.equal(inspect.recommendedNextAction, 'run_source_discovery');

  const run = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(run.status, 'pass');
  assert.equal(run.queueRepairRequired, false);
  assert.equal(run.queueRepairExecuted, false);
  assert.equal(run.queueRepairSucceeded, false);
  assert.equal(run.queueRepairNotRequired, true);
  assert.equal(run.queueCandidateTokenResolvedCount, 66);
  assert.equal(run.finalDiscoveryEligibleCount, 66);
  assert.equal(run.candidatesAttemptedCount, 10);
  assert.equal(run.searchQueryCount, 10);
  assert.equal(run.sourceReferencesAppliedCount, 10);
  assert.equal(env.fetchCalls.some((call) => JSON.parse(call.options.payload).input.includes('not-a-valid-url')), false);
});

test('old P0.3.5 queue schema is detected as migration-required without losing physical rows', () => {
  const env = createEnvironment({ sourceCount: 66 });
  env.workbook.sheets.Gmail_Evidence_Replenishment_Queue.rows = [OLD_REPLENISHMENT_HEADERS];
  seedGroundingReviewAndQueue(env, 66, { preserveHeaders: true });
  const status = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(status.queueSheetPresent, true);
  assert.equal(status.queuePhysicalDataRowCount, 66);
  assert.equal(status.queueParsedRowCount, 66);
  assert.equal(status.queueMigrationRequired, true);
  assert.equal(status.recommendedNextAction, 'repair_replenishment_queue');
  const run = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(run.queueMigrationExecuted, true);
  assert.equal(run.queueRowsMigrated, 66);
  assert.equal(run.queuePhysicalDataRowCountBefore, 66);
  assert.equal(run.queuePhysicalDataRowCountAfter, 66);
  assert.equal(run.searchQueryCount, 10);
});

test('legacy candidate-token-only queue is replaced with canonical stable join keys and continues discovery', () => {
  const env = createEnvironment({ sourceCount: 66 });
  seedGroundingReviewAndQueue(env, 66, { skipQueue: true });
  const queue = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  queue.rows = [OLD_REPLENISHMENT_HEADERS];
  for (let index = 1; index <= 66; index += 1) {
    queue.rows.push(OLD_REPLENISHMENT_HEADERS.map((header) => ({
      candidateToken: `legacy-token-${index}`,
      failureReasonCode: 'invalid_source_reference',
      requiredEvidenceType: 'official_source_reference',
      sourceReferencePresent: 'true',
      officialDomainPresent: 'false',
      eligibleForAutomatedReplenishment: 'true',
      queuedAt: '2026-07-01T00:00:00.000Z',
      status: 'queued'
    }[header] || '')));
  }
  const before = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(before.queuePhysicalDataRowCount, 66);
  assert.equal(before.queueParsedRowCount, 66);
  assert.equal(before.queueEligibleStatusCount, 66);
  assert.equal(before.queueRowsWithRawCandidateTokenCount, 66);
  assert.equal(before.queueRowsWithStableJoinKeyCount, 0);
  assert.equal(before.queueRowsWithResolvableCandidateTokenCount, 0);
  assert.equal(before.queueRowsWithResolvableJoinKeyCount, 0);
  assert.equal(before.queueRowsWithUnresolvableCandidateTokenCount, 66);
  assert.equal(before.queueRowsRequiringCanonicalRebuildCount, 66);
  assert.equal(before.queueRebuildEligibleCount, 66);
  assert.equal(before.recommendedNextAction, 'repair_replenishment_queue');
  const run = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(run.queueRepairRequired, true);
  assert.equal(run.queueRepairExecuted, true);
  assert.equal(run.queueRepairSucceeded, true);
  assert.equal(run.queueRebuildExecuted, true);
  assert.equal(run.canonicalQueueRowsBuiltCount, 66);
  assert.equal(run.legacyQueueRowsReplacedCount, 66);
  assert.equal(run.unresolvedLegacyQueueRowsCount, 0);
  assert.equal(run.queuePhysicalDataRowCountAfter, 66);
  assert.equal(run.queueRowsWithResolvableJoinKeyCountAfter, 66);
  assert.equal(run.sourceJoinSucceededCount, 66);
  assert.equal(run.publicBusinessIdentityPresentCount, 66);
  assert.equal(run.eligibleDiscoveryTargetCount, 66);
  assert.equal(run.candidatesAttemptedCount, 10);
  assert.equal(run.searchQueryCount, 10);
  assert.equal(run.sourceReferencesAppliedCount, 10);
  assert.equal(run.googleSheetsUpdated, true);
  const after = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(after.queueSchemaVersion, 'evidence-replenishment-v2');
  assert.equal(after.queueMigrationRequired, false);
  assert.equal(after.queueRowsWithResolvableJoinKeyCount, 56);
  assert.equal(after.queuePhysicalDataRowCount, 66);
});

test('empty queue with 66 needs-more-evidence review rows is rebuilt once and does not return AI-ready', () => {
  const env = createEnvironment({ sourceCount: 66 });
  seedGroundingReviewAndQueue(env, 66, { skipQueue: true });
  const before = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(before.queueParsedRowCount, 0);
  assert.equal(before.reviewNeedsMoreEvidenceCount, 66);
  assert.equal(before.queueRebuildEligibleCount, 66);
  assert.equal(before.recommendedNextAction, 'rebuild_replenishment_queue');
  const run = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(run.queueRebuildExecuted, true);
  assert.equal(run.queueRowsRebuilt, 66);
  assert.equal(run.queueRowsUpserted, 66);
  assert.equal(run.queueRowsDeduplicated, 0);
  assert.equal(run.queuePhysicalDataRowCountBefore, 0);
  assert.equal(run.queuePhysicalDataRowCountAfter, 66);
  assert.notEqual(run.recommendedNextAction, 'ready_for_ai_verification');
  assert.equal(run.searchQueryCount, 10);
  const second = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(second.queueRowsUpserted, 0);
  assert.equal(second.queueRowsDeduplicated >= 0, true);
});

test('queue status normalization excludes terminal and unknown rows safely', () => {
  const env = createEnvironment({ sourceCount: 8 });
  seedGroundingReviewAndQueue(env, 8);
  const queue = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  ['', 'queued', 'evidence_missing', 'source_missing', 'needs_source', 'completed', 'applied', 'mystery'].forEach((status, index) => {
    writeCell(queue, 2 + index, 'status', status);
  });
  const status = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(status.queueEligibleStatusCount, 5);
  assert.equal(status.queueIneligibleStatusCount, 3);
  assert.equal(status.queueStatusCounts.source_discovery_pending, 5);
  assert.equal(status.queueStatusCounts.completed, 1);
  assert.equal(status.queueStatusCounts.applied, 1);
  assert.equal(status.queueStatusCounts.unknown, 1);
});

test('queue sheet resolver handles alias and normalized names but rejects unrelated sheets', () => {
  const env = createEnvironment({ sourceCount: 1 });
  seedGroundingReviewAndQueue(env, 1);
  const original = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  delete env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  original.name = ' Gmail Evidence Replenishment Queue ';
  env.workbook.sheets[original.name] = original;
  const status = env.context.inspectGmailSalesEvidenceReplenishmentQueueStatus();
  assert.equal(status.queueSheetPresent, true);
  assert.equal(status.queueParsedRowCount, 1);
  env.workbook.sheets.Unrelated = new MockSheet('gmail_evidence_replenishment_queue_copy', [['foo', 'bar'], ['x', 'y']]);
  env.workbook.sheets.Unrelated.env = env;
  const run = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(run.queueSheetPresent, true);
  assert.equal(run.queueParsedRowCount, 1);
});

test('source join supports reviewId leadIdHash sourceRowKey and sourceRowDigest fallbacks', () => {
  const env = createEnvironment({ sourceCount: 4 });
  seedGroundingReviewAndQueue(env, 4);
  const queueSheet = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  const reviewSheet = env.workbook.sheets.Gmail_Contact_Basis_Review;
  writeCell(queueSheet, 2, 'candidateToken', '');
  writeCell(queueSheet, 2, 'reviewId', readCell(reviewSheet, 2, 'reviewId'));
  writeCell(queueSheet, 3, 'candidateToken', '');
  writeCell(queueSheet, 3, 'leadIdHash', readCell(reviewSheet, 3, 'leadIdHash'));
  writeCell(queueSheet, 4, 'candidateToken', '');
  writeCell(queueSheet, 4, 'sourceRowKey', readCell(reviewSheet, 4, 'sourceRowKey'));
  writeCell(queueSheet, 5, 'candidateToken', '');
  writeCell(queueSheet, 5, 'sourceRowDigest', readCell(reviewSheet, 5, 'sourceRowDigest'));
  const status = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(status.reviewJoinSucceededCount, 4);
  assert.equal(status.sourceJoinSucceededCount, 4);
  assert.equal(status.eligibleDiscoveryTargetCount, 4);
});

test('identity resolver supports English and Japanese public identity aliases without using email or person fields', () => {
  const env = createEnvironment({ sourceCount: 6 });
  setSource(env, 2, { name: '', companyName: 'Company Alias' });
  setSource(env, 3, { name: '', brandName: 'Brand Alias' });
  setSource(env, 4, { name: '', serviceName: 'Service Alias' });
  setSource(env, 5, { name: '', 会社名: 'Japanese Company Alias' });
  setSource(env, 6, { name: '', ブランド名: 'Japanese Brand Alias' });
  setSource(env, 7, { name: '', サービス名: 'Japanese Service Alias', personName: 'Person Name', email: 'localpart@example.invalid' });
  seedGroundingReviewAndQueue(env, 6);
  const status = env.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(status.publicBusinessIdentityPresentCount, 6);
  assert.equal(status.publicBusinessNamePresentCount, 2);
  assert.equal(status.publicBrandNamePresentCount, 2);
  assert.equal(status.publicServiceNamePresentCount, 2);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  const prompts = env.fetchCalls.map((call) => JSON.parse(call.options.payload).input);
  assert.equal(prompts.some((prompt) => prompt.includes('Company Alias')), true);
  assert.equal(prompts.some((prompt) => prompt.includes('Brand Alias')), true);
  assert.equal(prompts.some((prompt) => prompt.includes('Service Alias')), true);
  assert.equal(env.fetchCalls.some((call) => JSON.parse(call.options.payload).input.includes('Person Name')), false);
  assert.equal(env.fetchCalls.some((call) => JSON.parse(call.options.payload).input.includes('localpart')), false);
  assert.equal(result.sourceReferencesAppliedCount, 6);
});

test('missing identity and join failure produce actionable diagnostics without Gemini requests', () => {
  const missingIdentity = createEnvironment({ sourceCount: 1 });
  setSource(missingIdentity, 2, { name: '', companyName: '', brandName: '', serviceName: '', 会社名: '', ブランド名: '', サービス名: '', email: 'only-email@example.invalid' });
  seedGroundingReviewAndQueue(missingIdentity, 1);
  const missingResult = missingIdentity.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(missingResult.searchQueryCount, 0);
  assert.equal(missingIdentity.fetchCalls.length, 0);
  assert.equal(missingResult.publicBusinessIdentityMissingCount, 1);
  assert.equal(missingResult.exclusionReasonCounts.public_business_identity_missing, 1);
  assert.equal(missingResult.recommendedNextAction, 'replenish_with_new_candidates');

  const joinFailed = createEnvironment({ sourceCount: 1 });
  joinFailed.workbook.sheets.Gmail_Evidence_Replenishment_Queue.rows.push(REPLENISHMENT_HEADERS.map((header) => ({
    candidateToken: 'missing-token',
    failureReasonCode: 'no_source_reference',
    requiredEvidenceType: 'official_source_reference',
    eligibleForAutomatedReplenishment: 'true',
    status: 'queued',
    queueSchemaVersion: 'evidence-replenishment-v2'
  }[header] || '')));
  const joinStatus = joinFailed.context.inspectGmailSalesGroundedOfficialSourceDiscoveryStatus();
  assert.equal(joinStatus.replenishmentQueuePhysicalCount, 1);
  assert.equal(joinStatus.replenishmentQueueCount, 0);
  assert.equal(joinStatus.finalDiscoveryEligibleCount, 0);
  assert.equal(joinStatus.reviewJoinFailedCount, 1);
  assert.equal(joinStatus.excludedJoinFailureCount, 1);
  assert.equal(joinStatus.recommendedNextAction, 'repair_source_identity_join');
  assert.equal(joinFailed.fetchCalls.length, 0);
});

test('grounding is fail-closed when Gemini configuration is not valid', () => {
  const env = createEnvironment({ sourceCount: 1, aiEnabled: false });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'grounding_configuration_invalid');
  assert.equal(result.searchQueryCount, 0);
  assert.equal(env.fetchCalls.length, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.propertyWriteCount, 0);
});

test('grounded discovery is hard-gated when response contract probe is missing', () => {
  const env = createEnvironment({ sourceCount: 1, contractProbeValid: false });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'response_contract_probe_invalid');
  assert.equal(result.groundingContractProbeMissingOrInvalid, true);
  assert.equal(result.candidatesAttemptedCount, 0);
  assert.equal(result.searchQueryCount, 0);
  assert.equal(result.groundingHttpRequestCount, 0);
  assert.equal(result.sourceReferencesAppliedCount, 0);
  assert.equal(result.aiApiCalled, false);
  assert.equal(env.fetchCalls.length, 0);
});

test('grounded discovery is not hard-gated only by missing live citation acceptance probe', () => {
  const env = createEnvironment({ sourceCount: 1, citationProbeValid: false });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.localCitationSafetyContractValid, true);
  assert.equal(result.liveProviderProbeLastSucceeded, false);
  assert.equal(result.candidatesAttemptedCount, 1);
  assert.equal(result.searchQueryCount, 1);
  assert.equal(result.groundingHttpRequestCount, 1);
  assert.equal(result.sourceReferencesAppliedCount, 1);
  assert.equal(env.fetchCalls.length, 1);
});

test('provider non-2xx response is classified without normal response parsing or source-not-found', () => {
  const env = createEnvironment({ sourceCount: 1, fetchStatusCode: 429 });
  seedGroundingReviewAndQueue(env, 1);
  const result = env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'all_grounding_models_unavailable');
  assert.equal(result.providerHttpErrorCount, 4);
  assert.equal(result.providerErrorCategoryCounts.rate_limited, 4);
  assert.equal(result.groundingResponseJsonParsedCount, 0);
  assert.equal(result.sourceNotFoundCount, 0);
  assert.equal(result.blockedSourceCount, 1);
  const queueRow = rowFromSheet(env.workbook.sheets.Gmail_Evidence_Replenishment_Queue, 2);
  assert.equal(queueRow.status, 'grounding_provider_error_retryable');
  assert.equal(env.context.normalizeGmailSalesEvidenceReplenishmentQueueRow_(queueRow).status, 'grounding_provider_error_retryable');
});

test('citation safety rejected status is recognized and not search-eligible by default', () => {
  const env = createEnvironment({ sourceCount: 0 });
  const normalized = env.context.normalizeGmailSalesEvidenceReplenishmentQueueRow_({
    status: 'citation_safety_rejected',
    failureReasonCode: 'no_source_reference',
    candidateToken: 'token'
  });
  assert.equal(normalized.status, 'citation_safety_rejected');
  assert.equal(normalized.searchEligibleStatus, false);
});

test('citation selection requires grounded citation URL, official confidence, identity match, and safe domain', () => {
  const env = createEnvironment({ sourceCount: 0 });
  const target = buildSelectionTarget(env, 'token');
  const grounding = { minOfficialConfidence: 0.98, version: 'test' };
  assert.equal(env.context.parseGeminiGroundingCitations_(mockGeminiResponse({
    token: 'token',
    url: '',
    bodyUrlOnly: 'https://body-only.example/contact',
    confidence: 0.99,
    identity: true
  }), target).length, 0);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.97,
    businessIdentityMatched: true,
    riskFlags: [],
    reasonCodes: []
  }], grounding).ok, false);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.98,
    businessIdentityMatched: false,
    riskFlags: [],
    reasonCodes: []
  }], grounding).ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('http://localhost/contact').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('http://192.168.0.1/contact').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://bit.ly/path').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://instagram.com/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://www.google.com/maps/place/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://indeed.com/jobs/example').ok, false);
  assert.equal(env.context.normalizeGroundedCitationUrl_('https://prtimes.jp/main/html/example').ok, false);
  assert.equal(env.context.selectVerifiedGroundedOfficialSource_(target, [{
    candidateToken: 'token',
    url: 'https://official.example/contact',
    host: 'official.example',
    officialConfidence: 0.98,
    businessIdentityMatched: true,
    contactPageDiscovered: true,
    businessInquiryEvidencePresent: true,
    solicitationRestrictionPresent: false,
    riskFlags: [],
    reasonCodes: ['official_site_verified']
  }], grounding).ok, true);
});

test('production AI verification phase runs grounded discovery before enrichment and AI verification', () => {
  const env = createEnvironment({ sourceCount: 1 });
  let order = [];
  env.context.refreshGmailSalesContactBasisReviewQueueOnce = () => { order.push('refresh'); return { status: 'pass' }; };
  env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce = () => { order.push('grounding'); return { status: 'pass', sourceReferencesAppliedCount: 1, candidatesAttemptedCount: 1 }; };
  env.context.runGmailSalesOfficialEvidenceEnrichmentOnce = () => { order.push('enrichment'); return { status: 'pass', evidenceDigestChangedCount: 1, aiReevaluationEligibleCount: 1 }; };
  env.context.runGmailSalesAiContactBasisVerificationOnce = () => { order.push('verification'); return { status: 'pass' }; };
  env.context.runGmailSalesAiVerificationPhase_();
  assert.deepEqual(order, ['refresh', 'grounding', 'enrichment', 'verification']);
});

test('production AI verification phase stops when source discovery has no targets and no applied sources', () => {
  const env = createEnvironment({ sourceCount: 1 });
  let order = [];
  env.context.refreshGmailSalesContactBasisReviewQueueOnce = () => { order.push('refresh'); return { status: 'pass' }; };
  env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce = () => { order.push('grounding'); return { status: 'pass', sourceReferencesAppliedCount: 0, candidatesAttemptedCount: 0 }; };
  env.context.runGmailSalesOfficialEvidenceEnrichmentOnce = () => { order.push('enrichment'); return { status: 'pass' }; };
  env.context.runGmailSalesAiContactBasisVerificationOnce = () => { order.push('verification'); return { status: 'pass' }; };
  const result = env.context.runGmailSalesAiVerificationPhase_();
  assert.deepEqual(order, ['refresh', 'grounding']);
  assert.equal(result.sourceReferencesAppliedCount, 0);
});

test('production AI verification phase stops when enrichment has no evidence changes', () => {
  const env = createEnvironment({ sourceCount: 1 });
  let order = [];
  env.context.refreshGmailSalesContactBasisReviewQueueOnce = () => { order.push('refresh'); return { status: 'pass' }; };
  env.context.runGmailSalesGroundedOfficialSourceDiscoveryOnce = () => { order.push('grounding'); return { status: 'pass', sourceReferencesAppliedCount: 1 }; };
  env.context.runGmailSalesOfficialEvidenceEnrichmentOnce = () => { order.push('enrichment'); return { status: 'pass', evidenceDigestChangedCount: 0, aiReevaluationEligibleCount: 0 }; };
  env.context.runGmailSalesAiContactBasisVerificationOnce = () => { order.push('verification'); return { status: 'pass' }; };
  const result = env.context.runGmailSalesAiVerificationPhase_();
  assert.deepEqual(order, ['refresh', 'grounding', 'enrichment']);
  assert.equal(result.evidenceDigestChangedCount, 0);
});

function createEnvironment(options = {}) {
  const rows = [SOURCE_HEADERS];
  for (let index = 1; index <= (options.sourceCount || 0); index += 1) {
    rows.push(SOURCE_HEADERS.map((header) => buildSourceRow(index)[header] || ''));
  }
  const env = {
    props: {
      SHEET_ID: 'sheet-id',
      SHEET_NAME: 'sales',
      GMAIL_DAILY_SOURCE_TAB_NAME: 'Gmail営業候補プール',
      GMAIL_SHEET_READY_TAB_NAME: 'sales',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      GMAIL_SALES_AI_ENABLED: options.aiEnabled === false ? 'false' : 'true',
      GMAIL_SALES_AI_PROVIDER: 'gemini',
      GMAIL_SALES_AI_MODEL: 'gemini-mock',
      GMAIL_SALES_AI_API_KEY: options.aiEnabled === false ? '' : 'mock-redacted-token',
      GMAIL_SALES_GROUNDING_MODEL: 'gemini-mock-grounded',
      GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON: JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']),
      GMAIL_SALES_GROUNDING_MAX_CANDIDATES_PER_RUN: '10',
      GMAIL_SALES_GROUNDING_MAX_SEARCH_QUERIES_PER_DAY: '30',
      GMAIL_SALES_GROUNDING_MAX_PROMPT_REQUESTS_PER_DAY: '30',
      GMAIL_SALES_GROUNDING_MAX_DAILY_COST_YEN: '100',
      GMAIL_SALES_GROUNDING_CONTRACT_PROBE_SUMMARY_JSON: options.contractProbeValid === false ? '' : JSON.stringify({ responseContractValid: true, httpRequestExecuted: true, completedAt: '2026-07-01T00:00:00.000Z' }),
      GMAIL_SALES_GROUNDING_CITATION_ACCEPTANCE_PROBE_SUMMARY_JSON: options.citationProbeValid === false ? '' : JSON.stringify({ citationAcceptanceValid: true, httpRequestExecuted: true, completedAt: '2026-07-01T00:00:00.000Z' })
    },
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [SOURCE_HEADERS]),
        'Gmail営業候補プール': new MockSheet('Gmail営業候補プール', rows),
        Gmail_Contact_Basis_Review: new MockSheet('Gmail_Contact_Basis_Review', [REVIEW_HEADERS]),
        Gmail_Evidence_Replenishment_Queue: new MockSheet('Gmail_Evidence_Replenishment_Queue', [REPLENISHMENT_HEADERS])
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
    logs: [],
    cache: {},
    fetchCalls: [],
    fetchStatusCode: options.fetchStatusCode || 200,
    invalidCitationSpan: Boolean(options.invalidCitationSpan),
    sheetWriteCount: 0,
    propertyWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0
  };
  if (options.sourceProbeValid !== false) {
    env.cache.gmail_sales_source_reference_cell_contract_last_probe = JSON.stringify({ probeContractValid: true, completedAt: '2026-07-01T00:00:00.000Z' });
  }
  Object.values(env.workbook.sheets).forEach((sheet) => { sheet.env = env; });
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  return env;
}

function seedGroundingReviewAndQueue(env, count, options = {}) {
  const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
  const reviewSheet = env.workbook.sheets.Gmail_Contact_Basis_Review;
  const queueSheet = env.workbook.sheets.Gmail_Evidence_Replenishment_Queue;
  const queueHeaders = options.preserveHeaders ? queueSheet.rows[0] : REPLENISHMENT_HEADERS;
  for (let rowIndex = 2; rowIndex < 2 + count; rowIndex += 1) {
    if (options.invalidSourceReference) writeCell(sourceSheet, rowIndex, 'sourceReference', 'not-a-valid-url');
    const sourceRow = rowFromSheet(sourceSheet, rowIndex);
    const queue = env.context.buildContactBasisReviewQueueRow_({ row: sourceRow, rowIndex }, '2026-07-01T00:00:00.000Z');
    assert.equal(queue.include, true);
    const reviewRow = Object.assign({}, queue.row, {
      reviewDecision: 'needs_more_evidence',
      applyStatus: 'needs_more_evidence',
      applyErrorCode: 'no_source_reference',
      evidenceNotes: 'needs official source'
    });
    reviewSheet.rows.push(REVIEW_HEADERS.map((header) => reviewRow[header] || ''));
    if (options.skipQueue) continue;
    const token = env.context.buildGroundingCandidateToken_(reviewRow);
    const failureReasonCode = options.failureReasonCode || 'no_source_reference';
    const stableKeys = options.stableKeys !== false;
    queueSheet.rows.push(queueHeaders.map((header) => ({
      candidateToken: token,
      failureReasonCode,
      requiredEvidenceType: 'official_source_reference',
      existingSourceType: '',
      sourceReferencePresent: 'false',
      officialDomainPresent: 'false',
      eligibleForAutomatedReplenishment: 'true',
      queuedAt: '2026-07-01T00:00:00.000Z',
      status: 'queued',
      reviewId: stableKeys ? reviewRow.reviewId : '',
      leadIdHash: stableKeys ? reviewRow.leadIdHash : '',
      sourceRowKey: stableKeys ? reviewRow.sourceRowKey : '',
      sourceRowKeyHash: stableKeys ? env.context.hashValue_(String(reviewRow.sourceRowKey || '')) : '',
      reviewIdHash: stableKeys ? env.context.hashValue_(String(reviewRow.reviewId || '')) : '',
      sourceRowDigest: stableKeys ? reviewRow.sourceRowDigest : '',
      publicBusinessIdentityPresent: true,
      publicBusinessIdentityDigest: 'digest',
      identityJoinStatus: 'queued',
      identityJoinReasonCode: failureReasonCode,
      lastDiscoveryEligibilityCheckedAt: '',
      queueSchemaVersion: 'evidence-replenishment-v2'
    }[header] || '')));
  }
}

function buildSelectionTarget(env, token) {
  return {
    candidateToken: token,
    sourceItem: { rowIndex: 2, row: buildSourceRow(1) },
    reviewItem: { rowIndex: 2, row: { sourceRowKey: 'key', sourceRowDigest: 'digest' } },
    queueItem: null
  };
}

function mockGeminiResponse({ token, url, bodyUrlOnly, confidence, identity }) {
  const payload = {
    output_text: JSON.stringify({
      candidateToken: token,
      officialConfidence: confidence,
      businessIdentityMatched: identity,
      contactPageDiscovered: true,
      businessInquiryEvidencePresent: true,
      solicitationRestrictionPresent: false,
      riskFlags: [],
      reasonCodes: ['official_site_verified'],
      ignoredText: bodyUrlOnly || ''
    })
  };
  if (url) {
    payload.groundingMetadata = {
      groundingChunks: [{ web: { uri: url, title: 'official contact' } }]
    };
  }
  return {
    response: {
      getContentText: () => JSON.stringify(payload)
    }
  };
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
        },
        deleteProperty: (key) => {
          env.propertyWriteCount += 1;
          delete env.props[key];
        }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: {
      ProtectionType: { RANGE: 'RANGE' },
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
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { env.triggerWriteCount += 1; return {}; } }) }) }),
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: { getScriptCache: () => ({
      get: (key) => env.cache[key] || null,
      put: (key, value) => { env.cache[key] = String(value); }
    }) },
    UrlFetchApp: {
      fetch: (url, options = {}) => {
        env.fetchCalls.push({ url: String(url), options });
        const prompt = JSON.parse(options.payload).input;
        const token = /Candidate token for traceability:\s*([a-f0-9]+)/.exec(prompt)?.[1] || 'mock-token';
        const citationText = 'The official website was verified. Contact and business inquiry information is available.';
        return {
          getResponseCode: () => env.fetchStatusCode,
          getContentText: () => JSON.stringify({
            steps: [
              { type: 'google_search_call', arguments: { queries: ['redacted public business official website'] } },
              { type: 'google_search_result', call_id: 'call-1', result: { count: 1 } },
              {
                type: 'model_output',
                content: [{
                  type: 'text',
                  text: citationText,
                  annotations: [{
                    type: 'url_citation',
                    url: `https://official-${env.fetchCalls.length}.example/contact`,
                    title: 'official contact',
                    start_index: 4,
                    end_index: env.invalidCitationSpan ? 999 : 20
                  }]
                }]
              }
            ],
            metadata: { tokenDigest: token.slice(0, 8) }
          })
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
    publicSource: '',
    sourceUrl: '',
    sourceReference: '',
    sourceType: '',
    subject: `Subject ${index}`,
    body: `Body ${index}`,
    status: 'ready',
    dedupeKey: `dedupe-${index}`,
    optOutAvailable: 'true',
    companyName: '',
    brandName: '',
    serviceName: '',
    会社名: '',
    ブランド名: '',
    サービス名: '',
    personName: `Person ${index}`,
    domain: ''
  };
}

function setSource(env, rowIndex, values) {
  Object.keys(values).forEach((key) => writeCell(env.workbook.sheets['Gmail営業候補プール'], rowIndex, key, values[key]));
}

function rowFromSheet(sheet, rowIndex) {
  const headers = sheet.rows[0];
  const cells = sheet.rows[rowIndex - 1] || [];
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
}

function readCell(sheet, rowIndex, header) {
  const index = sheet.rows[0].indexOf(header);
  return index === -1 ? '' : sheet.rows[rowIndex - 1][index] || '';
}

function writeCell(sheet, rowIndex, header, value) {
  let index = sheet.rows[0].indexOf(header);
  if (index === -1) {
    sheet.rows[0].push(header);
    index = sheet.rows[0].length - 1;
  }
  if (!sheet.rows[rowIndex - 1]) sheet.rows[rowIndex - 1] = [];
  sheet.rows[rowIndex - 1][index] = value;
}

class MockSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.validations = {};
    this.formulas = {};
    this.merged = {};
    this.protections = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getMaxRows() { return Math.max(this.rows.length, 200); }
  getDataRange() { return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(row, column, numRows = 1, numColumns = 1) { return new MockRange(this, row, column, numRows, numColumns); }
  getProtections() { return this.protections; }
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
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue() ?? ''); }
  getFormula() { return this.sheet.formulas[`${this.row}:${this.column}`] || ''; }
  getDataValidation() { return this.sheet.validations[`${this.row}:${this.column}`] || null; }
  isPartOfMerge() { return Boolean(this.sheet.merged[`${this.row}:${this.column}`]); }
  getRow() { return this.row; }
  getColumn() { return this.column; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numColumns; }
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
    if (this.sheet.env && this.sheet.env.throwOnSourceReferenceSet && this.sheet.name === 'Gmail営業候補プール' && this.column === this.sheet.rows[0].indexOf('sourceReference') + 1) throw new Error('mock setValue failure');
    if (this.sheet.env && this.sheet.env.ignoreSourceReferenceSet && this.sheet.name === 'Gmail営業候補プール' && this.column === this.sheet.rows[0].indexOf('sourceReference') + 1 && value) return;
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
  groundedSourceDiscoveryTestPassed: true,
  scenarioCount: tests.length,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
