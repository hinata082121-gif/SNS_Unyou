#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'gmail-sales-automation', 'Code.gs'), 'utf8');
const TARGET_DATE = '2026-06-19';
const BATCH_ID = `gmail-sales-${TARGET_DATE}`;
const HEADERS = [
  'email',
  'contactEmail',
  'name',
  'subject',
  'body',
  'status',
  'sendDate',
  'sendBatchId',
  'sourceUrl',
  'prospectId',
  'dedupeKey',
  'sentStatus',
  'sentAt',
  'sendState',
  'sendRunId',
  'sendReservedAt',
  'sendAttemptCount',
  'approvedBatchId',
  'approvedCandidateDigest',
  'deliveryUncertainAt',
  'lastSendErrorCode',
  'contactBasisType',
  'contactBasisRecordedAt',
  'sourceType',
  'sourceReferenceHash',
  'optOutAvailable',
  'lastVerifiedAt',
  'suppressionCheckedAt',
  'historyCheckedAt',
  'lastCheckedAt'
];
const CONTACT_BASIS_HEADERS = [
  'contactBasisType',
  'contactBasisRecordedAt',
  'sourceType',
  'sourceReferenceHash',
  'optOutAvailable',
  'lastVerifiedAt',
  'suppressionCheckedAt',
  'historyCheckedAt'
];
const OUTBOX_HEADERS = [
  'prospectId',
  'name',
  'businessType',
  'area',
  'email',
  'contactEmail',
  'publicSource',
  'sourceUrl',
  'issueHypothesis',
  'salesAngle',
  'subject',
  'body',
  'status',
  'sendDate',
  'nextActionDate',
  'dedupeKey',
  'sendBatchId',
  'sentAt',
  'sentBy',
  'sentStatus',
  'errorMessage',
  'replyStatus',
  'unsubscribe',
  'doNotContact',
  'lastCheckedAt',
  'notes',
  'sendState',
  'sendRunId',
  'sendReservedAt',
  'sendAttemptCount',
  'approvedBatchId',
  'approvedCandidateDigest',
  'deliveryUncertainAt',
  'lastSendErrorCode',
  ...CONTACT_BASIS_HEADERS
];
const SOURCE_HEADERS = OUTBOX_HEADERS.slice();
const MAINTENANCE_HEADERS = [
  'lockName',
  'holderType',
  'holderId',
  'acquiredAt',
  'expiresAt',
  'heartbeatAt',
  'leaseVersion'
];

const scenarios = [
  ['LIVE_SEND_ENABLED missing blocks send', (env) => delete env.props.LIVE_SEND_ENABLED, (env, result) => {
    assertBlockedNoMail(env, result, 'live_send_disabled');
  }],
  ['LIVE_SEND_ENABLED uppercase TRUE blocks send', (env) => { env.props.LIVE_SEND_ENABLED = 'TRUE'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'live_send_disabled');
  }],
  ['AUTO_SEND_ENABLED false blocks scheduled entry', (env) => { env.entry = 'scheduled'; env.props.AUTO_SEND_ENABLED = 'false'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'auto_send_disabled');
  }],
  ['manifest missing blocks send', (env) => delete env.props.APPROVED_SEND_MANIFEST_JSON, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_load_failed');
  }],
  ['manifest expired blocks send', (env) => { env.manifest.expiresAt = '2020-01-01T00:00:00.000Z'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_expired');
  }],
  ['manifest digest mismatch blocks send', (env) => { env.manifest.candidateDigests[0] = 'digest_mismatch'; }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_digest_mismatch');
  }],
  ['suppression chunk missing blocks send', (env) => { env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_0; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['suppression checksum mismatch blocks send', (env) => { env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = 'bad_checksum'; }; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['recipient suppression match blocks MailApp', (env) => { env.suppression.recipientHashes = [hashValue(env.rows[0].email).slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['domain suppression match blocks MailApp', (env) => { env.suppression.domainHashes = [hashValue('safe-source-1.invalid').slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['business suppression match blocks MailApp', (env) => { env.suppression.businessFingerprints = [hashValue(`${'safe-source-1.invalid'}|${normalizeText(env.rows[0].name)}`).slice(0, 12)]; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_match');
  }],
  ['maintenance lease sheet missing blocks send before Sheet row writes', (env) => delete env.workbook.sheets._gmail_maintenance, (env, result) => {
    assertBlockedNoMail(env, result, 'maintenance_sheet_missing');
    assert.equal(env.sheetWriteCount, 0);
  }],
  ['script lock failure blocks send', (env) => { env.lockAvailable = false; }, (env, result) => {
    assertBlockedNoMail(env, result, 'lock_unavailable');
  }],
  ['candidate digest mismatch blocks MailApp', (env) => { writeCell(env, 2, 'body', `${env.rows[0].body} changed`); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_digest_mismatch');
  }],
  ['Gmail Sent match blocks MailApp', (env) => { env.gmailSearchResultCount = 1; }, (env, result) => {
    assertBlockedNoMail(env, result, 'gmail_sent_history_match');
  }],
  ['Gmail Sent search exception blocks MailApp', (env) => { env.gmailSearchThrows = true; }, (env, result) => {
    assertBlockedNoMail(env, result, 'gmail_sent_history_match');
  }],
  ['ready row reserves then sends then marks SENT', () => {}, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(env.mailSendCount, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'SENT');
    assert.equal(readCell(env, 2, 'sendAttemptCount'), 1);
    assert.equal(env.flushCount >= 2, true);
  }],
  ['MailApp exception leaves DELIVERY_UNKNOWN and rerun does not resend', (env) => { env.mailSendThrows = true; }, (env, result) => {
    assertBlockedNoMailCount(env, result, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'DELIVERY_UNKNOWN');
    env.mailSendThrows = false;
    const before = env.mailSendCount;
    env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
    assert.equal(env.mailSendCount, before);
  }],
  ['SENT update failure leaves non-ready state and rerun does not resend', (env) => { env.failSentUpdate = true; }, (env) => {
    assert.equal(env.mailSendCount, 1);
    assert.equal(readCell(env, 2, 'sendState'), 'DELIVERY_UNKNOWN');
    env.failSentUpdate = false;
    const before = env.mailSendCount;
    env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
    assert.equal(env.mailSendCount, before);
  }],
  ['existing SEND_RESERVED blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'SEND_RESERVED'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['existing SENT blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'SENT'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['existing DELIVERY_UNKNOWN blocks MailApp', (env) => { writeCell(env, 2, 'sendState', 'DELIVERY_UNKNOWN'); }, (env, result) => {
    assertBlockedNoMail(env, result, 'candidate_state_not_ready');
  }],
  ['attemptCount at limit blocks MailApp', (env) => { writeCell(env, 2, 'sendAttemptCount', 1); }, (env, result) => {
    assertBlockedNoMail(env, result, 'send_attempt_limit_exceeded');
    assert.equal(result.attemptLimitExceededCount, 1);
  }],
  ['dry-run success does not write any external state', (env) => { env.entry = 'dryRun'; env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true'; }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.wouldAttemptCount, 1);
    assertDryRunWriteFree(env);
  }],
  ['dry-run blocked does not reset live send flags', (env) => {
    env.entry = 'dryRun';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    delete env.props.APPROVED_SEND_MANIFEST_JSON;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReasons || []).includes('manifest_load_failed'), true);
    assertDryRunWriteFree(env);
  }],
  ['dry-run sheet load exception remains write-free', (env) => {
    env.entry = 'dryRun';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    env.openSheetThrows = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assertDryRunWriteFree(env);
  }],
  ['recovery dry-run success is write-free and uses dedicated recovery row', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoveryDryRun';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.mode, 'recovery_dry_run');
    assert.equal(result.candidateCount, 1);
    assert.equal(result.eligibleCount, 1);
    assert.equal(result.wouldAttemptCount, 1);
    assert.equal(result.maxSendCount, 1);
    assertDryRunWriteFree(env);
  }],
  ['recovery dry-run rejects manifest without same-day manual approval', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoveryDryRun';
    delete env.manifest.sameDayManualRecoveryApproved;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReasons || []).includes('same_day_manual_recovery_not_approved'), true);
    assertDryRunWriteFree(env);
  }],
  ['recovery dry-run rejects normal approved manifest', (env) => {
    installRecoveryReadyRow(env);
    env.entry = 'recoveryDryRun';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReasons || []).includes('manifest_source_not_recovery_single'), true);
    assertDryRunWriteFree(env);
  }],
  ['recovery send-once sends exactly one recovery row and does not touch normal sales rows', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoverySend';
    env.props.LIVE_SEND_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'false';
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 1);
    assert.equal(env.mailSendCount, 1);
    assert.equal(getRecoveryCell(env, 2, 'sendState'), 'SENT');
    assert.equal(readCell(env, 2, 'sendState'), '');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['recovery send-once blocks when live send disabled', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoverySend';
    env.props.LIVE_SEND_ENABLED = 'false';
    env.props.AUTO_SEND_ENABLED = 'false';
  }, (env, result) => {
    assertBlockedNoMail(env, result, 'live_send_disabled');
    assert.equal(getRecoveryCell(env, 2, 'sendState'), '');
  }],
  ['recovery send-once blocks when auto send enabled', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoverySend';
    env.props.LIVE_SEND_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
  }, (env, result) => {
    assertBlockedNoMail(env, result, 'auto_send_must_be_disabled');
    assert.equal(getRecoveryCell(env, 2, 'sendState'), '');
  }],
  ['candidate digest is stable across Node and Apps Script canonicalization fixtures', (env) => {
    env.entry = 'digestFixtureOnly';
  }, (env) => {
    const batchId = 'gmail-sales-2026-06-20-noon-recovery';
    const base = buildRecoveryOutboxRow();
    const fixtures = [
      ['plain', base],
      ['escaped newline', Object.assign({}, base, { body: String(base.body).replace(/\n/g, '\\n') })],
      ['crlf newline', Object.assign({}, base, { body: String(base.body).replace(/\n/g, '\r\n') })],
      ['date object fields outside digest', Object.assign({}, base, { sendDate: new Date(Date.UTC(2026, 5, 20)), nextActionDate: new Date(Date.UTC(2026, 5, 20)) })],
      ['boolean false outside digest', Object.assign({}, base, { doNotContact: false })],
      ['null empty outside digest', Object.assign({}, base, { notes: null, sentAt: undefined })],
      ['trailing subject whitespace', Object.assign({}, base, { subject: `${base.subject}  ` })],
      ['japanese body', Object.assign({}, base, { body: `${base.name} 様\\n日本語本文の確認です。\\n今後のご案内が不要な場合はご返信不要です。` })],
      ['digest fields excluded', Object.assign({}, base, { candidateDigest: 'synthetic', approvedCandidateDigest: 'synthetic' })]
    ];
    fixtures.forEach(([name, row]) => {
      const appsDigest = env.context.computeCandidateDigest_(row, '2026-06-20', batchId);
      const nodeDigest = nodeEquivalentCandidateDigest(row, '2026-06-20', batchId);
      assert.equal(appsDigest, nodeDigest, name);
    });
    const beforeMetadata = env.context.computeCandidateDigest_(base, '2026-06-20', batchId);
    const afterMetadata = env.context.computeCandidateDigest_(Object.assign({}, base, {
      sameDayManualRecoveryApproved: true,
      sameDayManualRecoveryApprovedAt: '2026-06-20T10:00:00.000Z',
      expiresAt: '2026-06-20T14:59:59.000Z'
    }), '2026-06-20', batchId);
    assert.equal(afterMetadata, beforeMetadata);
    const changedBody = env.context.computeCandidateDigest_(Object.assign({}, base, {
      body: `${base.body}\nsubstantive synthetic change`
    }), '2026-06-20', batchId);
    assert.notEqual(changedBody, beforeMetadata);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['recovery digest diagnostic valid manifest is read-only', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoveryDigestDiagnostic';
  }, (env, result) => {
    assert.equal(result.runtimeVersion, 'recovery-digest-diagnostic-v4');
    assert.equal(result.shaRuntimeSelfTestPassed, true);
    assert.equal(result.nodeAppsScriptDigestCompatibilityPassed, true);
    assert.equal(result.candidateDigestMatchAfterCanonicalization, true);
    assert.equal(result.recommendedNextAction, 'diagnosis_inconclusive');
    assertDiagnosticReadOnly(env);
  }],
  ['recovery digest diagnostic detects runtime reissue safe mismatch', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.candidateDigests[0] = 'digest_mismatch';
    env.entry = 'recoveryDigestDiagnostic';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.shaRuntimeSelfTestPassed, true);
    assert.equal(result.candidateDigestMatchAfterCanonicalization, false);
    assert.equal(result.manifestVsSheetFieldComparisonPassed, true);
    assert.equal(result.recommendedNextAction, 'runtime_digest_reissue_safe');
    assertDiagnosticReadOnly(env);
  }],
  ['recovery digest reissue updates only manifest property once when safe', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.candidateDigests[0] = 'digest_mismatch';
    env.entry = 'recoveryDigestReissue';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.propertyUpdated, true);
    assert.equal(result.candidateDigestChanged, true);
    assert.equal(env.setPropertyCount, 1);
    assert.equal(env.setPropertiesCount, 0);
    assert.equal(env.deletePropertyCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    const updated = JSON.parse(env.props.APPROVED_SEND_MANIFEST_JSON);
    assert.equal(updated.runtimeDigestReissued, true);
    assert.equal(updated.runtimeDigestVersion, 'recovery-digest-diagnostic-v4');
  }],
  ['recovery digest reissue rejects substantive sheet mismatch', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.candidateDigests[0] = 'digest_mismatch';
    setRecoveryCell(env, 2, 'body', `${getRecoveryCell(env, 2, 'body')}\nsubstantive synthetic change`);
    env.entry = 'recoveryDigestReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'sheet_substantive_content_mismatch');
    assert.equal(result.propertyUpdated, false);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
  }],
  ['recovery digest diagnostic classifies only candidateContentHash as repair safe', (env) => {
    installRecoveryReadyRowAndManifest(env);
    addRecoveryCandidateContentHashColumn(env, 'stale_derived_hash');
    env.entry = 'recoveryDigestDiagnostic';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.substantiveFieldMismatchCount, 0);
    assert.equal(result.derivedIntegrityFieldMismatchCount, 1);
    assert.deepEqual(Array.from(result.derivedIntegrityDifferingFieldNames), ['candidateContentHash']);
    assert.equal(result.recommendedNextAction, 'sheet_derived_candidate_hash_repair_safe');
    assertDiagnosticReadOnly(env);
  }],
  ['recovery digest diagnostic classifies manifest source hash mismatch as manifest reissue safe', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.entry = 'recoveryDigestDiagnostic';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.substantiveFieldMismatchCount, 0);
    assert.equal(result.derivedIntegrityFieldMismatchCount, 1);
    assert.deepEqual(Array.from(result.derivedIntegrityDifferingFieldNames), ['sourceOutboxIdentity.candidateContentHash']);
    assert.equal(result.sheetCandidateContentHashPresent, false);
    assert.equal(result.manifestSourceCandidateContentHashMatch, false);
    assert.equal(result.recommendedNextAction, 'manifest_source_candidate_content_hash_reissue_safe');
    assertDiagnosticReadOnly(env);
  }],
  ['recovery pre-send blocks manifest source hash mismatch without sending', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.entry = 'recoveryDryRun';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReasons.includes('manifest_source_candidate_content_hash_mismatch'), true);
    assert.equal(result.candidateDigestMismatchCount, 0);
    assert.equal(result.derivedIntegrityFieldMismatchCount, 1);
    assert.equal(result.eligibleCount, 0);
    assert.equal(result.wouldAttemptCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['recovery source hash reissue updates only approved manifest property once', (env) => {
    installRecoveryReadyRowAndManifest(env);
    const originalDigest = env.manifest.candidateDigests[0];
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.originalRecoveryDigest = originalDigest;
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.propertyUpdated, true);
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(result.sourceCandidateContentHashChanged, true);
    assert.equal(result.manifestDigestChanged, true);
    assert.equal(result.candidateDigestVerified, true);
    assert.equal(result.readBackValidationPassed, true);
    assert.equal(result.postReissueSubstantiveMismatchCount, 0);
    assert.equal(result.postReissueDerivedMismatchCount, 0);
    assert.equal(env.setPropertyCount, 1);
    assert.equal(env.setPropertiesCount, 0);
    assert.equal(env.deletePropertyCount, 0);
    assert.equal(env.propertyWriteCount, 1);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    const updated = JSON.parse(env.props.APPROVED_SEND_MANIFEST_JSON);
    assert.equal(updated.candidateDigests[0], env.originalRecoveryDigest);
    assert.equal(updated.runtimeSourceCandidateHashReissued, true);
    assert.equal(updated.runtimeSourceCandidateHashVersion, 'recovery-digest-diagnostic-v4');
    const diagnostic = env.context.runGmailSalesRecoveryDigestDiagnostic();
    assert.equal(diagnostic.substantiveFieldMismatchCount, 0);
    assert.equal(diagnostic.derivedIntegrityFieldMismatchCount, 0);
    assert.equal(diagnostic.manifestSourceCandidateContentHashMatch, true);
    const preSend = env.context.runGmailSalesRecoveryPreSendDryRun();
    assert.equal(preSend.status, 'pass');
    assert.equal(preSend.eligibleCount, 1);
    assert.equal(preSend.wouldAttemptCount, 1);
  }],
  ['recovery source hash reissue is idempotent when already applied', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'already_applied');
    assert.equal(result.propertyUpdated, false);
    assert.equal(result.propertyWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects substantive mismatch', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    setRecoveryCell(env, 2, 'body', `${getRecoveryCell(env, 2, 'body')}\nsubstantive synthetic change`);
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'sheet_substantive_content_mismatch');
    assert.equal(result.propertyUpdated, false);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects multiple derived mismatches', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    addRecoveryCandidateContentHashColumn(env, 'stale_sheet_hash');
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.propertyUpdated, false);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects candidate digest mismatch', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.manifest.candidateDigests[0] = 'digest_mismatch';
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.propertyUpdated, false);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects expired manifest', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.manifest.expiresAt = '2020-01-01T00:00:00.000Z';
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.propertyUpdated, false);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects read-back mismatch without retry', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.corruptApprovedManifestOnSet = true;
    env.entry = 'recoverySourceHashReissue';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'source_hash_reissue_read_back_failed');
    assert.equal(result.propertyUpdated, true);
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(env.setPropertyCount, 1);
    assert.equal(env.propertyWriteCount, 1);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery source hash reissue rejects scheduled trigger style invocation', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.entry = 'recoverySourceHashReissueScheduled';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'manual_execution_required');
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery repair is not applicable when sheet hash column is absent', (env) => {
    installRecoveryReadyRowAndManifest(env);
    env.manifest.sourceOutboxIdentity.candidateContentHash = 'stale_manifest_source_hash';
    env.entry = 'recoveryHashRepair';
  }, (env, result) => {
    assert.equal(result.status, 'not_applicable');
    assert.equal(result.blockedReason, 'sheet_candidate_content_hash_column_absent');
    assert.equal(result.sheetWriteCount, 0);
    assert.equal(result.updatedCellCount, 0);
    assert.equal(env.setValueCount, 0);
    assert.equal(env.setValuesCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery derived candidate hash repair updates one cell only', (env) => {
    installRecoveryReadyRowAndManifest(env);
    addRecoveryCandidateContentHashColumn(env, 'stale_derived_hash');
    env.entry = 'recoveryHashRepair';
  }, (env, result) => {
    assert.equal(result.status, 'repaired');
    assert.equal(result.sheetWriteCount, 1);
    assert.equal(result.updatedCellCount, 1);
    assert.equal(result.otherSheetCellChangeCount, 0);
    assert.equal(result.readBackValidationPassed, true);
    assert.equal(env.setValueCount, 1);
    assert.equal(env.setValuesCount, 0);
    assert.equal(env.sheetWriteCount, 1);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    const row = env.context.loadCandidateRows_(Object.assign({}, env.context.getConfig_(), {
      sheetName: 'recovery',
      sendDate: '2026-06-20'
    }))[0].row;
    assert.equal(getRecoveryCell(env, 2, 'candidateContentHash'), env.context.computeRecoveryCandidateContentHashForRuntime_(row));
    const diagnostic = env.context.runGmailSalesRecoveryDigestDiagnostic();
    assert.equal(diagnostic.derivedIntegrityFieldMismatchCount, 0);
    assert.equal(diagnostic.recommendedNextAction, 'diagnosis_inconclusive');
    const preSend = env.context.runGmailSalesRecoveryPreSendDryRun();
    assert.equal(preSend.status, 'pass');
    assert.equal(preSend.eligibleCount, 1);
    assert.equal(preSend.wouldAttemptCount, 1);
  }],
  ['recovery derived candidate hash repair is idempotent when already applied', (env) => {
    installRecoveryReadyRowAndManifest(env);
    const row = env.context.loadCandidateRows_(Object.assign({}, env.context.getConfig_(), {
      sheetName: 'recovery',
      sendDate: '2026-06-20'
    }))[0].row;
    addRecoveryCandidateContentHashColumn(env, env.context.computeRecoveryCandidateContentHashForRuntime_(row));
    env.entry = 'recoveryHashRepair';
  }, (env, result) => {
    assert.equal(result.status, 'already_applied');
    assert.equal(result.sheetWriteCount, 0);
    assert.equal(result.updatedCellCount, 0);
    assert.equal(env.setValueCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery derived candidate hash repair rejects substantive body mismatch', (env) => {
    installRecoveryReadyRowAndManifest(env);
    addRecoveryCandidateContentHashColumn(env, 'stale_derived_hash');
    setRecoveryCell(env, 2, 'body', `${getRecoveryCell(env, 2, 'body')}\nsubstantive synthetic change`);
    env.entry = 'recoveryHashRepair';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'sheet_substantive_content_mismatch');
    assert.equal(result.sheetWriteCount, 0);
    assert.equal(env.setValueCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['recovery pre-send blocks until derived candidate hash is repaired', (env) => {
    installRecoveryReadyRowAndManifest(env);
    addRecoveryCandidateContentHashColumn(env, 'stale_derived_hash');
    env.entry = 'recoveryDryRun';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReasons.includes('derived_candidate_hash_mismatch'), true);
    assert.equal(result.candidateDigestMismatchCount, 0);
    assert.equal(result.derivedIntegrityFieldMismatchCount, 1);
    assert.equal(result.eligibleCount, 0);
    assert.equal(result.wouldAttemptCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['manual then manual rerun sends only once', (env) => { env.afterRun = () => env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false }); }, (env) => {
    assert.equal(env.mailSendCount, 1);
  }],
  ['real send success resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 1);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['real send blocked resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    delete env.props.APPROVED_SEND_MANIFEST_JSON;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['real send exception resets live flags once', (env) => {
    env.props.AUTO_RESET_LIVE_SEND_AFTER_RUN = 'true';
    env.mailSendThrows = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 1);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(resetLogCount(env), 1);
  }],
  ['local_sync lease conflict blocks Apps Script send', (env) => {
    env.workbook.sheets._gmail_maintenance.rows[1] = ['GMAIL_SALES_SHEET_MAINTENANCE', 'local_sync', 'local-holder', new Date().toISOString(), '2099-01-01T00:00:00.000Z', new Date().toISOString(), '1'];
  }, (env, result) => {
    assertBlockedNoMail(env, result, 'maintenance_lease_held');
  }],
  ['expired lease can be acquired safely', (env) => {
    env.workbook.sheets._gmail_maintenance.rows[1] = ['GMAIL_SALES_SHEET_MAINTENANCE', 'local_sync', 'expired-holder', '2020-01-01T00:00:00.000Z', '2020-01-01T00:10:00.000Z', '2020-01-01T00:00:00.000Z', '1'];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(env.mailSendCount, 1);
  }],
  ['suppression JSON parse failure blocks send', (env) => { env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0 = '{bad'; env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256('{bad'); env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256('{bad'); }; }, (env, result) => {
    assertBlockedNoMail(env, result, 'suppression_ledger_missing');
  }],
  ['manifest candidateCount mismatch blocks send', (env) => { env.manifest.candidateCount = 29; }, (env, result) => {
    assertBlockedNoMail(env, result, 'manifest_candidate_count_mismatch');
  }],
  ['safe logs do not contain row content or digests', () => {}, (env) => {
    const joined = env.logs.join('\n');
    assert.equal(joined.includes(env.rows[0].email), false);
    assert.equal(joined.includes(env.rows[0].name), false);
    assert.equal(joined.includes(env.rows[0].sourceUrl), false);
    assert.equal(joined.includes(env.rows[0].body), false);
    assert.equal(joined.includes(env.manifest.candidateDigests[0]), false);
  }],
  ['suppression diagnostic valid bundle is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.ledgerLoaded, true);
    assert.equal(result.propertyCountExpected, 10);
    assert.equal(result.propertyCountPresent, 10);
    assert.equal(result.missingPropertyCount, 0);
    assert.equal(result.chunkCount, 1);
    assert.equal(result.chunkChecksumValid, true);
    assert.equal(result.bundleChecksumValid, true);
    assert.equal(result.sourceEntryCount, 30);
    assert.equal(result.recipientCount, 30);
    assert.equal(result.domainCount, 30);
    assert.equal(result.businessCount, 30);
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic property missing is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_CREATED_AT;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.missingPropertyCount > 0, true);
    assert.equal(result.blockedReason, 'property_missing');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic chunk missing is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => delete env.props.GMAIL_SUPPRESSION_LEDGER_0;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'property_missing');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic chunk checksum mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = 'mismatch'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'chunk_checksum_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic bundle checksum mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = 'mismatch'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'bundle_checksum_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic JSON parse failure is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => {
      env.props.GMAIL_SUPPRESSION_LEDGER_0 = '{bad';
      env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256('{bad');
      env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256('{bad');
    };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'json_parse_failure');
    assertDiagnosticReadOnly(env);
  }],
  ['suppression diagnostic count mismatch is read-only', (env) => {
    env.entry = 'suppressionDiagnostic';
    useThirtySuppressionEntries(env);
    env.afterInstall = () => { env.props.GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT = '29'; };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'count_mismatch');
    assertDiagnosticReadOnly(env);
  }],
  ['connected sheet dry-run reads existing sheet and writes nothing', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.connectedToGoogleSheet, true);
    assert.equal(result.targetWorksheetExists, true);
    assert.equal(result.incomingHeaderCount, OUTBOX_HEADERS.length);
    assert.equal(result.incomingCandidateCount, 30);
    assert.equal(result.wouldInsertCount, 30);
    assert.equal(result.wouldWriteCount, 30);
    assert.equal(env.sheetReadCount > 0, true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run handles empty sheet as all inserts', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.currentHeaderCount, 0);
    assert.equal(result.currentRowCount, 0);
    assert.equal(result.wouldInsertCount, 30);
    assert.equal(result.existingDataOverwriteRisk, false);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run skips identical existing rows', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...env.outboxRows.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.matchingIdentityCount, 30);
    assert.equal(result.wouldSkipCount, 30);
    assert.equal(result.wouldInsertCount, 0);
    assert.equal(result.wouldUpdateCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run classifies updates inserts and unrelated rows', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    const existing = [
      ...env.outboxRows.slice(0, 10),
      ...env.outboxRows.slice(10, 15).map((row) => Object.assign({}, row, { subject: 'previous safe subject' })),
      buildOutboxRow(31),
      buildOutboxRow(32)
    ];
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...existing.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.wouldSkipCount, 10);
    assert.equal(result.wouldUpdateCount, 5);
    assert.equal(result.wouldInsertCount, 15);
    assert.equal(result.unrelatedExistingRowCount, 2);
    assert.equal(result.wouldDeleteCount, 2);
    assert.equal(result.existingDataOverwriteRisk, true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks incoming duplicate identity', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.rows[1][0] = env.sheetSyncPayload.rows[0][0];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('duplicate'), true);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks existing duplicate identity', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    const duplicate = Object.assign({}, env.outboxRows[0], { subject: 'previous safe subject' });
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, outboxRowToCells(env.outboxRows[0]), outboxRowToCells(duplicate)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'existing_duplicate_identity');
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks unreadable existing headers', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.workbook.sheets.ready.rows = [['notIdentity'], ['value']];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'existing_identity_header_missing');
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run blocks missing target sheet without creating it', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    delete env.workbook.sheets.ready;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'target_sheet_missing');
    assert.equal(env.insertSheetCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run rejects bad token before sheet read', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.token = 'wrong-token';
  }, (env, result) => {
    assert.equal(result.blockedReason, 'token_mismatch');
    assert.equal(env.sheetReadCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['connected sheet dry-run rejects unknown mode before write handler', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload.mode = 'unknown';
    env.sheetSyncPayload.operation = 'unknown';
    env.sheetSyncPayload.action = 'unknown';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'unknown_sheet_sync_mode');
    assertSheetSyncReadOnly(env);
  }],
  ['sheet read-only snapshot returns rows only to response and writes nothing', (env) => {
    env.entry = 'sheetSyncReadOnlySnapshot';
    env.workbook.sheets.ready.rows = [OUTBOX_HEADERS, ...env.outboxRows.map(outboxRowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.event, 'gmail_sheet_sync_read_only_snapshot');
    assert.equal(result.mode, 'read_only_snapshot');
    assert.equal(result.headers.length, OUTBOX_HEADERS.length);
    assert.equal(result.rows.length, 30);
    assert.equal(result.currentRowCount, 30);
    assert.equal(env.logs.join('\n').includes(result.rows[0][0]), false);
    assertSheetSyncReadOnly(env);
  }],
  ['sheet read-only snapshot requires dryRun true and writes nothing', (env) => {
    env.entry = 'sheetSyncReadOnlySnapshot';
    env.sheetSyncPayload.dryRun = false;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'read_only_snapshot_requires_dry_run_true');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only plans one isolated write and writes nothing', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.action, 'sync_recovery_single');
    assert.equal(result.validationPassed, true);
    assert.equal(result.candidateCount, 1);
    assert.equal(result.intendedWriteCount, 1);
    assert.equal(result.actualWriteCount, 0);
    assert.equal(result.sheetUpdated, false);
    assert.equal(env.sheetReadCount > 0, true);
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only is idempotent for identical existing row', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(env.recoveryOutboxRows[0])];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.alreadyApplied, true);
    assert.equal(result.intendedWriteCount, 0);
    assert.equal(result.actualWriteCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only rejects identity conflict', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    const changed = Object.assign({}, env.recoveryOutboxRows[0], { subject: 'different synthetic subject' });
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(changed)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.conflict, true);
    assert.equal(result.blockedReason, 'identity_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only rejects recipient conflict for same identity', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    const changed = Object.assign({}, env.recoveryOutboxRows[0], { email: 'changed-recipient@example.invalid' });
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(changed)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.conflict, true);
    assert.equal(result.blockedReason, 'identity_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only rejects body conflict for same identity', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    const changed = Object.assign({}, env.recoveryOutboxRows[0], { body: `${env.recoveryOutboxRows[0].body}\nsubstantive synthetic change` });
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(changed)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.conflict, true);
    assert.equal(result.blockedReason, 'identity_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only rejects business conflict for same identity', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    const changed = Object.assign({}, env.recoveryOutboxRows[0], { name: 'Different Synthetic Business' });
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(changed)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.conflict, true);
    assert.equal(result.blockedReason, 'identity_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single validate-only rejects personalization conflict for same identity', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    const changed = Object.assign({}, env.recoveryOutboxRows[0], { salesAngle: 'different synthetic personalization angle' });
    env.workbook.sheets.recovery.rows = [OUTBOX_HEADERS, outboxRowToCells(changed)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.conflict, true);
    assert.equal(result.blockedReason, 'identity_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single synthetic write writes exactly one row and never clears', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.dryRun = false;
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.actualWriteCount, 1);
    assert.equal(result.sheetUpdated, true);
    assert.equal(env.setValuesCount, 1);
    assert.equal(env.clearCount, 0);
    assert.equal(env.appendRowCount, 0);
    assert.equal(env.deleteRowsCount, 0);
    assert.equal(env.workbook.sheets.recovery.rows.length, 2);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
  }],
  ['recovery single write then validate-only is already applied after Sheet type normalization', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.dryRun = false;
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.actualWriteCount, 1);
    assert.equal(result.sheetUpdated, true);
    const rowIndex = 2;
    setRecoveryCell(env, rowIndex, 'sendDate', new Date(Date.UTC(2026, 5, 20)));
    setRecoveryCell(env, rowIndex, 'nextActionDate', new Date(Date.UTC(2026, 5, 20)));
    setRecoveryCell(env, rowIndex, 'doNotContact', false);
    setRecoveryCell(env, rowIndex, 'notes', null);
    setRecoveryCell(env, rowIndex, 'body', String(getRecoveryCell(env, rowIndex, 'body')).replace(/\n/g, '\r\n'));
    env.sheetSyncRecoveryPayload.dryRun = true;
    const validateOnly = runEntry(env);
    assert.equal(validateOnly.status, 'pass');
    assert.equal(validateOnly.alreadyApplied, true);
    assert.equal(validateOnly.conflict, false);
    assert.equal(validateOnly.actualWriteCount, 0);
    assert.equal(env.setValuesCount, 1);
    assert.equal(env.clearCount, 0);
    assert.equal(env.appendRowCount, 0);
    assert.equal(env.deleteRowsCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
  }],
  ['recovery single rejects normal thirty-row payload', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload = Object.assign({}, buildSheetSyncPayload(env.outboxRows), {
      action: 'sync_recovery_single',
      operation: 'sync_recovery_single',
      mode: 'sync_recovery_single',
      sourceType: 'recovery_single',
      approvalStatus: 'approved',
      humanReviewCompleted: true,
      humanReviewedCount: 1,
      targetAutoApproved: false,
      manifestCreated: false,
      safetyCounters: buildZeroRecoverySafetyCounters(),
      targetDate: '2026-06-20',
      sendDate: '2026-06-20',
      sendBatchId: 'gmail-sales-2026-06-20-noon-recovery',
      sheetRowCount: 30,
      recoveryTabName: 'recovery'
    });
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'row_count_not_1');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects unapproved payload', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.approvalStatus = 'needs_review';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'approval_status_not_approved');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects targetAutoApproved true', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.targetAutoApproved = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'target_auto_approved_not_false');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects nonzero safety counter', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.safetyCounters.suppressionMatchCount = 1;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'suppressionMatchCount_nonzero');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects missing dedicated tab without creating it', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    delete env.workbook.sheets.recovery;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'recovery_target_sheet_missing');
    assert.equal(env.insertSheetCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects duplicate header', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.workbook.sheets.recovery.rows[0][1] = env.workbook.sheets.recovery.rows[0][0];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'recovery_header_mismatch');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects duplicate existing identity', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.workbook.sheets.recovery.rows = [
      OUTBOX_HEADERS,
      outboxRowToCells(env.recoveryOutboxRows[0]),
      outboxRowToCells(env.recoveryOutboxRows[0])
    ];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'duplicate_conflict');
    assertSheetSyncReadOnly(env);
  }],
  ['recovery single rejects bad token before sheet read', (env) => {
    env.entry = 'sheetSyncRecoverySingle';
    env.sheetSyncRecoveryPayload.token = 'wrong-token';
  }, (env, result) => {
    assert.equal(result.blockedReason, 'token_mismatch');
    assert.equal(env.sheetReadCount, 0);
    assertSheetSyncReadOnly(env);
  }],
  ['normal thirty action rejects recovery payload', (env) => {
    env.entry = 'sheetSyncConnectedDryRun';
    env.sheetSyncPayload = Object.assign({}, env.sheetSyncRecoveryPayload, {
      action: 'connected_dry_run',
      operation: 'connected_dry_run',
      mode: 'connected_dry_run'
    });
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('row_count_not_30'), true);
    assertSheetSyncReadOnly(env);
  }],
  ['normal daily prepare webhook syncs sheet and writes manifest/state only', (env) => {
    env.entry = 'dailyPrepareWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.sheetSyncPayload = buildDailyPreparePayload(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sheetSynced, true);
    assert.equal(result.stateUpdated, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.props.APPROVED_SEND_MANIFEST_JSON.includes('automatic_strict_gate'), true);
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).state, 'sheet_synced');
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).sheetSynced, true);
  }],
  ['normal daily prepare webhook rejects replay before second write', (env) => {
    env.entry = 'dailyPrepareWebhookReplay';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.sheetSyncPayload = buildDailyPreparePayload(env);
  }, (env, result) => {
    assert.equal(result.first.status, 'pass');
    assert.equal(result.second.status, 'blocked');
    assert.equal(result.second.blockedReason, 'webhook_replay_detected');
  }],
  ['normal daily prepare recovers blocked empty-target state before any send', (env) => {
    env.entry = 'dailyPrepareWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
      mode: 'normal_daily',
      state: 'blocked',
      targetDate: '',
      sendAttemptCount: 0,
      actualSendCount: 0,
      resultUnknown: false,
      blockedReasons: ['eligible_candidate_count_insufficient']
    });
    env.sheetSyncPayload = buildDailyPreparePayload(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    const state = JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON);
    assert.equal(state.state, 'sheet_synced');
    assert.equal(state.sheetSynced, true);
    assert.equal(state.recoveredFromState, 'blocked');
    assert.equal(state.recoveryReason, 'prepare_completed_before_any_send');
  }],
  ['normal daily prepare rejects blocked state with previous send attempt', (env) => {
    env.entry = 'dailyPrepareWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
      mode: 'normal_daily',
      state: 'blocked',
      targetDate: '',
      sendAttemptCount: 1,
      actualSendCount: 0,
      resultUnknown: false
    });
    env.sheetSyncPayload = buildDailyPreparePayload(env);
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'blocked_state_send_attempt_exists');
    assert.equal(env.sheetWriteCount, 0);
  }],
  ['normal daily source read webhook is read-only and returns source rows', (env) => {
    env.entry = 'dailySourceReadWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.props.GMAIL_DAILY_SOURCE_TAB_NAME = 'daily-source';
    env.sheetSyncPayload = buildDailySourceReadPayload(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.requestedSourceCount, 90);
    assert.equal(result.availableSourceCount, 90);
    assert.equal(result.sourceCount, 90);
    assert.equal(result.rows.length, 90);
    assert.equal(result.headers.length, OUTBOX_HEADERS.length);
    assert.equal(result.recoveryEntryCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['normal daily source sync writes only dedicated source tab and configures property', (env) => {
    env.entry = 'dailySourceSyncWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.sheetSyncPayload = buildDailySourceSyncPayload(env, 45);
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.sourceRowsWritten, 45);
    assert.equal(result.sourceRowsReadBack, 45);
    assert.equal(result.sourceDigestMatch, true);
    assert.equal(result.propertyConfigured, true);
    assert.equal(result.sourceTabCommitted, true);
    assert.equal(result.requestCommitted, true);
    assert.equal(env.props.GMAIL_DAILY_SOURCE_TAB_NAME, 'Gmail営業候補プール');
    assert.equal(env.setValuesCount, 1);
    assert.equal(env.flushCount, 1);
    assert.equal(env.workbook.sheets._gmail_normal_daily_source_staging, undefined);
    assert.equal(env.workbook.sheets._gmail_normal_daily_source_backup, undefined);
    assert.equal(env.workbook.sheets['Gmail営業候補プール'].rows.length, 46);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.workbook.sheets.sales.rows.length, 31);
  }],
  ['normal daily source sync replaces existing partial source only after staging validation', (env) => {
    env.entry = 'dailySourceSyncWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.workbook.sheets['Gmail営業候補プール'] = new MockSheet('Gmail営業候補プール', [OUTBOX_HEADERS, ...Array.from({ length: 10 }, (_, index) => outboxRowToCells(buildOutboxRow(index + 1)))]);
    env.workbook.sheets['Gmail営業候補プール'].env = env;
    env.sheetSyncPayload = buildDailySourceSyncPayload(env, 52);
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.sourceRowsWritten, 52);
    assert.equal(result.sourceRowsReadBack, 52);
    assert.equal(result.sourceTabCommitted, true);
    assert.equal(env.workbook.sheets['Gmail営業候補プール'].rows.length, 53);
    assert.equal(env.workbook.sheets._gmail_normal_daily_source_backup, undefined);
    assert.equal(env.workbook.sheets._gmail_normal_daily_source_staging, undefined);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['normal daily source sync rejects source rows below minimum without writes', (env) => {
    env.entry = 'dailySourceSyncWebhook';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    env.sheetSyncPayload = buildDailySourceSyncPayload(env, 29);
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('source_row_count_below_minimum'), true);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['future arm succeeds after source sync without sending or trigger changes', (env) => {
    env.entry = 'dailyFutureArm';
    installDailyFutureArmReadyState(env);
  }, (env, result) => {
    assert.equal(result.status, 'armed', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.armedForDate, '2026-06-23');
    assert.equal(result.sourceRowsReadBack, 45);
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'true');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'true');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['future arm is idempotent once armed', (env) => {
    env.entry = 'dailyFutureArm';
    installDailyFutureArmReadyState(env);
    env.afterRun = () => {
      env.secondResult = env.context.armGmailSalesDailyAutomationForFutureRunsOnce();
    };
  }, (env, result) => {
    assert.equal(result.status, 'armed');
    assert.equal(env.secondResult.status, 'already_armed');
    assert.equal(env.secondResult.propertyWriteCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['future arm rejects insufficient source rows', (env) => {
    env.entry = 'dailyFutureArm';
    installDailyFutureArmReadyState(env);
    env.workbook.sheets['Gmail営業候補プール'].rows = [OUTBOX_HEADERS, ...Array.from({ length: 29 }, (_, index) => outboxRowToCells(buildSourceOutboxRow(index + 1)))];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('source_rows_below_recommended'), true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['automatic strict manifest is accepted by normal pre-send', (env) => {
    env.manifest = buildAutomaticDailyManifest(env);
    env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
    env.entry = 'dryRun';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.candidateCount, 30);
    assertDryRunWriteFree(env);
  }],
  ['daily automation initializer configures versions without touching secret', (env) => {
    env.entry = 'dailyInitializer';
    env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
    delete env.props.GMAIL_SALES_AUTOMATION_VERSION;
    delete env.props.GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION;
    env.props.UNRELATED_PROPERTY = 'kept';
  }, (env, result) => {
    assert.equal(result.status, 'configured');
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(result.automationVersionConfigured, true);
    assert.equal(result.approvalPolicyVersionConfigured, true);
    assert.equal(result.sharedSecretPresent, true);
    assert.equal(env.props.GMAIL_AUTOMATION_SHARED_SECRET, 'test-secret');
    assert.equal(env.props.UNRELATED_PROPERTY, 'kept');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation initializer output immediately passes health window check', (env) => {
    env.entry = 'dailyInitializer';
    env.props.ALLOWED_SEND_START_HOUR = '0';
    env.props.ALLOWED_SEND_START_MINUTE = '0';
    env.props.ALLOWED_SEND_END_HOUR = '0';
    env.props.ALLOWED_SEND_END_MINUTE = '0';
  }, (env, result) => {
    assert.equal(result.sendWindowConfigured, true);
    env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
    const health = env.context.runGmailSalesDailyAutomationHealthCheck();
    assert.equal(health.status, 'pass');
    assert.equal(health.sendWindowConfigured, true);
    assert.equal(health.sendWindow, '11:45-12:45');
  }],
  ['daily automation initializer is idempotent', (env) => {
    env.entry = 'dailyInitializer';
    env.props.AUTOMATION_MASTER_ENABLED = 'false';
    env.props.AUTO_SEND_ENABLED = 'false';
    env.props.LIVE_SEND_ENABLED = 'false';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '11:45';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '12:45';
  }, (_env, result) => {
    assert.equal(result.status, 'already_configured');
    assert.equal(result.propertyWriteCount, 0);
    assert.equal(result.automationVersionConfigured, true);
    assert.equal(result.approvalPolicyVersionConfigured, true);
  }],
  ['daily automation health blocks unset versions', (env) => {
    env.entry = 'dailyHealth';
    env.props.GMAIL_SALES_AUTOMATION_VERSION = 'unset';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason.includes('version_not_configured'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks unconfigured send window', (env) => {
    env.entry = 'dailyHealth';
    delete env.props.GMAIL_SALES_SEND_WINDOW_START;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sendWindowConfigured, false);
    assert.equal(result.sendWindowStartPresent, false);
    assert.equal(result.blockedReason.includes('send_window_not_configured'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks missing send window end', (env) => {
    env.entry = 'dailyHealth';
    delete env.props.GMAIL_SALES_SEND_WINDOW_END;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sendWindowConfigured, false);
    assert.equal(result.sendWindowEndPresent, false);
    assert.equal(result.blockedReason.includes('send_window_not_configured'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks equal send window endpoints', (env) => {
    env.entry = 'dailyHealth';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '00:00';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '00:00';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sendWindowConfigured, false);
    assert.equal(result.sendWindowFormatValid, true);
    assert.equal(result.sendWindowRangeValid, false);
    assert.equal(result.blockedReason.includes('send_window_invalid'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks invalid send window format', (env) => {
    env.entry = 'dailyHealth';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '11:xx';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sendWindowConfigured, false);
    assert.equal(result.sendWindowFormatValid, false);
    assert.equal(result.blockedReason.includes('send_window_invalid'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health ignores legacy allowed send window overrides', (env) => {
    env.entry = 'dailyHealth';
    env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
    env.props.ALLOWED_SEND_START_HOUR = '0';
    env.props.ALLOWED_SEND_START_MINUTE = '0';
    env.props.ALLOWED_SEND_END_HOUR = '0';
    env.props.ALLOWED_SEND_END_MINUTE = '0';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sendWindowConfigured, true);
    assert.equal(result.sendWindow, '11:45-12:45');
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks legacy-only send window configuration', (env) => {
    env.entry = 'dailyHealth';
    delete env.props.GMAIL_SALES_SEND_WINDOW_START;
    delete env.props.GMAIL_SALES_SEND_WINDOW_END;
    env.props.ALLOWED_SEND_START_HOUR = '11';
    env.props.ALLOWED_SEND_START_MINUTE = '45';
    env.props.ALLOWED_SEND_END_HOUR = '12';
    env.props.ALLOWED_SEND_END_MINUTE = '45';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sendWindowConfigured, false);
    assert.equal(result.blockedReason.includes('send_window_not_configured'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health passes with configured versions and window', (env) => {
    env.entry = 'dailyHealth';
    env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.automationVersionMatch, true);
    assert.equal(result.approvalPolicyVersionMatch, true);
    assert.equal(result.sendWindowConfigured, true);
    assert.equal(result.sendWindow, '11:45-12:45');
    assert.equal(result.triggerScheduleConfigured, true);
    assert.equal(result.expectedTriggerHour, 12);
    assert.equal(result.expectedTriggerMinute, 15);
    assert.equal(result.expectedTriggerTimezone, 'Asia/Tokyo');
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health passes with one installed normal trigger', (env) => {
    env.entry = 'dailyHealth';
    env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.controlLoopTriggerCount, 1);
    assert.equal(result.triggerScheduleConfigured, true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation health blocks narrow trigger schedule', (env) => {
    env.entry = 'dailyHealth';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '11:45';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '12:00';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.triggerScheduleConfigured, false);
    assert.equal(result.blockedReason.includes('send_window_too_narrow'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily automation installer schedules midpoint trigger in Asia Tokyo', (env) => {
    env.entry = 'dailyInstall';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.triggerChanged, true);
    assert.equal(env.triggerWriteCount, 1);
    assert.equal(env.triggerCreations.length, 1);
    assert.equal(env.triggerCreations[0].handler, 'runGmailSalesDailyAutomationTrigger');
    assert.equal(env.triggerCreations[0].hour, 12);
    assert.equal(env.triggerCreations[0].minute, 15);
    assert.equal(env.triggerCreations[0].timezone, 'Asia/Tokyo');
    assert.notEqual(env.triggerCreations[0].hour, 11);
    assert.notEqual(env.triggerCreations[0].minute, 45);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['daily automation installer treats existing normal trigger as already installed', (env) => {
    env.entry = 'dailyInstall';
    env.triggers = [{ handler: 'runGmailSalesDailyAutomationTrigger' }];
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.alreadyInstalled, true);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.triggerCreations.length, 0);
  }],
  ['daily automation installer blocks duplicate normal triggers', (env) => {
    env.entry = 'dailyInstall';
    env.triggers = [
      { handler: 'runGmailSalesDailyAutomationTrigger' },
      { handler: 'runGmailSalesDailyAutomationTrigger' }
    ];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.duplicateTriggerCount, 1);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.triggerCreations.length, 0);
  }],
  ['daily automation installer blocks forbidden recovery trigger', (env) => {
    env.entry = 'dailyInstall';
    env.triggers = [{ handler: 'runGmailSalesRecoverySendOnce' }];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.forbiddenTriggerCount, 1);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.triggerCreations.length, 0);
  }],
  ['daily automation installer rejects equal send window endpoints', (env) => {
    env.entry = 'dailyInstall';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '00:00';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '00:00';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'send_window_invalid');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation installer rejects inverted send window', (env) => {
    env.entry = 'dailyInstall';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '12:45';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '11:45';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'send_window_invalid');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation installer rejects invalid send window format', (env) => {
    env.entry = 'dailyInstall';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '12:xx';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'send_window_invalid');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation installer rejects missing timezone', (env) => {
    env.entry = 'dailyInstall';
    delete env.props.GMAIL_SALES_TIMEZONE;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'timezone_not_configured');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation installer rejects non canonical timezone', (env) => {
    env.entry = 'dailyInstall';
    env.props.GMAIL_SALES_TIMEZONE = 'UTC';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'timezone_not_configured');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation installer rejects narrow send window', (env) => {
    env.entry = 'dailyInstall';
    env.props.GMAIL_SALES_SEND_WINDOW_START = '11:45';
    env.props.GMAIL_SALES_SEND_WINDOW_END = '12:00';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'send_window_too_narrow');
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation activation enables master and auto send once when prepared', (env) => {
    env.entry = 'dailyActivate';
    installDailyActivationReadyState(env);
  }, (env, result) => {
    assert.equal(result.status, 'activated', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'true');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'true');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['daily automation activation is idempotent when already active', (env) => {
    env.entry = 'dailyActivate';
    installDailyActivationReadyState(env);
    env.props.AUTOMATION_MASTER_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
    env.props.LIVE_SEND_ENABLED = 'false';
  }, (env, result) => {
    assert.equal(result.status, 'already_active');
    assert.equal(result.propertyWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['daily automation activation blocks without prepared state', (env) => {
    env.entry = 'dailyActivate';
    env.props.AUTOMATION_MASTER_ENABLED = 'false';
    env.props.AUTO_SEND_ENABLED = 'false';
    env.props.LIVE_SEND_ENABLED = 'false';
    env.triggers = [{ handler: 'runGmailSalesDailyAutomationTrigger' }];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.propertyWriteCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['daily automation deactivation disables send flags without deleting state', (env) => {
    env.entry = 'dailyDeactivate';
    installDailyActivationReadyState(env);
    env.props.AUTOMATION_MASTER_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
    env.props.LIVE_SEND_ENABLED = 'false';
  }, (env, result) => {
    assert.equal(result.status, 'deactivated');
    assert.equal(result.propertyWriteCount, 1);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).state, 'sheet_synced');
  }],
  ['daily readiness passes for verified normal daily batch', (env) => {
    env.entry = 'dailyReadiness';
    installNormalDailyReadyState(env);
  }, (env, result) => {
    assert.equal(result.readyForScheduledSend, true);
    assert.equal(result.schedulerAuthority, 'runGmailSalesDailyAutomationTrigger');
    assert.equal(result.sourceCandidateCount, 45);
    assert.equal(result.verifiedCandidateCount, 45);
    assert.equal(result.selectedCount, 30);
    assert.equal(result.reserveCount, 15);
    assert.equal(result.preflightPassed, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['prepareDailyPipeline selects thirty, syncs sheet, and creates ready state', (env) => {
    env.entry = 'dailyPreparePipeline';
    installDailyPipelineSourceState(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.selectedCount, 30);
    assert.equal(result.reserveCount, 15);
    assert.equal(result.sheetSynced, true);
    assert.equal(result.manifestCandidateCount, 30);
    assert.equal(result.candidateDigestMatch, true);
    assert.equal(result.readyForScheduledSend, true);
    const state = JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON);
    const manifest = JSON.parse(env.props.APPROVED_SEND_MANIFEST_JSON);
    assert.equal(state.state, 'sheet_synced');
    assert.equal(state.sheetSynced, true);
    assert.equal(state.actualCandidateCount, 30);
    assert.equal(manifest.candidateCount, 30);
    assert.equal(manifest.maxSendCount, 30);
    assert.equal(manifest.approvalStatus, 'approved');
    assert.equal(manifest.approvalType, 'automatic_strict_gate');
    assert.equal(manifest.targetAutoApproved, true);
    assert.equal(manifest.humanReviewCompleted, false);
    assert.equal(manifest.humanReviewedCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.draftCreateCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.sheetWriteCount > 0, true);
  }],
  ['prepareDailyPipeline prepares degraded nonzero source below thirty', (env) => {
    env.entry = 'dailyPreparePipeline';
    installDailyPipelineSourceState(env, { sourceCount: 29 });
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.selectedCount, 29);
    assert.equal(result.manifestCandidateCount, 29);
    assert.equal(result.degradedOperation, true);
    assert.equal(result.shortfallCount, 1);
    assert.equal(result.sheetSynced, true);
    assert.equal(result.readyForScheduledSend, true);
    const manifest = JSON.parse(env.props.APPROVED_SEND_MANIFEST_JSON);
    assert.equal(manifest.candidateCount, 29);
    assert.equal(manifest.maxSendCount, 29);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
  }],
  ['prepareDailyPipeline excludes unknown contact basis and prepares degraded nonzero batch', (env) => {
    env.entry = 'dailyPreparePipeline';
    installDailyPipelineSourceState(env, { sourceCount: 30 });
    const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
    const basisColumn = sourceSheet.rows[0].indexOf('contactBasisType');
    sourceSheet.rows[1][basisColumn] = 'unknown';
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result)));
    assert.equal(result.selectedCount, 29);
    assert.equal(result.manifestCandidateCount, 29);
    assert.equal(result.degradedOperation, true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['prepareDailyPipeline blocks when approved eligible count is zero', (env) => {
    env.entry = 'dailyPreparePipeline';
    installDailyPipelineSourceState(env, { sourceCount: 30 });
    const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
    const basisColumn = sourceSheet.rows[0].indexOf('contactBasisType');
    for (let index = 1; index < sourceSheet.rows.length; index += 1) {
      sourceSheet.rows[index][basisColumn] = 'unknown';
    }
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.blockedReason, 'no_approved_eligible_candidate');
    assert.equal(result.sheetSynced, false);
    assert.equal(env.mailSendCount, 0);
  }],
  ['daily E2E pipeline prepares, enables, sends thirty, audits, and safe rests', (env) => {
    env.entry = 'dailyE2E';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
  }, (env, result) => {
    assert.equal(result.prepare.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result.prepare)));
    assert.equal(result.prepare.sourceCandidateCount, 57);
    assert.equal(result.prepare.selectedCount, 30);
    assert.equal(result.prepare.reserveCount, 27);
    assert.equal(result.prepare.sheetSynced, true);
    assert.equal(result.prepare.manifestCandidateCount, 30);
    assert.equal(result.prepare.candidateDigestMatch, true);
    assert.equal(result.prepare.readyForScheduledSend, true);
    assert.equal(result.enable.status, 'enabled', JSON.stringify(safeResultForAssertionMessage(result.enable)));
    assert.equal(result.send.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result.send)));
    assert.equal(result.send.sentCount, 30);
    assert.equal(result.audit.status, 'pass', JSON.stringify(safeResultForAssertionMessage(result.audit)));
    assert.equal(result.audit.sentCount, 30);
    assert.equal(result.audit.duplicateCount, 0);
    assert.equal(result.audit.overageCount, 0);
    assert.equal(env.mailSendCount, 30);
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
  }],
  ['special restart Sunday is operational', (env) => {
    env.entry = 'dailyReadiness';
    installNormalDailyReadyState(env, { targetDate: '2026-06-28' });
  }, (env, result) => {
    assert.equal(result.isOperationalDay, true);
    assert.equal(result.isSpecialRestartDay, true);
    assert.equal(result.readyForScheduledSend, true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['regular Sunday after restart is not operational and sends zero', (env) => {
    env.entry = 'dailyAutomationTrigger';
    installNormalDailyReadyState(env, { targetDate: '2026-07-05' });
    env.props.AUTOMATION_MASTER_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
    env.props.LIVE_SEND_ENABLED = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReasons || []).includes('weekly_review_day'), true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['deployment readiness diagnostic is read-only', (env) => {
    env.entry = 'deploymentReadiness';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
  }, (env, result) => {
    assert.equal(result.mode, 'read_only');
    assert.equal(result.requiredFunctionsPresent, true, JSON.stringify(result.missingFunctions));
    assert.equal(result.triggerInstallerPresent, true);
    assert.equal(result.controlLoopFunctionPresent, true);
    assert.equal(result.sendAuthorityPresent, true);
    assert.equal(result.mailAppSendEmailCallSiteExpectedCount, 1);
    assert.equal(result.spreadsheetAccessConfigured, true);
    assert.equal(result.sourceTabAccessible, true);
    assert.equal(result.contactBasisFieldsSupported, true);
    assert.equal(result.suppressionSourceAccessible, true);
    assert.equal(result.historySourceAccessible, true);
    assert.equal(result.productionSendExecuted, false);
    assert.equal(result.productionSheetUpdated, false);
    assert.equal(result.productionPropertyUpdated, false);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.triggerWriteCount, 0);
  }],
  ['deployment readiness separates configured max from stale manifest max', (env) => {
    env.entry = 'deploymentReadiness';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
    env.manifest = Object.assign({}, env.manifest, {
      targetDate: '2026-06-19',
      maxSendCount: 1,
      candidateCount: 1
    });
    env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
    env.props.GMAIL_SEND_MAX_SEND_COUNT = '1';
  }, (env, result) => {
    assert.equal(result.configuredMaxDailySendCount, 30);
    assert.equal(result.currentManifestMaxSendCount, 1);
    assert.equal(result.dailyLimitConfigurationValid, true);
    assert.equal(result.deploymentReady, true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['deployment readiness detects missing ready tab property and contact basis fields', (env) => {
    env.entry = 'deploymentReadiness';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
    delete env.props.GMAIL_SHEET_READY_TAB_NAME;
    env.workbook.sheets['Gmail営業候補プール'].rows[0] = [
      'prospectId',
      'name',
      'email',
      'contactEmail',
      'subject',
      'body',
      'status',
      'sendDate',
      'dedupeKey',
      'sendBatchId',
      'lastCheckedAt',
      'notes'
    ];
  }, (env, result) => {
    assert.equal(result.deploymentReady, false);
    assert.equal(result.infrastructureBlockedReasons.includes('required_property_missing'), true);
    assert.equal(result.infrastructureBlockedReasons.includes('contact_basis_fields_missing'), true);
    assert.equal(result.configuredMaxDailySendCount, 30);
    assert.equal(result.currentManifestMaxSendCount, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['production schema installer sets ready tab and appends missing contact basis columns', (env) => {
    env.entry = 'schemaInstall';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
    delete env.props.GMAIL_SHEET_READY_TAB_NAME;
    env.workbook.sheets['Gmail営業候補プール'].rows[0] = OUTBOX_HEADERS.filter((header) => CONTACT_BASIS_HEADERS.indexOf(header) === -1);
    env.workbook.sheets.sales.rows[0] = HEADERS.filter((header) => CONTACT_BASIS_HEADERS.indexOf(header) === -1);
  }, (env, result) => {
    assert.equal(result.status, 'pass', JSON.stringify(result));
    assert.equal(env.props.GMAIL_SHEET_READY_TAB_NAME, 'sales');
    assert.equal(env.props.GMAIL_SALES_EXPECTED_DAILY_COUNT, '30');
    assert.equal(env.props.GMAIL_SALES_MAX_DAILY_SEND_COUNT, '30');
    assert.equal(result.schemaColumnsAddedCount, CONTACT_BASIS_HEADERS.length * 2);
    assert.equal(result.sourceColumnsAdded, CONTACT_BASIS_HEADERS.length);
    assert.equal(result.outboxColumnsAdded, CONTACT_BASIS_HEADERS.length);
    assert.equal(result.backupCreated, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.setPropertiesCount >= 1, true);
  }],
  ['production schema installer rolls back header mismatch before property write', (env) => {
    env.entry = 'schemaInstall';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
    delete env.props.GMAIL_SHEET_READY_TAB_NAME;
    env.schemaHeaderCorruptionsRemaining = 1;
    env.workbook.sheets.sales.rows[0] = HEADERS.filter((header) => CONTACT_BASIS_HEADERS.indexOf(header) === -1);
  }, (env, result) => {
    assert.equal(result.status, 'blocked', JSON.stringify(result));
    assert.equal(result.blockedReason, 'header_read_back_failed');
    assert.equal(result.readBackPassed, false);
    assert.equal(env.props.GMAIL_SHEET_READY_TAB_NAME, undefined);
    assert.equal(env.setPropertiesCount, 0);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.triggerWriteCount, 0);
    assert.equal(env.workbook.sheets.sales.rows[0].includes('contactBasisType'), false);
  }],
  ['production schema inspector is read-only', (env) => {
    env.entry = 'productionSchema';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
  }, (env, result) => {
    assert.equal(result.schemaReady, true, JSON.stringify(result.blockedReasons));
    assert.equal(result.configuredMaxDailySendCount, 30);
    assert.equal(result.currentManifestMaxSendCount, 0);
    assertDiagnosticReadOnly(env);
  }],
  ['contact basis coverage reports operational candidates', (env) => {
    env.entry = 'contactBasisCoverage';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 57 });
  }, (env, result) => {
    assert.equal(result.fieldsSupported, true);
    assert.equal(result.approvedBasisCount, 57);
    assert.equal(result.validBusinessContactExceptionCount, 57);
    assert.equal(result.eligibleAfterBasisCheckCount, 57);
    assert.equal(result.operationalCandidateReady, true);
    assertDiagnosticReadOnly(env);
  }],
  ['contact basis coverage classifies allowed and blocked basis types without auto approval', (env) => {
    env.entry = 'contactBasisCoverage';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 45 });
    const sourceSheet = env.workbook.sheets['Gmail営業候補プール'];
    const basisIndex = sourceSheet.rows[0].indexOf('contactBasisType');
    sourceSheet.rows[1][basisIndex] = 'explicit_opt_in';
    sourceSheet.rows[2][basisIndex] = 'existing_relationship';
    sourceSheet.rows[3][basisIndex] = 'manual_legal_reviewed';
    sourceSheet.rows[4][basisIndex] = 'needs_review';
    sourceSheet.rows[5][basisIndex] = 'guessed';
    sourceSheet.rows[6][basisIndex] = 'private_personal_contact';
    sourceSheet.rows[7][basisIndex] = '';
  }, (env, result) => {
    assert.equal(result.explicitOptInCount, 1);
    assert.equal(result.existingRelationshipCount, 1);
    assert.equal(result.manualLegalReviewedCount, 1);
    assert.equal(result.needsReviewCount, 1);
    assert.equal(result.guessedContactCount, 1);
    assert.equal(result.privatePersonalContactCount, 1);
    assert.equal(result.missingBasisCount, 1);
    assert.equal(result.approvedBasisCount, 41);
    assert.equal(result.operationalCandidateReady, true);
    assertDiagnosticReadOnly(env);
  }],
  ['contact basis coverage blocks when eligible basis count is below thirty', (env) => {
    env.entry = 'contactBasisCoverage';
    installDailyPipelineSourceState(env, { targetDate: '2026-06-30', sourceCount: 29 });
  }, (env, result) => {
    assert.equal(result.eligibleAfterBasisCheckCount, 29);
    assert.equal(result.operationalCandidateReady, false);
    assert.equal(result.blockedReasons.includes('eligible_basis_count_below_30'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['weekly report Sunday sends zero and keeps strategy unchanged with low sample', (env) => {
    env.entry = 'weeklyReport';
    env.nowIso = '2026-07-05T09:00:00.000Z';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.weekStart, '2026-06-29');
    assert.equal(result.weekEnd, '2026-07-04');
    assert.equal(result.totalSent, 0);
    assert.equal(result.appliedChanges, 0);
    assert.equal(env.mailSendCount, 0);
  }],
  ['production trigger installer creates control loop only without sending', (env) => {
    env.entry = 'productionTriggerInstall';
    env.triggers = [
      { handler: 'runScheduledDailySend' },
      { handler: 'runGmailSalesDailyAutomationTrigger' }
    ];
  }, (env, result) => {
    assert.equal(result.controlLoopTriggerExists, true);
    assert.equal(result.oldSendTriggerAbsent, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.triggerWriteCount > 0, true);
  }],
  ['production control loop installer alias is idempotent and does not install direct send trigger', (env) => {
    env.entry = 'productionControlLoopInstallAlias';
  }, (env, result) => {
    assert.equal(result.controlLoopTriggerExists, true);
    assert.equal(result.oldSendTriggerAbsent, true);
    assert.equal(env.triggerCreations.length, 1);
    assert.equal(env.triggerCreations[0].handler, 'runGmailSalesProductionControlLoop');
    assert.equal(env.triggerCreations[0].minuteInterval, 30);
    assert.equal(env.mailSendCount, 0);
  }],
  ['production scheduler inspector reports installed controller without writes', (env) => {
    env.entry = 'productionSchedulerStatus';
    env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  }, (env, result) => {
    assert.equal(result.schedulerInstalled, true);
    assert.equal(result.schedulerEnabled, true);
    assert.equal(result.controllerTriggerCount, 1);
    assert.equal(result.sendAuthorityTriggerCount, 0);
    assertDiagnosticReadOnly(env);
  }],
  ['tomorrow emergency readiness treats stale one-candidate manifest as zero eligible', (env) => {
    env.entry = 'tomorrowEmergencyReadiness';
    installStaleOneCandidateManifestReadinessState(env);
  }, (env, result) => {
    assert.equal(result.targetBusinessDate, '2026-07-02');
    assert.equal(result.currentApprovedEligibleCount, 0);
    assert.equal(result.currentSendManifestEligibleCount, 0);
    assert.equal(result.zeroSendRisk, true);
    assert.equal(result.zeroSendRiskReasons.includes('no_approved_eligible_candidate'), true);
    assert.equal(result.zeroSendRiskReasons.includes('scheduler_not_installed'), true);
    assert.equal(result.zeroSendRiskReasons.includes('contact_basis_coverage_invalid'), true);
    assert.equal(result.zeroSendRiskReasons.includes('target_manifest_invalid'), true);
    assert.equal(result.zeroSendRiskReasons.includes('preflight_failed'), true);
    assertDiagnosticReadOnly(env);
  }],
  ['daily enable when ready sets three flags without sending', (env) => {
    env.entry = 'dailyEnableWhenReady';
    installNormalDailyReadyState(env);
  }, (env, result) => {
    assert.equal(result.status, 'enabled');
    assert.equal(result.readyForScheduledSend, true);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'true');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'true');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'true');
    assert.equal(env.mailSendCount, 0);
  }],
  ['legacy scheduled daily send is monitor only', (env) => {
    env.entry = 'legacyScheduledDailySend';
    installNormalDailyReadyState(env);
    env.props.AUTOMATION_MASTER_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
    env.props.LIVE_SEND_ENABLED = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'monitor_only');
    assert.equal(result.gmailSendExecuted, false);
    assert.equal(env.mailSendCount, 0);
  }],
  ['daily automation trigger authority sends thirty once when enabled', (env) => {
    env.entry = 'dailyAutomationTrigger';
    installNormalDailyReadyState(env);
    env.props.AUTOMATION_MASTER_ENABLED = 'true';
    env.props.AUTO_SEND_ENABLED = 'true';
    env.props.LIVE_SEND_ENABLED = 'true';
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 30);
    assert.equal(env.mailSendCount, 30);
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).state, 'sent');
  }],
  ['same-day prepare creates strict state and manifest without sending', (env) => {
    env.entry = 'sameDayPrepare20260624';
    installSameDayPrepareInputState(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.selectedCount, 30);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
    const state = JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON);
    const manifest = JSON.parse(env.props.APPROVED_SEND_MANIFEST_JSON);
    assert.equal(state.state, 'sheet_synced');
    assert.equal(state.targetDate, '2026-06-24');
    assert.equal(manifest.targetDate, '2026-06-24');
    assert.equal(manifest.batchId, 'gmail-sales-2026-06-24');
    assert.equal(manifest.candidateCount, 30);
    assert.equal(manifest.maxSendCount, 30);
    assert.equal(manifest.approvalType, 'automatic_strict_gate');
    assert.equal(manifest.targetAutoApproved, true);
    assert.equal(manifest.humanReviewCompleted, false);
    assert.equal(manifest.humanReviewedCount, 0);
  }],
  ['same-day prepare blocks with twenty-nine candidates and writes nothing', (env) => {
    env.entry = 'sameDayPrepare20260624';
    installSameDayPrepareInputState(env);
    env.rows = env.rows.slice(0, 29);
    env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('candidate_count_not_30'), true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.setPropertyCount, 0);
    assert.equal(env.setPropertiesCount, 0);
  }],
  ['same-day prepare blocks after deadline and writes nothing', (env) => {
    env.entry = 'sameDayPrepare20260624';
    installSameDayPrepareInputState(env);
    env.nowIso = '2026-06-24T20:01:00.000Z';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('same_day_emergency_window_closed'), true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.setPropertyCount, 0);
    assert.equal(env.setPropertiesCount, 0);
  }],
  ['same-day readiness is true only after live send is enabled', (env) => {
    env.entry = 'sameDayReadiness20260624';
    installSameDayEmergencyReadyState(env);
    env.props.LIVE_SEND_ENABLED = 'true';
  }, (env, result) => {
    assert.equal(result.readyToSend, true);
    assert.equal(result.candidateCount, 30);
    assert.equal(result.manifestCandidateCount, 30);
    assert.equal(result.manifestMaxSendCount, 30);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['same-day properties verify is read-only', (env) => {
    env.entry = 'sameDayPropertiesVerify20260624';
    installSameDayPrepareInputState(env);
    env.props.LIVE_SEND_ENABLED = 'true';
  }, (env, result) => {
    assert.equal(result.masterEnabled, true);
    assert.equal(result.autoSendEnabled, false);
    assert.equal(result.liveSendEnabled, true);
    assert.equal(result.automationVersionConfigured, true);
    assert.equal(result.approvalPolicyVersionConfigured, true);
    assert.equal(result.sharedSecretPresent, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.propertyWriteCount, 0);
  }],
  ['same-day candidate rejection inspect reports wrong send date as metadata repairable', (env) => {
    env.entry = 'sameDayCandidateInspect20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
  }, (env, result) => {
    assert.equal(result.sourceCandidateCount, 30);
    assert.equal(result.eligibleCount, 0);
    assert.equal(result.wrongTargetDateCount, 30);
    assert.equal(result.candidatesRepairableByMetadataOnly, 30);
    assert.equal(result.readyForMetadataRepair, true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.sheetWriteCount, 0);
  }],
  ['same-day metadata repair fixes wrong send date without sending', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.repairedCount, 30);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.props.LIVE_SEND_ENABLED, 'true');
    const postInspect = env.context.inspectGmailSalesSameDayCandidateRejections20260624();
    assert.equal(postInspect.eligibleCount, 30);
  }],
  ['same-day metadata repair fixes wrong status without sending', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongStatus: true });
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.repairedCount, 30);
    assert.equal(env.mailSendCount, 0);
    const postInspect = env.context.inspectGmailSalesSameDayCandidateRejections20260624();
    assert.equal(postInspect.eligibleCount, 30);
  }],
  ['same-day metadata repair rejects invalid email', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.rows[0].email = 'invalid-email';
    env.rows[0].contactEmail = 'invalid-email';
    env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day metadata repair rejects suppression match', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.afterInstall = () => {
      const row = env.rows[0];
      env.suppression.recipientHashes = [env.context.hashValue_(env.context.normalizeEmail_(row.email))];
      env.suppression.domainHashes = [env.context.hashValue_(env.context.sourceDomainFromRow_(row))];
      env.suppression.businessFingerprints = [env.context.businessFingerprintFromRow_(row)];
      installSuppressionProps(env);
    };
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day metadata repair rejects already sent row', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.rows[0].sentStatus = 'sent';
    env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day metadata repair rejects duplicate candidate', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.rows[1].email = env.rows[0].email;
    env.rows[1].contactEmail = env.rows[0].contactEmail;
    env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day metadata repair rejects missing body', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.rows[0].body = '';
    env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day metadata repair rejects after deadline', (env) => {
    env.entry = 'sameDayMetadataRepair20260624';
    installSameDayMetadataRepairInputState(env, { wrongSendDate: true });
    env.nowIso = '2026-06-24T20:01:00.000Z';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.insertSheetCount, 0);
  }],
  ['same-day emergency sends thirty once and enables future automation after success', (env) => {
    env.entry = 'sameDayEmergency20260624';
    installSameDayEmergencyReadyState(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 30);
    assert.equal(result.oneWeekCatchUpSendCount, 0);
    assert.equal(result.pastDateSendCount, 0);
    assert.equal(env.mailSendCount, 30);
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).state, 'sent');
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'true');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'true');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'true');
  }],
  ['same-day emergency rerun after sent sends zero', (env) => {
    env.entry = 'sameDayEmergency20260624';
    installSameDayEmergencyReadyState(env);
    env.afterRun = () => {
      env.secondResult = env.context.runGmailSalesSameDaySend20260624Once();
    };
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 30);
    assert.equal(env.secondResult.status, 'blocked');
    assert.equal((env.secondResult.blockedReason || '').includes('already_sent'), true);
    assert.equal(env.mailSendCount, 30);
  }],
  ['same-day emergency blocks after 20:00 without sending', (env) => {
    env.entry = 'sameDayEmergency20260624';
    installSameDayEmergencyReadyState(env);
    env.nowIso = '2026-06-24T20:01:00.000Z';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('same_day_emergency_window_closed'), true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['same-day emergency blocks unless exactly thirty candidates are ready', (env) => {
    env.entry = 'sameDayEmergency20260624';
    installSameDayEmergencyReadyState(env);
    env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify(Object.assign(
      JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON),
      { actualCandidateCount: 29 }
    ));
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('candidate_count_not_30'), true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['same-day emergency blocks past-date batches without sending', (env) => {
    env.entry = 'sameDayEmergency20260624';
    installSameDayEmergencyReadyState(env);
    env.props.SEND_DATE = '2026-06-23';
    env.props.SEND_BATCH_ID = 'gmail-sales-2026-06-23';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('send_date_mismatch'), true);
    assert.equal(env.mailSendCount, 0);
  }],
  ['daily catch-up sends thirty once and enables future automation after success', (env) => {
    env.entry = 'dailyCatchUp';
    installDailyCatchUpReadyState(env);
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 30);
    assert.equal(env.mailSendCount, 30);
    assert.equal(JSON.parse(env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON).state, 'sent');
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'true');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'true');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
  }],
  ['daily catch-up rerun after sent sends zero', (env) => {
    env.entry = 'dailyCatchUp';
    installDailyCatchUpReadyState(env);
    env.afterRun = () => {
      env.secondResult = env.context.activateAndRunGmailSalesDailyCatchUpOnce();
    };
  }, (env, result) => {
    assert.equal(result.status, 'pass');
    assert.equal(result.sentCount, 30);
    assert.equal(env.secondResult.status, 'blocked');
    assert.equal((env.secondResult.blockedReason || '').includes('already_sent'), true);
    assert.equal(env.mailSendCount, 30);
  }],
  ['daily catch-up blocks after same-day window without sending', (env) => {
    env.entry = 'dailyCatchUp';
    installDailyCatchUpReadyState(env);
    env.nowIso = '2026-06-22T20:01:00.000Z';
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal((result.blockedReason || '').includes('catch_up_window_closed'), true);
    assert.equal(env.mailSendCount, 0);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
  }],
  ['daily catch-up partial failure stops and keeps automation disabled', (env) => {
    env.entry = 'dailyCatchUp';
    installDailyCatchUpReadyState(env);
    env.mailSendThrows = true;
  }, (env, result) => {
    assert.equal(result.status, 'blocked');
    assert.equal(result.sentCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(env.mailSendCount, 1);
    assert.equal(env.props.AUTOMATION_MASTER_ENABLED, 'false');
    assert.equal(env.props.AUTO_SEND_ENABLED, 'false');
    assert.equal(env.props.LIVE_SEND_ENABLED, 'false');
  }]
];

function createEnvironment() {
  const rows = Array.from({ length: 30 }, (_, index) => buildRow(index + 1));
  const outboxRows = Array.from({ length: 30 }, (_, index) => buildOutboxRow(index + 1));
  const recoveryOutboxRows = [buildRecoveryOutboxRow()];
  const env = {
    props: {
      SHEET_ID: 'mock-sheet',
      SHEET_NAME: 'sales',
      GMAIL_SHEET_SYNC_TOKEN: 'token',
      GMAIL_SHEET_READY_TAB_NAME: 'ready',
      GMAIL_SHEET_RECOVERY_TAB_NAME: 'recovery',
      DRY_RUN: 'false',
      LIVE_SEND_ENABLED: 'true',
      AUTO_SEND_ENABLED: 'true',
      SEND_DATE: TARGET_DATE,
      SEND_BATCH_ID: BATCH_ID,
      SEND_DATE_OVERRIDE: 'true',
      SEND_BATCH_ID_OVERRIDE: 'true',
      GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
      GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1',
      GMAIL_SALES_SEND_WINDOW_START: '11:45',
      GMAIL_SALES_SEND_WINDOW_END: '12:45',
      GMAIL_SALES_EXPECTED_DAILY_COUNT: '30',
      GMAIL_SALES_MAX_DAILY_SEND_COUNT: '30',
      GMAIL_SALES_TIMEZONE: 'Asia/Tokyo',
      ALLOWED_SEND_START_HOUR: '0',
      ALLOWED_SEND_START_MINUTE: '0',
      ALLOWED_SEND_END_HOUR: '23',
      ALLOWED_SEND_END_MINUTE: '59',
      DAILY_SEND_LIMIT: '30',
      GMAIL_SEND_MAX_SEND_COUNT: '1',
      GMAIL_SEND_MAX_ATTEMPTS: '1',
      AUTO_RESET_LIVE_SEND_AFTER_RUN: 'false'
    },
    rows,
    outboxRows,
    recoveryOutboxRows,
    sheetSyncPayload: buildSheetSyncPayload(outboxRows),
    sheetSyncRecoveryPayload: buildRecoverySheetSyncPayload(recoveryOutboxRows),
    workbook: {
      sheets: {
        sales: new MockSheet('sales', [HEADERS, ...rows.map(rowToCells)]),
        'daily-source': new MockSheet('daily-source', [OUTBOX_HEADERS, ...Array.from({ length: 90 }, (_, index) => outboxRowToCells(buildOutboxRow(index + 1)))]),
        ready: new MockSheet('ready', [OUTBOX_HEADERS]),
        recovery: new MockSheet('recovery', [OUTBOX_HEADERS]),
        _gmail_maintenance: new MockSheet('_gmail_maintenance', [MAINTENANCE_HEADERS])
      },
      getSheetByName(name) {
        return this.sheets[name] || null;
      },
      getSheets() {
        return Object.keys(this.sheets).map((name) => this.sheets[name]);
      },
      insertSheet(name) {
        env.insertSheetCount += 1;
        env.sheetWriteCount += 1;
        this.sheets[name] = new MockSheet(name, []);
        this.sheets[name].env = env;
        return this.sheets[name];
      },
      deleteSheet(sheet) {
        env.sheetWriteCount += 1;
        delete this.sheets[sheet.getName()];
      }
    },
    suppression: {
      schemaVersion: 1,
      createdAt: '2026-06-19T00:00:00.000Z',
      sourceEntryCount: 1,
      recipientHashes: ['nonmatching_recipient_hash'],
      domainHashes: ['nonmatching_domain_hash'],
      businessFingerprints: ['nonmatching_business_hash']
    },
    manifest: null,
    entry: 'manual',
    mailSendCount: 0,
    gmailSearchResultCount: 0,
    gmailSearchThrows: false,
    mailSendThrows: false,
    lockAvailable: true,
    flushCount: 0,
    sheetReadCount: 0,
    sheetWriteCount: 0,
    setValueCount: 0,
    setValuesCount: 0,
    clearCount: 0,
    appendRowCount: 0,
    insertRowsCount: 0,
    deleteRowsCount: 0,
    insertSheetCount: 0,
    propertyWriteCount: 0,
    setPropertyCount: 0,
    setPropertiesCount: 0,
    deletePropertyCount: 0,
    triggerWriteCount: 0,
    triggerCreations: [],
    triggers: [],
    draftCreateCount: 0,
    leaseWriteCount: 0,
    openSheetThrows: false,
    failSentUpdate: false,
    corruptApprovedManifestOnSet: false,
    schemaHeaderCorruptionsRemaining: 0,
    cache: {},
    logs: []
  };
  env.context = buildContext(env);
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  env.manifest = {
    schemaVersion: 1,
    targetDate: TARGET_DATE,
    batchId: BATCH_ID,
    candidateCount: 30,
    approvedOutboxHash: 'approved_outbox_hash_present',
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    expiresAt: '2099-01-01T00:00:00.000Z',
    maxSendCount: 1,
    candidateDigests: rows.map((row) => env.context.computeCandidateDigest_(row, TARGET_DATE, BATCH_ID))
  };
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  Object.values(env.workbook.sheets).forEach((sheet) => {
    sheet.env = env;
  });
  return env;
}

function buildContext(env) {
  const ContextDate = buildDynamicDate(env);
  return {
    console,
    Date: ContextDate,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      computeHmacSha256Signature: (value, secret) => Array.from(crypto.createHmac('sha256', String(secret)).update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      newBlob: (value) => ({ getBytes: () => Array.from(Buffer.from(String(value), 'utf8')).map((byte) => byte > 127 ? byte - 256 : byte) }),
      getUuid: () => `uuid-${crypto.randomBytes(4).toString('hex')}`,
      formatDate: (date, _timezone, pattern) => formatDate(date, pattern)
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Tokyo'
    },
    Logger: {
      log: (value) => env.logs.push(String(value))
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => env.props[key],
        getProperties: () => Object.assign({}, env.props),
        setProperty: (key, value) => {
          env.setPropertyCount += 1;
          env.propertyWriteCount += 1;
          if (key === 'APPROVED_SEND_MANIFEST_JSON' && env.corruptApprovedManifestOnSet) {
            const parsed = JSON.parse(String(value));
            parsed.sourceOutboxIdentity.candidateContentHash = 'read_back_mismatch';
            env.props[key] = JSON.stringify(parsed);
          } else {
            env.props[key] = String(value);
          }
        },
        setProperties: (values) => {
          env.setPropertiesCount += 1;
          env.propertyWriteCount += 1;
          Object.keys(values || {}).forEach((key) => {
            env.props[key] = String(values[key]);
          });
        },
        deleteProperty: (key) => {
          env.deletePropertyCount += 1;
          env.propertyWriteCount += 1;
          delete env.props[key];
        }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => env.cache[key] || null,
        put: (key, value) => { env.cache[key] = String(value); }
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => env.lockAvailable,
        releaseLock: () => {}
      })
    },
    SpreadsheetApp: {
      openById: () => {
        if (env.openSheetThrows) throw new Error('mock_sheet_load_failed');
        return env.workbook;
      },
      flush: () => { env.flushCount += 1; }
    },
    GmailApp: {
      search: () => {
        if (env.gmailSearchThrows) throw new Error('mock_gmail_search_failed');
        return Array.from({ length: env.gmailSearchResultCount }, () => ({}));
      },
      createDraft: () => {
        env.draftCreateCount += 1;
        return {};
      },
      getUserLabelByName: () => null,
      createLabel: () => ({ addToThread: () => {} })
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: () => {
        env.mailSendCount += 1;
        if (env.mailSendThrows) throw new Error('mock_mail_send_failed');
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => ({ text }) })
    },
    ScriptApp: {
      getScriptId: () => 'mock-script-id',
      getProjectTriggers: () => env.triggers.map((trigger) => ({
        getHandlerFunction: () => trigger.handler
      })),
      deleteTrigger: (trigger) => {
        env.triggerWriteCount += 1;
        const handler = trigger && trigger.getHandlerFunction ? trigger.getHandlerFunction() : '';
        const index = env.triggers.findIndex((candidate) => candidate.handler === handler);
        if (index !== -1) env.triggers.splice(index, 1);
      },
      newTrigger: (handler) => {
        const spec = { handler, hour: null, minute: null, timezone: null };
        const builder = {
          timeBased: () => builder,
          everyDays: () => builder,
          everyHours: () => builder,
          everyMinutes: (minutes) => {
            spec.minuteInterval = minutes;
            return builder;
          },
          atHour: (hour) => {
            spec.hour = hour;
            return builder;
          },
          nearMinute: (minute) => {
            spec.minute = minute;
            return builder;
          },
          inTimezone: (timezone) => {
            spec.timezone = timezone;
            return builder;
          },
          create: () => {
            env.triggerWriteCount += 1;
            env.triggerCreations.push(Object.assign({}, spec));
            env.triggers.push({ handler });
            return { getHandlerFunction: () => handler };
          }
        };
        return builder;
      }
    }
  };
}

function buildDynamicDate(env) {
  return class DynamicDate extends Date {
    constructor(...args) {
      super(...(args.length === 0 && env.nowIso ? [Date.parse(env.nowIso)] : args));
    }

    static now() {
      return env.nowIso ? Date.parse(env.nowIso) : Date.now();
    }

    static parse(value) {
      return Date.parse(value);
    }

    static UTC(...args) {
      return Date.UTC(...args);
    }
  };
}

function safeResultForAssertionMessage(result) {
  return {
    status: result && result.status,
    blockedReason: result && result.blockedReason,
    blockedReasons: result && result.blockedReasons,
    errorCode: result && result.errorCode
  };
}

function runEntry(env) {
  if (env.entry === 'scheduled') return env.context.executeDailyGmailSalesSend_({ source: 'scheduled', requireAutoSend: true, dryRun: false });
  if (env.entry === 'dryRun') return env.context.runGmailSalesPreSendDryRun();
  if (env.entry === 'recoveryDryRun') return env.context.runGmailSalesRecoveryPreSendDryRun();
  if (env.entry === 'recoverySend') return env.context.runGmailSalesRecoverySendOnce();
  if (env.entry === 'digestFixtureOnly') return { status: 'pass' };
  if (env.entry === 'recoveryDigestDiagnostic') return env.context.runGmailSalesRecoveryDigestDiagnostic();
  if (env.entry === 'recoveryDigestReissue') return env.context.runGmailSalesRecoveryReissueManifestDigests();
  if (env.entry === 'recoverySourceHashReissue') return env.context.runGmailSalesRecoveryReissueSourceCandidateContentHash();
  if (env.entry === 'recoverySourceHashReissueScheduled') return env.context.runGmailSalesRecoveryReissueSourceCandidateContentHash({ source: 'scheduled_trigger' });
  if (env.entry === 'recoveryHashRepair') return env.context.runGmailSalesRecoveryRepairDerivedCandidateHash();
  if (env.entry === 'suppressionDiagnostic') return env.context.runGmailSuppressionLedgerReadOnlyDiagnostic();
  if (env.entry === 'deploymentReadiness') return env.context.inspectGmailSalesDeploymentReadiness();
  if (env.entry === 'productionSchema') return env.context.inspectGmailSalesProductionSchema();
  if (env.entry === 'contactBasisCoverage') return env.context.inspectGmailSalesContactBasisCoverage();
  if (env.entry === 'schemaInstall') return env.context.installGmailSalesProductionSchemaOnce();
  if (env.entry === 'dailyInitializer') return env.context.initializeGmailSalesDailyAutomationProperties();
  if (env.entry === 'dailyHealth') return env.context.runGmailSalesDailyAutomationHealthCheck();
  if (env.entry === 'dailyInstall') return env.context.installGmailSalesDailyAutomationTriggers();
  if (env.entry === 'dailyActivate') return env.context.activateGmailSalesDailyAutomationOnce();
  if (env.entry === 'dailyDeactivate') return env.context.deactivateGmailSalesDailyAutomation();
  if (env.entry === 'dailyReadiness') return env.context.inspectGmailSalesDailyReadiness();
  if (env.entry === 'dailyPreparePipeline') return env.context.prepareDailyPipeline();
  if (env.entry === 'dailyE2E') {
    const prepare = env.context.prepareDailyPipeline();
    const enable = env.context.runGmailSalesDailyEnableWhenReady();
    env.nowIso = '2026-06-30T12:00:00.000Z';
    const send = env.context.runGmailSalesDailyAutomationTrigger();
    env.nowIso = '2026-06-30T14:00:00.000Z';
    const audit = env.context.runGmailSalesDailyPostSendAudit();
    return { prepare, enable, send, audit };
  }
  if (env.entry === 'dailyEnableWhenReady') return env.context.enableGmailSalesNormalAutomationWhenReadyOnce();
  if (env.entry === 'weeklyReport') return env.context.runGmailSalesWeeklyReportAndOptimization();
  if (env.entry === 'productionTriggerInstall') return env.context.installGmailSalesProductionTriggersOnce();
  if (env.entry === 'productionControlLoopInstallAlias') return env.context.installGmailSalesProductionControlLoopTriggerOnce();
  if (env.entry === 'productionSchedulerStatus') return env.context.inspectGmailSalesProductionSchedulerStatus();
  if (env.entry === 'tomorrowEmergencyReadiness') return env.context.inspectGmailSalesTomorrowEmergencyReadiness();
  if (env.entry === 'legacyScheduledDailySend') return env.context.runScheduledDailySend();
  if (env.entry === 'dailyAutomationTrigger') return env.context.runGmailSalesDailyAutomationTrigger();
  if (env.entry === 'sameDayPrepare20260624') return env.context.prepareGmailSalesSameDay20260624Once();
  if (env.entry === 'sameDayReadiness20260624') return env.context.inspectGmailSalesSameDay20260624Readiness();
  if (env.entry === 'sameDayPropertiesVerify20260624') return env.context.verifyGmailSalesSameDayProperties20260624();
  if (env.entry === 'sameDayCandidateInspect20260624') return env.context.inspectGmailSalesSameDayCandidateRejections20260624();
  if (env.entry === 'sameDayMetadataRepair20260624') return env.context.repairGmailSalesSameDayCandidateMetadata20260624Once();
  if (env.entry === 'sameDayEmergency20260624') return env.context.runGmailSalesSameDaySend20260624Once();
  if (env.entry === 'dailyCatchUp') return env.context.activateAndRunGmailSalesDailyCatchUpOnce();
  if (env.entry === 'dailyFutureArm') return env.context.armGmailSalesDailyAutomationForFutureRunsOnce();
  if (env.entry === 'sheetSyncConnectedDryRun' || env.entry === 'sheetSyncReadOnlySnapshot') {
    if (env.entry === 'sheetSyncReadOnlySnapshot') {
      env.sheetSyncPayload.action = 'read_only_snapshot';
      env.sheetSyncPayload.operation = 'read_only_snapshot';
      env.sheetSyncPayload.mode = 'read_only_snapshot';
    }
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    });
    return JSON.parse(output.text);
  }
  if (env.entry === 'sheetSyncRecoverySingle') {
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncRecoveryPayload) }
    });
    return JSON.parse(output.text);
  }
  if (env.entry === 'dailyPrepareWebhook') {
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    });
    return JSON.parse(output.text);
  }
  if (env.entry === 'dailyPrepareWebhookReplay') {
    const first = JSON.parse(env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    }).text);
    const second = JSON.parse(env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    }).text);
    return { first, second };
  }
  if (env.entry === 'dailySourceReadWebhook') {
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    });
    return JSON.parse(output.text);
  }
  if (env.entry === 'dailySourceSyncWebhook') {
    const output = env.context.handleGmailOutboxSheetSync_({
      postData: { contents: JSON.stringify(env.sheetSyncPayload) }
    });
    return JSON.parse(output.text);
  }
  return env.context.executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false, dryRun: false });
}

function installSuppressionProps(env) {
  const payload = JSON.stringify(sortObject(env.suppression));
  env.props.GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION = '1';
  env.props.GMAIL_SUPPRESSION_LEDGER_CREATED_AT = env.suppression.createdAt;
  env.props.GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT = String(env.suppression.sourceEntryCount);
  env.props.GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT = String(env.suppression.recipientHashes.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT = String(env.suppression.domainHashes.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT = String(env.suppression.businessFingerprints.length);
  env.props.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM = sha256(payload);
  env.props.GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT = '1';
  env.props.GMAIL_SUPPRESSION_LEDGER_0 = payload;
  env.props.GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM = sha256(payload);
}

function buildRow(index) {
  const name = `Business ${index}`;
  return {
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    name,
    subject: `Sales note ${index}`,
    body: `${name} 様\n安全なご案内です。\n今後のご案内が不要な場合はご返信不要です。`,
    status: 'ready',
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    sourceUrl: `https://safe-source-${index}.invalid/page`,
    prospectId: `prospect-${index}`,
    dedupeKey: `dedupe-${index}`,
    sentStatus: '',
    sentAt: '',
    sendState: '',
    sendRunId: '',
    sendReservedAt: '',
    sendAttemptCount: '',
    approvedBatchId: '',
    approvedCandidateDigest: '',
    deliveryUncertainAt: '',
    lastSendErrorCode: '',
    contactBasisType: 'valid_business_contact_exception',
    contactBasisRecordedAt: '2026-06-22T00:00:00+09:00',
    sourceType: 'public_business_contact',
    sourceReferenceHash: `source-ref-${index}`,
    optOutAvailable: 'true',
    lastVerifiedAt: '2026-06-22T00:00:00+09:00',
    suppressionCheckedAt: '2026-06-22T00:00:00+09:00',
    historyCheckedAt: '2026-06-22T00:00:00+09:00',
    lastCheckedAt: ''
  };
}

function rowToCells(row) {
  return HEADERS.map((header) => row[header] ?? '');
}

function buildOutboxRow(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    businessType: 'service',
    area: 'Tokyo',
    email: `recipient${index}@example.invalid`,
    contactEmail: `recipient${index}@example.invalid`,
    publicSource: 'public',
    sourceUrl: `https://safe-source-${index}.invalid/page`,
    issueHypothesis: 'issue',
    salesAngle: 'angle',
    subject: `Subject ${index}`,
    body: `Business ${index} 様\nBody ${index} ご返信不要`,
    status: 'ready',
    sendDate: TARGET_DATE,
    nextActionDate: TARGET_DATE,
    dedupeKey: `dedupe-${index}`,
    sendBatchId: BATCH_ID,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: '',
    doNotContact: '',
    lastCheckedAt: '',
    sendState: '',
    sendRunId: '',
    sendReservedAt: '',
    sendAttemptCount: '',
    approvedBatchId: '',
    approvedCandidateDigest: '',
    deliveryUncertainAt: '',
    lastSendErrorCode: '',
    contactBasisType: 'valid_business_contact_exception',
    contactBasisRecordedAt: '2026-06-22T00:00:00+09:00',
    sourceType: 'public_business_contact',
    sourceReferenceHash: `source-ref-${index}`,
    optOutAvailable: 'true',
    lastVerifiedAt: '2026-06-22T00:00:00+09:00',
    suppressionCheckedAt: '2026-06-22T00:00:00+09:00',
    historyCheckedAt: '2026-06-22T00:00:00+09:00',
    notes: ''
  };
}

function buildSourceOutboxRow(index) {
  return Object.assign({}, buildOutboxRow(index), {
    sendDate: '',
    nextActionDate: '',
    sendBatchId: '',
    lastCheckedAt: '2026-06-22T00:00:00+09:00',
    notes: 'verified normal daily source'
  });
}

function buildRecoveryOutboxRow() {
  return Object.assign({}, buildOutboxRow(1), {
    sendDate: '2026-06-20',
    nextActionDate: '2026-06-20',
    sendBatchId: 'gmail-sales-2026-06-20-noon-recovery',
    subject: 'Recovery note 1',
    body: 'Business 1 様\n安全なご案内です。\n今後のご案内が不要な場合はご返信不要です。'
  });
}

function outboxRowToCells(row) {
  return OUTBOX_HEADERS.map((header) => row[header] ?? '');
}

function sourceRowToCells(row) {
  return SOURCE_HEADERS.map((header) => row[header] ?? '');
}

function getRecoveryCell(env, rowIndex, header) {
  const sheet = env.workbook.sheets.recovery;
  const columnIndex = sheet.rows[0].indexOf(header);
  return sheet.rows[rowIndex - 1][columnIndex];
}

function setRecoveryCell(env, rowIndex, header, value) {
  const sheet = env.workbook.sheets.recovery;
  const columnIndex = sheet.rows[0].indexOf(header);
  sheet.rows[rowIndex - 1][columnIndex] = value;
}

function addRecoveryCandidateContentHashColumn(env, value) {
  const sheet = env.workbook.sheets.recovery;
  if (!sheet.rows[0].includes('candidateContentHash')) {
    sheet.rows[0].push('candidateContentHash');
    sheet.rows.slice(1).forEach((row) => row.push(''));
  }
  setRecoveryCell(env, 2, 'candidateContentHash', value);
}

function buildSheetSyncPayload(outboxRows) {
  return {
    token: 'token',
    action: 'connected_dry_run',
    operation: 'connected_dry_run',
    mode: 'connected_dry_run',
    dryRun: true,
    targetDate: TARGET_DATE,
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    headers: OUTBOX_HEADERS.slice(),
    rows: outboxRows.map(outboxRowToCells),
    candidateCount: outboxRows.length,
    schemaVersion: 1,
    requestId: 'runtime-test-connected-dry-run',
    readyTabName: 'ready'
  };
}

function buildRecoverySheetSyncPayload(outboxRows) {
  const row = outboxRows[0];
  return {
    token: 'token',
    action: 'sync_recovery_single',
    operation: 'sync_recovery_single',
    mode: 'sync_recovery_single',
    sourceType: 'recovery_single',
    dryRun: true,
    targetDate: '2026-06-20',
    sendDate: '2026-06-20',
    sendBatchId: row.sendBatchId,
    headers: OUTBOX_HEADERS.slice(),
    rows: outboxRows.map(outboxRowToCells),
    candidateCount: 1,
    sheetRowCount: 1,
    rowCount: 1,
    schemaVersion: 1,
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    humanReviewedCount: 1,
    targetAutoApproved: false,
    manifestCreated: false,
    safetyCounters: buildZeroRecoverySafetyCounters(),
    requestId: 'runtime-test-recovery-single',
    recoveryTabName: 'recovery'
  };
}

function buildDailyPreparePayload(env) {
  const manifest = buildAutomaticDailyManifest(env);
  const payload = {
    action: 'prepare_normal_daily',
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    automationVersion: 'normal-daily-v1',
    autoApprovalPolicyVersion: 'automatic-strict-gate-v1',
    targetDate: TARGET_DATE,
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    candidateCount: env.outboxRows.length,
    schemaVersion: 1,
    requestId: `runtime-daily-prepare-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    nonce: `nonce-${crypto.randomBytes(4).toString('hex')}`,
    manifest,
    headers: OUTBOX_HEADERS.slice(),
    rows: env.outboxRows.map(outboxRowToCells),
    dryRun: false
  };
  payload.bodyDigest = sha256(webhookBodyMaterial(payload));
  payload.signature = crypto.createHmac('sha256', env.props.GMAIL_AUTOMATION_SHARED_SECRET)
    .update([
      payload.timestamp,
      payload.nonce,
      payload.requestId,
      payload.action,
      payload.targetDate,
      payload.bodyDigest
    ].join('\n'))
    .digest('hex');
  return payload;
}

function buildDailySourceReadPayload(env) {
  const payload = {
    action: 'read_normal_daily_source',
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    automationVersion: 'normal-daily-v1',
    autoApprovalPolicyVersion: 'automatic-strict-gate-v1',
    targetDate: TARGET_DATE,
    sendDate: TARGET_DATE,
    sendBatchId: BATCH_ID,
    expectedCount: 30,
    requestedSourceCount: 90,
    pageSize: 100,
    cursor: '',
    requestId: `runtime-daily-source-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    nonce: `nonce-${crypto.randomBytes(4).toString('hex')}`
  };
  payload.bodyDigest = sha256(webhookBodyMaterial(payload));
  payload.signature = crypto.createHmac('sha256', env.props.GMAIL_AUTOMATION_SHARED_SECRET)
    .update([
      payload.timestamp,
      payload.nonce,
      payload.requestId,
      payload.action,
      payload.targetDate,
      payload.bodyDigest
    ].join('\n'))
    .digest('hex');
  return payload;
}

function buildDailySourceSyncPayload(env, count) {
  const rows = Array.from({ length: count }, (_, index) => outboxRowToCells(buildSourceOutboxRow(index + 1)));
  const payload = {
    action: 'sync_normal_daily_source',
    mode: 'normal_daily',
    sourceType: 'normal_daily_source',
    sourceVerificationStatus: 'verified_only',
    dryRun: false,
    automationVersion: 'normal-daily-v1',
    autoApprovalPolicyVersion: 'automatic-strict-gate-v1',
    targetDate: '2026-06-22',
    sendDate: '2026-06-22',
    sendBatchId: 'gmail-sales-2026-06-22',
    sourceTabName: 'Gmail営業候補プール',
    candidateCount: rows.length,
    verifiedCandidateCount: rows.length,
    headers: OUTBOX_HEADERS.slice(),
    rows,
    requestId: `runtime-daily-source-sync-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    nonce: `nonce-${crypto.randomBytes(4).toString('hex')}`
  };
  payload.bodyDigest = sha256(webhookBodyMaterial(payload));
  payload.signature = crypto
    .createHmac('sha256', env.props.GMAIL_AUTOMATION_SHARED_SECRET)
    .update([
      payload.timestamp,
      payload.nonce,
      payload.requestId,
      payload.action,
      payload.targetDate,
      payload.bodyDigest
    ].join('\n'))
    .digest('hex');
  return payload;
}

function installDailyActivationReadyState(env) {
  env.nowIso = '2026-06-22T03:00:00.000Z';
  const config = env.context.getConfig_();
  const manifest = buildAutomaticDailyManifest(env);
  manifest.targetDate = config.currentJstDate;
  manifest.batchId = `gmail-sales-${config.currentJstDate}`;
  manifest.humanReviewCompleted = false;
  manifest.humanReviewedCount = 0;
  manifest.targetAutoApproved = true;
  env.manifest = manifest;
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(manifest);
  env.props.AUTOMATION_MASTER_ENABLED = 'false';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate: config.currentJstDate,
    mode: 'normal_daily',
    sendBatchId: `gmail-sales-${config.currentJstDate}`,
    expectedCandidateCount: 30,
    actualCandidateCount: 30,
    sheetSynced: true,
    state: 'sheet_synced',
    automationVersion: 'normal-daily-v1'
  });
}

function installDailyCatchUpReadyState(env) {
  const targetDate = '2026-06-22';
  const batchId = `gmail-sales-${targetDate}`;
  env.nowIso = '2026-06-22T03:00:00.000Z';
  env.props.SEND_DATE = targetDate;
  env.props.SEND_BATCH_ID = batchId;
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'false';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.rows = Array.from({ length: 30 }, (_, index) => Object.assign({}, buildRow(index + 1), {
    sendDate: targetDate,
    sendBatchId: batchId
  }));
  env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  const candidateDigests = env.rows.map((row) => env.context.computeCandidateDigest_(row, targetDate, batchId));
  env.manifest = Object.assign({}, buildAutomaticDailyManifest(env), {
    targetDate,
    batchId,
    maxSendCount: 30,
    candidateDigests
  });
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate,
    mode: 'normal_daily',
    sendBatchId: batchId,
    expectedCandidateCount: 30,
    actualCandidateCount: 30,
    state: 'sheet_synced',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function installSameDayPrepareInputState(env) {
  const targetDate = '2026-06-24';
  const batchId = `gmail-sales-${targetDate}`;
  env.nowIso = '2026-06-24T09:00:00.000Z';
  env.props.SEND_DATE = targetDate;
  env.props.SEND_BATCH_ID = batchId;
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'true';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.rows = Array.from({ length: 30 }, (_, index) => Object.assign({}, buildRow(index + 1), {
    sendDate: targetDate,
    sendBatchId: batchId
  }));
  env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate: '',
    mode: 'normal_daily',
    sendBatchId: '',
    expectedCandidateCount: 0,
    actualCandidateCount: 0,
    state: 'not_started',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
  delete env.props.APPROVED_SEND_MANIFEST_JSON;
}

function installNormalDailyReadyState(env, options = {}) {
  const targetDate = options.targetDate || '2026-06-25';
  const batchId = `gmail-sales-${targetDate}`;
  env.nowIso = `${targetDate}T12:00:00.000Z`;
  env.props.SEND_DATE = targetDate;
  env.props.SEND_BATCH_ID = batchId;
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'false';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.props.GMAIL_DAILY_SOURCE_TAB_NAME = 'Gmail営業候補プール';
  env.props.ALLOWED_SEND_START_HOUR = '11';
  env.props.ALLOWED_SEND_START_MINUTE = '45';
  env.props.ALLOWED_SEND_END_HOUR = '12';
  env.props.ALLOWED_SEND_END_MINUTE = '45';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.rows = Array.from({ length: 30 }, (_, index) => Object.assign({}, buildRow(index + 1), {
    sendDate: targetDate,
    sendBatchId: batchId,
    lastCheckedAt: targetDate
  }));
  env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  env.workbook.sheets['Gmail営業候補プール'] = new MockSheet('Gmail営業候補プール', [
    SOURCE_HEADERS,
    ...Array.from({ length: 45 }, (_, index) => sourceRowToCells(Object.assign({}, buildSourceOutboxRow(index + 1), {
      lastCheckedAt: targetDate
    })))
  ]);
  env.workbook.sheets['Gmail営業候補プール'].env = env;
  const candidateDigests = env.rows.map((row) => env.context.computeCandidateDigest_(row, targetDate, batchId));
  env.manifest = Object.assign({}, buildAutomaticDailyManifest(env), {
    targetDate,
    batchId,
    maxSendCount: 30,
    candidateCount: 30,
    expectedCandidateCount: 30,
    candidateDigests
  });
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate,
    mode: 'normal_daily',
    sendBatchId: batchId,
    expectedCandidateCount: 30,
    actualCandidateCount: 30,
    sheetSynced: true,
    state: 'sheet_synced',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function installStaleOneCandidateManifestReadinessState(env) {
  const targetDate = '2026-07-02';
  const staleDate = '2026-07-01';
  env.nowIso = `${targetDate}T03:00:00.000Z`;
  env.props.SEND_DATE = targetDate;
  env.props.SEND_BATCH_ID = `gmail-sales-${targetDate}`;
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'false';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.props.GMAIL_DAILY_SOURCE_TAB_NAME = 'Gmail営業候補プール';
  env.triggers = [];
  env.rows = [];
  env.workbook.sheets.sales.rows = [HEADERS];
  env.workbook.sheets['Gmail営業候補プール'] = new MockSheet('Gmail営業候補プール', [
    SOURCE_HEADERS,
    ...Array.from({ length: 30 }, (_, index) => sourceRowToCells(Object.assign({}, buildSourceOutboxRow(index + 1), {
      contactBasisType: 'unknown',
      lastCheckedAt: targetDate
    })))
  ]);
  env.workbook.sheets['Gmail営業候補プール'].env = env;
  env.manifest = {
    schemaVersion: 1,
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    targetDate: staleDate,
    batchId: `gmail-sales-${staleDate}`,
    candidateCount: 1,
    maxSendCount: 1,
    expectedCandidateCount: 1,
    approvalStatus: 'approved',
    approvalType: 'automatic_strict_gate',
    targetAutoApproved: true,
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    expiresAt: '2099-01-01T00:00:00.000Z',
    candidateDigests: ['stale_fixture_digest'],
    sourceOutboxIdentity: {
      targetDate: staleDate,
      sendBatchId: `gmail-sales-${staleDate}`,
      candidateContentHash: 'stale_fixture_hash'
    }
  };
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate: staleDate,
    mode: 'normal_daily',
    sendBatchId: `gmail-sales-${staleDate}`,
    expectedCandidateCount: 1,
    actualCandidateCount: 1,
    sheetSynced: true,
    state: 'sheet_synced',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function installDailyPipelineSourceState(env, options = {}) {
  const targetDate = options.targetDate || '2026-06-30';
  const sourceCount = options.sourceCount || 45;
  env.nowIso = `${targetDate}T08:00:00.000Z`;
  env.props.SEND_DATE = '2026-06-19';
  env.props.SEND_BATCH_ID = 'gmail-sales-2026-06-19';
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'true';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.props.GMAIL_DAILY_SOURCE_TAB_NAME = 'Gmail営業候補プール';
  env.props.GMAIL_SHEET_READY_TAB_NAME = 'sales';
  env.props.ALLOWED_SEND_START_HOUR = '11';
  env.props.ALLOWED_SEND_START_MINUTE = '45';
  env.props.ALLOWED_SEND_END_HOUR = '12';
  env.props.ALLOWED_SEND_END_MINUTE = '45';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.rows = [];
  env.workbook.sheets.sales.rows = [HEADERS];
  env.workbook.sheets['Gmail営業候補プール'] = new MockSheet('Gmail営業候補プール', [
    SOURCE_HEADERS,
    ...Array.from({ length: sourceCount }, (_, index) => sourceRowToCells(Object.assign({}, buildSourceOutboxRow(index + 1), {
      lastCheckedAt: targetDate
    })))
  ]);
  env.workbook.sheets['Gmail営業候補プール'].env = env;
  delete env.props.APPROVED_SEND_MANIFEST_JSON;
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate: '',
    mode: 'normal_daily',
    sendBatchId: '',
    expectedCandidateCount: 0,
    actualCandidateCount: 0,
    sheetSynced: false,
    state: 'not_started',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function installSameDayMetadataRepairInputState(env, options = {}) {
  installSameDayPrepareInputState(env);
  env.props.LIVE_SEND_ENABLED = 'true';
  env.rows = env.rows.map((row) => {
    const next = Object.assign({}, row);
    if (options.wrongSendDate) {
      next.sendDate = '2026-06-23';
      next.sendBatchId = 'gmail-sales-2026-06-23';
    }
    if (options.wrongStatus) {
      next.status = 'available';
    }
    next.lastCheckedAt = options.staleVerification === false ? '2026-06-24' : '2026-06-23';
    return next;
  });
  env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
}

function installSameDayEmergencyReadyState(env) {
  const targetDate = '2026-06-24';
  const batchId = `gmail-sales-${targetDate}`;
  env.nowIso = '2026-06-24T09:00:00.000Z';
  env.props.SEND_DATE = targetDate;
  env.props.SEND_BATCH_ID = batchId;
  env.props.SEND_DATE_OVERRIDE = 'true';
  env.props.SEND_BATCH_ID_OVERRIDE = 'true';
  env.props.GMAIL_SEND_MAX_SEND_COUNT = '30';
  env.props.DAILY_SEND_LIMIT = '30';
  env.props.AUTOMATION_MASTER_ENABLED = 'true';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.rows = Array.from({ length: 30 }, (_, index) => Object.assign({}, buildRow(index + 1), {
    sendDate: targetDate,
    sendBatchId: batchId
  }));
  env.workbook.sheets.sales.rows = [HEADERS, ...env.rows.map(rowToCells)];
  const candidateDigests = env.rows.map((row) => env.context.computeCandidateDigest_(row, targetDate, batchId));
  env.manifest = Object.assign({}, buildAutomaticDailyManifest(env), {
    targetDate,
    batchId,
    maxSendCount: 30,
    candidateCount: 30,
    expectedCandidateCount: 30,
    candidateDigests
  });
  env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate,
    mode: 'normal_daily',
    sendBatchId: batchId,
    expectedCandidateCount: 30,
    actualCandidateCount: 30,
    state: 'sheet_synced',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function installDailyFutureArmReadyState(env) {
  env.nowIso = '2026-06-22T13:00:00.000Z';
  env.props.GMAIL_AUTOMATION_SHARED_SECRET = 'test-secret';
  env.props.AUTOMATION_MASTER_ENABLED = 'false';
  env.props.AUTO_SEND_ENABLED = 'false';
  env.props.LIVE_SEND_ENABLED = 'false';
  env.props.GMAIL_DAILY_SOURCE_TAB_NAME = 'Gmail営業候補プール';
  env.props.GMAIL_SALES_SEND_WINDOW_START = '11:45';
  env.props.GMAIL_SALES_SEND_WINDOW_END = '12:45';
  env.props.ALLOWED_SEND_END_HOUR = '12';
  env.props.ALLOWED_SEND_END_MINUTE = '45';
  env.triggers = [{ handler: 'runGmailSalesProductionControlLoop' }];
  env.workbook.sheets['Gmail営業候補プール'] = new MockSheet('Gmail営業候補プール', [
    OUTBOX_HEADERS,
    ...Array.from({ length: 45 }, (_, index) => outboxRowToCells(buildSourceOutboxRow(index + 1)))
  ]);
  env.workbook.sheets['Gmail営業候補プール'].env = env;
  env.props.GMAIL_DAILY_AUTOMATION_STATE_JSON = JSON.stringify({
    targetDate: '',
    mode: 'normal_daily',
    state: 'not_started',
    sendAttemptCount: 0,
    actualSendCount: 0,
    resultUnknown: false,
    automationVersion: 'normal-daily-v1'
  });
}

function buildAutomaticDailyManifest(env) {
  const digests = env.rows.map((row) => env.context.computeCandidateDigest_(row, TARGET_DATE, BATCH_ID));
  const manifest = {
    schemaVersion: 1,
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    targetDate: TARGET_DATE,
    batchId: BATCH_ID,
    candidateCount: 30,
    expectedCandidateCount: 30,
    approvedOutboxHash: 'automatic_approved_outbox_hash_present',
    approvalStatus: 'approved',
    approvalType: 'automatic_strict_gate',
    targetAutoApproved: true,
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    autoApprovalPolicyVersion: 'automatic-strict-gate-v1',
    automationVersion: 'normal-daily-v1',
    autoApprovalPassedAt: '2099-01-01T00:00:00.000Z',
    maxSendCount: 1,
    expiresAt: '2099-01-01T00:00:00.000Z',
    candidateDigests: digests,
    sourceOutboxIdentity: {
      source: 'github_actions_normal_daily_prepare',
      candidateContentHash: 'automatic_candidate_content_hash_present',
      outboxIdentityDigest: 'automatic_outbox_identity_digest_present',
      statusDocument: 'automatic_strict_gate'
    }
  };
  manifest.manifestDigest = sha256(JSON.stringify(manifest));
  return manifest;
}

function webhookBodyMaterial(payload) {
  if (payload.action === 'read_normal_daily_source') {
    return JSON.stringify({
      action: payload.action,
      targetDate: payload.targetDate,
      sendBatchId: payload.sendBatchId,
      expectedCount: payload.expectedCount,
      requestedSourceCount: payload.requestedSourceCount,
      pageSize: payload.pageSize,
      cursor: payload.cursor,
      mode: payload.mode,
      sourceType: payload.sourceType,
      automationVersion: payload.automationVersion,
      autoApprovalPolicyVersion: payload.autoApprovalPolicyVersion
    });
  }
  if (payload.action === 'sync_normal_daily_source') {
    return JSON.stringify({
      action: payload.action,
      targetDate: payload.targetDate,
      sourceTabName: payload.sourceTabName,
      candidateCount: payload.candidateCount,
      verifiedCandidateCount: payload.verifiedCandidateCount,
      sourceVerificationStatus: payload.sourceVerificationStatus,
      headers: payload.headers,
      rows: payload.rows,
      mode: payload.mode,
      sourceType: payload.sourceType,
      dryRun: payload.dryRun,
      automationVersion: payload.automationVersion,
      autoApprovalPolicyVersion: payload.autoApprovalPolicyVersion
    });
  }
  return JSON.stringify({
    action: payload.action,
    targetDate: payload.targetDate,
    sendBatchId: payload.sendBatchId,
    candidateCount: payload.candidateCount,
    manifest: payload.manifest,
    headers: payload.headers,
    rows: payload.rows
  });
}

function installRecoveryReadyRow(env) {
  env.workbook.sheets.recovery.rows = [
    OUTBOX_HEADERS.slice(),
    outboxRowToCells(env.recoveryOutboxRows[0])
  ];
}

function installRecoveryReadyRowAndManifest(env) {
  env.nowIso = '2026-06-20T03:00:00.000Z';
  installRecoveryReadyRow(env);
  const row = env.context.loadCandidateRows_(Object.assign({}, env.context.getConfig_(), {
    sheetName: 'recovery',
    sendDate: '2026-06-20'
  }))[0].row;
  const batchId = 'gmail-sales-2026-06-20-noon-recovery';
  env.manifest = {
    schemaVersion: 1,
    targetDate: '2026-06-20',
    effectiveSendDate: '2026-06-20',
    batchId,
    candidateCount: 1,
    approvedOutboxHash: 'approved_recovery_outbox_hash_present',
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    humanReviewedCount: 1,
    targetAutoApproved: false,
    sheetAlreadyAppliedConfirmed: true,
    sameDayManualRecoveryApproved: true,
    sameDayManualRecoveryApprovedAt: '2026-06-20T03:00:00.000Z',
    sameDayManualRecoveryReasonCode: 'user_required_same_day_sales_recovery',
    originalScheduledAt: '2026-06-20T12:00:00+09:00',
    expiresAt: '2099-01-01T00:00:00.000Z',
    maxSendCount: 1,
    sourceType: 'recovery_single',
    recoverySingle: true,
    candidateDigestCanonicalization: 'apps-script-v2',
    candidateDigests: [env.context.computeCandidateDigest_(row, '2026-06-20', batchId)],
    sourceOutboxIdentity: {
      source: 'local_recovery_approved_outbox',
      candidateContentHash: env.context.computeRecoveryCandidateContentHashForRuntime_(row),
      outboxIdentityDigest: 'present',
      statusDocument: 'approved'
    }
  };
}

function buildZeroRecoverySafetyCounters() {
  return {
    requiredFieldMissingCount: 0,
    personalizationInvalidCount: 0,
    recipientDuplicateCount: 0,
    domainDuplicateCount: 0,
    businessDuplicateCount: 0,
    suppressionMatchCount: 0,
    gmailSentMatchCount: 0,
    sheetHistoryMatchCount: 0,
    localHistoryMatchCount: 0,
    existingOutboxMatchCount: 0,
    june19SourceMatchCount: 0,
    june20ExistingTargetMatchCount: 0
  };
}

function assertBlockedNoMail(env, result, reason) {
  assert.equal(result.status, 'blocked');
  assert.equal((result.blockedReasons || []).includes(reason), true);
  assert.equal(env.mailSendCount, 0);
}

function assertBlockedNoMailCount(env, result, mailCount) {
  assert.equal(result.status, 'blocked');
  assert.equal(env.mailSendCount, mailCount);
}

function assertDryRunWriteFree(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
  assert.equal(resetLogCount(env), 0);
}

function assertDiagnosticReadOnly(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
}

function assertSheetSyncReadOnly(env) {
  assert.equal(env.setPropertyCount, 0);
  assert.equal(env.setPropertiesCount, 0);
  assert.equal(env.deletePropertyCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.setValueCount, 0);
  assert.equal(env.setValuesCount, 0);
  assert.equal(env.clearCount, 0);
  assert.equal(env.appendRowCount, 0);
  assert.equal(env.insertRowsCount, 0);
  assert.equal(env.deleteRowsCount, 0);
  assert.equal(env.flushCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.leaseWriteCount, 0);
}

function resetLogCount(env) {
  return env.logs.filter((line) => line.includes('live_send_reset_after_run')).length;
}

function useThirtySuppressionEntries(env) {
  env.suppression = {
    schemaVersion: 1,
    createdAt: '2026-06-19T00:00:00.000Z',
    sourceEntryCount: 30,
    recipientHashes: Array.from({ length: 30 }, (_, index) => `recipient_hash_${index}`),
    domainHashes: Array.from({ length: 30 }, (_, index) => `domain_hash_${index}`),
    businessFingerprints: Array.from({ length: 30 }, (_, index) => `business_hash_${index}`)
  };
}

function readCell(env, rowIndex, header) {
  const sheet = env.workbook.sheets.sales;
  const columnIndex = sheet.rows[0].indexOf(header);
  return sheet.rows[rowIndex - 1][columnIndex];
}

function writeCell(env, rowIndex, header, value) {
  const sheet = env.workbook.sheets.sales;
  const columnIndex = sheet.rows[0].indexOf(header);
  sheet.rows[rowIndex - 1][columnIndex] = value;
}

function formatDate(date, pattern) {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  if (pattern === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
  if (pattern === 'yyyy/MM/dd') return `${year}/${month}/${day}`;
  if (pattern === 'HH:mm') return `${hour}:${minute}`;
  if (pattern === 'H') return String(value.getUTCHours());
  if (pattern === 'm') return String(value.getUTCMinutes());
  return value.toISOString();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sha256(value) {
  return hashValue(value);
}

function nodeEquivalentCandidateDigest(row, targetDate, batchId) {
  const candidateId = String(row.prospectId || row.dedupeKey || '').trim().toLowerCase();
  return sha256([
    String(row.email || row.contactEmail || row['宛先メール'] || row['メール'] || '').trim().toLowerCase(),
    normalizeSubjectLikeAppsScript(row.subject || row['件名']),
    normalizeBodyLikeAppsScript(row.body || row['本文']),
    candidateId,
    targetDate,
    String(batchId || '').trim()
  ].join('\n'));
}

function normalizeBodyLikeAppsScript(value) {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSubjectLikeAppsScript(value) {
  return String(value || '')
    .replace(/\\r\\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortObject(value[key]);
    return acc;
  }, {});
}

class MockSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getName() {
    return this.name;
  }

  setName(name) {
    if (this.env) {
      this.env.sheetWriteCount += 1;
      const sheets = this.env.workbook.sheets;
      delete sheets[this.name];
      this.name = name;
      sheets[name] = this;
    } else {
      this.name = name;
    }
    return this;
  }

  getDataRange() {
    return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }

  getRange(row, column, numRows = 1, numColumns = 1) {
    return new MockRange(this, row, column, numRows, numColumns);
  }

  clearContents() {
    if (this.env) {
      this.env.clearCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows = [];
  }

  clear() {
    if (this.env) {
      this.env.clearCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows = [];
  }

  appendRow(row) {
    if (this.env) {
      this.env.appendRowCount += 1;
      this.env.sheetWriteCount += 1;
    }
    this.rows.push((row || []).slice());
  }

  insertRows() {
    if (this.env) {
      this.env.insertRowsCount += 1;
      this.env.sheetWriteCount += 1;
    }
  }

  deleteRows() {
    if (this.env) {
      this.env.deleteRowsCount += 1;
      this.env.sheetWriteCount += 1;
    }
  }
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
    if (this.sheet.env) this.sheet.env.sheetReadCount += 1;
    return Array.from({ length: this.numRows }, (_, r) => Array.from({ length: this.numColumns }, (_, c) => {
      const row = this.sheet.rows[this.row + r - 1] || [];
      return row[this.column + c - 1] ?? '';
    }));
  }

  setValues(values) {
    if (this.sheet.env) this.sheet.env.setValuesCount += 1;
    values.forEach((rowValues, r) => {
      const targetRowIndex = this.row + r - 1;
      if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
      rowValues.forEach((value, c) => {
        this.assertCanWrite(targetRowIndex, this.column + c - 1, value);
        let nextValue = value;
        if (
          this.sheet.env?.schemaHeaderCorruptionsRemaining > 0 &&
          this.sheet.name === 'sales' &&
          targetRowIndex === 0 &&
          value === 'contactBasisType'
        ) {
          this.sheet.env.schemaHeaderCorruptionsRemaining -= 1;
          nextValue = 'corruptedContactBasisType';
        }
        this.sheet.rows[targetRowIndex][this.column + c - 1] = nextValue;
      });
    });
  }

  setValue(value) {
    if (this.sheet.env) this.sheet.env.setValueCount += 1;
    const targetRowIndex = this.row - 1;
    const targetColumnIndex = this.column - 1;
    if (!this.sheet.rows[targetRowIndex]) this.sheet.rows[targetRowIndex] = [];
    this.assertCanWrite(targetRowIndex, targetColumnIndex, value);
    this.sheet.rows[targetRowIndex][targetColumnIndex] = value;
  }

  assertCanWrite(_targetRowIndex, targetColumnIndex, value) {
    const env = this.sheet.env;
    if (env) env.sheetWriteCount += 1;
    if (env && this.sheet.name === '_gmail_maintenance') env.leaseWriteCount += 1;
    if (env?.failSentUpdate && this.sheet.name === 'sales' && this.sheet.rows[0][targetColumnIndex] === 'sendState' && value === 'SENT') {
      throw new Error('mock_sent_update_failed');
    }
  }
}

for (const [name, mutate, verify] of scenarios) {
  const env = createEnvironment();
  mutate(env);
  if (env.props.APPROVED_SEND_MANIFEST_JSON !== undefined) {
    env.props.APPROVED_SEND_MANIFEST_JSON = JSON.stringify(env.manifest);
  }
  installSuppressionProps(env);
  if (typeof env.afterInstall === 'function') env.afterInstall();
  const result = runEntry(env);
  if (typeof env.afterRun === 'function') env.afterRun();
  try {
    verify(env, result);
  } catch (error) {
    error.message = `${name}: ${error.message}; result=${JSON.stringify(safeResultForAssertionMessage(result))}`;
    throw error;
  }
}

console.log(JSON.stringify({
  runtimeTestScenarioCount: scenarios.length,
  passed: true,
  mailAppCallsInTestsOnly: true,
  realGmailSendExecuted: false,
  realGoogleSheetsUpdated: false,
  realScriptPropertiesUpdated: false,
  appsScriptExecuted: false
}, null, 2));
