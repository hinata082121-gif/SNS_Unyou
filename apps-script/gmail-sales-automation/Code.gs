/**
 * ICHI Social Gmail sales automation MVP.
 *
 * Default safety:
 * - DRY_RUN is treated as true unless Script Properties explicitly set it to false.
 * - LIVE_SEND_ENABLED must be true before any mail is sent.
 * - DAILY_SEND_LIMIT is capped at 30.
 *
 * Do not write real Sheet IDs or confidential values in this file.
 */

const LABELS = {
  sent: 'ICHI/Sales/Sent',
  replied: 'ICHI/Sales/Replied',
  interested: 'ICHI/Sales/Interested',
  requestInfo: 'ICHI/Sales/RequestInfo',
  notInterested: 'ICHI/Sales/NoThanks',
  unsubscribe: 'ICHI/Sales/Unsubscribe',
  bounce: 'ICHI/Sales/Bounce',
  complaint: 'ICHI/Sales/Complaint',
  autoReply: 'ICHI/Sales/AutoReply',
  needsHuman: 'ICHI/Sales/NeedsHuman',
  processed: 'ICHI/Sales/Processed',
  dryRun: 'ICHI/Sales/DryRun'
};

const CLASSIFICATION = {
  interested: 'interested',
  requestInfo: 'request_info',
  notInterested: 'not_interested',
  unsubscribe: 'unsubscribe',
  bounce: 'bounce',
  complaint: 'complaint',
  autoReply: 'auto_reply',
  needsHuman: 'needs_human'
};

const GMAIL_SEND_MANIFEST_SCHEMA_VERSION = 1;
const GMAIL_SEND_DEFAULT_MAX_SEND_COUNT = 1;
const GMAIL_SEND_SAFE_MAX_SEND_COUNT = 30;
const GMAIL_SEND_MAX_ATTEMPTS = 1;
const GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION = 1;
const GMAIL_SUPPRESSION_LEDGER_CHUNK_SIZE = 7000;
const GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION = 'recovery-digest-diagnostic-v4';
const GMAIL_RECOVERY_CANDIDATE_DIGEST_CANONICALIZATION = 'apps-script-v2';
const GMAIL_DAILY_AUTOMATION_VERSION = 'normal-daily-v1';
const GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION = 'automatic-strict-gate-v1';
const GMAIL_DAILY_AUTOMATION_STATE_PROPERTY = 'GMAIL_DAILY_AUTOMATION_STATE_JSON';
const GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY = 'GMAIL_AUTOMATION_SHARED_SECRET';
const GMAIL_DAILY_AUTOMATION_NONCE_PREFIX = 'gmail_daily_nonce_';
const GMAIL_DAILY_AUTOMATION_REQUEST_PREFIX = 'gmail_daily_request_';
const GMAIL_DAILY_SOURCE_SYNC_STATE_PREFIX = 'gmail_daily_source_sync_state_';
const GMAIL_DAILY_AUTOMATION_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const GMAIL_DAILY_EXPECTED_COUNT = 30;
const GMAIL_DAILY_DEFAULT_REQUESTED_SOURCE_COUNT = 90;
const GMAIL_DAILY_MAX_REQUESTED_SOURCE_COUNT = 300;
const GMAIL_DAILY_SOURCE_PAGE_SIZE = 100;
const GMAIL_DAILY_CATCH_UP_TARGET_DATE = '2026-06-22';
const GMAIL_DAILY_CATCH_UP_END_HHMM = '20:00';
const GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624 = '2026-06-24';
const GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624 = '20:00';
const GMAIL_SALES_SPECIAL_RESTART_DATE = '2026-06-28';
const GMAIL_SALES_FIRST_WEEKLY_REPORT_DATE = '2026-07-05';
const GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER = 'runGmailSalesProductionControlLoop';
const GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT = 'Gmail営業候補プール';
const GMAIL_DAILY_SOURCE_STAGING_TAB_NAME = '_gmail_normal_daily_source_staging';
const GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME = '_gmail_normal_daily_source_backup';
const GMAIL_DAILY_SOURCE_MIN_SYNC_COUNT = 30;
const GMAIL_DAILY_SOURCE_RECOMMENDED_SYNC_COUNT = 45;
const GMAIL_DAILY_SOURCE_SYNC_SOFT_DEADLINE_MS = 180000;
const GMAIL_DAILY_SOURCE_SYNC_COMMIT_START_DEADLINE_MS = 150000;
const GMAIL_SALES_SEND_WINDOW_START_PROPERTY = 'GMAIL_SALES_SEND_WINDOW_START';
const GMAIL_SALES_SEND_WINDOW_END_PROPERTY = 'GMAIL_SALES_SEND_WINDOW_END';
const GMAIL_SALES_SEND_WINDOW_START_DEFAULT = '11:45';
const GMAIL_SALES_SEND_WINDOW_END_DEFAULT = '12:45';
const GMAIL_SALES_TIMEZONE_PROPERTY = 'GMAIL_SALES_TIMEZONE';
const GMAIL_SALES_TIMEZONE_DEFAULT = 'Asia/Tokyo';
const GMAIL_DAILY_TRIGGER_MIN_SAFE_MARGIN_MINUTES = 15;
const GMAIL_DAILY_TRIGGER_HANDLERS = [
  'runGmailSalesDailyAutomationTrigger'
];
const GMAIL_DAILY_FORBIDDEN_TRIGGER_HANDLERS = [
  'runGmailSalesRecoverySendOnce',
  'runGmailSalesRecoveryPreSendDryRun',
  'runGmailSalesRecoveryReissueManifestDigests',
  'runGmailSalesRecoveryReissueSourceCandidateContentHash',
  'runGmailSalesRecoveryRepairDerivedCandidateHash'
];
const GMAIL_DAILY_INITIAL_PROPERTIES = {
  [GMAIL_SALES_TIMEZONE_PROPERTY]: GMAIL_SALES_TIMEZONE_DEFAULT,
  GMAIL_SALES_EXPECTED_DAILY_COUNT: '30',
  GMAIL_SALES_MAX_DAILY_SEND_COUNT: '30',
  [GMAIL_SALES_SEND_WINDOW_START_PROPERTY]: GMAIL_SALES_SEND_WINDOW_START_DEFAULT,
  [GMAIL_SALES_SEND_WINDOW_END_PROPERTY]: GMAIL_SALES_SEND_WINDOW_END_DEFAULT,
  GMAIL_SALES_AUTOMATION_VERSION: GMAIL_DAILY_AUTOMATION_VERSION,
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION,
  AUTOMATION_MASTER_ENABLED: 'false',
  AUTO_SEND_ENABLED: 'false',
  LIVE_SEND_ENABLED: 'false'
};
const GMAIL_SALES_SHEET_MAINTENANCE_LOCK = 'GMAIL_SALES_SHEET_MAINTENANCE';
const GMAIL_SALES_SHEET_MAINTENANCE_SHEET = '_gmail_maintenance';
const GMAIL_SALES_SHEET_MAINTENANCE_LEASE_MS = 10 * 60 * 1000;
const GMAIL_SALES_SHEET_MAINTENANCE_HEADERS = [
  'lockName',
  'holderType',
  'holderId',
  'acquiredAt',
  'expiresAt',
  'heartbeatAt',
  'leaseVersion'
];
const GMAIL_SUPPRESSION_LEDGER_REQUIRED_PROPERTIES = [
  'GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION',
  'GMAIL_SUPPRESSION_LEDGER_CREATED_AT',
  'GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT',
  'GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT',
  'GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT',
  'GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT',
  'GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM',
  'GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT'
];
const GMAIL_SEND_STATE = {
  ready: 'READY',
  reserved: 'SEND_RESERVED',
  sent: 'SENT',
  deliveryUnknown: 'DELIVERY_UNKNOWN',
  failedBeforeSend: 'FAILED_BEFORE_SEND',
  blocked: 'BLOCKED',
  manualReviewRequired: 'MANUAL_REVIEW_REQUIRED'
};
const GMAIL_SEND_STATE_COLUMNS = [
  'sendState',
  'sendRunId',
  'sendReservedAt',
  'sendAttemptCount',
  'approvedBatchId',
  'approvedCandidateDigest',
  'deliveryUncertainAt',
  'lastSendErrorCode'
];
const GMAIL_CONTACT_BASIS_COLUMNS = [
  'contactBasisType',
  'contactBasisRecordedAt',
  'sourceType',
  'sourceReferenceHash',
  'optOutAvailable',
  'lastVerifiedAt',
  'suppressionCheckedAt',
  'historyCheckedAt'
];
const GMAIL_CONTACT_BASIS_ALLOWED_TYPES = [
  'existing_relationship',
  'explicit_opt_in',
  'valid_business_contact_exception',
  'manual_legal_reviewed'
];
const GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY = 'GMAIL_SALES_CONTACT_BASIS_REVIEW_TAB_NAME';
const GMAIL_CONTACT_BASIS_REVIEW_TAB_DEFAULT = 'Gmail_Contact_Basis_Review';
const GMAIL_CONTACT_BASIS_REVIEW_HEADERS = [
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
const GMAIL_CONTACT_BASIS_REVIEW_DECISIONS = ['pending', 'approved', 'approved_ai', 'rejected', 'needs_more_evidence'];
const GMAIL_CONTACT_BASIS_REVIEW_APPLY_STATUSES = [
  'pending',
  'applied',
  'applied_ai',
  'skipped_invalid',
  'skipped_stale_source',
  'rejected',
  'needs_more_evidence',
  'rollback',
  'error'
];
const GMAIL_SALES_AI_PROMPT_VERSION = 'contact-basis-ai-prompt-v1';
const GMAIL_SALES_AI_DEFAULT_POLICY_VERSION = 'contact-basis-policy-v1';
const GMAIL_SALES_AI_ALLOWED_PROVIDERS = ['gemini', 'openai', 'mock', 'disabled'];
const GMAIL_SALES_AI_SETUP_TOKEN_DIGEST_PROPERTY = 'GMAIL_SALES_AI_SETUP_TOKEN_DIGEST';
const GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT_PROPERTY = 'GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT';
const GMAIL_SALES_AI_SETUP_TOKEN_USED_PROPERTY = 'GMAIL_SALES_AI_SETUP_TOKEN_USED';
const GMAIL_SALES_AI_SETUP_TOKEN_TTL_MINUTES = 10;
const GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS = [
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
const GMAIL_SHEET_SYNC_OUTBOX_HEADERS = [
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
  'contactBasisType',
  'contactBasisRecordedAt',
  'sourceType',
  'sourceReferenceHash',
  'optOutAvailable',
  'lastVerifiedAt',
  'suppressionCheckedAt',
  'historyCheckedAt'
];

function setupGmailSalesAutomation() {
  const config = getConfig_();
  Object.keys(LABELS).forEach((key) => createOrGetLabel_(LABELS[key]));

  appendLog_({
    event: 'setup_checked',
    dryRun: config.dryRun,
    liveSendEnabled: config.liveSendEnabled,
    dailySendLimit: config.dailySendLimit
  });

  if (String(config.createTriggers).toLowerCase() === 'true') {
    ScriptApp.newTrigger('dailySalesEmailJob').timeBased().everyDays(1).atHour(9).create();
    ScriptApp.newTrigger('scanGmailRepliesJob').timeBased().everyHours(1).create();
    appendLog_({ event: 'triggers_created' });
  } else {
    appendLog_({ event: 'trigger_creation_skipped' });
  }
}

function setupDailyAutoSendTriggers() {
  const config = getConfig_();
  const triggerSpecs = [
    { handler: 'runScheduledPreflight', hour: config.preflightHour, minute: 30 },
    { handler: 'runScheduledDailySend', hour: config.sendHour, minute: 0 },
    { handler: 'runPostSendCheck', hour: config.postSendCheckHour, minute: 30 },
    { handler: 'runFailureRecoveryCheck', hour: 14, minute: 0 }
  ];

  triggerSpecs.forEach((spec) => {
    if (hasTrigger_(spec.handler)) {
      appendSafeLog_({ event: 'auto_trigger_exists', handler: spec.handler });
      return;
    }
    ScriptApp.newTrigger(spec.handler)
      .timeBased()
      .everyDays(1)
      .atHour(spec.hour)
      .nearMinute(spec.minute)
      .create();
    appendSafeLog_({ event: 'auto_trigger_created', handler: spec.handler, hour: spec.hour, minute: spec.minute });
  });
}

function removeDailyAutoSendTriggers() {
  const handlers = [
    'runScheduledPreflight',
    'runScheduledDailySend',
    'runPostSendCheck',
    'runFailureRecoveryCheck'
  ];

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
      appendSafeLog_({ event: 'auto_trigger_removed', handler: trigger.getHandlerFunction() });
    }
  });
}

function dailySalesEmailJob() {
  executeApprovedGmailSalesBatch_({ source: 'legacy_scheduled', requireAutoSend: true, dryRun: false });
}

function doPost(e) {
  return handleGmailOutboxSheetSync_(e);
}

function handleGmailOutboxSheetSync_(e) {
  const props = PropertiesService.getScriptProperties();
  const expectedToken = String(props.getProperty('GMAIL_SHEET_SYNC_TOKEN') || props.getProperty('SHEET_SYNC_TOKEN') || '').trim();
  let payload;

  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    appendSafeLog_({ event: 'gmail_sheet_sync_rejected', blockedReason: 'invalid_json' });
    return buildSheetSyncResponse_({ ok: false, sheetSynced: false, blockedReason: 'invalid_json' });
  }

  const action = String((payload && payload.action) || '').trim().toLowerCase();
  if (action === 'read_normal_daily_source') {
    return handleGmailSalesNormalDailySourceReadWebhook_(payload);
  }
  if (action === 'prepare_normal_daily') {
    return handleGmailSalesNormalDailyPrepareWebhook_(payload);
  }
  if (action === 'sync_normal_daily_source') {
    return handleGmailSalesNormalDailySourceSyncWebhook_(payload);
  }
  if (action === 'get_normal_daily_source_sync_status') {
    return handleGmailSalesNormalDailySourceSyncStatusWebhook_(payload);
  }

  const providedToken = String((payload && payload.token) || '').trim();
  if (!expectedToken || providedToken !== expectedToken) {
    appendSafeLog_({ event: 'gmail_sheet_sync_rejected', blockedReason: 'token_mismatch' });
    return buildSheetSyncResponse_({ ok: false, sheetSynced: false, blockedReason: 'token_mismatch' });
  }

  const modeResolution = resolveSheetSyncOperationMode_(payload);
  if (!modeResolution.ok) {
    appendSafeLog_({ event: 'gmail_sheet_sync_rejected', blockedReason: modeResolution.blockedReason });
    return buildSheetSyncResponse_(buildConnectedSheetSyncDryRunResult_({
      status: 'blocked',
      blockedReason: modeResolution.blockedReason
    }));
  }

  const validation = validateSheetSyncPayload_(payload);
  if (modeResolution.mode === 'connected_dry_run') {
    return handleConnectedSheetSyncDryRun_(payload, validation);
  }
  if (modeResolution.mode === 'read_only_snapshot') {
    return handleSheetSyncReadOnlySnapshot_(payload, validation);
  }
  if (modeResolution.mode === 'sync_recovery_single') {
    return handleRecoverySingleSheetSync_(payload);
  }

  if (!validation.ok) {
    appendSafeLog_(Object.assign({
      event: 'gmail_sheet_sync_rejected',
      sendDate: validation.sendDate,
      sendBatchId: validation.sendBatchId,
      rowCount: validation.rowCount,
      payloadHash: validation.payloadHash,
      blockedReason: validation.blockedReason
    }, validation.safeCounts));
    return buildSheetSyncResponse_({
      ok: false,
      sheetSynced: false,
      sendDate: validation.sendDate,
      sendBatchId: validation.sendBatchId,
      rowCount: validation.rowCount,
      blockedReason: validation.blockedReason
    });
  }

  const config = getConfig_();
  const holderId = String((payload.maintenanceLease && payload.maintenanceLease.holderId) || Utilities.getUuid()).trim();
  const lease = acquireSheetMaintenanceLease_(config, {
    holderType: 'local_sync',
    holderId,
    dryRun: false
  });
  if (!lease.ok) {
    appendSafeLog_(Object.assign({
      event: 'gmail_sheet_sync_rejected',
      sendDate: validation.sendDate,
      sendBatchId: validation.sendBatchId,
      rowCount: validation.rowCount,
      payloadHash: validation.payloadHash,
      blockedReason: lease.blockedReason
    }, validation.safeCounts));
    return buildSheetSyncResponse_({
      ok: false,
      sheetSynced: false,
      sendDate: validation.sendDate,
      sendBatchId: validation.sendBatchId,
      rowCount: validation.rowCount,
      blockedReason: lease.blockedReason
    });
  }

  let result;
  try {
    result = writeGmailOutboxRowsToSheet_(payload, config);
  } finally {
    releaseSheetMaintenanceLease_(config, lease);
  }
  appendSafeLog_({
    event: 'gmail_sheet_sync_completed',
    sendDate: validation.sendDate,
    sendBatchId: validation.sendBatchId,
    rowCount: validation.rowCount,
    payloadHash: validation.payloadHash,
    sheetSynced: result.sheetSynced,
    blockedReason: result.blockedReason
  });

  return buildSheetSyncResponse_({
    ok: result.sheetSynced,
    sheetSynced: result.sheetSynced,
    sendDate: validation.sendDate,
    sendBatchId: validation.sendBatchId,
    rowCount: validation.rowCount,
    blockedReason: result.blockedReason
  });
}

function resolveSheetSyncOperationMode_(payload) {
  const rawModes = [
    payload && payload.mode,
    payload && payload.operation,
    payload && payload.action
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  const uniqueModes = rawModes.filter((value, index) => rawModes.indexOf(value) === index);
  const mode = uniqueModes.length === 0 ? 'write' : uniqueModes[0];
  if (uniqueModes.length > 1) {
    return { ok: false, mode: '', blockedReason: 'sheet_sync_mode_mismatch' };
  }
  if (mode === 'connected_dry_run') {
    if (payload.dryRun !== true) {
      return { ok: false, mode: '', blockedReason: 'connected_dry_run_requires_dry_run_true' };
    }
    return { ok: true, mode };
  }
  if (mode === 'read_only_snapshot') {
    if (payload.dryRun !== true) {
      return { ok: false, mode: '', blockedReason: 'read_only_snapshot_requires_dry_run_true' };
    }
    return { ok: true, mode };
  }
  if (mode === 'sync_recovery_single') {
    return { ok: true, mode };
  }
  if (mode === 'write') {
    if (payload.dryRun === true) {
      return { ok: false, mode: '', blockedReason: 'write_mode_rejects_dry_run_true' };
    }
    return { ok: true, mode };
  }
  return { ok: false, mode: '', blockedReason: 'unknown_sheet_sync_mode' };
}

function handleGmailSalesNormalDailyPrepareWebhook_(payload) {
  const auth = verifyGmailDailyAutomationWebhook_(payload);
  if (!auth.ok) {
    appendSafeLog_({
      event: 'gmail_daily_prepare_rejected',
      blockedReason: auth.blockedReason,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    });
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: auth.blockedReason,
      sheetSynced: false,
      stateUpdated: false
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: 'lock_unavailable',
      sheetSynced: false,
      stateUpdated: false
    });
  }
  let lease = null;
  try {
    const validation = validateGmailDailyPreparePayload_(payload);
    if (!validation.ok) {
      appendSafeLog_({
        event: 'gmail_daily_prepare_rejected',
        targetDate: validation.targetDate,
        blockedReason: validation.blockedReason,
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false
      });
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: validation.blockedReason,
        sheetSynced: false,
        stateUpdated: false
      });
    }
    const previousState = readGmailDailyAutomationState_();
    const stateTransition = validateNormalDailyPrepareStateTransition_(previousState, validation);
    if (!stateTransition.ok) {
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: stateTransition.blockedReason,
        sheetSynced: false,
        stateUpdated: false,
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false
      });
    }
    const config = getConfig_();
    lease = acquireSheetMaintenanceLease_(config, {
      holderType: 'github_actions_prepare',
      holderId: String(payload.requestId || Utilities.getUuid()).trim(),
      dryRun: false
    });
    if (!lease.ok) {
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: lease.blockedReason,
        sheetSynced: false,
        stateUpdated: false
      });
    }
    const sheetResult = writeGmailOutboxRowsToSheet_(payload, config);
    if (!sheetResult.sheetSynced) {
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: sheetResult.blockedReason || 'sheet_sync_failed',
        sheetSynced: false,
        stateUpdated: false
      });
    }
    const props = PropertiesService.getScriptProperties();
    props.setProperty('APPROVED_SEND_MANIFEST_JSON', JSON.stringify(payload.manifest));
    const state = writeGmailDailyAutomationState_({
      targetDate: validation.targetDate,
      mode: 'normal_daily',
      sendBatchId: validation.sendBatchId,
      manifestDigest: String(payload.manifest.manifestDigest || payload.manifest.approvedOutboxHash || '').trim(),
      candidateContentHash: String(payload.manifest.sourceOutboxIdentity && payload.manifest.sourceOutboxIdentity.candidateContentHash || '').trim(),
      expectedCandidateCount: validation.expectedCandidateCount,
      actualCandidateCount: validation.candidateCount,
      sheetSynced: true,
      state: 'sheet_synced',
      stateVersion: 2,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preSendPassedAt: '',
      sendStartedAt: '',
      sentAt: '',
      sendAttemptCount: 0,
      actualSendCount: 0,
      failedSendCount: 0,
      resultUnknown: false,
      blockedReasons: [],
      errorCode: '',
      automationVersion: GMAIL_DAILY_AUTOMATION_VERSION,
      triggerRunId: ''
    });
    if (stateTransition.recoveredFromState) {
      state.recoveredFromState = stateTransition.recoveredFromState;
      state.recoveryReason = stateTransition.recoveryReason;
      state.previousStateAudit = stateTransition.previousStateAudit;
      writeGmailDailyAutomationState_(state);
    }
    appendSafeLog_({
      event: 'gmail_daily_prepare_completed',
      targetDate: validation.targetDate,
      sendBatchId: validation.sendBatchId,
      candidateCount: validation.candidateCount,
      state: state.state,
      gmailSendExecuted: false,
      googleSheetsUpdated: true,
      scriptPropertiesUpdated: true
    });
    return buildSheetSyncResponse_({
      ok: true,
      status: 'pass',
      event: 'gmail_daily_prepare_completed',
      targetDate: validation.targetDate,
      sendBatchId: validation.sendBatchId,
      candidateCount: validation.candidateCount,
      sheetSynced: true,
      stateUpdated: true,
      currentState: state.state,
      gmailSendExecuted: false,
      googleSheetsUpdated: true,
      scriptPropertiesUpdated: true
    });
  } catch (error) {
    appendSafeLog_({
      event: 'gmail_daily_prepare_failed',
      blockedReason: safeErrorCode_(error),
      gmailSendExecuted: false
    });
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: safeErrorCode_(error),
      sheetSynced: false,
      stateUpdated: false
    });
  } finally {
    if (lease) {
      releaseSheetMaintenanceLease_(getConfig_(), lease);
    }
    lock.releaseLock();
  }
}

function handleGmailSalesNormalDailySourceReadWebhook_(payload) {
  const auth = verifyGmailDailyAutomationWebhook_(payload);
  if (!auth.ok) {
    appendSafeLog_({
      event: 'gmail_daily_source_read_rejected',
      blockedReason: auth.blockedReason,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: auth.blockedReason,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
  }
  const validation = validateGmailDailySourceReadPayload_(payload);
  if (!validation.ok) {
    appendSafeLog_({
      event: 'gmail_daily_source_read_rejected',
      targetDate: validation.targetDate,
      blockedReason: validation.blockedReason,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: validation.blockedReason,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: 'lock_unavailable',
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
  }
  try {
    const config = getConfig_();
    const source = loadNormalDailySourceRows_(config, validation);
    const rows = source.rows;
    if (rows.length < validation.expectedCount) {
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: 'source_available_count_insufficient',
        sourceCount: rows.length,
        availableSourceCount: source.availableSourceCount,
        returnedSourceCount: rows.length,
        hasMore: source.hasMore,
        nextCursorPresent: Boolean(source.nextCursor),
        recoveryEntryCount: source.recoveryEntryCount,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false,
        triggerChanged: false
      });
    }
    appendSafeLog_({
      event: 'gmail_daily_source_read_pass',
      targetDate: validation.targetDate,
      sourceCount: rows.length,
      availableSourceCount: source.availableSourceCount,
      returnedSourceCount: rows.length,
      hasMore: source.hasMore,
      nextCursorPresent: Boolean(source.nextCursor),
      recoveryEntryCount: source.recoveryEntryCount,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
    return buildSheetSyncResponse_({
      ok: true,
      status: 'pass',
      sourceSchemaVersion: 1,
      sourceCount: rows.length,
      availableSourceCount: source.availableSourceCount,
      returnedSourceCount: rows.length,
      requestedSourceCount: validation.requestedSourceCount,
      hasMore: source.hasMore,
      nextCursor: source.nextCursor,
      nextCursorPresent: Boolean(source.nextCursor),
      recoveryEntryCount: source.recoveryEntryCount,
      headers: GMAIL_SHEET_SYNC_OUTBOX_HEADERS,
      rows,
      sourceSnapshotIdentity: 'apps_script_normal_daily_source',
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
  } catch (error) {
    appendSafeLog_({
      event: 'gmail_daily_source_read_rejected',
      blockedReason: safeErrorCode_(error),
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      blockedReason: 'source_input_unavailable',
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false,
      triggerChanged: false
    });
  } finally {
    lock.releaseLock();
  }
}

function handleGmailSalesNormalDailySourceSyncWebhook_(payload) {
  const auth = verifyGmailDailyAutomationWebhook_(payload);
  if (!auth.ok) {
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      action: 'sync_normal_daily_source',
      blockedReason: auth.blockedReason,
      sourceRowsWritten: 0,
      gmailSendExecuted: false,
      sendTargetSheetUpdated: false,
      triggerChanged: false
    });
  }
  const validation = validateGmailDailySourceSyncPayload_(payload);
  if (!validation.ok) {
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      action: 'sync_normal_daily_source',
      blockedReason: validation.blockedReason,
      sourceRowsRequested: validation.rowCount,
      sourceRowsWritten: 0,
      gmailSendExecuted: false,
      sendTargetSheetUpdated: false,
      triggerChanged: false
    });
  }
  if (payload.dryRun === true) {
    return buildSheetSyncResponse_({
      ok: true,
      status: 'pass',
      action: 'sync_normal_daily_source',
      mode: 'dry_run',
      sourceRowsRequested: validation.rowCount,
      sourceRowsWritten: 0,
      sourceRowsReadBack: 0,
      sourceDigestMatch: false,
      propertyConfigured: false,
      propertyWriteCount: 0,
      gmailSendExecuted: false,
      sendTargetSheetUpdated: false,
      triggerChanged: false
    });
  }
  const result = writeNormalDailySourceRows_(payload, validation);
  appendSafeLog_({
    event: 'gmail_daily_source_sync_completed',
    status: result.status,
    sourceRowsRequested: validation.rowCount,
    sourceRowsWritten: result.sourceRowsWritten,
    sourceRowsReadBack: result.sourceRowsReadBack,
    sourceDigestMatch: result.sourceDigestMatch,
    propertyConfigured: result.propertyConfigured,
    blockedReason: result.blockedReason || ''
  });
  return buildSheetSyncResponse_(result);
}

function handleGmailSalesNormalDailySourceSyncStatusWebhook_(payload) {
  const auth = verifyGmailDailyAutomationWebhook_(payload);
  if (!auth.ok) {
    return buildSheetSyncResponse_({
      ok: false,
      status: 'blocked',
      action: 'get_normal_daily_source_sync_status',
      blockedReason: auth.blockedReason,
      gmailSendExecuted: false,
      sendTargetSheetUpdated: false,
      triggerChanged: false
    });
  }
  const targetDate = String(payload && payload.targetDate || '').trim();
  const expectedCandidateCount = Number(payload && payload.expectedCandidateCount || payload && payload.candidateCount || 0);
  const sourceTabName = String(payload && payload.sourceTabName || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
  const sourceDigest = String(payload && payload.sourceDigest || '').trim();
  const validation = {
    targetDate,
    rowCount: expectedCandidateCount,
    sourceTabName
  };
  const state = readNormalDailySourceSyncState_(payload);
  const status = inspectNormalDailySourceSyncStatus_(payload, validation, sourceDigest);
  const response = {
    ok: status.requestCommitted === true,
    status: status.requestCommitted === true ? 'pass' : 'blocked',
    action: 'get_normal_daily_source_sync_status',
    blockedReason: status.requestCommitted === true ? '' : (state.safeReasonCode || status.blockedReason || 'source_sync_commit_status_unknown'),
    targetDate,
    expectedCandidateCount,
    sourceTabExists: status.sourceTabExists,
    sourceDataRowCount: status.sourceRowsReadBack,
    sourceHeaderColumnCount: status.sourceHeaderColumnCount,
    sourceDigestMatch: status.sourceDigestMatch,
    propertyConfigured: status.propertyConfigured,
    sourceTabCommitted: status.sourceTabCommitted,
    requestCommitted: status.requestCommitted,
    stagingTabExists: status.stagingTabExists,
    backupTabExists: status.backupTabExists,
    gmailSendExecuted: false,
    sendTargetSheetUpdated: false,
    triggerChanged: false
  };
  return buildSheetSyncResponse_(response);
}

function verifyGmailDailyAutomationWebhook_(payload) {
  const props = PropertiesService.getScriptProperties();
  const secret = String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim();
  if (!secret) return { ok: false, blockedReason: 'automation_secret_missing' };
  const timestamp = String(payload && payload.timestamp || '').trim();
  const nonce = String(payload && payload.nonce || '').trim();
  const requestId = String(payload && payload.requestId || '').trim();
  const action = String(payload && payload.action || '').trim();
  const targetDate = String(payload && payload.targetDate || payload && payload.sendDate || '').trim();
  const bodyDigest = String(payload && payload.bodyDigest || '').trim();
  const signature = String(payload && payload.signature || '').trim().toLowerCase();
  if (!timestamp || !nonce || !requestId || !action || !targetDate || !bodyDigest || !signature) {
    return { ok: false, blockedReason: 'webhook_auth_fields_missing' };
  }
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > GMAIL_DAILY_AUTOMATION_MAX_CLOCK_SKEW_MS) {
    return { ok: false, blockedReason: 'webhook_timestamp_stale' };
  }
  if (!/^[a-f0-9]{64}$/.test(bodyDigest) || !/^[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, blockedReason: 'webhook_signature_format_invalid' };
  }
  const computedBodyDigest = sha256Hex_(gmailDailyWebhookBodyMaterial_(payload));
  if (!constantTimeEqual_(bodyDigest, computedBodyDigest)) {
    return { ok: false, blockedReason: 'webhook_body_digest_mismatch' };
  }
  const signed = [timestamp, nonce, requestId, action, targetDate, bodyDigest].join('\n');
  const expectedSignature = hmacSha256Hex_(secret, signed);
  if (!constantTimeEqual_(signature, expectedSignature)) {
    return { ok: false, blockedReason: 'webhook_signature_mismatch' };
  }
  const cache = CacheService.getScriptCache();
  const nonceKey = GMAIL_DAILY_AUTOMATION_NONCE_PREFIX + hashValue_(nonce);
  if (cache.get(nonceKey)) {
    return { ok: false, blockedReason: 'webhook_replay_detected' };
  }
  cache.put(nonceKey, '1', 10 * 60);
  return { ok: true, blockedReason: '' };
}

function validateGmailDailyPreparePayload_(payload) {
  const manifest = payload && payload.manifest;
  const headers = Array.isArray(payload && payload.headers) ? payload.headers : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const targetDate = String(payload && (payload.targetDate || payload.sendDate) || '').trim();
  const sendBatchId = String(payload && payload.sendBatchId || manifest && manifest.batchId || '').trim();
  const expectedCandidateCount = gmailDailyExpectedCount_();
  const versionStatus = gmailDailyVersionStatus_();
  const blocked = [];
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (String(payload && payload.action || '') !== 'prepare_normal_daily') blocked.push('action_not_prepare_normal_daily');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) blocked.push('target_date_invalid');
  if (!manifest || typeof manifest !== 'object') blocked.push('manifest_missing');
  if (String(manifest && (manifest.mode || manifest.sourceType) || '') !== 'normal_daily') blocked.push('manifest_mode_not_normal_daily');
  if (String(payload && payload.automationVersion || '') !== GMAIL_DAILY_AUTOMATION_VERSION) blocked.push('payload_automation_version_mismatch');
  if (String(payload && payload.autoApprovalPolicyVersion || '') !== GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION) blocked.push('payload_approval_policy_version_mismatch');
  if (manifest && manifest.recoverySingle === true) blocked.push('recovery_manifest_rejected');
  if (String(manifest && manifest.targetDate || '') !== targetDate) blocked.push('manifest_target_date_mismatch');
  if (String(manifest && manifest.batchId || '') !== sendBatchId) blocked.push('manifest_batch_id_mismatch');
  if (String(manifest && manifest.automationVersion || '') !== GMAIL_DAILY_AUTOMATION_VERSION) blocked.push('manifest_automation_version_mismatch');
  if (Number(manifest && manifest.candidateCount || 0) !== expectedCandidateCount) blocked.push('manifest_candidate_count_mismatch');
  if (rows.length !== expectedCandidateCount) blocked.push('row_count_not_30');
  if (Number(payload && payload.candidateCount || rows.length) !== expectedCandidateCount) blocked.push('payload_candidate_count_mismatch');
  if (manifest && manifest.approvalStatus !== 'approved') blocked.push('manifest_approval_status_not_approved');
  if (manifest && manifest.approvalType !== 'automatic_strict_gate') blocked.push('manifest_approval_type_invalid');
  if (manifest && manifest.targetAutoApproved !== true) blocked.push('manifest_target_auto_approved_missing');
  if (manifest && manifest.humanReviewCompleted !== false) blocked.push('manifest_human_review_must_be_false');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 0) blocked.push('manifest_human_review_count_must_be_zero');
  if (String(manifest && manifest.autoApprovalPolicyVersion || '') !== GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION) blocked.push('auto_approval_policy_mismatch');
  if (!Array.isArray(manifest && manifest.candidateDigests) || manifest.candidateDigests.length !== expectedCandidateCount) blocked.push('manifest_candidate_digests_invalid');
  if (!headers.length) blocked.push('headers_missing');
  if (blocked.length === 0) {
    const rowPayload = {
      headers,
      rows,
      sendDate: targetDate,
      sendBatchId,
      candidateCount: rows.length
    };
    const sheetValidation = validateSheetSyncPayload_(rowPayload);
    if (!sheetValidation.ok) blocked.push(sheetValidation.blockedReason || 'sheet_payload_invalid');
  }
  return {
    ok: blocked.length === 0,
    blockedReason: blocked.join(','),
    targetDate,
    sendBatchId,
    candidateCount: rows.length,
    expectedCandidateCount
  };
}

function validateNormalDailyPrepareStateTransition_(state, validation) {
  const current = state || {};
  const currentState = String(current.state || 'not_started');
  if (currentState !== 'blocked') {
    return { ok: true, blockedReason: '', recoveredFromState: '' };
  }
  const blocked = [];
  const currentTargetDate = String(current.targetDate || '');
  if (currentTargetDate && currentTargetDate !== validation.targetDate) blocked.push('blocked_state_target_date_conflict');
  if (Number(current.sendAttemptCount || 0) !== 0) blocked.push('blocked_state_send_attempt_exists');
  if (Number(current.actualSendCount || 0) !== 0) blocked.push('blocked_state_actual_send_exists');
  if (current.resultUnknown === true || currentState === 'result_unknown') blocked.push('blocked_state_result_unknown');
  if (validation.candidateCount !== validation.expectedCandidateCount) blocked.push('candidate_count_not_30');
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    recoveredFromState: blocked.length === 0 ? 'blocked' : '',
    recoveryReason: blocked.length === 0 ? 'prepare_completed_before_any_send' : '',
    previousStateAudit: blocked.length === 0 ? {
      state: currentState,
      targetDatePresent: Boolean(currentTargetDate),
      targetDateMatched: !currentTargetDate || currentTargetDate === validation.targetDate,
      sendAttemptCount: Number(current.sendAttemptCount || 0),
      actualSendCount: Number(current.actualSendCount || 0),
      resultUnknown: current.resultUnknown === true
    } : null
  };
}

function validateGmailDailySourceReadPayload_(payload) {
  const targetDate = String(payload && (payload.targetDate || payload.sendDate) || '').trim();
  const sendBatchId = String(payload && payload.sendBatchId || '').trim();
  const expectedCount = Number(payload && payload.expectedCount || 0);
  const requestedSourceCount = Number(payload && payload.requestedSourceCount || 0);
  const pageSize = Number(payload && payload.pageSize || GMAIL_DAILY_SOURCE_PAGE_SIZE);
  const cursor = String(payload && payload.cursor || '').trim();
  const offset = cursor ? Number(cursor) : Number(payload && payload.offset || 0);
  const versionStatus = gmailDailyVersionStatus_();
  const blocked = [];
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (String(payload && payload.action || '') !== 'read_normal_daily_source') blocked.push('action_not_read_normal_daily_source');
  if (String(payload && payload.mode || '') !== 'normal_daily') blocked.push('mode_not_normal_daily');
  if (String(payload && payload.sourceType || '') !== 'normal_daily') blocked.push('source_type_not_normal_daily');
  if (String(payload && payload.automationVersion || '') !== GMAIL_DAILY_AUTOMATION_VERSION) blocked.push('payload_automation_version_mismatch');
  if (String(payload && payload.autoApprovalPolicyVersion || '') !== GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION) blocked.push('payload_approval_policy_version_mismatch');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) blocked.push('target_date_invalid');
  if (sendBatchId !== 'gmail-sales-' + targetDate) blocked.push('send_batch_id_mismatch');
  if (expectedCount !== gmailDailyExpectedCount_()) blocked.push('expected_count_mismatch');
  if (!Number.isFinite(requestedSourceCount) || requestedSourceCount < expectedCount || requestedSourceCount > GMAIL_DAILY_MAX_REQUESTED_SOURCE_COUNT) blocked.push('requested_source_count_invalid');
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > GMAIL_DAILY_SOURCE_PAGE_SIZE) blocked.push('page_size_invalid');
  if (!Number.isFinite(offset) || offset < 0) blocked.push('cursor_invalid');
  return {
    ok: blocked.length === 0,
    blockedReason: blocked.join(','),
    targetDate,
    sendBatchId,
    expectedCount,
    requestedSourceCount: Math.min(GMAIL_DAILY_MAX_REQUESTED_SOURCE_COUNT, Math.max(expectedCount, requestedSourceCount || GMAIL_DAILY_DEFAULT_REQUESTED_SOURCE_COUNT)),
    pageSize: Math.min(GMAIL_DAILY_SOURCE_PAGE_SIZE, Math.max(1, Math.floor(pageSize || GMAIL_DAILY_SOURCE_PAGE_SIZE))),
    offset: Math.floor(offset || 0)
  };
}

function validateGmailDailySourceSyncPayload_(payload) {
  const headers = Array.isArray(payload && payload.headers) ? payload.headers.map((value) => String(value || '')) : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const targetDate = String(payload && (payload.targetDate || payload.verificationDate || payload.sendDate) || '').trim();
  const sourceTabName = String(payload && payload.sourceTabName || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
  const versionStatus = gmailDailyVersionStatus_();
  const config = getConfig_();
  const blocked = [];
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (String(payload && payload.action || '') !== 'sync_normal_daily_source') blocked.push('action_not_sync_normal_daily_source');
  if (String(payload && payload.mode || '') !== 'normal_daily') blocked.push('mode_not_normal_daily');
  if (String(payload && payload.sourceType || '') !== 'normal_daily_source') blocked.push('source_type_not_normal_daily_source');
  if (String(payload && payload.sourceVerificationStatus || '') !== 'verified_only') blocked.push('source_verification_status_not_verified_only');
  if (Number(payload && payload.verifiedCandidateCount || 0) !== rows.length) blocked.push('verified_candidate_count_mismatch');
  if (String(payload && payload.automationVersion || '') !== GMAIL_DAILY_AUTOMATION_VERSION) blocked.push('payload_automation_version_mismatch');
  if (String(payload && payload.autoApprovalPolicyVersion || '') !== GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION) blocked.push('payload_approval_policy_version_mismatch');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) blocked.push('target_date_invalid');
  if (!headersStrictlyMatch_(headers, GMAIL_SHEET_SYNC_OUTBOX_HEADERS)) blocked.push('header_mismatch');
  if (hasDuplicateValues_(headers)) blocked.push('duplicate_header');
  if (rows.length < GMAIL_DAILY_SOURCE_MIN_SYNC_COUNT) blocked.push('source_row_count_below_minimum');
  if (!sourceTabName) blocked.push('source_tab_name_missing');
  if (sourceTabName === config.sheetName) blocked.push('source_tab_matches_send_target');
  if (isRecoverySheetName_(sourceTabName, config)) blocked.push('source_tab_matches_recovery');
  const seen = { email: {}, domain: {}, business: {}, dedupe: {} };
  rows.forEach((rowValues) => {
    const cells = Array.isArray(rowValues) ? rowValues : [];
    if (cells.length !== headers.length) blocked.push('row_width_mismatch');
    const row = rowFromCells_(headers, cells);
    const status = String(row.status || '').trim().toLowerCase();
    if (status !== 'available' && status !== 'ready') blocked.push('row_status_not_source_eligible');
    if (String(row.sentAt || row.sentStatus || '').trim()) blocked.push('sent_row_rejected');
    if (String(row.doNotContact || '').trim().toLowerCase() === 'true') blocked.push('do_not_contact_row_rejected');
    if (normalizeDateText_(row.lastCheckedAt || row.verifiedAt || '').slice(0, 10) !== targetDate) blocked.push('row_not_verified_for_target_date');
    if (!normalizeEmail_(row.email || row.contactEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(row.email || row.contactEmail))) blocked.push('invalid_email');
    if (!normalizeEmailSubject_(row.subject) || !normalizeEmailBody_(row.body)) blocked.push('missing_subject_or_body');
    if (normalizeEmailBody_(row.body).indexOf('不要') === -1) blocked.push('missing_opt_out_text');
    const emailHash = hashValue_(normalizeEmail_(row.email || row.contactEmail));
    const domainHash = hashValue_(sourceDomainFromRow_(row));
    const businessHash = hashValue_(String(row.name || '').trim().toLowerCase());
    const dedupe = String(row.dedupeKey || '').trim().toLowerCase();
    if (emailHash && seen.email[emailHash]) blocked.push('duplicate_recipient');
    if (domainHash && seen.domain[domainHash]) blocked.push('duplicate_domain');
    if (businessHash && seen.business[businessHash]) blocked.push('duplicate_business');
    if (dedupe && seen.dedupe[dedupe]) blocked.push('duplicate_dedupe_key');
    seen.email[emailHash] = true;
    seen.domain[domainHash] = true;
    seen.business[businessHash] = true;
    seen.dedupe[dedupe] = true;
  });
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    targetDate,
    sourceTabName,
    headers,
    rows,
    rowCount: rows.length
  };
}

function writeNormalDailySourceRows_(payload, validation) {
  const startedAtMs = Date.now();
  const config = getConfig_();
  if (!config.sheetId) {
    return buildNormalDailySourceSyncResult_({ status: 'blocked', blockedReason: 'missing_sheet_id' });
  }
  const requestState = readNormalDailySourceSyncState_(payload);
  const sourceDigest = normalDailySourceDigest_([validation.headers].concat(validation.rows));
  if (requestState.status === 'committed') {
    if (requestState.bodyDigest && requestState.bodyDigest !== String(payload.bodyDigest || '')) {
      return buildNormalDailySourceSyncResult_({ status: 'blocked', blockedReason: 'source_sync_request_digest_conflict', requestCommitted: false });
    }
    const committedStatus = inspectNormalDailySourceSyncStatus_(payload, validation, sourceDigest);
    if (committedStatus.requestCommitted) return buildNormalDailySourceSyncResult_(committedStatus);
  }
  if (requestState.bodyDigest && requestState.bodyDigest !== String(payload.bodyDigest || '')) {
    return buildNormalDailySourceSyncResult_({ status: 'blocked', blockedReason: 'source_sync_request_digest_conflict', requestCommitted: false });
  }
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const values = [validation.headers].concat(validation.rows);
  writeNormalDailySourceSyncState_(payload, {
    status: 'in_progress',
    targetDate: validation.targetDate,
    candidateCount: validation.rowCount,
    bodyDigest: String(payload.bodyDigest || ''),
    sourceDigest,
    startedAt: new Date().toISOString(),
    safeReasonCode: ''
  });
  if (Date.now() - startedAtMs > GMAIL_DAILY_SOURCE_SYNC_COMMIT_START_DEADLINE_MS) {
    return blockNormalDailySourceSync_(payload, validation, 'source_sync_soft_deadline_exceeded');
  }
  const staging = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_STAGING_TAB_NAME) || spreadsheet.insertSheet(GMAIL_DAILY_SOURCE_STAGING_TAB_NAME);
  staging.clearContents();
  staging.getRange(1, 1, values.length, validation.headers.length).setValues(values);
  SpreadsheetApp.flush();
  const readBack = staging.getRange(1, 1, values.length, validation.headers.length).getValues();
  const sourceDigestMatch = normalDailySourceDigest_(readBack) === sourceDigest;
  if (!sourceDigestMatch) {
    writeNormalDailySourceSyncState_(payload, {
      status: 'failed',
      targetDate: validation.targetDate,
      candidateCount: validation.rowCount,
      bodyDigest: String(payload.bodyDigest || ''),
      sourceDigest,
      completedAt: new Date().toISOString(),
      safeReasonCode: 'source_readback_digest_mismatch'
    });
    return buildNormalDailySourceSyncResult_({
      status: 'blocked',
      blockedReason: 'source_readback_digest_mismatch',
      sourceRowsRequested: validation.rowCount,
      sourceRowsWritten: validation.rowCount,
      sourceRowsReadBack: Math.max(0, readBack.length - 1),
      sourceDigestMatch
    });
  }
  if (Date.now() - startedAtMs > GMAIL_DAILY_SOURCE_SYNC_COMMIT_START_DEADLINE_MS) {
    return blockNormalDailySourceSync_(payload, validation, 'source_sync_soft_deadline_exceeded');
  }
  return commitNormalDailySourceStaging_(spreadsheet, payload, validation, sourceDigest, startedAtMs);
}

function commitNormalDailySourceStaging_(spreadsheet, payload, validation, sourceDigest, startedAtMs) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return blockNormalDailySourceSync_(payload, validation, 'source_sync_commit_lock_unavailable');
  }
  let sourceSheet = null;
  try {
    if (Date.now() - startedAtMs > GMAIL_DAILY_SOURCE_SYNC_COMMIT_START_DEADLINE_MS) {
      return blockNormalDailySourceSync_(payload, validation, 'source_sync_soft_deadline_exceeded');
    }
    const staging = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_STAGING_TAB_NAME);
    if (!staging) return blockNormalDailySourceSync_(payload, validation, 'source_sync_staging_missing');
    deleteSheetIfExists_(spreadsheet, GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME);
    sourceSheet = spreadsheet.getSheetByName(validation.sourceTabName);
    if (sourceSheet) {
      sourceSheet.setName(GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME);
    }
    staging.setName(validation.sourceTabName);
    const props = PropertiesService.getScriptProperties();
    props.setProperties({
      GMAIL_DAILY_SOURCE_TAB_NAME: validation.sourceTabName,
      [normalDailySourceSyncStateKey_(payload)]: JSON.stringify({
        status: 'committed',
        targetDate: validation.targetDate,
        candidateCount: validation.rowCount,
        bodyDigest: String(payload.bodyDigest || ''),
        sourceDigest,
        completedAt: new Date().toISOString(),
        safeReasonCode: ''
      })
    });
    const committedStatus = inspectNormalDailySourceSyncStatus_(payload, validation, sourceDigest);
    if (!committedStatus.requestCommitted) {
      rollbackNormalDailySource_(spreadsheet, validation.sourceTabName);
      return blockNormalDailySourceSync_(payload, validation, committedStatus.blockedReason || 'source_commit_verification_failed');
    }
    deleteSheetIfExists_(spreadsheet, GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME);
    return buildNormalDailySourceSyncResult_(Object.assign(committedStatus, {
      ok: true,
      status: 'pass',
      sourceTabCommitted: true,
      propertyWriteCount: 1,
      flushCount: 1,
      lockTimeoutMs: 5000
    }));
  } catch (error) {
    rollbackNormalDailySource_(spreadsheet, validation.sourceTabName);
    return blockNormalDailySourceSync_(payload, validation, 'source_sync_commit_failed');
  } finally {
    lock.releaseLock();
  }
}

function rollbackNormalDailySource_(spreadsheet, sourceTabName) {
  const source = spreadsheet.getSheetByName(sourceTabName);
  const backup = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME);
  if (source && backup) spreadsheet.deleteSheet(source);
  if (backup) backup.setName(sourceTabName);
}

function blockNormalDailySourceSync_(payload, validation, reason) {
  writeNormalDailySourceSyncState_(payload, {
    status: 'failed',
    targetDate: validation.targetDate,
    candidateCount: validation.rowCount,
    bodyDigest: String(payload.bodyDigest || ''),
    completedAt: new Date().toISOString(),
    safeReasonCode: reason
  });
  return buildNormalDailySourceSyncResult_({
    status: 'blocked',
    blockedReason: reason,
    sourceRowsRequested: validation.rowCount,
    sourceTabCommitted: false,
    propertyConfigured: false
  });
}

function inspectNormalDailySourceSyncStatus_(payload, validation, expectedDigest) {
  const config = getConfig_();
  const spreadsheet = config.sheetId ? SpreadsheetApp.openById(config.sheetId) : null;
  const source = spreadsheet ? spreadsheet.getSheetByName(validation.sourceTabName) : null;
  const staging = spreadsheet ? spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_STAGING_TAB_NAME) : null;
  const backup = spreadsheet ? spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME) : null;
  const values = source ? source.getRange(1, 1, Math.max(1, source.getLastRow()), Math.max(1, source.getLastColumn())).getValues() : [];
  const sourceRows = Math.max(0, values.length - 1);
  const sourceDigestMatch = Boolean(source && sourceRows === validation.rowCount && normalDailySourceDigest_(values) === expectedDigest);
  const propName = String(PropertiesService.getScriptProperties().getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || '').trim();
  const propertyConfigured = propName === validation.sourceTabName;
  return {
    ok: sourceDigestMatch && propertyConfigured,
    status: sourceDigestMatch && propertyConfigured ? 'pass' : 'blocked',
    blockedReason: sourceDigestMatch && propertyConfigured ? '' : 'source_commit_verification_failed',
    sourceRowsRequested: validation.rowCount,
    sourceRowsWritten: sourceRows,
    sourceRowsReadBack: sourceRows,
    sourceDigestMatch,
    propertyConfigured,
    requestCommitted: sourceDigestMatch && propertyConfigured,
    sourceTabCommitted: sourceDigestMatch && propertyConfigured,
    sourceTabExists: Boolean(source),
    stagingTabExists: Boolean(staging),
    backupTabExists: Boolean(backup),
    sourceHeaderColumnCount: values.length ? values[0].length : 0,
    gmailSendExecuted: false,
    sendTargetSheetUpdated: false,
    triggerChanged: false
  };
}

function normalDailySourceDigest_(values) {
  return sha256Hex_(JSON.stringify(values || []));
}

function normalDailySourceSyncStateKey_(payload) {
  return GMAIL_DAILY_SOURCE_SYNC_STATE_PREFIX + hashValue_(String(payload && payload.requestId || ''));
}

function readNormalDailySourceSyncState_(payload) {
  const raw = String(PropertiesService.getScriptProperties().getProperty(normalDailySourceSyncStateKey_(payload)) || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeNormalDailySourceSyncState_(payload, state) {
  PropertiesService.getScriptProperties().setProperty(normalDailySourceSyncStateKey_(payload), JSON.stringify(state || {}));
}

function deleteSheetIfExists_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (sheet) spreadsheet.deleteSheet(sheet);
}

function inspectGmailNormalDailySourceStateSafe() {
  const config = getConfig_();
  const props = PropertiesService.getScriptProperties();
  let spreadsheet = null;
  let source = null;
  let staging = null;
  let backup = null;
  if (config.sheetId) {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
    source = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT);
    staging = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_STAGING_TAB_NAME);
    backup = spreadsheet.getSheetByName(GMAIL_DAILY_SOURCE_BACKUP_TAB_NAME);
  }
  const sourceRowCount = source ? Math.max(0, Number(source.getLastRow ? source.getLastRow() : 0) - 1) : 0;
  const stagingRowCount = staging ? Math.max(0, Number(staging.getLastRow ? staging.getLastRow() : 0) - 1) : 0;
  const backupRowCount = backup ? Math.max(0, Number(backup.getLastRow ? backup.getLastRow() : 0) - 1) : 0;
  const triggers = ScriptApp.getProjectTriggers ? ScriptApp.getProjectTriggers() : [];
  const normalTriggerCount = triggers.filter((trigger) => String(trigger.getHandlerFunction && trigger.getHandlerFunction() || '') === 'runGmailSalesDailyAutomationTrigger').length;
  const duplicateTriggerCount = Math.max(0, normalTriggerCount - 1);
  const forbiddenTriggerCount = triggers.filter((trigger) => GMAIL_DAILY_FORBIDDEN_TRIGGER_HANDLERS.indexOf(String(trigger.getHandlerFunction && trigger.getHandlerFunction() || '')) !== -1).length;
  const result = {
    event: 'gmail_normal_daily_source_state_inspection',
    sourceTabName: GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT,
    sourceTabExists: Boolean(source),
    sourceDataRowCount: sourceRowCount,
    sourceHeaderColumnCount: source ? Number(source.getLastColumn ? source.getLastColumn() : 0) : 0,
    recommendedRowCountMet: sourceRowCount >= GMAIL_DAILY_SOURCE_RECOMMENDED_SYNC_COUNT,
    propertyPresent: Boolean(String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || '').trim()),
    propertyMatchesSourceTab: String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || '').trim() === GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT,
    stagingTabExists: Boolean(staging),
    stagingDataRowCount: stagingRowCount,
    backupTabExists: Boolean(backup),
    backupDataRowCount: backupRowCount,
    automationMasterEnabled: String(props.getProperty('AUTOMATION_MASTER_ENABLED') || '').toLowerCase() === 'true',
    autoSendEnabled: String(props.getProperty('AUTO_SEND_ENABLED') || '').toLowerCase() === 'true',
    liveSendAtRest: String(props.getProperty('LIVE_SEND_ENABLED') || '').toLowerCase() !== 'true',
    normalTriggerCount,
    duplicateTriggerCount,
    forbiddenTriggerCount,
    gmailSendExecuted: false,
    sheetUpdated: false,
    propertyChanged: false,
    triggerChanged: false
  };
  console.log(JSON.stringify(result));
  return result;
}

function inspectGmailNormalDailySourceSyncRequestSafe() {
  const props = PropertiesService.getScriptProperties();
  const keys = Object.keys(props.getProperties ? props.getProperties() : {}).filter((key) => key.indexOf(GMAIL_DAILY_SOURCE_SYNC_STATE_PREFIX) === 0).sort();
  let state = {};
  if (keys.length) {
    try {
      state = JSON.parse(String(props.getProperty(keys[keys.length - 1]) || '{}'));
    } catch (error) {
      state = { status: 'failed', safeReasonCode: 'sync_state_invalid_json' };
    }
  }
  const result = {
    event: 'gmail_normal_daily_source_sync_request_inspection',
    status: String(state.status || ''),
    blockedReason: String(state.safeReasonCode || ''),
    targetDate: String(state.targetDate || ''),
    expectedCandidateCount: Number(state.candidateCount || 0),
    requestCommitted: String(state.status || '') === 'committed',
    gmailSendExecuted: false,
    sheetUpdated: false,
    propertyChanged: false,
    triggerChanged: false
  };
  console.log(JSON.stringify(result));
  return result;
}

function buildNormalDailySourceSyncResult_(overrides) {
  return Object.assign({
    ok: false,
    action: 'sync_normal_daily_source',
    status: 'blocked',
    blockedReason: '',
    sourceTabCreated: false,
    sourceRowsRequested: 0,
    sourceRowsWritten: 0,
    sourceRowsReadBack: 0,
    sourceDigestMatch: false,
    propertyConfigured: false,
    propertyWriteCount: 0,
    gmailSendExecuted: false,
    sendTargetSheetUpdated: false,
    triggerChanged: false
  }, overrides || {});
}

function sourceDomainFromRow_(row) {
  const raw = String(row.sourceUrl || row.publicSource || '').trim();
  try {
    return raw ? new URL(raw).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch (error) {
    return '';
  }
}

function normalDailySourceRow_(row, targetDate, sendBatchId) {
  const source = {};
  GMAIL_SHEET_SYNC_OUTBOX_HEADERS.forEach((header) => {
    source[header] = row[header] || '';
  });
  source.email = source.email || row.email || row.contactEmail || '';
  source.contactEmail = source.contactEmail || source.email;
  source.name = source.name || row.name || '';
  source.subject = source.subject || row.subject || '';
  source.body = source.body || row.body || '';
  source.status = 'ready';
  source.sendDate = targetDate;
  source.nextActionDate = source.nextActionDate || targetDate;
  source.sendBatchId = sendBatchId;
  source.dedupeKey = source.dedupeKey || [source.email, source.name].join('|');
  return source;
}

function loadNormalDailySourceRows_(config, validation) {
  const sourceItems = loadNormalDailySourceItems_(config);
  const uniqueItems = dedupeNormalDailySourceItems_(sourceItems.items);
  const mappedRows = uniqueItems.map((item) => normalDailySourceRow_(item.row, validation.targetDate, validation.sendBatchId));
  const start = validation.offset;
  const end = Math.min(mappedRows.length, start + validation.pageSize, validation.requestedSourceCount);
  const rows = mappedRows.slice(start, end);
  const hasMore = end < Math.min(mappedRows.length, validation.requestedSourceCount);
  return {
    rows,
    availableSourceCount: mappedRows.length,
    hasMore,
    nextCursor: hasMore ? String(end) : '',
    recoveryEntryCount: sourceItems.recoveryEntryCount
  };
}

function loadNormalDailySourceItems_(config) {
  if (!config.sheetId) return { items: [], recoveryEntryCount: 0 };
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sourceNames = configuredNormalDailySourceSheetNames_(config);
  const sheets = [];
  if (typeof spreadsheet.getSheets === 'function') {
    spreadsheet.getSheets().forEach((sheet) => {
      const name = String(sheet.getName ? sheet.getName() : '').trim();
      if (shouldUseNormalDailySourceSheet_(name, config, sourceNames) && looksLikeCandidateSheet_(sheet)) sheets.push(sheet);
    });
  }
  sourceNames.forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name);
    if (sheet && sheets.indexOf(sheet) === -1 && looksLikeCandidateSheet_(sheet)) sheets.push(sheet);
  });

  const items = [];
  let recoveryEntryCount = 0;
  sheets.forEach((sheet) => {
    const sheetName = String(sheet.getName ? sheet.getName() : '').trim();
    if (isRecoverySheetName_(sheetName, config)) {
      recoveryEntryCount += Math.max(0, Number(sheet.getLastRow ? sheet.getLastRow() : 0) - 1);
      return;
    }
    loadRowsFromSheet_(sheet).forEach((item) => {
      if (isNormalDailySourceCandidate_(item.row)) {
        item.sourceSheetName = sheetName;
        items.push(item);
      }
    });
  });
  items.sort((left, right) => normalDailySourceRank_(left.row).localeCompare(normalDailySourceRank_(right.row)));
  return { items, recoveryEntryCount };
}

function configuredNormalDailySourceSheetNames_(config) {
  const props = PropertiesService.getScriptProperties();
  const explicit = uniqueArray_([
    props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME'),
    props.getProperty('GMAIL_SHEET_SOURCE_TAB_NAME'),
    props.getProperty('GMAIL_SHEET_CANDIDATE_SOURCE_TAB_NAME'),
    props.getProperty('GMAIL_SHEET_POOL_TAB_NAME')
  ].map((value) => String(value || '').trim()).filter(Boolean));
  if (explicit.length > 0) return explicit;
  return [];
}

function shouldUseNormalDailySourceSheet_(name, config, sourceNames) {
  if (!name) return false;
  if (isRecoverySheetName_(name, config)) return false;
  if (name === getMaintenanceSheetName_()) return false;
  if (sourceNames.length > 0) return sourceNames.indexOf(name) !== -1;
  return name !== config.sheetName;
}

function isRecoverySheetName_(name, config) {
  return Boolean(name && (
    name === config.recoverySheetName ||
    name.toLowerCase().indexOf('recovery') !== -1
  ));
}

function looksLikeCandidateSheet_(sheet) {
  if (!sheet || Number(sheet.getLastRow ? sheet.getLastRow() : 0) < 2 || Number(sheet.getLastColumn ? sheet.getLastColumn() : 0) < 1) return false;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value || ''));
  const hasEmail = header.indexOf('email') !== -1 || header.indexOf('contactEmail') !== -1 || header.indexOf('宛先メール') !== -1 || header.indexOf('メール') !== -1;
  const hasName = header.indexOf('name') !== -1 || header.indexOf('店舗名') !== -1;
  const hasSubject = header.indexOf('subject') !== -1 || header.indexOf('件名') !== -1;
  const hasBody = header.indexOf('body') !== -1 || header.indexOf('本文') !== -1;
  return hasEmail && hasName && hasSubject && hasBody;
}

function loadRowsFromSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  const header = values[0].map((value) => String(value || ''));
  return values.slice(1).map((rowValues, index) => {
    const row = {};
    header.forEach((key, columnIndex) => {
      row[key] = rowValues[columnIndex];
    });
    row.email = row.email || row['宛先メール'] || row['メール'];
    row.contactEmail = row.contactEmail || row['連絡先メール'];
    row.name = row.name || row['店舗名'];
    row.subject = row.subject || row['件名'];
    row.body = row.body || row['本文'];
    return { row, rowIndex: index + 2 };
  });
}

function isNormalDailySourceCandidate_(row) {
  const status = String(row.status || '').trim().toLowerCase();
  if (status && ['sent', '送信済', 'blocked', 'manual_review_required', 'delivery_unknown', 'unsubscribed'].indexOf(status) !== -1) return false;
  if (shouldSkipRecipient_(row)) return false;
  if (hasSheetSentHistory_(row)) return false;
  return true;
}

function dedupeNormalDailySourceItems_(items) {
  const seen = {};
  const unique = [];
  (items || []).forEach((item) => {
    const row = item.row || {};
    const identity = [
      String(row.prospectId || '').trim().toLowerCase(),
      String(row.dedupeKey || '').trim().toLowerCase(),
      normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール'])
    ].filter(Boolean).join('|');
    if (!identity || seen[identity]) return;
    seen[identity] = true;
    unique.push(item);
  });
  return unique;
}

function normalDailySourceRank_(row) {
  return [
    String(row.lastCheckedAt || ''),
    String(row.prospectId || ''),
    String(row.dedupeKey || ''),
    normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール'])
  ].join('|');
}

function gmailDailyWebhookBodyMaterial_(payload) {
  if (String(payload && payload.action || '') === 'read_normal_daily_source') {
    return JSON.stringify({
      action: payload && payload.action,
      targetDate: payload && payload.targetDate,
      sendBatchId: payload && payload.sendBatchId,
      expectedCount: payload && payload.expectedCount,
      requestedSourceCount: payload && payload.requestedSourceCount,
      pageSize: payload && payload.pageSize,
      cursor: payload && payload.cursor,
      mode: payload && payload.mode,
      sourceType: payload && payload.sourceType,
      automationVersion: payload && payload.automationVersion,
      autoApprovalPolicyVersion: payload && payload.autoApprovalPolicyVersion
    });
  }
  if (String(payload && payload.action || '') === 'sync_normal_daily_source') {
    return JSON.stringify({
      action: payload && payload.action,
      targetDate: payload && payload.targetDate,
      sourceTabName: payload && payload.sourceTabName,
      candidateCount: payload && payload.candidateCount,
      verifiedCandidateCount: payload && payload.verifiedCandidateCount,
      sourceVerificationStatus: payload && payload.sourceVerificationStatus,
      headers: payload && payload.headers,
      rows: payload && payload.rows,
      mode: payload && payload.mode,
      sourceType: payload && payload.sourceType,
      dryRun: payload && payload.dryRun,
      automationVersion: payload && payload.automationVersion,
      autoApprovalPolicyVersion: payload && payload.autoApprovalPolicyVersion
    });
  }
  if (String(payload && payload.action || '') === 'get_normal_daily_source_sync_status') {
    return JSON.stringify({
      action: payload && payload.action,
      targetDate: payload && payload.targetDate,
      requestId: payload && payload.requestId,
      sourceBodyDigest: payload && payload.sourceBodyDigest,
      sourceDigest: payload && payload.sourceDigest,
      expectedCandidateCount: payload && payload.expectedCandidateCount,
      sourceTabName: payload && payload.sourceTabName,
      mode: payload && payload.mode,
      sourceType: payload && payload.sourceType,
      automationVersion: payload && payload.automationVersion,
      autoApprovalPolicyVersion: payload && payload.autoApprovalPolicyVersion
    });
  }
  return JSON.stringify({
    action: payload && payload.action,
    targetDate: payload && payload.targetDate,
    sendBatchId: payload && payload.sendBatchId,
    candidateCount: payload && payload.candidateCount,
    manifest: payload && payload.manifest,
    headers: payload && payload.headers,
    rows: payload && payload.rows
  });
}

function handleRecoverySingleSheetSync_(payload) {
  const validation = validateRecoverySingleSheetSyncPayload_(payload);
  const result = buildRecoverySingleSheetSyncResult_({
    status: validation.ok ? 'blocked' : 'blocked',
    targetDate: validation.targetDate,
    candidateCount: validation.candidateCount,
    blockedReason: validation.blockedReason,
    errorCode: validation.blockedReason,
    validationPassed: false,
    dryRun: payload && payload.dryRun === true
  });
  if (!validation.ok) {
    appendSafeLog_({
      event: 'gmail_sheet_sync_recovery_single_rejected',
      targetDate: validation.targetDate,
      candidateCount: validation.candidateCount,
      blockedReason: validation.blockedReason
    });
    return buildSheetSyncResponse_(result);
  }

  const config = getConfig_();
  const tabName = resolveRecoverySingleSheetName_(payload, config);
  if (!config.sheetId) {
    result.blockedReason = 'missing_sheet_id';
    result.errorCode = 'missing_sheet_id';
    return buildSheetSyncResponse_(result);
  }
  if (!tabName) {
    result.blockedReason = 'recovery_tab_name_missing';
    result.errorCode = 'recovery_tab_name_missing';
    return buildSheetSyncResponse_(result);
  }

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
  } catch (error) {
    result.blockedReason = 'sheet_open_failed';
    result.errorCode = 'sheet_open_failed';
    return buildSheetSyncResponse_(result);
  }
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    result.blockedReason = 'recovery_target_sheet_missing';
    result.errorCode = 'recovery_target_sheet_missing';
    return buildSheetSyncResponse_(result);
  }

  const sheetState = inspectRecoverySingleTargetSheet_(sheet, validation.headers, validation.row);
  Object.assign(result, {
    validationPassed: sheetState.ok,
    intendedWriteCount: sheetState.intendedWriteCount,
    alreadyApplied: sheetState.alreadyApplied,
    conflict: sheetState.conflict,
    blockedReason: sheetState.blockedReason,
    errorCode: sheetState.blockedReason
  });
  if (!sheetState.ok) {
    appendSafeLog_({
      event: 'gmail_sheet_sync_recovery_single_rejected',
      targetDate: validation.targetDate,
      candidateCount: validation.candidateCount,
      blockedReason: sheetState.blockedReason
    });
    return buildSheetSyncResponse_(result);
  }

  if (payload.dryRun === true || sheetState.intendedWriteCount === 0) {
    Object.assign(result, {
      ok: true,
      status: 'pass',
      validationPassed: true,
      actualWriteCount: 0,
      sheetUpdated: false,
      blockedReason: '',
      errorCode: ''
    });
    appendSafeLog_({
      event: 'gmail_sheet_sync_recovery_single_validated',
      targetDate: validation.targetDate,
      candidateCount: validation.candidateCount,
      intendedWriteCount: sheetState.intendedWriteCount,
      dryRun: payload.dryRun === true
    });
    return buildSheetSyncResponse_(result);
  }

  sheet.getRange(sheetState.nextRowIndex, 1, 1, validation.headers.length).setValues([validation.row]);
  SpreadsheetApp.flush();
  Object.assign(result, {
    ok: true,
    status: 'pass',
    validationPassed: true,
    actualWriteCount: 1,
    sheetUpdated: true,
    blockedReason: '',
    errorCode: ''
  });
  appendSafeLog_({
    event: 'gmail_sheet_sync_recovery_single_written',
    targetDate: validation.targetDate,
    candidateCount: validation.candidateCount,
    actualWriteCount: 1
  });
  return buildSheetSyncResponse_(result);
}

function handleConnectedSheetSyncDryRun_(payload, validation) {
  const result = buildConnectedSheetSyncDryRunResult_({
    status: 'blocked',
    sendDate: validation.sendDate,
    sendBatchId: validation.sendBatchId,
    incomingHeaderCount: Array.isArray(payload.headers) ? payload.headers.length : 0,
    incomingCandidateCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
    schemaValid: validation.ok,
    requiredHeadersPresent: sheetSyncRequiredHeadersPresent_(payload.headers),
    incomingDuplicateCount: validation.safeCounts.duplicateInPayloadCount || 0,
    blockedReason: validation.ok ? '' : validation.blockedReason
  });

  if (!validation.ok) {
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  const config = getConfig_();
  if (!config.sheetId) {
    result.blockedReason = 'missing_sheet_id';
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  const targetSheetName = resolveSheetSyncTargetName_(payload, config);
  result.targetWorksheetResolved = Boolean(targetSheetName);
  if (!targetSheetName) {
    result.blockedReason = 'missing_sheet_name';
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
    result.connectedToGoogleSheet = true;
  } catch (error) {
    result.blockedReason = 'spreadsheet_open_failed';
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  const sheet = spreadsheet.getSheetByName(targetSheetName);
  result.targetWorksheetExists = Boolean(sheet);
  if (!sheet) {
    result.blockedReason = 'target_sheet_missing';
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  const lastRow = Math.max(0, Number(sheet.getLastRow() || 0));
  const lastColumn = Math.max(0, Number(sheet.getLastColumn() || 0));
  const values = lastRow > 0 && lastColumn > 0
    ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
    : [];
  const existingHeaders = values[0] ? values[0].map((value) => String(value || '').trim()) : [];
  const existingRows = values.slice(1);
  result.currentHeaderCount = existingHeaders.filter(Boolean).length;
  result.currentRowCount = existingRows.length;

  if (existingRows.length > 0 && !sheetSyncHasIdentityHeaders_(existingHeaders)) {
    result.blockedReason = 'existing_identity_header_missing';
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  const comparison = compareSheetSyncRows_(payload.headers, payload.rows, existingHeaders, existingRows);
  Object.assign(result, comparison.safeCounts);
  if (comparison.blockedReason) {
    result.blockedReason = comparison.blockedReason;
    appendSafeLog_(result);
    return buildSheetSyncResponse_(result);
  }

  result.status = 'pass';
  result.ok = true;
  result.blockedReason = '';
  appendSafeLog_(result);
  return buildSheetSyncResponse_(result);
}

function handleSheetSyncReadOnlySnapshot_(payload, validation) {
  const result = buildConnectedSheetSyncDryRunResult_({
    event: 'gmail_sheet_sync_read_only_snapshot',
    mode: 'read_only_snapshot',
    status: 'blocked',
    sendDate: validation.sendDate,
    sendBatchId: validation.sendBatchId,
    incomingHeaderCount: Array.isArray(payload.headers) ? payload.headers.length : 0,
    incomingCandidateCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
    schemaValid: validation.ok,
    requiredHeadersPresent: sheetSyncRequiredHeadersPresent_(payload.headers),
    incomingDuplicateCount: validation.safeCounts.duplicateInPayloadCount || 0,
    blockedReason: validation.ok ? '' : validation.blockedReason,
    headers: [],
    rows: []
  });

  if (!validation.ok) {
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  const config = getConfig_();
  if (!config.sheetId) {
    result.blockedReason = 'missing_sheet_id';
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  const targetSheetName = resolveSheetSyncTargetName_(payload, config);
  result.targetWorksheetResolved = Boolean(targetSheetName);
  if (!targetSheetName) {
    result.blockedReason = 'missing_sheet_name';
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
    result.connectedToGoogleSheet = true;
  } catch (error) {
    result.blockedReason = 'spreadsheet_open_failed';
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  const sheet = spreadsheet.getSheetByName(targetSheetName);
  result.targetWorksheetExists = Boolean(sheet);
  if (!sheet) {
    result.blockedReason = 'target_sheet_missing';
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  const lastRow = Math.max(0, Number(sheet.getLastRow() || 0));
  const lastColumn = Math.max(0, Number(sheet.getLastColumn() || 0));
  const values = lastRow > 0 && lastColumn > 0
    ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
    : [];
  const existingHeaders = values[0] ? values[0].map((value) => String(value || '').trim()) : [];
  const existingRows = values.slice(1).map((row) => existingHeaders.map((_, index) => String(row[index] || '')));
  result.headers = existingHeaders;
  result.rows = existingRows;
  result.currentHeaderCount = existingHeaders.filter(Boolean).length;
  result.currentRowCount = existingRows.length;

  if (existingRows.length > 0 && !sheetSyncHasIdentityHeaders_(existingHeaders)) {
    result.blockedReason = 'existing_identity_header_missing';
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  const comparison = compareSheetSyncRows_(payload.headers, payload.rows, existingHeaders, existingRows);
  Object.assign(result, comparison.safeCounts);
  if (comparison.blockedReason) {
    result.blockedReason = comparison.blockedReason;
    appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
    return buildSheetSyncResponse_(result);
  }

  result.status = 'pass';
  result.ok = true;
  result.blockedReason = '';
  appendSafeLog_(sheetSyncSnapshotSafeLog_(result));
  return buildSheetSyncResponse_(result);
}

function sheetSyncSnapshotSafeLog_(result) {
  const safe = Object.assign({}, result || {});
  delete safe.headers;
  delete safe.rows;
  return safe;
}

function buildConnectedSheetSyncDryRunResult_(overrides) {
  return Object.assign({
    ok: false,
    event: 'gmail_sheet_sync_connected_dry_run',
    mode: 'connected_dry_run',
    status: 'blocked',
    blockedReason: '',
    connectedToGoogleSheet: false,
    targetWorksheetResolved: false,
    targetWorksheetExists: false,
    currentHeaderCount: 0,
    currentRowCount: 0,
    incomingHeaderCount: 0,
    incomingCandidateCount: 0,
    schemaValid: false,
    requiredHeadersPresent: false,
    existingDuplicateCount: 0,
    incomingDuplicateCount: 0,
    matchingIdentityCount: 0,
    wouldInsertCount: 0,
    wouldUpdateCount: 0,
    wouldSkipCount: 0,
    wouldDeleteCount: 0,
    wouldClearWorksheet: false,
    wouldWriteCount: 0,
    existingDataOverwriteRisk: false,
    unrelatedExistingRowCount: 0,
    maintenanceLeaseCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  }, overrides || {});
}

function resolveSheetSyncTargetName_(payload, config) {
  return String(
    payload.readyTabName ||
    payload.targetName ||
    PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_READY_TAB_NAME') ||
    PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_TARGET_NAME') ||
    config.sheetName ||
    ''
  ).trim();
}

function sheetSyncRequiredHeadersPresent_(headers) {
  const index = buildHeaderIndex_((headers || []).map((value) => String(value)));
  return ['email', 'contactEmail', 'subject', 'body', 'status', 'sendDate', 'sendBatchId'].every((key) => index[key] !== undefined);
}

function sheetSyncHasIdentityHeaders_(headers) {
  const index = buildHeaderIndex_((headers || []).map((value) => String(value)));
  return index.prospectId !== undefined || index.dedupeKey !== undefined || index.email !== undefined || index.contactEmail !== undefined;
}

function compareSheetSyncRows_(incomingHeaders, incomingRows, existingHeaders, existingRows) {
  const incomingIndex = buildHeaderIndex_(incomingHeaders || []);
  const existingIndex = buildHeaderIndex_(existingHeaders || []);
  const incomingMap = {};
  const existingMap = {};
  const safeCounts = {
    existingDuplicateCount: 0,
    incomingDuplicateCount: 0,
    matchingIdentityCount: 0,
    wouldInsertCount: 0,
    wouldUpdateCount: 0,
    wouldSkipCount: 0,
    wouldDeleteCount: 0,
    wouldClearWorksheet: false,
    wouldWriteCount: 0,
    existingDataOverwriteRisk: false,
    unrelatedExistingRowCount: 0
  };

  if (!sheetSyncHasIdentityHeaders_(incomingHeaders)) {
    return { blockedReason: 'incoming_identity_header_missing', safeCounts };
  }

  for (let index = 0; index < incomingRows.length; index += 1) {
    const cells = Array.isArray(incomingRows[index]) ? incomingRows[index] : [];
    const identity = sheetSyncIdentity_(cells, incomingIndex);
    if (!identity) return { blockedReason: 'incoming_identity_missing', safeCounts };
    if (incomingMap[identity]) safeCounts.incomingDuplicateCount += 1;
    incomingMap[identity] = cells;
  }
  if (safeCounts.incomingDuplicateCount > 0) {
    return { blockedReason: 'incoming_duplicate_identity', safeCounts };
  }

  for (let index = 0; index < existingRows.length; index += 1) {
    const cells = Array.isArray(existingRows[index]) ? existingRows[index] : [];
    const identity = sheetSyncIdentity_(cells, existingIndex);
    if (!identity) continue;
    if (existingMap[identity]) safeCounts.existingDuplicateCount += 1;
    existingMap[identity] = cells;
  }
  if (safeCounts.existingDuplicateCount > 0) {
    return { blockedReason: 'existing_duplicate_identity', safeCounts };
  }

  Object.keys(incomingMap).forEach((identity) => {
    const incomingCells = incomingMap[identity];
    const existingCells = existingMap[identity];
    if (!existingCells) {
      safeCounts.wouldInsertCount += 1;
      return;
    }
    safeCounts.matchingIdentityCount += 1;
    if (sheetSyncRowsEquivalent_(incomingHeaders, incomingCells, existingIndex, existingCells)) {
      safeCounts.wouldSkipCount += 1;
    } else {
      safeCounts.wouldUpdateCount += 1;
    }
  });

  Object.keys(existingMap).forEach((identity) => {
    if (!incomingMap[identity]) safeCounts.unrelatedExistingRowCount += 1;
  });
  safeCounts.wouldDeleteCount = safeCounts.unrelatedExistingRowCount;
  safeCounts.existingDataOverwriteRisk = safeCounts.unrelatedExistingRowCount > 0;
  safeCounts.wouldClearWorksheet = safeCounts.existingDataOverwriteRisk;
  safeCounts.wouldWriteCount = safeCounts.wouldInsertCount + safeCounts.wouldUpdateCount + safeCounts.wouldDeleteCount;
  return { blockedReason: '', safeCounts };
}

function sheetSyncIdentity_(cells, headerIndex) {
  const prospectId = String(cells[headerIndex.prospectId] || '').trim();
  if (prospectId) return 'prospect:' + prospectId.toLowerCase();
  const dedupeKey = String(cells[headerIndex.dedupeKey] || '').trim();
  if (dedupeKey) return 'dedupe:' + dedupeKey.toLowerCase();
  const email = normalizeEmail_(cells[headerIndex.email] || cells[headerIndex.contactEmail] || '');
  if (email) return 'email:' + email;
  return '';
}

function sheetSyncRowsEquivalent_(incomingHeaders, incomingCells, existingIndex, existingCells) {
  for (let index = 0; index < incomingHeaders.length; index += 1) {
    const header = String(incomingHeaders[index] || '');
    const existingColumn = existingIndex[header];
    if (existingColumn === undefined) return false;
    if (String(incomingCells[index] || '') !== String(existingCells[existingColumn] || '')) return false;
  }
  return true;
}

function validateRecoverySingleSheetSyncPayload_(payload) {
  const headers = Array.isArray(payload && payload.headers) ? payload.headers.map((value) => String(value)) : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const row = Array.isArray(rows[0]) ? rows[0].map((value) => String(value === undefined ? '' : value)) : [];
  const targetDate = normalizeDateText_((payload && payload.targetDate) || (payload && payload.sendDate) || '');
  const sourceType = String((payload && payload.sourceType) || '').trim();
  const sendBatchId = String((payload && payload.sendBatchId) || '').trim();
  const counters = (payload && payload.safetyCounters) || {};
  const errors = [];

  if (sourceType !== 'recovery_single') errors.push('source_type_not_recovery_single');
  if (!targetDate) errors.push('target_date_missing');
  if (targetDate !== '2026-06-20') errors.push('target_date_not_allowed_for_recovery_single');
  if (rows.length !== 1) errors.push('row_count_not_1');
  if (Number(payload && payload.candidateCount) !== 1) errors.push('candidate_count_not_1');
  if (Number((payload && payload.sheetRowCount) || (payload && payload.rowCount) || rows.length) !== 1) errors.push('sheet_row_count_not_1');
  if (String((payload && payload.approvalStatus) || '') !== 'approved') errors.push('approval_status_not_approved');
  if (!payload || payload.humanReviewCompleted !== true) errors.push('human_review_not_completed');
  if (Number(payload && payload.humanReviewedCount) !== 1) errors.push('human_review_count_not_1');
  if (!payload || payload.targetAutoApproved !== false) errors.push('target_auto_approved_not_false');
  if (!payload || payload.manifestCreated !== false) errors.push('manifest_already_created');
  if (!headersStrictlyMatch_(headers, GMAIL_SHEET_SYNC_OUTBOX_HEADERS)) errors.push('header_mismatch');
  if (hasDuplicateValues_(headers)) errors.push('duplicate_header');
  if (sendBatchId.indexOf('recovery') === -1) errors.push('send_batch_not_recovery');
  if (row.length !== headers.length) errors.push('row_width_mismatch');

  [
    'requiredFieldMissingCount',
    'personalizationInvalidCount',
    'recipientDuplicateCount',
    'domainDuplicateCount',
    'businessDuplicateCount',
    'suppressionMatchCount',
    'gmailSentMatchCount',
    'sheetHistoryMatchCount',
    'localHistoryMatchCount',
    'existingOutboxMatchCount',
    'june19SourceMatchCount',
    'june20ExistingTargetMatchCount'
  ].forEach((key) => {
    if (Number(counters[key] || 0) !== 0) errors.push(key + '_nonzero');
  });

  const rowObject = rowFromCells_(headers, row);
  if (!recoverySingleIdentity_(rowObject)) errors.push('identity_missing');
  if (normalizeDateText_(rowObject.sendDate) !== targetDate) errors.push('row_target_date_mismatch');
  if (String(rowObject.sendBatchId || '').trim() !== sendBatchId) errors.push('row_batch_mismatch');
  if (String(rowObject.status || '').trim().toLowerCase() !== 'ready') errors.push('row_status_not_ready');
  if (!normalizeEmail_(rowObject.email || rowObject.contactEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(rowObject.email || rowObject.contactEmail))) {
    errors.push('invalid_email');
  }
  if (!normalizeEmailSubject_(rowObject.subject) || !normalizeEmailBody_(rowObject.body)) errors.push('missing_subject_or_body');
  if (normalizeEmailBody_(rowObject.body).indexOf('不要') === -1) errors.push('missing_opt_out_text');

  return {
    ok: errors.length === 0,
    targetDate,
    candidateCount: rows.length,
    headers,
    row,
    rowObject,
    sendBatchId,
    blockedReason: errors[0] || '',
    errors
  };
}

function buildRecoverySingleSheetSyncResult_(overrides) {
  return Object.assign({
    ok: false,
    action: 'sync_recovery_single',
    mode: 'sync_recovery_single',
    targetDate: '',
    validationPassed: false,
    candidateCount: 0,
    intendedWriteCount: 0,
    actualWriteCount: 0,
    alreadyApplied: false,
    conflict: false,
    dryRun: true,
    sheetUpdated: false,
    errorCode: '',
    status: 'blocked',
    blockedReason: ''
  }, overrides || {});
}

function resolveRecoverySingleSheetName_(payload, config) {
  return String(
    (payload && payload.recoveryTabName) ||
    PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_RECOVERY_TAB_NAME') ||
    config.recoverySheetName ||
    ''
  ).trim();
}

function inspectRecoverySingleTargetSheet_(sheet, expectedHeaders, incomingRow) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return { ok: false, blockedReason: 'recovery_header_missing', intendedWriteCount: 0 };
  if (lastColumn !== expectedHeaders.length) return { ok: false, blockedReason: 'recovery_header_column_mismatch', intendedWriteCount: 0 };
  const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((value) => String(value || ''));
  if (!headersStrictlyMatch_(existingHeaders, expectedHeaders)) return { ok: false, blockedReason: 'recovery_header_mismatch', intendedWriteCount: 0 };
  if (hasDuplicateValues_(existingHeaders)) return { ok: false, blockedReason: 'recovery_duplicate_header', intendedWriteCount: 0 };

  const incomingIdentity = recoverySingleIdentity_(rowFromCells_(expectedHeaders, incomingRow));
  if (!incomingIdentity) return { ok: false, blockedReason: 'identity_missing', intendedWriteCount: 0 };

  const existingRows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
    : [];
  const matchingRows = existingRows.filter((cells) => {
    const row = rowFromCells_(existingHeaders, cells);
    return recoverySingleIdentity_(row) === incomingIdentity;
  });
  if (matchingRows.length > 1) return { ok: false, blockedReason: 'duplicate_conflict', conflict: true, intendedWriteCount: 0 };
  if (matchingRows.length === 1) {
    const same = recoverySingleRowsEquivalent_(expectedHeaders, matchingRows[0], incomingRow);
    if (same) {
      return { ok: true, blockedReason: '', alreadyApplied: true, conflict: false, intendedWriteCount: 0, nextRowIndex: lastRow + 1 };
    }
    return { ok: false, blockedReason: 'identity_conflict', conflict: true, intendedWriteCount: 0 };
  }

  return { ok: true, blockedReason: '', alreadyApplied: false, conflict: false, intendedWriteCount: 1, nextRowIndex: lastRow + 1 };
}

function recoverySingleRowsEquivalent_(headers, existingRow, incomingRow) {
  return headers.every((header, index) => {
    return canonicalRecoverySingleCell_(header, existingRow[index]) === canonicalRecoverySingleCell_(header, incomingRow[index]);
  });
}

function canonicalRecoverySingleCell_(header, value) {
  const key = String(header || '');
  if (key === 'email' || key === 'contactEmail') return normalizeEmail_(value);
  if (key === 'subject') return normalizeEmailSubject_(value);
  if (key === 'body') return normalizeEmailBody_(value);
  if (key === 'sendDate' || key === 'nextActionDate') return normalizeDateText_(value);
  if (key === 'doNotContact') return normalizeBooleanLikeSheetCell_(value);
  return normalizeSheetComparableText_(value);
}

function normalizeSheetComparableText_(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return normalizeDateText_(value);
  return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeBooleanLikeSheetCell_(value) {
  if (value === true) return 'true';
  if (value === false || value === null || value === undefined) return '';
  const text = String(value).trim().toLowerCase();
  if (!text || text === 'false' || text === '0' || text === 'no') return '';
  if (text === 'true' || text === '1' || text === 'yes') return 'true';
  return text;
}

function recoverySingleIdentity_(row) {
  const prospectId = String(row.prospectId || '').trim().toLowerCase();
  const dedupeKey = String(row.dedupeKey || '').trim().toLowerCase();
  const email = normalizeEmail_(row.email || row.contactEmail);
  if (prospectId) return 'prospect:' + prospectId;
  if (dedupeKey) return 'dedupe:' + dedupeKey;
  return email ? 'email:' + email : '';
}

function headersStrictlyMatch_(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((header, index) => actual[index] === header);
}

function hasDuplicateValues_(values) {
  const seen = {};
  return values.some((value) => {
    const key = String(value || '').trim();
    if (!key) return false;
    if (seen[key]) return true;
    seen[key] = true;
    return false;
  });
}

function validateSheetSyncPayload_(payload) {
  const headers = Array.isArray(payload && payload.headers) ? payload.headers.map((value) => String(value)) : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const sendDate = normalizeDateText_((payload && payload.sendDate) || '');
  const sendBatchId = String((payload && payload.sendBatchId) || '').trim();
  const rowCount = rows.length;
  const headerIndex = buildHeaderIndex_(headers);
  const expectedBatchId = sendDate ? buildSendBatchId_(sendDate) : '';
  const safeCounts = {
    validationErrorCount: 0,
    duplicateInPayloadCount: 0,
    invalidEmailCount: 0,
    sendDateMismatchCount: 0,
    sendBatchIdMismatchCount: 0,
    missingSubjectBodyCount: 0,
    missingOptOutTextCount: 0
  };
  const seenEmail = {};
  const errors = [];

  if (!sendDate) errors.push('missing_send_date');
  if (!sendBatchId) errors.push('missing_send_batch_id');
  if (rowCount !== 30) errors.push('row_count_not_30');
  ['email', 'contactEmail', 'subject', 'body', 'status', 'sendDate', 'sendBatchId'].forEach((key) => {
    if (headerIndex[key] === undefined) errors.push('missing_header_' + key);
  });
  if (sendBatchId && expectedBatchId && sendBatchId !== expectedBatchId && sendBatchId.indexOf(expectedBatchId + '-') !== 0) {
    errors.push('send_batch_id_not_for_send_date');
  }

  rows.forEach((rowValues) => {
    const cells = Array.isArray(rowValues) ? rowValues : [];
    const row = rowFromCells_(headers, cells);
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const rowStatus = String(row.status || '').toLowerCase();
    const rowSendDate = normalizeDateText_(row.sendDate || row['送信日']);
    const rowBatchId = String(row.sendBatchId || '').trim();
    const subject = normalizeEmailSubject_(row.subject || row['件名']);
    const body = normalizeEmailBody_(row.body || row['本文']);

    if (rowStatus !== 'ready') safeCounts.validationErrorCount += 1;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) safeCounts.invalidEmailCount += 1;
    if (email) {
      if (seenEmail[email]) safeCounts.duplicateInPayloadCount += 1;
      seenEmail[email] = true;
    }
    if (rowSendDate !== sendDate) safeCounts.sendDateMismatchCount += 1;
    if (rowBatchId !== sendBatchId) safeCounts.sendBatchIdMismatchCount += 1;
    if (!subject || !body) safeCounts.missingSubjectBodyCount += 1;
    if (!body || body.indexOf('不要') === -1) safeCounts.missingOptOutTextCount += 1;
  });

  Object.keys(safeCounts).forEach((key) => {
    if (safeCounts[key] > 0) errors.push(key);
  });

  return {
    ok: errors.length === 0,
    sendDate,
    sendBatchId,
    rowCount,
    payloadHash: hashValue_([sendDate, sendBatchId, rowCount, headers.length].join('|')),
    blockedReason: errors.join(','),
    safeCounts
  };
}

function writeGmailOutboxRowsToSheet_(payload, config) {
  if (!config.sheetId) {
    return { sheetSynced: false, blockedReason: 'missing_sheet_id' };
  }
  const headers = payload.headers.map((value) => String(value));
  const rows = payload.rows.map((rowValues) => {
    const cells = Array.isArray(rowValues) ? rowValues : [];
    return headers.map((_, index) => cells[index] === undefined ? '' : cells[index]);
  });
  const targetSheetName = String(
    payload.readyTabName ||
    PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_READY_TAB_NAME') ||
    PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_TARGET_NAME') ||
    config.sheetName ||
    'Gmail送信対象'
  );
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheet = spreadsheet.getSheetByName(targetSheetName) || spreadsheet.insertSheet(targetSheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length + 1, headers.length).setValues([headers].concat(rows));
  return { sheetSynced: true, blockedReason: '' };
}

function buildSheetSyncResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildHeaderIndex_(headers) {
  const index = {};
  headers.forEach((header, i) => {
    index[String(header)] = i;
  });
  return index;
}

function rowFromCells_(headers, cells) {
  const row = {};
  headers.forEach((header, index) => {
    row[header] = cells[index];
  });
  return row;
}

function runPreflightCheckOnly() {
  const result = runPreflight_(false);
  appendSafeLog_({
    event: 'preflight_check_only',
    currentJstDate: result.config.currentJstDate,
    expectedSendDate: result.config.sendDate,
    expectedSendBatchId: result.batchId,
    sendDateSource: result.config.sendDateSource,
    sendBatchIdSource: result.config.sendBatchIdSource,
    staleSendDate: result.config.staleSendDate,
    staleBatchId: result.config.staleBatchId,
    dryRun: result.dryRun,
    liveSendEnabled: result.liveSendEnabled,
    autoSendEnabled: result.config.autoSendEnabled,
    dailySendLimit: result.dailySendLimit,
    remainingQuota: result.remainingQuota,
    targetCount: result.targetCount,
    readyCount: result.readyCount,
    blockedReason: result.blockedReason,
    sheetConnected: result.sheetConnected,
    safeToSend: false,
    publishAllowed: result.publishAllowed,
    canPrepareOutbox: result.canPrepareOutbox,
    canSendToday: result.canSendToday,
    recommendedNextAction: result.recommendedNextAction
  });
}

function runPreflightDiagnosticsOnly() {
  const production = validateProductionConfig_();
  const config = production.config;
  const batchId = buildSendBatchId_(config.sendDate);
  let rows = [];
  let sheetConnected = false;
  let loadFailed = false;

  try {
    rows = loadCandidateRows_(config);
    sheetConnected = Boolean(config.sheetId && config.sheetName);
  } catch (error) {
    loadFailed = true;
  }

  const summary = buildPreflightDiagnosticsSummary_(rows, config, batchId);
  appendSafeLog_(Object.assign({
    event: 'preflight_diagnostics_only',
    currentJstDate: config.currentJstDate,
    targetCount: Math.min(config.dailySendLimit, 30),
    sheetConnected,
    sheetLoadFailed: loadFailed,
    expectedSendDate: config.sendDate,
    expectedSendBatchId: batchId,
    sendDateSource: config.sendDateSource,
    sendBatchIdSource: config.sendBatchIdSource,
    staleSendDate: config.staleSendDate,
    staleBatchId: config.staleBatchId,
    dryRun: config.dryRun,
    liveSendEnabled: config.liveSendEnabled,
    autoSendEnabled: config.autoSendEnabled,
    publishAllowed: !config.dryRun && config.liveSendEnabled && config.autoSendEnabled,
    canPrepareOutbox: summary.readyRows === Math.min(config.dailySendLimit, 30),
    canSendToday: summary.readyRows === Math.min(config.dailySendLimit, 30) && !config.dryRun && config.liveSendEnabled,
    blockedReason: buildDiagnosticsBlockedReason_(summary, config, batchId),
    recommendedNextAction: buildRecommendedNextAction_(
      buildDiagnosticsBlockedReason_(summary, config, batchId),
      summary.readyRows,
      Math.min(config.dailySendLimit, 30),
      config
    )
  }, summary));
}

function runBatchApprovalChecksumPreviewOnly() {
  const preflight = runPreflight_(false);
  const checksum = calculateBatchApprovalChecksum_(preflight.config, preflight.batchId, preflight.readyRows);
  appendSafeLog_({
    event: 'batch_approval_checksum_preview_only',
    sendDate: preflight.config.sendDate,
    sendBatchId: preflight.batchId,
    readyCount: preflight.readyCount,
    targetCount: preflight.targetCount,
    approvalChecksum: checksum,
    gmailSendExecuted: false,
    googleSheetsUpdated: false
  });
  return {
    sendDate: preflight.config.sendDate,
    sendBatchId: preflight.batchId,
    readyCount: preflight.readyCount,
    targetCount: preflight.targetCount,
    approvalChecksum: checksum
  };
}

function runSentHistoryIncidentAuditOnly() {
  const config = getConfig_();
  const incidentConfig = getSentHistoryIncidentConfig_();
  const query = buildSentHistoryIncidentQuery_(incidentConfig);
  const threads = GmailApp.search(query, 0, incidentConfig.maxThreads);
  const ledger = {};
  const dailyCounts = {};
  let totalSent = 0;
  let missingGreetingCount = 0;
  let outsideWindowCount = 0;
  let invalidNotCountedCount = 0;

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      if (!isIncidentAuditMessage_(message, incidentConfig)) {
        return;
      }

      const sentAt = message.getDate();
      const sentAtIso = sentAt.toISOString();
      const day = Utilities.formatDate(sentAt, incidentConfig.timezone, 'yyyy-MM-dd');
      const body = normalizeEmailBody_(message.getPlainBody() || '');
      const greetingName = extractGreetingName_(body);
      const greetingIssue = classifyGreetingIssue_(body, greetingName);
      const outsideWindow = isOutsideAllowedIncidentWindow_(sentAt, config, incidentConfig);
      const batchId = extractBatchIdFromSubjectOrBody_(message.getSubject(), body);
      const recipients = parseRecipientEmailsFromHeader_(message.getTo());

      recipients.forEach((email) => {
        const recipientHash = hashValue_(email);
        const domainHash = hashValue_(extractEmailDomain_(email));
        const businessFingerprint = hashValue_(normalizeTextForComparison_(greetingName || 'missing_greeting') + '|' + domainHash);
        const existing = ledger[recipientHash] || {
          recipientHash,
          normalizedDomainHash: domainHash,
          businessFingerprint,
          firstSentAt: sentAtIso,
          lastSentAt: sentAtIso,
          sendCount: 0,
          batchIds: [],
          deliveryStatus: 'sent',
          salesCompletionStatus: 'unverified',
          invalidReasons: {},
          suppressed: true,
          futureEligible: false
        };

        existing.sendCount += 1;
        existing.firstSentAt = sentAtIso < existing.firstSentAt ? sentAtIso : existing.firstSentAt;
        existing.lastSentAt = sentAtIso > existing.lastSentAt ? sentAtIso : existing.lastSentAt;
        if (batchId && existing.batchIds.indexOf(batchId) === -1) {
          existing.batchIds.push(batchId);
        }
        if (greetingIssue) {
          existing.invalidReasons[greetingIssue] = true;
        }
        if (outsideWindow) {
          existing.invalidReasons.outside_window = true;
        }
        ledger[recipientHash] = existing;
      });

      totalSent += recipients.length;
      dailyCounts[day] = (dailyCounts[day] || 0) + recipients.length;
      if (greetingIssue) {
        missingGreetingCount += recipients.length;
      }
      if (outsideWindow) {
        outsideWindowCount += recipients.length;
      }
    });
  });

  Object.keys(ledger).forEach((recipientHash) => {
    const entry = ledger[recipientHash];
    if (entry.sendCount > 1) {
      entry.invalidReasons.duplicate = true;
    }
    const invalidReasons = Object.keys(entry.invalidReasons);
    entry.invalidReasons = invalidReasons;
    entry.salesCompletionStatus = invalidReasons.length === 0 && entry.sendCount === 1
      ? 'valid_first_send'
      : 'invalid_not_counted';
    if (entry.salesCompletionStatus === 'invalid_not_counted') {
      invalidNotCountedCount += entry.sendCount;
    }
  });

  const recipientHashes = Object.keys(ledger);
  const duplicatedRecipients = recipientHashes.filter((hash) => ledger[hash].sendCount > 1).length;
  const maxSendCount = recipientHashes.reduce((max, hash) => Math.max(max, ledger[hash].sendCount), 0);
  const summary = {
    event: 'sent_history_incident_audit_only',
    sinceJst: incidentConfig.sinceJst,
    subjectHash: hashValue_(incidentConfig.subject),
    totalSent,
    uniqueRecipients: recipientHashes.length,
    duplicatedRecipients,
    duplicateRecipientCount: totalSent - recipientHashes.length,
    maxSendCount,
    missingGreetingCount,
    outsideWindowCount,
    invalidNotCountedCount,
    suppressedCount: recipientHashes.length,
    dailyCounts,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };

  storeSuppressionLedger_(ledger, summary);
  appendSafeLog_(summary);
  return summary;
}

function exportSentSuppressionLedgerSafeOnly() {
  const ledger = loadSuppressionLedgerFromProperties_();
  const entries = ledger.entries.map((entry) => ({
    recipientHash: entry.recipientHash,
    normalizedDomainHash: entry.normalizedDomainHash,
    businessFingerprint: entry.businessFingerprint,
    suppressed: entry.suppressed !== false,
    futureEligible: entry.futureEligible === true,
    ledgerVersion: ledger.generatedAt,
    generatedAt: ledger.generatedAt
  }));
  const result = {
    event: 'sent_suppression_ledger_export_safe_only',
    ledgerLoaded: ledger.loaded,
    generatedAt: ledger.generatedAt,
    ledgerVersion: ledger.generatedAt,
    suppressedCount: entries.filter((entry) => entry.suppressed && !entry.futureEligible).length,
    entries,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_({
    event: result.event,
    ledgerLoaded: result.ledgerLoaded,
    generatedAt: result.generatedAt,
    suppressedCount: result.suppressedCount,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  });
  return result;
}

function logSentSuppressionLedgerSafeJsonOnly() {
  const exported = exportSentSuppressionLedgerSafeOnly();
  const safePayload = {
    event: 'sent_suppression_ledger_export_safe_json',
    ledgerLoaded: exported.ledgerLoaded,
    generatedAt: exported.generatedAt,
    ledgerVersion: exported.ledgerVersion,
    suppressedCount: exported.suppressedCount,
    entries: exported.entries.map((entry) => ({
      recipientHash: entry.recipientHash,
      normalizedDomainHash: entry.normalizedDomainHash,
      businessFingerprint: entry.businessFingerprint,
      suppressed: entry.suppressed !== false,
      futureEligible: entry.futureEligible === true,
      ledgerVersion: entry.ledgerVersion,
      generatedAt: entry.generatedAt
    }))
  };
  const json = JSON.stringify(safePayload);
  const maxPayloadLength = 5600;
  const chunkCount = Math.max(1, Math.ceil(json.length / maxPayloadLength));
  for (let index = 0; index < chunkCount; index += 1) {
    Logger.log(JSON.stringify({
      event: 'sent_suppression_ledger_export_chunk',
      chunkIndex: index + 1,
      chunkCount,
      payload: json.slice(index * maxPayloadLength, (index + 1) * maxPayloadLength)
    }));
  }
  Logger.log(JSON.stringify({
    event: 'sent_suppression_ledger_export_complete',
    chunkCount,
    suppressedCount: safePayload.suppressedCount,
    ledgerLoaded: safePayload.ledgerLoaded
  }));
  return {
    event: 'sent_suppression_ledger_export_complete',
    chunkCount,
    suppressedCount: safePayload.suppressedCount,
    ledgerLoaded: safePayload.ledgerLoaded,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
}

function logGoogleSheetSendHistorySafeJsonOnly() {
  const maxPayloadLength = 5600;
  const generatedAt = new Date().toISOString();
  let safePayload;

  try {
    const config = getConfig_();
    const knownSentEmails = loadKnownSentEmails_(config);
    const recipientHashes = Object.keys(knownSentEmails)
      .map((value) => hashValue_(normalizeEmail_(value)))
      .filter(Boolean);
    const uniqueRecipientHashes = Array.from(new Set(recipientHashes)).sort();
    safePayload = {
      event: 'google_sheet_send_history_safe_json',
      historyLoaded: true,
      generatedAt,
      entryCount: uniqueRecipientHashes.length,
      entries: uniqueRecipientHashes.map((recipientHash) => ({ recipientHash }))
    };
  } catch (error) {
    safePayload = {
      event: 'google_sheet_send_history_safe_json',
      historyLoaded: false,
      generatedAt,
      entryCount: 0,
      entries: [],
      blockedReason: 'sheet_history_read_failed'
    };
  }

  const json = JSON.stringify(safePayload);
  const chunkCount = Math.max(1, Math.ceil(json.length / maxPayloadLength));
  for (let index = 0; index < chunkCount; index += 1) {
    Logger.log(JSON.stringify({
      event: 'google_sheet_send_history_export_chunk',
      chunkIndex: index + 1,
      chunkCount,
      payload: json.slice(index * maxPayloadLength, (index + 1) * maxPayloadLength)
    }));
  }

  const complete = {
    event: 'google_sheet_send_history_export_complete',
    historyLoaded: safePayload.historyLoaded,
    entryCount: safePayload.entryCount,
    chunkCount,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false,
    scriptPropertiesUpdated: false
  };
  if (!safePayload.historyLoaded) {
    complete.blockedReason = safePayload.blockedReason;
  }
  Logger.log(JSON.stringify(complete));
  return complete;
}

function runPreparedBatchDiagnosticsOnly() {
  const preflight = runPreflight_(false);
  const ledger = loadSuppressionLedgerFromProperties_();
  const personalization = preflight.readyRows.map((item) => {
    try {
      assertRecipientPersonalizationSafe_(item.row, buildInitialSalesEmail_(item.row));
      return true;
    } catch (error) {
      return false;
    }
  });
  const failedPersonalizationCount = personalization.filter((ok) => !ok).length;
  const windowCheck = validateDailySendWindow_(preflight.config);
  const result = {
    event: 'prepared_batch_diagnostics_only',
    sendDate: preflight.config.sendDate,
    sendBatchId: preflight.batchId,
    targetCount: preflight.targetCount,
    readyCount: preflight.readyCount,
    blockedReason: preflight.blockedReason,
    suppressionLedgerLoaded: ledger.loaded,
    suppressedCount: ledger.entries.length,
    personalizationCheckedCount: personalization.length,
    failedPersonalizationCount,
    insideAllowedSendWindowNow: windowCheck.ok,
    approvalRequiredLater: preflight.config.requireExplicitBatchApproval,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function runScheduledPreflight() {
  const result = runPreflight_(false);
  appendAutomationStatusLog_({
    event: 'scheduled_preflight_checked',
    currentJstDate: result.config.currentJstDate,
    expectedSendDate: result.config.sendDate,
    expectedSendBatchId: result.batchId,
    sendDateSource: result.config.sendDateSource,
    sendBatchIdSource: result.config.sendBatchIdSource,
    staleSendDate: result.config.staleSendDate,
    staleBatchId: result.config.staleBatchId,
    dryRun: result.dryRun,
    liveSendEnabled: result.liveSendEnabled,
    autoSendEnabled: result.config.autoSendEnabled,
    dailySendLimit: result.dailySendLimit,
    remainingQuota: result.remainingQuota,
    targetCount: result.targetCount,
    readyCount: result.readyCount,
    sendBatchId: result.batchId,
    blockedReason: result.blockedReason,
    sheetConnected: result.sheetConnected,
    safeToSend: false,
    publishAllowed: result.publishAllowed,
    canPrepareOutbox: result.canPrepareOutbox,
    canSendToday: result.canSendToday,
    recommendedNextAction: result.recommendedNextAction
  });
}

function runScheduledDailySend() {
  const readiness = inspectGmailSalesDailyReadiness();
  appendSafeLog_({
    event: 'scheduled_daily_send_legacy_noop',
    schedulerAuthority: 'runGmailSalesDailyAutomationTrigger',
    targetDate: readiness.targetDate,
    readyForScheduledSend: readiness.readyForScheduledSend,
    blockedReasons: readiness.blockedReasons,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  });
  return Object.assign({}, readiness, {
    event: 'scheduled_daily_send_legacy_noop',
    status: 'monitor_only',
    gmailSendExecuted: false,
    googleSheetsUpdated: false
  });
}

function runGmailSalesProductionControlLoop() {
  return runGmailSalesProductionControlLoop_({ source: 'time_trigger' });
}

function runGmailSalesProductionControlLoopManualSafe() {
  return runGmailSalesProductionControlLoop_({ source: 'manual_safe' });
}

function runGmailSalesProductionControlLoop_(options) {
  const settings = options || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildProductionLoopResult_('blocked', 'lock_unavailable', settings.source);
  }
  try {
    const config = getConfig_();
    const policy = getGmailSalesOperationalDayPolicy_(config.currentJstDate);
    const phase = getGmailSalesProductionPhase_();
    if (phase === 'outside_window') {
      return buildProductionLoopResult_('noop', 'outside_phase_window', settings.source, policy, phase);
    }
    if (policy.isWeeklyReviewDay && phase === 'weekly_report') {
      return runGmailSalesWeeklyReportAndOptimization();
    }
    if (!policy.isOperationalDay) {
      return buildProductionLoopResult_('noop', policy.reason, settings.source, policy, phase);
    }
    if (phase === 'ai_verification') return runGmailSalesAiContactBasisVerificationOnce();
    if (phase === 'prepare') return prepareDailyPipeline_({ source: settings.source || 'time_trigger' });
    if (phase === 'enable') return runGmailSalesDailyEnableWhenReady();
    if (phase === 'send') return runGmailSalesDailyAutomationTrigger();
    if (phase === 'post_send_audit') return runGmailSalesDailyPostSendAudit();
    return buildProductionLoopResult_('noop', 'phase_not_actionable', settings.source, policy, phase);
  } finally {
    lock.releaseLock();
  }
}

function getGmailSalesOperationalDayPolicy_(targetDate) {
  const dateText = normalizeDateText_(targetDate || getConfig_().currentJstDate);
  const date = new Date(dateText + 'T00:00:00Z');
  const dayOfWeek = Number.isNaN(date.getTime()) ? -1 : date.getUTCDay();
  const isSunday = dayOfWeek === 0;
  const isSpecialRestartDay = dateText === GMAIL_SALES_SPECIAL_RESTART_DATE;
  const isWeeklyReviewDay = isSunday && dateText >= GMAIL_SALES_FIRST_WEEKLY_REPORT_DATE;
  const isOperationalDay = isSpecialRestartDay || (dayOfWeek >= 1 && dayOfWeek <= 6);
  return {
    targetDate: dateText,
    dayOfWeek,
    isOperationalDay,
    isSpecialRestartDay,
    isWeeklyReviewDay,
    reason: isOperationalDay ? (isSpecialRestartDay ? 'special_restart_day' : 'monday_to_saturday') : (isWeeklyReviewDay ? 'weekly_review_day' : 'sunday_no_sales')
  };
}

function getGmailSalesProductionPhase_() {
  const timezone = Session.getScriptTimeZone() || GMAIL_SALES_TIMEZONE_DEFAULT;
  const minutes = timeTextToMinutes_(Utilities.formatDate(new Date(), timezone, 'HH:mm'));
  const policy = getGmailSalesOperationalDayPolicy_(Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd'));
  if (policy.isWeeklyReviewDay && minutes >= timeTextToMinutes_('08:30') && minutes <= timeTextToMinutes_('11:30')) return 'weekly_report';
  if (minutes >= timeTextToMinutes_('06:30') && minutes < timeTextToMinutes_('07:30')) return 'ai_verification';
  if (minutes >= timeTextToMinutes_('07:30') && minutes <= timeTextToMinutes_('09:45')) return 'prepare';
  if (minutes >= timeTextToMinutes_('10:00') && minutes <= timeTextToMinutes_('11:30')) return 'enable';
  if (minutes >= timeTextToMinutes_('11:45') && minutes <= timeTextToMinutes_('12:45')) return 'send';
  if (minutes >= timeTextToMinutes_('13:00') && minutes <= timeTextToMinutes_('15:00')) return 'post_send_audit';
  return 'outside_window';
}

function buildProductionLoopResult_(status, blockedReason, source, policy, phase) {
  const result = {
    event: 'gmail_sales_production_control_loop',
    status,
    blockedReason,
    source: source || 'unknown',
    operationalDayPolicy: policy || getGmailSalesOperationalDayPolicy_(),
    currentPhase: phase || getGmailSalesProductionPhase_(),
    schedulerController: GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER,
    sendAuthority: 'runGmailSalesDailyAutomationTrigger',
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function runGmailSalesDailyAutomationTrigger() {
  let configForReset = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const config = getConfig_();
    configForReset = config;
    const policy = getGmailSalesOperationalDayPolicy_(config.currentJstDate);
    const state = readGmailDailyAutomationState_();
    const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
    const versionStatus = gmailDailyVersionStatus_();
    const blockedReasons = [];
    if (!policy.isOperationalDay) blockedReasons.push(policy.reason);
    if (props.getProperty('AUTOMATION_MASTER_ENABLED') !== 'true') blockedReasons.push('automation_master_disabled');
    if (!config.autoSendEnabled) blockedReasons.push('auto_send_disabled');
    if (!config.liveSendEnabled) blockedReasons.push('live_send_disabled');
    if (triggerHealth.status !== 'pass') blockedReasons.push('daily_trigger_health_blocked');
    if (!versionStatus.ok) blockedReasons.push.apply(blockedReasons, versionStatus.blockedReasons);
    const sendWindowStatus = getGmailSalesDailySendWindowConfig_(props);
    if (!sendWindowStatus.configured) blockedReasons.push(sendWindowStatus.blockedReason || 'send_window_not_configured');
    if (!isGmailDailyPreparedState_(state)) blockedReasons.push('daily_state_not_ready');
    if (state.mode !== 'normal_daily') blockedReasons.push('daily_state_mode_invalid');
    if (String(state.automationVersion || '') !== GMAIL_DAILY_AUTOMATION_VERSION) blockedReasons.push('daily_state_automation_version_mismatch');
    if (state.targetDate !== config.currentJstDate) blockedReasons.push('daily_state_target_date_mismatch');
    const dailyWindowConfig = withGmailSalesDailySendWindow_(config, sendWindowStatus);
    if (sendWindowStatus.configured && !insideAllowedSendWindow_(dailyWindowConfig)) blockedReasons.push('outside_send_window');
    if (blockedReasons.length > 0) {
      const blocked = writeGmailDailyAutomationState_(Object.assign({}, state, {
        state: 'blocked',
        blockedReasons: uniqueArray_((state.blockedReasons || []).concat(blockedReasons)),
        updatedAt: new Date().toISOString()
      }));
      appendSafeLog_({
        event: 'gmail_daily_automation_blocked',
        targetDate: state.targetDate || config.currentJstDate,
        state: blocked.state,
        blockedReason: blockedReasons.join(','),
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        triggerChanged: false
      });
      return buildPreSendDryRunResult_({
        mode: 'normal_daily_automation',
        status: 'blocked',
        blockedReasons
      });
    }
    const preSend = executeApprovedGmailSalesPreSendDryRun_({ source: 'normal_daily_automation_trigger' });
    if (preSend.status !== 'pass') {
      writeGmailDailyAutomationState_(Object.assign({}, state, {
        state: 'blocked',
        blockedReasons: preSend.blockedReasons || ['pre_send_blocked'],
        updatedAt: new Date().toISOString()
      }));
      return preSend;
    }
    writeGmailDailyAutomationState_(Object.assign({}, state, {
      state: 'pre_send_passed',
      preSendPassedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    const sendResult = executeApprovedGmailSalesBatch_({
      source: 'normal_daily_automation_trigger',
      requireAutoSend: true,
      dryRun: false
    });
    writeGmailDailyAutomationState_(Object.assign({}, state, {
      state: sendResult.status === 'pass' ? 'sent' : 'failed',
      sentAt: sendResult.status === 'pass' ? new Date().toISOString() : '',
      actualSendCount: Number(sendResult.sentCount || 0),
      failedSendCount: Number(sendResult.failedCount || 0),
      blockedReasons: sendResult.blockedReasons || [],
      updatedAt: new Date().toISOString()
    }));
    return sendResult;
  } catch (error) {
    const state = readGmailDailyAutomationState_();
    writeGmailDailyAutomationState_(Object.assign({}, state, {
      state: 'result_unknown',
      errorCode: safeErrorCode_(error),
      updatedAt: new Date().toISOString()
    }));
    appendSafeLog_({
      event: 'gmail_daily_automation_result_unknown',
      blockedReason: safeErrorCode_(error),
      gmailSendExecuted: false
    });
    return buildPreSendDryRunResult_({
      mode: 'normal_daily_automation',
      status: 'blocked',
      blockedReasons: ['result_unknown']
    });
  } finally {
    if (configForReset) {
      resetLiveSendAfterRun_(configForReset);
    }
  }
}

function runGmailSalesDailyAutomationHealthCheck() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const state = readGmailDailyAutomationState_();
  const versionStatus = gmailDailyVersionStatus_();
  const sendWindowStatus = getGmailSalesDailySendWindowConfig_(props);
  const triggerSchedule = getGmailSalesDailyTriggerSchedule_(props);
  const blockedReasons = [];
  if (triggerHealth.status !== 'pass') blockedReasons.push('trigger_health_blocked');
  if (!versionStatus.ok) blockedReasons.push.apply(blockedReasons, versionStatus.blockedReasons);
  if (!sendWindowStatus.configured) blockedReasons.push(sendWindowStatus.blockedReason || 'send_window_not_configured');
  if (!triggerSchedule.configured) blockedReasons.push(triggerSchedule.blockedReason || 'trigger_schedule_not_configured');
  const result = {
    event: 'gmail_daily_automation_health_check',
    status: blockedReasons.length === 0 ? 'pass' : 'blocked',
    runtimeVersion: GMAIL_DAILY_AUTOMATION_VERSION,
    automationMasterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
    autoSendEnabled: config.autoSendEnabled,
    liveSendAtRest: config.liveSendEnabled === false,
    expectedDailyCount: gmailDailyExpectedCount_(),
    maxDailySendCount: config.dailySendLimit,
    sendWindow: sendWindowStatus.summary,
    sendWindowConfigured: sendWindowStatus.configured,
    sendWindowStartPresent: sendWindowStatus.startPresent,
    sendWindowEndPresent: sendWindowStatus.endPresent,
    sendWindowFormatValid: sendWindowStatus.formatValid,
    sendWindowRangeValid: sendWindowStatus.rangeValid,
    triggerScheduleConfigured: triggerSchedule.configured,
    expectedTriggerHour: triggerSchedule.hour,
    expectedTriggerMinute: triggerSchedule.minute,
    expectedTriggerTimezone: triggerSchedule.timezone,
    triggerScheduleSafeMarginMinutes: triggerSchedule.safeMarginMinutes,
    automationVersionConfigured: versionStatus.automationVersionConfigured,
    automationVersionMatch: versionStatus.automationVersionMatch,
    approvalPolicyVersionConfigured: versionStatus.approvalPolicyVersionConfigured,
    approvalPolicyVersionMatch: versionStatus.approvalPolicyVersionMatch,
    sharedSecretPresent: Boolean(String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim()),
    triggerStatus: triggerHealth.status,
    normalTriggerCount: triggerHealth.normalTriggerCount,
    duplicateTriggerCount: triggerHealth.duplicateTriggerCount,
    forbiddenTriggerCount: triggerHealth.forbiddenTriggerCount,
    currentState: state.state || 'not_started',
    currentTargetDate: state.targetDate || '',
    blockedReason: blockedReasons.join(','),
    recoverySeparated: true,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function initializeGmailSalesDailyAutomationProperties() {
  const props = PropertiesService.getScriptProperties();
  const current = props.getProperties();
  const updates = {};
  let preWriteMissingPropertyCount = 0;
  let preWriteMismatchPropertyCount = 0;
  Object.keys(GMAIL_DAILY_INITIAL_PROPERTIES).forEach((key) => {
    const expected = GMAIL_DAILY_INITIAL_PROPERTIES[key];
    const actual = String(current[key] || '').trim();
    if (!actual) {
      preWriteMissingPropertyCount += 1;
      updates[key] = expected;
      return;
    }
    if (actual !== expected) {
      preWriteMismatchPropertyCount += 1;
      updates[key] = expected;
    }
  });
  let propertyWriteCount = 0;
  if (Object.keys(updates).length > 0) {
    props.setProperties(updates, false);
    propertyWriteCount = 1;
  }
  const readBack = props.getProperties();
  let postWriteMissingPropertyCount = 0;
  let postWriteMismatchPropertyCount = 0;
  Object.keys(GMAIL_DAILY_INITIAL_PROPERTIES).forEach((key) => {
    const expected = GMAIL_DAILY_INITIAL_PROPERTIES[key];
    const actual = String(readBack[key] || '').trim();
    if (!actual) {
      postWriteMissingPropertyCount += 1;
      return;
    }
    if (actual !== expected) {
      postWriteMismatchPropertyCount += 1;
    }
  });
  const sendWindowStatus = getGmailSalesDailySendWindowConfig_(readBack);
  const result = {
    event: 'gmail_daily_automation_properties_initialized',
    status: propertyWriteCount === 0 ? 'already_configured' : 'configured',
    runtimeVersion: GMAIL_DAILY_AUTOMATION_VERSION,
    propertyWriteCount,
    missingPropertyCount: preWriteMissingPropertyCount,
    mismatchPropertyCount: preWriteMismatchPropertyCount,
    preWriteMissingPropertyCount,
    preWriteMismatchPropertyCount,
    postWriteMissingPropertyCount,
    postWriteMismatchPropertyCount,
    automationMasterEnabled: readBack.AUTOMATION_MASTER_ENABLED === 'true',
    autoSendEnabled: readBack.AUTO_SEND_ENABLED === 'true',
    liveSendAtRest: readBack.LIVE_SEND_ENABLED === 'false',
    expectedDailyCountConfigured: readBack.GMAIL_SALES_EXPECTED_DAILY_COUNT === '30',
    maxDailySendCountConfigured: readBack.GMAIL_SALES_MAX_DAILY_SEND_COUNT === '30',
    timezoneConfigured: readBack[GMAIL_SALES_TIMEZONE_PROPERTY] === GMAIL_SALES_TIMEZONE_DEFAULT,
    sendWindowConfigured: sendWindowStatus.configured,
    sendWindow: sendWindowStatus.summary,
    automationVersionConfigured: readBack.GMAIL_SALES_AUTOMATION_VERSION === GMAIL_DAILY_AUTOMATION_VERSION,
    approvalPolicyVersionConfigured: readBack.GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION === GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION,
    sharedSecretPresent: Boolean(String(readBack[GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY] || '').trim()),
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false,
    blockedReason: '',
    errorCode: ''
  };
  appendSafeLog_(result);
  return result;
}

function installGmailSalesDailyAutomationTriggers() {
  const props = PropertiesService.getScriptProperties();
  const health = verifyGmailSalesDailyAutomationTriggers();
  if (health.forbiddenTriggerCount > 0 || health.duplicateTriggerCount > 0) {
    appendSafeLog_(Object.assign({ event: 'gmail_daily_trigger_install_blocked' }, health));
    return Object.assign({}, health, { triggerChanged: false });
  }
  const sendWindowStatus = getGmailSalesDailySendWindowConfig_(props);
  const triggerSchedule = getGmailSalesDailyTriggerSchedule_(props);
  if (!sendWindowStatus.configured || !triggerSchedule.configured) {
    const blockedReason = sendWindowStatus.blockedReason || triggerSchedule.blockedReason || 'trigger_schedule_not_configured';
    appendSafeLog_({
      event: 'gmail_daily_trigger_install_blocked',
      blockedReason,
      triggerChanged: false
    });
    return Object.assign({}, health, {
      status: 'blocked',
      blockedReason,
      triggerChanged: false
    });
  }
  if (health.normalTriggerCount === GMAIL_DAILY_TRIGGER_HANDLERS.length) {
    return Object.assign({}, health, { status: 'pass', alreadyInstalled: true, triggerChanged: false });
  }
  GMAIL_DAILY_TRIGGER_HANDLERS.forEach((handler) => {
    if (!hasTrigger_(handler)) {
      ScriptApp.newTrigger(handler)
        .timeBased()
        .everyDays(1)
        .atHour(triggerSchedule.hour)
        .nearMinute(triggerSchedule.minute)
        .inTimezone(triggerSchedule.timezone)
        .create();
      appendSafeLog_({
        event: 'gmail_daily_trigger_created',
        handler,
        hour: triggerSchedule.hour,
        minute: triggerSchedule.minute,
        timezoneConfigured: triggerSchedule.timezone === GMAIL_SALES_TIMEZONE_DEFAULT,
        triggerChanged: true
      });
    }
  });
  return Object.assign({}, verifyGmailSalesDailyAutomationTriggers(), { triggerChanged: true });
}

function installGmailSalesProductionTriggersOnce() {
  const triggers = ScriptApp.getProjectTriggers();
  const knownHandlers = [
    'runScheduledDailySend',
    'runScheduledPreflight',
    'runPostSendCheck',
    'runGmailSalesDailyAutomationTrigger',
    GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER,
    'runGmailSalesDailyPreparationTrigger',
    'runGmailSalesDailyEnableWhenReadyTrigger',
    'runGmailSalesDailyPostSendAuditTrigger',
    'runGmailSalesWeeklyReportAndOptimization'
  ];
  triggers.forEach((trigger) => {
    const handler = String(trigger.getHandlerFunction && trigger.getHandlerFunction() || '');
    if (knownHandlers.indexOf(handler) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER)
    .timeBased()
    .everyMinutes(30)
    .create();
  const result = Object.assign(inspectGmailSalesProductionTriggers(), {
    event: 'gmail_sales_production_triggers_installed',
    triggerChanged: true,
    gmailSendExecuted: false
  });
  appendSafeLog_(result);
  return result;
}

function inspectGmailSalesProductionTriggers() {
  const counts = {};
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    const handler = String(trigger.getHandlerFunction && trigger.getHandlerFunction() || '');
    counts[handler] = Number(counts[handler] || 0) + 1;
  });
  const oldSendTriggerCount = Number(counts.runScheduledDailySend || 0) + Number(counts.runGmailSalesDailyAutomationTrigger || 0);
  const controlLoopTriggerCount = Number(counts[GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER] || 0);
  const result = {
    event: 'gmail_sales_production_triggers',
    mode: 'read_only',
    schedulerAuthority: GMAIL_SALES_PRODUCTION_CONTROL_LOOP_HANDLER,
    mailSendAuthority: 'runGmailSalesDailyAutomationTrigger',
    controlLoopTriggerExists: controlLoopTriggerCount === 1,
    controlLoopDuplicateCount: Math.max(0, controlLoopTriggerCount - 1),
    oldSendTriggerCount,
    oldSendTriggerAbsent: oldSendTriggerCount === 0,
    otherTriggersUnchanged: true,
    triggerChanged: false,
    gmailSendExecuted: false
  };
  try {
    console.log(JSON.stringify(result));
  } catch (error) {
    appendSafeLog_(result);
  }
  return result;
}

function inspectGmailSalesCurrentOperationalStatus() {
  const config = getConfig_();
  const readiness = inspectGmailSalesDailyReadiness_({});
  const action = recommendGmailSalesNextAction_(readiness, config);
  return Object.assign({}, readiness, {
    event: 'gmail_sales_current_operational_status',
    operationalDayPolicy: getGmailSalesOperationalDayPolicy_(config.currentJstDate),
    currentPhase: getGmailSalesProductionPhase_(),
    candidateSourceAccessible: readiness.sourceCandidateCount > 0,
    manifestValid: readiness.manifestTargetDateMatched && readiness.manifestBatchMatched && readiness.manifestCandidateCount === gmailDailyExpectedCount_(),
    candidateDigestMatch: readiness.preflightPassed,
    autoSendEnabled: getConfig_().autoSendEnabled,
    liveSendEnabled: getConfig_().liveSendEnabled,
    todaySentCount: 0,
    batchFinalized: false,
    prepareAttemptCount: 0,
    lastSuccessfulPhase: readiness.readyForScheduledSend ? 'readiness' : '',
    lastFailurePhase: readiness.readyForScheduledSend ? '' : 'readiness',
    recommendedNextAction: action
  });
}

function recommendGmailSalesNextAction_(readiness, config) {
  const phase = getGmailSalesProductionPhase_();
  if (!getGmailSalesOperationalDayPolicy_(config.currentJstDate).isOperationalDay) return 'wait_for_control_loop';
  if (readiness.readyForScheduledSend && phase === 'prepare') return 'ready_wait_for_enable';
  if (readiness.readyForScheduledSend && phase === 'enable') return 'ready_wait_for_send_window';
  if (readiness.readyForScheduledSend && phase === 'send') return 'send_in_progress';
  if (readiness.readyForScheduledSend && phase === 'audit') return 'audit_pending';
  if (readiness.readyForScheduledSend) return 'wait_for_control_loop';
  if (phase === 'prepare') return 'prepare_retry_available';
  if ((readiness.blockedReasons || []).indexOf('selected_count_not_30') !== -1) return 'manual_prepare_review_required';
  return 'blocked_human_review';
}

function inspectGmailSalesDeploymentReadiness() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const dailyLimit = getGmailSalesDailyLimitConfiguration_();
  const schema = inspectGmailSalesProductionSchema_({ skipDeploymentReadiness: true });
  const coverage = inspectGmailSalesContactBasisCoverage_({ skipSchema: true });
  const requiredFunctions = [
    'prepareDailyPipeline',
    'prepareGmailSalesDailyBatchForTodayOnce',
    'runGmailSalesProductionControlLoop',
    'runGmailSalesDailyAutomationTrigger',
    'runGmailSalesDailyEnableWhenReady',
    'runGmailSalesDailyPostSendAudit',
    'runScheduledDailySend',
    'installGmailSalesProductionTriggersOnce',
    'inspectGmailSalesProductionTriggers',
    'loadSuppressionLedgerFromProperties_',
    'hasAllowedGmailSalesContactBasis_'
  ];
  const requiredProperties = [
    'SHEET_ID',
    'SHEET_NAME',
    'GMAIL_DAILY_SOURCE_TAB_NAME',
    'GMAIL_SHEET_READY_TAB_NAME',
    GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY,
    GMAIL_SALES_SEND_WINDOW_START_PROPERTY,
    GMAIL_SALES_SEND_WINDOW_END_PROPERTY,
    'GMAIL_SALES_EXPECTED_DAILY_COUNT',
    'GMAIL_SALES_MAX_DAILY_SEND_COUNT',
    'GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION',
    'GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT',
    'GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM',
    'GMAIL_SUPPRESSION_LEDGER_0',
    'GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM'
  ];
  const allProps = props.getProperties();
  const missingFunctions = requiredFunctions.filter((name) => typeof this[name] !== 'function');
  const missingPropertyNames = requiredProperties.filter((name) => !String(allProps[name] || '').trim());
  const infrastructureBlockedReasons = [];
  const candidateBlockedReasons = [];
  let spreadsheetAccessConfigured = false;
  let selectedOutboxTabAccessible = false;
  let sourceTabAccessible = false;
  let contactBasisFieldsSupported = false;
  let sendStateFieldsSupported = false;
  let suppressionSourceAccessible = false;
  let historySourceAccessible = false;
  let inaccessibleResourceCount = 0;

  try {
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    spreadsheetAccessConfigured = Boolean(spreadsheet);
    const selectedSheet = spreadsheet.getSheetByName(config.sheetName);
    selectedOutboxTabAccessible = Boolean(selectedSheet);
    const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || '');
    const sourceSheet = sourceName ? spreadsheet.getSheetByName(sourceName) : null;
    sourceTabAccessible = Boolean(sourceSheet);
    if (sourceSheet && sourceSheet.getLastColumn() > 0) {
      const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0].map((value) => String(value));
      contactBasisFieldsSupported = hasContactBasisHeaderSupport_(headers);
    }
    if (selectedSheet && selectedSheet.getLastColumn() > 0) {
      const outboxHeaders = selectedSheet.getRange(1, 1, 1, selectedSheet.getLastColumn()).getValues()[0].map((value) => String(value));
      sendStateFieldsSupported = GMAIL_SEND_STATE_COLUMNS.every((header) => outboxHeaders.indexOf(header) !== -1);
    }
  } catch (error) {
    spreadsheetAccessConfigured = false;
  }

  try {
    suppressionSourceAccessible = loadSuppressionLedgerFromProperties_().loaded === true;
  } catch (error) {
    suppressionSourceAccessible = false;
  }
  try {
    loadKnownSentEmails_(config);
    historySourceAccessible = true;
  } catch (error) {
    historySourceAccessible = false;
  }

  if (missingFunctions.length > 0) infrastructureBlockedReasons.push('required_function_missing');
  if (missingPropertyNames.length > 0) infrastructureBlockedReasons.push('required_property_missing');
  if (!spreadsheetAccessConfigured) infrastructureBlockedReasons.push('spreadsheet_not_accessible');
  if (!selectedOutboxTabAccessible) infrastructureBlockedReasons.push('selected_outbox_tab_not_accessible');
  if (!sourceTabAccessible) infrastructureBlockedReasons.push('source_tab_not_accessible');
  if (!contactBasisFieldsSupported) infrastructureBlockedReasons.push('contact_basis_fields_missing');
  if (!sendStateFieldsSupported) infrastructureBlockedReasons.push('send_state_fields_missing');
  if (!suppressionSourceAccessible) infrastructureBlockedReasons.push('suppression_source_not_accessible');
  if (!historySourceAccessible) infrastructureBlockedReasons.push('history_source_not_accessible');
  if ((Session.getScriptTimeZone() || '') !== GMAIL_SALES_TIMEZONE_DEFAULT) infrastructureBlockedReasons.push('timezone_not_asia_tokyo');
  if (!dailyLimit.configurationValid) infrastructureBlockedReasons.push('daily_limit_configuration_invalid');
  if (coverage.operationalCandidateReady !== true) {
    candidateBlockedReasons.push.apply(candidateBlockedReasons, coverage.blockedReasons || ['contact_basis_coverage_not_ready']);
  }
  inaccessibleResourceCount = [
    spreadsheetAccessConfigured,
    selectedOutboxTabAccessible,
    sourceTabAccessible,
    suppressionSourceAccessible,
    historySourceAccessible
  ].filter((ok) => !ok).length;
  const deploymentReady = infrastructureBlockedReasons.length === 0 &&
    schema.schemaReady === true &&
    dailyLimit.configurationValid === true;
  const operationalCandidateReady = deploymentReady === true && coverage.operationalCandidateReady === true;

  const result = {
    event: 'gmail_sales_deployment_readiness',
    mode: 'read_only',
    deploymentReady,
    operationalCandidateReady,
    blockedReasons: uniqueArray_(infrastructureBlockedReasons.concat(candidateBlockedReasons)),
    infrastructureBlockedReasons: uniqueArray_(infrastructureBlockedReasons),
    candidateBlockedReasons: uniqueArray_(candidateBlockedReasons),
    missingFunctions,
    missingPropertyNames,
    inaccessibleResourceCount,
    requiredFunctionsPresent: missingFunctions.length === 0,
    triggerInstallerPresent: typeof installGmailSalesProductionTriggersOnce === 'function',
    controlLoopFunctionPresent: typeof runGmailSalesProductionControlLoop === 'function',
    sendAuthorityPresent: typeof runGmailSalesDailyAutomationTrigger === 'function',
    mailAppSendEmailCallSiteExpectedCount: 1,
    spreadsheetAccessConfigured,
    selectedOutboxTabAccessible,
    sourceTabAccessible,
    contactBasisFieldsSupported,
    sendStateFieldsSupported,
    suppressionSourceAccessible,
    historySourceAccessible,
    timezoneAsiaTokyo: (Session.getScriptTimeZone() || '') === GMAIL_SALES_TIMEZONE_DEFAULT,
    expectedDailyCount: dailyLimit.expectedDailyCount,
    configuredMaxDailySendCount: dailyLimit.configuredMaxDailySendCount,
    currentManifestMaxSendCount: dailyLimit.currentManifestMaxSendCount,
    dailyLimitConfigurationValid: dailyLimit.configurationValid,
    maxDailySendCount: dailyLimit.configuredMaxDailySendCount,
    productionSendExecuted: false,
    productionSheetUpdated: false,
    productionPropertyUpdated: false
  };
  appendSafeLog_(result);
  logGmailSalesJsonResult_(result);
  return result;
}

function getGmailSalesDailyLimitConfiguration_() {
  const props = PropertiesService.getScriptProperties();
  const expectedRaw = String(props.getProperty('GMAIL_SALES_EXPECTED_DAILY_COUNT') || '').trim();
  const maxRaw = String(props.getProperty('GMAIL_SALES_MAX_DAILY_SEND_COUNT') || '').trim();
  let manifestMax = 0;
  try {
    const manifest = JSON.parse(String(props.getProperty('APPROVED_SEND_MANIFEST_JSON') || '{}'));
    manifestMax = Number(manifest && manifest.maxSendCount || 0);
  } catch (error) {
    manifestMax = 0;
  }
  const expectedDailyCount = Number(expectedRaw || 0);
  const configuredMaxDailySendCount = Number(maxRaw || 0);
  return {
    expectedDailyCount,
    configuredMaxDailySendCount,
    currentManifestMaxSendCount: manifestMax,
    sourcePropertyNames: {
      expectedDailyCount: 'GMAIL_SALES_EXPECTED_DAILY_COUNT',
      configuredMaxDailySendCount: 'GMAIL_SALES_MAX_DAILY_SEND_COUNT',
      currentManifestMaxSendCount: 'APPROVED_SEND_MANIFEST_JSON.maxSendCount'
    },
    canonicalExpectedCountPropertyPresent: Boolean(expectedRaw),
    canonicalMaxCountPropertyPresent: Boolean(maxRaw),
    configurationValid: expectedDailyCount === GMAIL_DAILY_EXPECTED_COUNT &&
      configuredMaxDailySendCount === GMAIL_DAILY_EXPECTED_COUNT &&
      configuredMaxDailySendCount <= GMAIL_SEND_SAFE_MAX_SEND_COUNT
  };
}

function inspectGmailSalesProductionProperties() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const dailyLimit = getGmailSalesDailyLimitConfiguration_();
  return {
    event: 'gmail_sales_production_properties',
    mode: 'read_only',
    propertyCount: Object.keys(allProps || {}).length,
    automationMasterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
    autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    expectedDailyCount: dailyLimit.expectedDailyCount,
    configuredMaxDailySendCount: dailyLimit.configuredMaxDailySendCount,
    currentManifestMaxSendCount: dailyLimit.currentManifestMaxSendCount,
    dailyLimitConfigurationValid: dailyLimit.configurationValid,
    canonicalExpectedCountPropertyPresent: dailyLimit.canonicalExpectedCountPropertyPresent,
    canonicalMaxCountPropertyPresent: dailyLimit.canonicalMaxCountPropertyPresent,
    sourcePropertyNames: dailyLimit.sourcePropertyNames,
    automationVersionConfigured: props.getProperty('GMAIL_SALES_AUTOMATION_VERSION') === GMAIL_DAILY_AUTOMATION_VERSION,
    approvalPolicyVersionConfigured: props.getProperty('GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION') === GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION,
    sharedSecretPresent: Boolean(String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim()),
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
}

function inspectGmailSalesProductionSchema() {
  const result = inspectGmailSalesProductionSchema_({});
  logGmailSalesJsonResult_(result);
  return result;
}

function inspectGmailSalesProductionSchema_() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const dailyLimit = getGmailSalesDailyLimitConfiguration_();
  const blockedReasons = [];
  let spreadsheet = null;
  let readyTabResolved = '';
  let readyTabAccessible = false;
  let sourceTabAccessible = false;
  let sourceHeaderValid = false;
  let outboxHeaderValid = false;
  let contactBasisFieldsSupported = false;
  let sendStateFieldsSupported = false;
  let requiredSourceColumnsMissing = GMAIL_CONTACT_BASIS_COLUMNS.slice();
  let requiredOutboxColumnsMissing = GMAIL_SEND_STATE_COLUMNS.concat(GMAIL_CONTACT_BASIS_COLUMNS);

  try {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
  } catch (error) {
    spreadsheet = null;
  }
  if (!spreadsheet) blockedReasons.push('spreadsheet_not_accessible');

  const readyTabProperty = String(props.getProperty('GMAIL_SHEET_READY_TAB_NAME') || '').trim();
  const readyTabName = resolveGmailSalesReadyTabName_(spreadsheet, config);
  readyTabResolved = readyTabName;
  const readySheet = spreadsheet && readyTabName ? spreadsheet.getSheetByName(readyTabName) : null;
  if (readySheet) {
    readyTabAccessible = true;
    const headers = getSheetHeaders_(readySheet);
    requiredOutboxColumnsMissing = missingHeaders_(headers, GMAIL_SEND_STATE_COLUMNS.concat(GMAIL_CONTACT_BASIS_COLUMNS));
    sendStateFieldsSupported = missingHeaders_(headers, GMAIL_SEND_STATE_COLUMNS).length === 0;
    outboxHeaderValid = requiredOutboxColumnsMissing.length === 0;
  }

  const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
  const sourceSheet = spreadsheet && sourceName ? spreadsheet.getSheetByName(sourceName) : null;
  if (sourceSheet) {
    sourceTabAccessible = true;
    const headers = getSheetHeaders_(sourceSheet);
    requiredSourceColumnsMissing = missingContactBasisColumns_(headers);
    contactBasisFieldsSupported = requiredSourceColumnsMissing.length === 0;
    sourceHeaderValid = contactBasisFieldsSupported;
  }

  if (!readyTabProperty) blockedReasons.push('ready_tab_property_missing');
  if (!readyTabResolved) blockedReasons.push('ready_tab_unresolved');
  if (!readyTabAccessible) blockedReasons.push('ready_tab_not_accessible');
  if (!sourceTabAccessible) blockedReasons.push('source_tab_not_accessible');
  if (!sourceHeaderValid) blockedReasons.push('source_header_invalid');
  if (!outboxHeaderValid) blockedReasons.push('outbox_header_invalid');
  if (!contactBasisFieldsSupported) blockedReasons.push('contact_basis_fields_missing');
  if (!sendStateFieldsSupported) blockedReasons.push('send_state_fields_missing');
  if (!dailyLimit.configurationValid) blockedReasons.push('daily_limit_configuration_invalid');

  return {
    event: 'gmail_sales_production_schema',
    mode: 'read_only',
    readyTabPropertyPresent: Boolean(readyTabProperty),
    readyTabResolved: Boolean(readyTabResolved),
    readyTabAccessible,
    sourceTabAccessible,
    sourceHeaderValid,
    outboxHeaderValid,
    contactBasisFieldsSupported,
    sendStateFieldsSupported,
    requiredSourceColumnsMissing,
    requiredOutboxColumnsMissing,
    configuredMaxDailySendCount: dailyLimit.configuredMaxDailySendCount,
    currentManifestMaxSendCount: dailyLimit.currentManifestMaxSendCount,
    dailyLimitConfigurationValid: dailyLimit.configurationValid,
    schemaReady: blockedReasons.length === 0,
    blockedReasons: uniqueArray_(blockedReasons),
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
}

function inspectGmailSalesContactBasisCoverage() {
  const result = inspectGmailSalesContactBasisCoverage_({});
  logGmailSalesJsonResult_(result);
  return result;
}

function inspectGmailSalesContactBasisCoverage_() {
  const config = getConfig_();
  const source = loadDailyPipelineSourceRows_(config);
  const summary = {
    event: 'gmail_sales_contact_basis_coverage',
    mode: 'read_only',
    sourceCandidateCount: source.sourceCandidateCount || 0,
    fieldsSupported: false,
    approvedBasisCount: 0,
    needsReviewCount: 0,
    missingBasisCount: 0,
    explicitOptInCount: 0,
    existingRelationshipCount: 0,
    validBusinessContactExceptionCount: 0,
    manualLegalReviewedCount: 0,
    guessedContactCount: 0,
    privatePersonalContactCount: 0,
    eligibleAfterBasisCheckCount: 0,
    operationalCandidateReady: false,
    blockedReasons: [],
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  if (!source.loaded) {
    summary.blockedReasons.push(source.blockedReason || 'source_candidate_load_failed');
    return summary;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
    const sheet = spreadsheet.getSheetByName(sourceName);
    summary.fieldsSupported = sheet ? hasContactBasisHeaderSupport_(getSheetHeaders_(sheet)) : false;
  } catch (error) {
    summary.fieldsSupported = false;
  }
  (source.rows || []).forEach((item) => {
    const row = item.row || {};
    const basis = normalizeContactBasisType_(getContactBasisValue_(row, 'contactBasisType'));
    if (!basis) summary.missingBasisCount += 1;
    if (basis === 'needs_review') summary.needsReviewCount += 1;
    if (basis === 'explicit_opt_in') summary.explicitOptInCount += 1;
    if (basis === 'existing_relationship') summary.existingRelationshipCount += 1;
    if (basis === 'valid_business_contact_exception') summary.validBusinessContactExceptionCount += 1;
    if (basis === 'manual_legal_reviewed') summary.manualLegalReviewedCount += 1;
    if (basis === 'guessed' || basis === 'scraped_without_basis') summary.guessedContactCount += 1;
    if (basis === 'private_personal_contact') summary.privatePersonalContactCount += 1;
    if (hasAllowedGmailSalesContactBasis_(row)) {
      summary.approvedBasisCount += 1;
      summary.eligibleAfterBasisCheckCount += 1;
    }
  });
  if (!summary.fieldsSupported) summary.blockedReasons.push('contact_basis_fields_missing');
  if (summary.eligibleAfterBasisCheckCount < gmailDailyExpectedCount_()) summary.blockedReasons.push('eligible_basis_count_below_30');
  summary.operationalCandidateReady = summary.blockedReasons.length === 0;
  return summary;
}

function installGmailSalesProductionSchemaOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesSchemaInstallResult_('blocked', 'safe_rest_required', {});
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesSchemaInstallResult_('blocked', 'lock_unavailable', {});
  }
  try {
    const config = getConfig_();
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    const readyTabName = resolveGmailSalesReadyTabName_(spreadsheet, config);
    if (!readyTabName) {
      return buildGmailSalesSchemaInstallResult_('blocked', 'canonical_ready_tab_unresolved', {});
    }
    const readySheet = spreadsheet.getSheetByName(readyTabName);
    const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
    const sourceSheet = spreadsheet.getSheetByName(sourceName);
    if (!readySheet || !sourceSheet) {
      return buildGmailSalesSchemaInstallResult_('blocked', 'source_or_ready_tab_missing', {});
    }
    const backupCreated = createGmailSalesSchemaBackup_(spreadsheet, sourceSheet, readySheet);
    const sourceMigration = ensureSheetHeaders_(sourceSheet, GMAIL_CONTACT_BASIS_COLUMNS);
    const outboxMigration = ensureSheetHeaders_(readySheet, GMAIL_SEND_STATE_COLUMNS.concat(GMAIL_CONTACT_BASIS_COLUMNS));
    if (!sourceMigration.readBackPassed || !outboxMigration.readBackPassed) {
      return buildGmailSalesSchemaInstallResult_('blocked', 'header_read_back_failed', {
        schemaColumnsAddedCount: sourceMigration.columnsAddedCount + outboxMigration.columnsAddedCount,
        sourceColumnsAdded: sourceMigration.columnsAddedCount,
        outboxColumnsAdded: outboxMigration.columnsAddedCount,
        existingRowsEvaluatedCount: Math.max(0, sourceSheet.getLastRow() - 1),
        backupCreated,
        readBackPassed: false,
        googleSheetsUpdated: sourceMigration.columnsAddedCount + outboxMigration.columnsAddedCount > 0 || backupCreated,
        scriptPropertiesUpdated: false
      });
    }
    const beforeProperties = props.getProperties();
    const properties = {
      GMAIL_SHEET_READY_TAB_NAME: readyTabName,
      GMAIL_SALES_EXPECTED_DAILY_COUNT: String(GMAIL_DAILY_EXPECTED_COUNT),
      GMAIL_SALES_MAX_DAILY_SEND_COUNT: String(GMAIL_DAILY_EXPECTED_COUNT)
    };
    props.setProperties(properties, false);
    const readBack = props.getProperties();
    const schema = inspectGmailSalesProductionSchema_({});
    const coverage = inspectGmailSalesContactBasisCoverage_({});
    const deployment = inspectGmailSalesDeploymentReadiness();
    return buildGmailSalesSchemaInstallResult_('pass', '', {
      schemaColumnsAddedCount: sourceMigration.columnsAddedCount + outboxMigration.columnsAddedCount,
      sourceColumnsAdded: sourceMigration.columnsAddedCount,
      outboxColumnsAdded: outboxMigration.columnsAddedCount,
      propertiesAddedCount: [
        'GMAIL_SHEET_READY_TAB_NAME',
        'GMAIL_SALES_EXPECTED_DAILY_COUNT',
        'GMAIL_SALES_MAX_DAILY_SEND_COUNT'
      ].filter((key) => !String(beforeProperties[key] || '').trim() && String(readBack[key] || '') === String(properties[key])).length,
      propertiesUpdatedCount: [
        'GMAIL_SHEET_READY_TAB_NAME',
        'GMAIL_SALES_EXPECTED_DAILY_COUNT',
        'GMAIL_SALES_MAX_DAILY_SEND_COUNT'
      ].filter((key) => String(beforeProperties[key] || '') !== String(properties[key]) && String(readBack[key] || '') === String(properties[key])).length,
      existingRowsEvaluatedCount: Math.max(0, sourceSheet.getLastRow() - 1),
      basisAutoMappedCount: coverage.approvedBasisCount,
      basisNeedsReviewCount: coverage.needsReviewCount + coverage.missingBasisCount,
      backupCreated,
      readBackPassed: schema.schemaReady,
      schemaReady: schema.schemaReady,
      deploymentReady: deployment.deploymentReady,
      operationalCandidateReady: deployment.operationalCandidateReady,
      googleSheetsUpdated: sourceMigration.columnsAddedCount + outboxMigration.columnsAddedCount > 0 || backupCreated,
      scriptPropertiesUpdated: true
    });
  } finally {
    lock.releaseLock();
  }
}

function buildGmailSalesSchemaInstallResult_(status, blockedReason, overrides) {
  const result = Object.assign({
    event: 'gmail_sales_production_schema_install',
    status,
    blockedReason,
    schemaColumnsAddedCount: 0,
    propertiesAddedCount: 0,
    propertiesUpdatedCount: 0,
    existingRowsEvaluatedCount: 0,
    basisAutoMappedCount: 0,
    basisNeedsReviewCount: 0,
    backupCreated: false,
    readBackPassed: false,
    schemaReady: false,
    deploymentReady: false,
    operationalCandidateReady: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  }, overrides || {});
  appendSafeLog_(result);
  return result;
}

function resolveGmailSalesReadyTabName_(spreadsheet, config) {
  const props = PropertiesService.getScriptProperties();
  const configured = String(props.getProperty('GMAIL_SHEET_READY_TAB_NAME') || '').trim();
  if (configured && spreadsheet && spreadsheet.getSheetByName(configured)) return configured;
  const candidates = [
    config.sheetName,
    props.getProperty('GMAIL_SHEET_TARGET_NAME'),
    'sales',
    'Gmail送信対象'
  ].map((value) => String(value || '').trim()).filter(Boolean);
  for (let i = 0; i < candidates.length; i += 1) {
    if (spreadsheet && spreadsheet.getSheetByName(candidates[i])) return candidates[i];
  }
  return '';
}

function getSheetHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value || '').trim());
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }
  return headers;
}

function missingHeaders_(headers, required) {
  const existing = {};
  (headers || []).forEach((header) => {
    if (header) existing[header] = true;
  });
  return (required || []).filter((header) => !existing[header]);
}

function missingContactBasisColumns_(headers) {
  return GMAIL_CONTACT_BASIS_COLUMNS.filter((field) => !findContactBasisHeader_(headers, field));
}

function hasContactBasisHeaderSupport_(headers) {
  return missingContactBasisColumns_(headers).length === 0;
}

function findContactBasisHeader_(headers, field) {
  const aliases = contactBasisAliases_()[field] || [field];
  for (let i = 0; i < aliases.length; i += 1) {
    if ((headers || []).indexOf(aliases[i]) !== -1) return aliases[i];
  }
  return '';
}

function contactBasisAliases_() {
  return {
    contactBasisType: ['contactBasisType', 'contact_basis_type', 'contactBasis', 'basisType', '送信根拠種別'],
    contactBasisRecordedAt: ['contactBasisRecordedAt', 'contact_basis_recorded_at', 'basisRecordedAt', '送信根拠記録日時'],
    sourceType: ['sourceType', 'source_type', 'contactSourceType', '取得元種別'],
    sourceReferenceHash: ['sourceReferenceHash', 'source_reference_hash', 'sourceHash', 'sourceDigest', '取得元参照hash'],
    optOutAvailable: ['optOutAvailable', 'opt_out_available', 'unsubscribeAvailable', '配信停止導線あり'],
    lastVerifiedAt: ['lastVerifiedAt', 'last_verified_at', 'verifiedAt', 'lastCheckedAt', '最終確認日時'],
    suppressionCheckedAt: ['suppressionCheckedAt', 'suppression_checked_at', 'suppressionVerifiedAt', '抑止確認日時'],
    historyCheckedAt: ['historyCheckedAt', 'history_checked_at', 'sentHistoryCheckedAt', '履歴確認日時']
  };
}

function ensureSheetHeaders_(sheet, requiredHeaders) {
  const before = getSheetHeaders_(sheet);
  const missing = missingHeaders_(before, requiredHeaders);
  const targetWidth = Math.max(before.length, (requiredHeaders || []).length, before.length + missing.length, 1);
  const headerValidationCellsCleared = clearHeaderDataValidations_(sheet, targetWidth);
  if (missing.length === 0) {
    return {
      columnsAddedCount: 0,
      readBackPassed: true,
      headerWritePassed: true,
      headerValidationCellsCleared,
      headerValidationCountAfterRepair: countHeaderDataValidations_(sheet, targetWidth)
    };
  }
  const next = before.concat(missing);
  sheet.getRange(1, 1, 1, next.length).setValues([next]);
  SpreadsheetApp.flush();
  const after = getSheetHeaders_(sheet);
  const readBackPassed = missingHeaders_(after, next).length === 0;
  if (!readBackPassed) {
    sheet.getRange(1, 1, 1, before.length).setValues([before]);
    SpreadsheetApp.flush();
  }
  return {
    columnsAddedCount: readBackPassed ? missing.length : 0,
    readBackPassed,
    headerWritePassed: readBackPassed,
    headerValidationCellsCleared,
    headerValidationCountAfterRepair: countHeaderDataValidations_(sheet, next.length)
  };
}

function clearHeaderDataValidations_(sheet, width) {
  if (!sheet || typeof sheet.getRange !== 'function') return 0;
  const columnCount = Math.max(1, Number(width || sheet.getLastColumn && sheet.getLastColumn() || 1));
  const range = sheet.getRange(1, 1, 1, columnCount);
  const before = countDataValidationsInRange_(range);
  if (typeof range.clearDataValidations === 'function') {
    range.clearDataValidations();
  } else if (typeof range.setDataValidation === 'function' && before > 0) {
    range.setDataValidation(null);
  }
  return before;
}

function countHeaderDataValidations_(sheet, width) {
  if (!sheet || typeof sheet.getRange !== 'function') return 0;
  const columnCount = Math.max(1, Number(width || sheet.getLastColumn && sheet.getLastColumn() || 1));
  return countDataValidationsInRange_(sheet.getRange(1, 1, 1, columnCount));
}

function countDataValidationsInRange_(range) {
  if (!range || typeof range.getDataValidations !== 'function') return 0;
  try {
    return range.getDataValidations().reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  } catch (error) {
    return 0;
  }
}

function createGmailSalesSchemaBackup_(spreadsheet, sourceSheet, readySheet) {
  const backupName = '_gmail_schema_backup_' + new Date().getTime();
  const backup = spreadsheet.insertSheet(backupName);
  const rows = [
    ['sheetNameHash', 'headerDigest', 'rowCount'],
    [hashValue_(sourceSheet.getName()), hashValue_(getSheetHeaders_(sourceSheet).join('|')), Math.max(0, sourceSheet.getLastRow() - 1)],
    [hashValue_(readySheet.getName()), hashValue_(getSheetHeaders_(readySheet).join('|')), Math.max(0, readySheet.getLastRow() - 1)]
  ];
  backup.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  return true;
}

function installGmailSalesContactBasisReviewWorkflowOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_workflow_install', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_workflow_install', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const config = getConfig_();
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    const reviewTabName = String(props.getProperty(GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY) || GMAIL_CONTACT_BASIS_REVIEW_TAB_DEFAULT).trim();
    const beforeProperty = String(props.getProperty(GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY) || '').trim();
    let reviewSheet = spreadsheet.getSheetByName(reviewTabName);
    let reviewTabCreated = false;
    if (!reviewSheet) {
      reviewSheet = spreadsheet.insertSheet(reviewTabName);
      reviewTabCreated = true;
    }
    const migration = ensureSheetHeaders_(reviewSheet, GMAIL_CONTACT_BASIS_REVIEW_HEADERS);
    if (!migration.readBackPassed) {
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_workflow_install', 'blocked', {
        blockedReason: 'header_read_back_failed',
        reviewTabPropertyPresent: Boolean(beforeProperty),
        reviewTabCreated,
        reviewTabResolved: Boolean(reviewSheet),
        columnsAddedCount: migration.columnsAddedCount,
        headerReadBackPassed: false,
        googleSheetsUpdated: true
      });
    }
    configureGmailSalesReviewSheetPresentation_(reviewSheet);
    const propertyValues = {};
    propertyValues[GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY] = reviewTabName;
    props.setProperties(propertyValues, false);
    const readBack = String(props.getProperty(GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY) || '').trim() === reviewTabName;
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_workflow_install', readBack ? 'pass' : 'blocked', {
      blockedReason: readBack ? '' : 'property_read_back_failed',
      mode: 'write',
      reviewTabPropertyPresent: true,
      reviewTabCreated,
      reviewTabResolved: Boolean(reviewSheet),
      columnsAddedCount: migration.columnsAddedCount,
      dataValidationConfigured: true,
      headerReadBackPassed: readBack,
      sourceCandidatesUpdated: false,
      googleSheetsUpdated: reviewTabCreated || migration.columnsAddedCount > 0,
      scriptPropertiesUpdated: beforeProperty !== reviewTabName
    });
  } finally {
    lock.releaseLock();
  }
}

function refreshGmailSalesContactBasisReviewQueueOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_queue_refresh', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_queue_refresh', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const context = getGmailSalesContactBasisReviewContext_();
    if (!context.ok) {
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_queue_refresh', 'blocked', {
        blockedReason: context.blockedReason
      });
    }
    const now = new Date().toISOString();
    const reviewData = readSheetObjects_(context.reviewSheet);
    const existingById = {};
    reviewData.items.forEach((item) => {
      const id = String(item.row.reviewId || '').trim();
      if (id) existingById[id] = item;
    });
    const source = loadDailyPipelineSourceRows_(context.config);
    if (!source.loaded) {
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_queue_refresh', 'blocked', {
        blockedReason: source.blockedReason || 'source_candidate_load_failed'
      });
    }
    const rows = [];
    const existingReviewDecisionsPreserved = {};
    const seenReviewIds = {};
    let sourceCandidatesEvaluatedCount = 0;
    let queueInsertedCount = 0;
    let queueUpdatedCount = 0;
    let existingReviewDecisionsPreservedCount = 0;
    let eligibleSuggestionCount = 0;
    let needsEvidenceCount = 0;
    let excludedCount = 0;
    source.rows.forEach((item) => {
      sourceCandidatesEvaluatedCount += 1;
      const queue = buildContactBasisReviewQueueRow_(item, now);
      if (!queue.include) {
        excludedCount += 1;
        return;
      }
      const existing = existingById[queue.row.reviewId];
      const next = Object.assign({}, queue.row);
      if (existing) {
        preserveGmailSalesReviewDecisionFields_(next, existing.row, queue.row.sourceRowDigest);
        queueUpdatedCount += 1;
        if (!existingReviewDecisionsPreserved[next.reviewId]) {
          existingReviewDecisionsPreserved[next.reviewId] = true;
          existingReviewDecisionsPreservedCount += 1;
        }
      } else {
        queueInsertedCount += 1;
      }
      if (next.suggestedBasisType) eligibleSuggestionCount += 1;
      if (!next.suggestedBasisType || next.suggestionReasonCode === 'insufficient_evidence') needsEvidenceCount += 1;
      seenReviewIds[next.reviewId] = true;
      rows.push(next);
    });
    reviewData.items.forEach((item) => {
      const id = String(item.row.reviewId || '').trim();
      const status = String(item.row.applyStatus || '').trim();
      if (id && !seenReviewIds[id] && status === 'applied') {
        rows.push(item.row);
        seenReviewIds[id] = true;
      }
    });
    rows.sort(compareGmailSalesContactBasisReviewRows_);
    writeObjectsToSheet_(context.reviewSheet, GMAIL_CONTACT_BASIS_REVIEW_HEADERS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS), rows);
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_queue_refresh', 'pass', {
      mode: 'write',
      reviewTabPropertyPresent: Boolean(context.reviewTabName),
      reviewTabResolved: Boolean(context.reviewSheet),
      headerReadBackPassed: true,
      sourceCandidatesEvaluatedCount,
      queueInsertedCount,
      queueUpdatedCount,
      existingReviewDecisionsPreservedCount,
      eligibleSuggestionCount,
      needsEvidenceCount,
      excludedCount,
      queueCount: rows.length,
      sourceCandidatesUpdated: false,
      googleSheetsUpdated: true
    });
  } finally {
    lock.releaseLock();
  }
}

function applyApprovedGmailSalesContactBasisReviewsOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const context = getGmailSalesContactBasisReviewContext_();
    if (!context.ok) {
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', 'blocked', {
        blockedReason: context.blockedReason
      });
    }
    const reviewData = readSheetObjects_(context.reviewSheet);
    const sourceData = readSheetObjects_(context.sourceSheet);
    const sourceByKey = {};
    sourceData.items.forEach((item) => {
      sourceByKey[buildGmailSalesContactSourceRowKey_(item.row, item.rowIndex)] = item;
    });
    const approvedRows = reviewData.items.filter((item) => String(item.row.reviewDecision || '').trim() === 'approved');
    const suspicious = detectSuspiciousBulkApprovalPattern_(approvedRows);
    if (suspicious.suspiciousBulkApprovalPattern) {
      updateReviewApplyStatuses_(context.reviewSheet, reviewData.headers, approvedRows, 'skipped_invalid', 'suspicious_bulk_approval_pattern');
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', 'blocked', {
        blockedReason: 'suspicious_bulk_approval_pattern',
        approvedRowsEvaluatedCount: approvedRows.length,
        suspiciousBulkApprovalPattern: true,
        identicalApprovalPatternCount: suspicious.identicalApprovalPatternCount,
        manualReviewRequired: true,
        googleSheetsUpdated: approvedRows.length > 0
      });
    }
    const now = new Date().toISOString();
    const updates = [];
    let skippedInvalidCount = 0;
    let skippedStaleSourceCount = 0;
    approvedRows.forEach((reviewItem) => {
      const validation = validateApprovedContactBasisReview_(reviewItem.row, sourceByKey);
      if (!validation.ok) {
        if (validation.errorCode === 'stale_source_data') {
          skippedStaleSourceCount += 1;
          setReviewApplyStatus_(context.reviewSheet, reviewData.headers, reviewItem.rowIndex, 'skipped_stale_source', validation.errorCode);
        } else {
          skippedInvalidCount += 1;
          setReviewApplyStatus_(context.reviewSheet, reviewData.headers, reviewItem.rowIndex, 'skipped_invalid', validation.errorCode);
        }
        return;
      }
      updates.push({
        reviewItem,
        sourceItem: validation.sourceItem,
        approvedBasisType: validation.approvedBasisType,
        sourceType: validation.sourceType,
        sourceReferenceHash: validation.sourceReferenceHash,
        now
      });
    });
    const beforeRows = updates.map((update) => ({
      rowIndex: update.sourceItem.rowIndex,
      values: GMAIL_CONTACT_BASIS_COLUMNS.map((field) => getCellByHeader_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, field))
    }));
    updates.forEach((update) => {
      writeContactBasisToSourceRow_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, update);
    });
    const readBackPassed = updates.every((update) => verifyContactBasisSourceRow_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, update));
    if (!readBackPassed) {
      beforeRows.forEach((snapshot) => {
        GMAIL_CONTACT_BASIS_COLUMNS.forEach((field, index) => {
          setCellByHeader_(context.sourceSheet, sourceData.headers, snapshot.rowIndex, field, snapshot.values[index]);
        });
      });
      updates.forEach((update) => {
        setReviewApplyStatus_(context.reviewSheet, reviewData.headers, update.reviewItem.rowIndex, 'rollback', 'read_back_mismatch');
      });
      return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', 'blocked', {
        blockedReason: 'read_back_mismatch',
        approvedRowsEvaluatedCount: approvedRows.length,
        validApprovedCount: updates.length,
        appliedCount: 0,
        skippedInvalidCount,
        skippedStaleSourceCount,
        rollbackExecuted: true,
        sourceCandidatesUpdated: false,
        googleSheetsUpdated: true
      });
    }
    updates.forEach((update) => {
      setReviewApplyStatus_(context.reviewSheet, reviewData.headers, update.reviewItem.rowIndex, 'applied', '');
      setCellByHeader_(context.reviewSheet, reviewData.headers, update.reviewItem.rowIndex, 'appliedAt', now);
    });
    const coverage = inspectGmailSalesContactBasisCoverage_({});
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_reviews_apply', updates.length > 0 ? 'pass' : 'blocked', {
      blockedReason: updates.length > 0 ? '' : 'no_valid_approved_reviews',
      mode: 'write',
      approvedRowsEvaluatedCount: approvedRows.length,
      validApprovedCount: updates.length,
      appliedCount: updates.length,
      skippedInvalidCount,
      skippedStaleSourceCount,
      rollbackExecuted: false,
      approvedBasisCountAfterApply: coverage.approvedBasisCount,
      eligibleAfterBasisCheckCount: coverage.eligibleAfterBasisCheckCount,
      operationalCandidateReady: coverage.operationalCandidateReady,
      sourceCandidatesUpdated: updates.length > 0,
      googleSheetsUpdated: approvedRows.length > 0
    });
  } finally {
    lock.releaseLock();
  }
}

function inspectGmailSalesContactBasisReviewQueue() {
  const context = getGmailSalesContactBasisReviewContext_({ allowMissing: true });
  const result = buildGmailSalesContactBasisReviewQueueInspection_(context);
  logGmailSalesJsonResult_(result);
  return result;
}

function inspectGmailSalesContactBasisReviewWorkflowReadiness() {
  const queue = inspectGmailSalesContactBasisReviewQueue();
  const coverage = inspectGmailSalesContactBasisCoverage_({});
  let recommendedNextAction = 'blocked_manual_review';
  if (!queue.reviewTabPresent) recommendedNextAction = 'install_review_workflow';
  else if (queue.totalQueueCount < 1) recommendedNextAction = 'refresh_review_queue';
  else if (queue.readyToApplyCount > 0) recommendedNextAction = 'apply_approved_reviews';
  else if (coverage.operationalCandidateReady) recommendedNextAction = 'ready_for_daily_pipeline';
  else if (queue.pendingCount > 0 || queue.needsMoreEvidenceCount > 0) recommendedNextAction = 'review_pending_rows';
  const result = {
    event: 'gmail_sales_contact_basis_review_workflow_readiness',
    mode: 'read_only',
    workflowInstalled: queue.reviewTabPresent && queue.reviewTabAccessible,
    queueGenerated: queue.totalQueueCount > 0,
    queueReviewProgressRate: queue.totalQueueCount > 0 ? (queue.approvedCount + queue.rejectedCount + queue.needsMoreEvidenceCount + queue.appliedCount) / queue.totalQueueCount : 0,
    readyToApplyCount: queue.readyToApplyCount,
    appliedApprovedCount: queue.appliedCount,
    eligibleAfterBasisCheckCount: coverage.eligibleAfterBasisCheckCount,
    operationalCandidateReady: coverage.operationalCandidateReady,
    remainingReviewCount: Math.max(0, GMAIL_DAILY_EXPECTED_COUNT - coverage.eligibleAfterBasisCheckCount),
    recommendedNextAction,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  logGmailSalesJsonResult_(result);
  return result;
}

function markGmailSalesContactBasisReviewRowsReviewedAtOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_mark_reviewed_at', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const context = getGmailSalesContactBasisReviewContext_();
  if (!context.ok) {
    return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_mark_reviewed_at', 'blocked', {
      blockedReason: context.blockedReason
    });
  }
  const data = readSheetObjects_(context.reviewSheet);
  const now = new Date().toISOString();
  let updatedCount = 0;
  data.items.forEach((item) => {
    const decision = String(item.row.reviewDecision || '').trim();
    const reviewedAt = String(item.row.reviewedAt || '').trim();
    const reviewerLabel = String(item.row.reviewerLabel || '').trim();
    if (!reviewedAt && reviewerLabel && ['approved', 'rejected', 'needs_more_evidence'].indexOf(decision) !== -1) {
      setCellByHeader_(context.reviewSheet, data.headers, item.rowIndex, 'reviewedAt', now);
      updatedCount += 1;
    }
  });
  return buildGmailSalesContactBasisReviewResult_('gmail_sales_contact_basis_review_mark_reviewed_at', 'pass', {
    mode: 'write',
    reviewedAtUpdatedCount: updatedCount,
    googleSheetsUpdated: updatedCount > 0
  });
}

function installGmailSalesAiVerificationConfigurationOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_configuration_install', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_configuration_install', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const before = props.getProperties();
    const defaultValues = {
      GMAIL_SALES_AI_ENABLED: 'false',
      GMAIL_SALES_AI_PROVIDER: 'disabled',
      GMAIL_SALES_AI_MAX_DAILY_REQUESTS: '100',
      GMAIL_SALES_AI_MAX_DAILY_COST_YEN: '100',
      GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: '0.95',
      GMAIL_SALES_AI_POLICY_VERSION: GMAIL_SALES_AI_DEFAULT_POLICY_VERSION,
      GMAIL_SALES_AI_DATA_MINIMIZATION_MODE: 'strict'
    };
    const defaults = {};
    let propertiesAddedCount = 0;
    Object.keys(defaultValues).forEach((key) => {
      if (before[key] === undefined || before[key] === '') {
        defaults[key] = defaultValues[key];
        propertiesAddedCount += 1;
      }
    });
    if (propertiesAddedCount > 0) props.setProperties(defaults, false);
    const context = getGmailSalesContactBasisReviewContext_({ allowMissing: true });
    let sourceColumnsAddedCount = 0;
    let reviewColumnsAddedCount = 0;
    let headerReadBackPassed = true;
    let headerValidationCellsCleared = 0;
    let headerValidationCountAfterRepair = 0;
    let dataRowValidationApplied = false;
    let suspiciousRepair = emptySuspiciousBulkRepairResult_();
    if (context.sourceSheet) {
      const sourceMigration = ensureSheetHeaders_(context.sourceSheet, GMAIL_CONTACT_BASIS_COLUMNS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS));
      sourceColumnsAddedCount = sourceMigration.columnsAddedCount;
      headerReadBackPassed = headerReadBackPassed && sourceMigration.readBackPassed;
    }
    if (context.reviewSheet) {
      const reviewMigration = ensureSheetHeaders_(context.reviewSheet, GMAIL_CONTACT_BASIS_REVIEW_HEADERS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS));
      reviewColumnsAddedCount = reviewMigration.columnsAddedCount;
      headerReadBackPassed = headerReadBackPassed && reviewMigration.readBackPassed;
      headerValidationCellsCleared += Number(reviewMigration.headerValidationCellsCleared || 0);
      configureGmailSalesReviewDataValidation_(context.reviewSheet);
      dataRowValidationApplied = reviewDataRowValidationConfigured_(context.reviewSheet);
      headerValidationCountAfterRepair = countHeaderDataValidations_(context.reviewSheet, getSheetHeaders_(context.reviewSheet).length || 1);
      suspiciousRepair = repairSuspiciousBulkApprovalRowsForAi_(context);
    }
    const config = getGmailSalesAiConfig_();
    const schema = buildGmailSalesContactBasisReviewSchemaInspection_(context);
    const propertyReadBackPassed = Object.keys(defaults).every((key) => String(props.getProperty(key) || '') === String(defaults[key]));
    const installPassed = headerReadBackPassed && headerValidationCountAfterRepair === 0 && dataRowValidationApplied && !suspiciousRepair.rollbackExecuted && propertyReadBackPassed && schema.schemaValid;
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_configuration_install', installPassed ? 'pass' : 'blocked', {
      blockedReason: installPassed ? '' : (suspiciousRepair.blockedReason || (!headerReadBackPassed ? 'header_read_back_failed' : (!dataRowValidationApplied ? 'data_row_validation_missing' : (!propertyReadBackPassed ? 'property_read_back_failed' : 'schema_invalid')))),
      mode: 'write',
      reviewTabResolved: Boolean(context.reviewSheet),
      headerValidationRepairRequired: headerValidationCellsCleared > 0,
      headerValidationCellsCleared,
      headerWritePassed: headerReadBackPassed,
      aiProvider: config.provider,
      aiEnabled: config.enabled,
      confidenceThreshold: config.confidenceThreshold,
      policyVersion: config.policyVersion,
      promptVersion: GMAIL_SALES_AI_PROMPT_VERSION,
      sourceAiAuditColumnsAddedCount: sourceColumnsAddedCount,
      reviewAiAuditColumnsAddedCount: reviewColumnsAddedCount,
      aiColumnsAddedCount: sourceColumnsAddedCount + reviewColumnsAddedCount,
      headerReadBackPassed,
      dataRowValidationApplied,
      headerValidationCountAfterRepair,
      suspiciousBulkRowsDetected: suspiciousRepair.detectedCount,
      suspiciousBulkRowsReset: suspiciousRepair.resetCount,
      suspiciousBulkRowsSkipped: suspiciousRepair.skippedCount,
      suspiciousBulkRowsStale: suspiciousRepair.staleCount,
      backupCreated: suspiciousRepair.backupCreated,
      rollbackExecuted: suspiciousRepair.rollbackExecuted,
      aiEligibleRowsAfterReset: suspiciousRepair.aiEligibleRowsAfterReset,
      propertiesAddedCount,
      propertiesUpdatedCount: 0,
      configurationInstalled: installPassed,
      sourceCandidatesUpdated: false,
      scriptPropertiesUpdated: propertiesAddedCount > 0,
      googleSheetsUpdated: sourceColumnsAddedCount + reviewColumnsAddedCount > 0 || headerValidationCellsCleared > 0 || suspiciousRepair.resetCount > 0
    });
  } finally {
    lock.releaseLock();
  }
}

function inspectGmailSalesAiContactBasisStatus() {
  const context = getGmailSalesContactBasisReviewContext_({ allowMissing: true });
  const config = getGmailSalesAiConfig_();
  const sourceData = context.sourceSheet ? readSheetObjects_(context.sourceSheet) : { headers: [], items: [] };
  const reviewData = context.reviewSheet ? readSheetObjects_(context.reviewSheet) : { headers: [], items: [] };
  const status = buildGmailSalesAiContactBasisStatus_(context, config, sourceData, reviewData);
  logGmailSalesJsonResult_(status);
  return status;
}

function configureGmailSalesAiNonSecretSettingsOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_non_secret_configuration', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const values = {
    GMAIL_SALES_AI_MAX_DAILY_REQUESTS: props.getProperty('GMAIL_SALES_AI_MAX_DAILY_REQUESTS') || '100',
    GMAIL_SALES_AI_MAX_DAILY_COST_YEN: props.getProperty('GMAIL_SALES_AI_MAX_DAILY_COST_YEN') || '100',
    GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: props.getProperty('GMAIL_SALES_AI_CONFIDENCE_THRESHOLD') || '0.95',
    GMAIL_SALES_AI_POLICY_VERSION: props.getProperty('GMAIL_SALES_AI_POLICY_VERSION') || GMAIL_SALES_AI_DEFAULT_POLICY_VERSION,
    GMAIL_SALES_AI_DATA_MINIMIZATION_MODE: props.getProperty('GMAIL_SALES_AI_DATA_MINIMIZATION_MODE') || 'strict'
  };
  if (!props.getProperty('GMAIL_SALES_AI_PROVIDER')) values.GMAIL_SALES_AI_PROVIDER = 'disabled';
  if (!props.getProperty('GMAIL_SALES_AI_ENABLED')) values.GMAIL_SALES_AI_ENABLED = 'false';
  props.setProperties(values, false);
  return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_non_secret_configuration', 'pass', {
    configurationSaved: true,
    aiEnabled: props.getProperty('GMAIL_SALES_AI_ENABLED') === 'true',
    providerConfigured: Boolean(props.getProperty('GMAIL_SALES_AI_PROVIDER')),
    modelConfigured: Boolean(props.getProperty('GMAIL_SALES_AI_MODEL')),
    apiKeyPresent: Boolean(props.getProperty('GMAIL_SALES_AI_API_KEY')),
    dailyRequestLimit: Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_REQUESTS') || '100'),
    dailyCostLimitYen: Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_COST_YEN') || '100'),
    confidenceThreshold: Number(props.getProperty('GMAIL_SALES_AI_CONFIDENCE_THRESHOLD') || '0.95'),
    scriptPropertiesUpdated: true
  });
}

function createGmailSalesAiSetupSessionOnce() {
  const session = createGmailSalesAiSetupSession_({ includeToken: false });
  logGmailSalesJsonResult_(session.publicResult);
  return session.publicResult;
}

function showGmailSalesAiProviderSetupDialog() {
  let ui = null;
  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi && typeof HtmlService !== 'undefined') {
      ui = SpreadsheetApp.getUi();
    }
  } catch (error) {
    ui = null;
  }
  if (!ui) {
    const fallback = buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_setup_dialog', 'pass', {
      dialogShown: false,
      standaloneFallbackAvailable: true,
      setupSessionCreated: false,
      setupTokenReturned: false,
      recommendedAction: 'open_web_app_exec_url'
    });
    return fallback;
  }
  const session = createGmailSalesAiSetupSessionForHtml_();
  if (session.publicResult.status !== 'pass') {
    logGmailSalesJsonResult_(session.publicResult);
    return session.publicResult;
  }
  const html = buildGmailSalesAiProviderSetupHtml_(session.rawToken);
  try {
    ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(640), 'Gmail Sales AI Provider Setup');
  } catch (error) {
    invalidateGmailSalesAiSetupSession_();
    const fallback = buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_setup_dialog', 'pass', {
      dialogShown: false,
      standaloneFallbackAvailable: true,
      setupSessionCreated: false,
      setupTokenReturned: false,
      recommendedAction: 'open_web_app_exec_url'
    });
    return fallback;
  }
  const result = Object.assign({}, session.publicResult, {
    event: 'gmail_sales_ai_provider_setup_dialog',
    dialogShown: true,
    standaloneFallbackAvailable: false,
    setupTokenReturned: false
  });
  logGmailSalesJsonResult_(result);
  return result;
}

function doGet(e) {
  return serveGmailSalesAiProviderSetupPage_(e);
}

function serveGmailSalesAiProviderSetupPage_(e) {
  const session = createGmailSalesAiSetupSessionForHtml_();
  const html = session.publicResult.status === 'pass'
    ? buildGmailSalesAiProviderSetupHtml_(session.rawToken)
    : buildGmailSalesAiProviderSetupErrorHtml_(session.publicResult.blockedReason || 'setup_session_failed');
  if (typeof HtmlService !== 'undefined') {
    return HtmlService.createHtmlOutput(html)
      .setTitle('Gmail Sales AI Provider Setup')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  return html;
}

function saveGmailSalesAiProviderConfiguration(input) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const payload = input || {};
    const tokenCheck = validateGmailSalesAiSetupToken_(payload.setupToken);
    if (!tokenCheck.ok) {
      return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', 'blocked', {
        blockedReason: tokenCheck.reason
      });
    }
    const provider = String(payload.provider || '').trim().toLowerCase();
    const model = String(payload.model || '').trim();
    const keepExistingApiKey = payload.keepExistingApiKey === true || String(payload.keepExistingApiKey || '').toLowerCase() === 'true';
    const apiKey = String(payload.apiKey || '').trim();
    const limitsValidation = validateGmailSalesAiLimits_(payload.dailyRequestLimit, payload.dailyCostLimitYen, payload.confidenceThreshold);
    if (!limitsValidation.ok) {
      return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', 'blocked', {
        blockedReason: 'invalid_limits'
      });
    }
    const dailyRequestLimit = limitsValidation.dailyRequestLimit;
    const dailyCostLimitYen = limitsValidation.dailyCostLimitYen;
    const confidenceThreshold = limitsValidation.confidenceThreshold;
    const validation = validateGmailSalesAiProviderSetupInput_(provider, model, apiKey, keepExistingApiKey, props);
    if (!validation.ok) {
      return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', 'blocked', {
        blockedReason: validation.reason
      });
    }
    const values = {
      GMAIL_SALES_AI_ENABLED: 'true',
      GMAIL_SALES_AI_PROVIDER: provider,
      GMAIL_SALES_AI_MODEL: model,
      GMAIL_SALES_AI_MAX_DAILY_REQUESTS: String(dailyRequestLimit),
      GMAIL_SALES_AI_MAX_DAILY_COST_YEN: String(dailyCostLimitYen),
      GMAIL_SALES_AI_CONFIDENCE_THRESHOLD: String(confidenceThreshold),
      GMAIL_SALES_AI_POLICY_VERSION: GMAIL_SALES_AI_DEFAULT_POLICY_VERSION,
      GMAIL_SALES_AI_DATA_MINIMIZATION_MODE: 'strict',
      GMAIL_SALES_AI_SETUP_TOKEN_USED: 'true',
      GMAIL_SALES_AI_SETUP_TOKEN_DIGEST: '',
      GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT: ''
    };
    if (!keepExistingApiKey || apiKey) values.GMAIL_SALES_AI_API_KEY = apiKey;
    props.setProperties(values, false);
    const keyPresent = Boolean(props.getProperty('GMAIL_SALES_AI_API_KEY'));
    const readBackPassed = props.getProperty('GMAIL_SALES_AI_ENABLED') === 'true' &&
      props.getProperty('GMAIL_SALES_AI_PROVIDER') === provider &&
      props.getProperty('GMAIL_SALES_AI_MODEL') === model &&
      keyPresent;
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration_save', readBackPassed ? 'pass' : 'blocked', {
      blockedReason: readBackPassed ? '' : 'configuration_readback_failed',
      configurationSaved: readBackPassed,
      aiEnabled: props.getProperty('GMAIL_SALES_AI_ENABLED') === 'true',
      providerConfigured: Boolean(props.getProperty('GMAIL_SALES_AI_PROVIDER')),
      provider,
      modelConfigured: Boolean(props.getProperty('GMAIL_SALES_AI_MODEL')),
      apiKeyPresent: keyPresent,
      dailyRequestLimit,
      dailyCostLimitYen,
      confidenceThreshold,
      policyVersion: GMAIL_SALES_AI_DEFAULT_POLICY_VERSION,
      dataMinimizationMode: 'strict',
      tokenUsed: true,
      scriptPropertiesUpdated: true
    });
  } finally {
    lock.releaseLock();
  }
}

function inspectGmailSalesAiProviderConfiguration() {
  const props = PropertiesService.getScriptProperties();
  const provider = String(props.getProperty('GMAIL_SALES_AI_PROVIDER') || '').trim();
  const model = String(props.getProperty('GMAIL_SALES_AI_MODEL') || '').trim();
  const keyPresent = Boolean(props.getProperty('GMAIL_SALES_AI_API_KEY'));
  const sessionState = getGmailSalesAiSetupSessionState_();
  const blockedReasons = [];
  if (['openai', 'gemini'].indexOf(provider) === -1) blockedReasons.push('provider_not_configured');
  if (!model) blockedReasons.push('model_missing');
  if (!keyPresent) blockedReasons.push('api_key_missing');
  const result = buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_provider_configuration', blockedReasons.length === 0 ? 'pass' : 'blocked', {
    mode: 'read_only',
    aiEnabled: props.getProperty('GMAIL_SALES_AI_ENABLED') === 'true',
    providerConfigured: ['openai', 'gemini'].indexOf(provider) !== -1,
    provider,
    modelConfigured: Boolean(model),
    apiKeyPresent: keyPresent,
    dailyRequestLimit: Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_REQUESTS') || '100'),
    dailyCostLimitYen: Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_COST_YEN') || '100'),
    confidenceThreshold: Number(props.getProperty('GMAIL_SALES_AI_CONFIDENCE_THRESHOLD') || '0.95'),
    policyVersion: String(props.getProperty('GMAIL_SALES_AI_POLICY_VERSION') || GMAIL_SALES_AI_DEFAULT_POLICY_VERSION),
    dataMinimizationMode: String(props.getProperty('GMAIL_SALES_AI_DATA_MINIMIZATION_MODE') || 'strict'),
    configurationValid: blockedReasons.length === 0,
    blockedReasons,
    setupSessionActive: sessionState.active,
    setupSessionExpired: sessionState.expired,
    setupSessionUsed: sessionState.used
  });
  logGmailSalesJsonResult_(result);
  return result;
}

function disableGmailSalesAiVerificationOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_disable', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  props.setProperties({ GMAIL_SALES_AI_ENABLED: 'false' }, false);
  return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_disable', 'pass', {
    aiEnabled: false,
    apiKeyPresent: Boolean(props.getProperty('GMAIL_SALES_AI_API_KEY')),
    scriptPropertiesUpdated: true
  });
}

function deleteGmailSalesAiApiKeyOnce(input) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_api_key_delete', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const tokenCheck = validateGmailSalesAiSetupToken_(input && input.setupToken);
  if (!tokenCheck.ok) {
    return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_api_key_delete', 'blocked', {
      blockedReason: tokenCheck.reason
    });
  }
  props.setProperties({
    GMAIL_SALES_AI_ENABLED: 'false',
    GMAIL_SALES_AI_API_KEY: '',
    GMAIL_SALES_AI_SETUP_TOKEN_USED: 'true',
    GMAIL_SALES_AI_SETUP_TOKEN_DIGEST: '',
    GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT: ''
  }, false);
  return buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_api_key_delete', 'pass', {
    aiEnabled: false,
    apiKeyPresent: false,
    tokenUsed: true,
    scriptPropertiesUpdated: true
  });
}

function runGmailSalesAiContactBasisVerificationOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
      blockedReason: 'safe_rest_required'
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
      blockedReason: 'lock_unavailable'
    });
  }
  try {
    const config = getGmailSalesAiConfig_();
    const context = getGmailSalesContactBasisReviewContext_();
    if (!context.ok) {
      return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
        blockedReason: context.blockedReason
      });
    }
    if (!config.enabled) {
      return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
        blockedReason: 'ai_disabled',
        aiProvider: config.provider,
        confidenceThreshold: config.confidenceThreshold
      });
    }
    if (GMAIL_SALES_AI_ALLOWED_PROVIDERS.indexOf(config.provider) === -1 || config.provider === 'disabled') {
      return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
        blockedReason: 'ai_provider_not_configured',
        aiProvider: config.provider
      });
    }
    const sourceMigration = ensureSheetHeaders_(context.sourceSheet, GMAIL_CONTACT_BASIS_COLUMNS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS));
    const reviewMigration = ensureSheetHeaders_(context.reviewSheet, GMAIL_CONTACT_BASIS_REVIEW_HEADERS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS));
    if (!sourceMigration.readBackPassed || !reviewMigration.readBackPassed) {
      return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
        blockedReason: 'header_read_back_failed',
        googleSheetsUpdated: sourceMigration.columnsAddedCount + reviewMigration.columnsAddedCount > 0
      });
    }
    const sourceData = readSheetObjects_(context.sourceSheet);
    const reviewData = readSheetObjects_(context.reviewSheet);
    const sourceByKey = {};
    sourceData.items.forEach((item) => {
      sourceByKey[buildGmailSalesContactSourceRowKey_(item.row, item.rowIndex)] = item;
    });
    const reviewById = {};
    reviewData.items.forEach((item) => {
      const id = String(item.row.reviewId || '').trim();
      if (id) reviewById[id] = item;
    });
    const now = new Date().toISOString();
    const updates = [];
    let sourceCandidatesEvaluatedCount = 0;
    let deterministicApprovedCount = 0;
    let aiEvaluatedCount = 0;
    let aiAutoApprovedCount = 0;
    let aiNeedsReviewCount = 0;
    let excludedCount = 0;
    let budgetBlockedCount = 0;
    const reasonCounts = {};
    const payloadFieldSet = {};
    const uniqueEvidenceDigests = {};
    sourceData.items.forEach((sourceItem) => {
      sourceCandidatesEvaluatedCount += 1;
      const queue = buildContactBasisReviewQueueRow_(sourceItem, now);
      if (!queue.include) {
        excludedCount += 1;
        incrementCount_(reasonCounts, queue.reason || 'excluded');
        return;
      }
      const existingReview = reviewById[queue.row.reviewId];
      const existingDecision = existingReview ? String(existingReview.row.reviewDecision || '').trim() : '';
      const existingApplyStatus = existingReview ? String(existingReview.row.applyStatus || '').trim() : '';
      if (existingApplyStatus === 'applied' || existingApplyStatus === 'applied_ai' || existingDecision === 'approved' || existingDecision === 'rejected') {
        excludedCount += 1;
        incrementCount_(reasonCounts, 'already_reviewed');
        return;
      }
      const evidence = collectGmailSalesContactBasisEvidence_(sourceItem.row, queue.row);
      const deterministic = buildDeterministicGmailSalesAiDecision_(evidence);
      let decision = deterministic;
      if (!decision.autoApproved && evidence.suggestedBasisType === 'valid_business_contact_exception') {
        if (!isGmailSalesAiBudgetAvailable_(config, aiEvaluatedCount + 1)) {
          budgetBlockedCount += 1;
          decision = {
            autoApproved: false,
            status: 'needs_human_review',
            approvedBasisType: '',
            confidence: 0,
            reasonCodes: ['ai_budget_exceeded'],
            riskFlags: ['budget_exceeded'],
            requiresHumanReview: true
          };
        } else {
          const payload = buildMinimizedAiEvidencePayload_(evidence, config);
          Object.keys(payload).forEach((field) => { payloadFieldSet[field] = true; });
          if (!validateGmailSalesAiPayloadMinimized_(payload)) {
            decision = {
              autoApproved: false,
              status: 'needs_human_review',
              approvedBasisType: '',
              confidence: 0,
              reasonCodes: ['payload_minimization_failed'],
              riskFlags: ['payload_minimization_failed'],
              requiresHumanReview: true
            };
          } else {
            aiEvaluatedCount += 1;
            const providerDecision = callGmailSalesAiProvider_(config, payload);
            decision = validateGmailSalesAiDecision_(providerDecision, evidence, config);
          }
        }
      }
      if (decision.autoApproved) {
        if (decision.providerDecision) aiAutoApprovedCount += 1;
        else deterministicApprovedCount += 1;
        uniqueEvidenceDigests[decision.evidenceDigest] = true;
        updates.push({
          sourceItem,
          reviewItem: existingReview || null,
          queueRow: queue.row,
          approvedBasisType: decision.approvedBasisType,
          sourceType: queue.row.sourceType,
          sourceReferenceHash: queue.row.sourceReferenceHash,
          aiDecision: decision,
          now
        });
      } else {
        aiNeedsReviewCount += 1;
        updates.push({
          sourceItem: null,
          reviewItem: existingReview || null,
          queueRow: queue.row,
          aiDecision: decision,
          now,
          needsHumanReview: true
        });
      }
      (decision.reasonCodes || []).forEach((reason) => incrementCount_(reasonCounts, reason));
    });
    const sourceUpdates = updates.filter((item) => item.sourceItem && !item.needsHumanReview);
    const beforeRows = sourceUpdates.map((update) => ({
      rowIndex: update.sourceItem.rowIndex,
      values: GMAIL_CONTACT_BASIS_COLUMNS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS).map((field) => getCellByHeader_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, field))
    }));
    sourceUpdates.forEach((update) => {
      writeContactBasisToSourceRow_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, update);
      writeAiAuditToSourceRow_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, update.aiDecision, update.now);
    });
    const readBackPassed = sourceUpdates.every((update) => verifyContactBasisSourceRow_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, update) &&
      String(getCellByHeader_(context.sourceSheet, sourceData.headers, update.sourceItem.rowIndex, 'aiEvidenceDigest') || '').trim() === update.aiDecision.evidenceDigest);
    if (!readBackPassed) {
      beforeRows.forEach((snapshot) => {
        GMAIL_CONTACT_BASIS_COLUMNS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS).forEach((field, index) => {
          setCellByHeader_(context.sourceSheet, sourceData.headers, snapshot.rowIndex, field, snapshot.values[index]);
        });
      });
      return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'blocked', {
        blockedReason: 'source_read_back_mismatch',
        rollbackExecuted: true,
        aiAutoApprovedCount,
        deterministicApprovedCount,
        sourceCandidatesUpdated: false,
        googleSheetsUpdated: true
      });
    }
    updates.forEach((update) => upsertGmailSalesAiReviewRow_(context.reviewSheet, reviewData.headers, update, reviewById));
    const coverage = inspectGmailSalesContactBasisCoverage_({});
    return buildGmailSalesAiContactBasisResult_('gmail_sales_ai_contact_basis_verification', 'pass', {
      mode: 'write',
      aiProvider: config.provider,
      aiEnabled: config.enabled,
      confidenceThreshold: config.confidenceThreshold,
      policyVersion: config.policyVersion,
      promptVersion: GMAIL_SALES_AI_PROMPT_VERSION,
      sourceCandidatesEvaluatedCount,
      deterministicApprovedCount,
      aiEvaluatedCount,
      aiAutoApprovedCount,
      aiNeedsReviewCount,
      excludedCount,
      budgetBlockedCount,
      aiAppliedCount: sourceUpdates.length,
      uniqueEvidenceDigestCount: Object.keys(uniqueEvidenceDigests).length,
      aiBulkApprovalBlocked: false,
      rejectionReasonCounts: reasonCounts,
      dataMinimizationMode: config.dataMinimizationMode,
      payloadFields: Object.keys(payloadFieldSet).sort(),
      approvedBasisCountAfterApply: coverage.approvedBasisCount,
      eligibleAfterBasisCheckCount: coverage.eligibleAfterBasisCheckCount,
      operationalCandidateReady: coverage.operationalCandidateReady,
      sourceCandidatesUpdated: sourceUpdates.length > 0,
      googleSheetsUpdated: updates.length > 0 || sourceMigration.columnsAddedCount + reviewMigration.columnsAddedCount > 0
    });
  } finally {
    lock.releaseLock();
  }
}

function emptySuspiciousBulkRepairResult_() {
  return {
    detectedCount: 0,
    resetCount: 0,
    skippedCount: 0,
    staleCount: 0,
    backupCreated: false,
    rollbackExecuted: false,
    aiEligibleRowsAfterReset: 0,
    blockedReason: ''
  };
}

function repairSuspiciousBulkApprovalRowsForAi_(context) {
  const result = emptySuspiciousBulkRepairResult_();
  if (!context || !context.reviewSheet || !context.sourceSheet) return result;
  const reviewData = readSheetObjects_(context.reviewSheet);
  const sourceData = readSheetObjects_(context.sourceSheet);
  const sourceByKey = {};
  sourceData.items.forEach((item) => {
    sourceByKey[buildGmailSalesContactSourceRowKey_(item.row, item.rowIndex)] = item;
  });
  const targets = [];
  reviewData.items.forEach((item) => {
    const validation = isSuspiciousBulkApprovalResetCandidate_(item.row, sourceByKey);
    if (validation.ok) {
      targets.push(item);
      result.detectedCount += 1;
    } else if (validation.stale) {
      result.staleCount += 1;
    } else if (validation.looksSuspicious) {
      result.skippedCount += 1;
    }
  });
  if (targets.length === 0) {
    result.aiEligibleRowsAfterReset = countAiEligibleReviewRows_(reviewData.items, sourceByKey);
    return result;
  }
  const resetFields = ['reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable', 'reviewerLabel', 'reviewedAt', 'applyStatus', 'applyErrorCode', 'appliedAt'];
  const preservedFields = ['reviewId', 'sourceRowKey', 'leadIdHash', 'sourceRowDigest', 'sourceType', 'sourceReference', 'sourceReferenceHash', 'existingRelationshipEvidence', 'explicitOptInEvidence', 'businessContactEvidence', 'existingContactBasisType', 'suggestedBasisType', 'suggestionReasonCode', 'priorityRank', 'priorityReasonCode', 'lastQueueSyncedAt'];
  const snapshots = targets.map((item) => ({
    rowIndex: item.rowIndex,
    resetValues: resetFields.map((field) => getCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, field)),
    preservedValues: preservedFields.map((field) => getCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, field))
  }));
  result.backupCreated = createGmailSalesSuspiciousBulkResetBackup_(context, targets, reviewData.headers, resetFields);
  targets.forEach((item) => {
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'reviewDecision', 'pending');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'approvedBasisType', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'evidenceNotes', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'optOutAvailable', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'reviewerLabel', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'reviewedAt', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'applyStatus', 'pending');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'applyErrorCode', '');
    setCellByHeader_(context.reviewSheet, reviewData.headers, item.rowIndex, 'appliedAt', '');
  });
  SpreadsheetApp.flush();
  const readBackPassed = snapshots.every((snapshot) => {
    const resetOk = String(getCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, 'reviewDecision') || '') === 'pending' &&
      String(getCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, 'applyStatus') || '') === 'pending' &&
      !String(getCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, 'approvedBasisType') || '') &&
      !String(getCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, 'applyErrorCode') || '');
    const preservedOk = preservedFields.every((field, index) => String(getCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, field) || '') === String(snapshot.preservedValues[index] || ''));
    return resetOk && preservedOk;
  });
  if (!readBackPassed) {
    snapshots.forEach((snapshot) => {
      resetFields.forEach((field, index) => {
        setCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, field, snapshot.resetValues[index]);
      });
      preservedFields.forEach((field, index) => {
        setCellByHeader_(context.reviewSheet, reviewData.headers, snapshot.rowIndex, field, snapshot.preservedValues[index]);
      });
    });
    result.rollbackExecuted = true;
    result.blockedReason = 'suspicious_bulk_reset_read_back_failed';
    result.aiEligibleRowsAfterReset = 0;
    return result;
  }
  result.resetCount = targets.length;
  const afterData = readSheetObjects_(context.reviewSheet);
  result.aiEligibleRowsAfterReset = countAiEligibleReviewRows_(afterData.items, sourceByKey);
  return result;
}

function createGmailSalesSuspiciousBulkResetBackup_(context, targets, headers, resetFields) {
  if (!context.spreadsheet || typeof context.spreadsheet.insertSheet !== 'function') return false;
  const name = '_gmail_ai_bulk_reset_backup_' + new Date().getTime();
  const backup = context.spreadsheet.insertSheet(name);
  const backupHeaders = ['backupTimestamp', 'operationId', 'rowIndex', 'sourceRowKey', 'sourceRowDigest'].concat(resetFields);
  const timestamp = new Date().toISOString();
  const operationId = 'ai-bulk-reset-' + hashValue_(timestamp + '|' + targets.length);
  const rows = [backupHeaders].concat(targets.map((item) => {
    const row = item.row || {};
    return [timestamp, operationId, item.rowIndex, row.sourceRowKey || '', row.sourceRowDigest || ''].concat(resetFields.map((field) => row[field] === undefined ? '' : row[field]));
  }));
  backup.getRange(1, 1, rows.length, backupHeaders.length).setValues(rows);
  return true;
}

function isSuspiciousBulkApprovalResetCandidate_(row, sourceByKey) {
  const decision = String(row.reviewDecision || '').trim();
  const applyStatus = String(row.applyStatus || '').trim();
  const errorCode = String(row.applyErrorCode || '').trim();
  const looksSuspicious = decision === 'approved' && applyStatus === 'skipped_invalid' && errorCode === 'suspicious_bulk_approval_pattern';
  if (!looksSuspicious) return { ok: false, looksSuspicious: false, stale: false, reason: 'not_suspicious_bulk' };
  if (String(row.appliedAt || '').trim()) return { ok: false, looksSuspicious, stale: false, reason: 'already_applied_at_present' };
  if (String(row.aiAutoApproved || '').toLowerCase() === 'true' || applyStatus === 'applied_ai') return { ok: false, looksSuspicious, stale: false, reason: 'ai_approved_protected' };
  if (['applied', 'applied_ai'].indexOf(applyStatus) !== -1) return { ok: false, looksSuspicious, stale: false, reason: 'applied_protected' };
  const reviewer = String(row.reviewerLabel || '').trim();
  if (reviewer && ['operator_reviewed', 'human_reviewed', 'manual_reviewed'].indexOf(reviewer) === -1) return { ok: false, looksSuspicious, stale: false, reason: 'reviewer_not_resettable' };
  const sourceItem = sourceByKey[String(row.sourceRowKey || '').trim()];
  if (!sourceItem) return { ok: false, looksSuspicious, stale: true, reason: 'source_row_missing' };
  if (hasAllowedGmailSalesContactBasis_(sourceItem.row)) return { ok: false, looksSuspicious, stale: false, reason: 'source_already_has_basis' };
  if (String(getContactBasisValue_(sourceItem.row, 'contactBasisRecordedAt') || '').trim()) return { ok: false, looksSuspicious, stale: false, reason: 'source_basis_recorded' };
  if (String(sourceItem.row.aiVerificationStatus || '').trim() === 'applied') return { ok: false, looksSuspicious, stale: false, reason: 'source_ai_applied' };
  const queue = buildContactBasisReviewQueueRow_(sourceItem, new Date().toISOString());
  if (!queue.include || String(queue.row.sourceRowDigest || '') !== String(row.sourceRowDigest || '').trim()) {
    return { ok: false, looksSuspicious, stale: true, reason: 'source_digest_mismatch' };
  }
  return { ok: true, looksSuspicious, stale: false, reason: '' };
}

function isAiEligibleReviewQueueRow_(row, sourceByKey) {
  const decision = String(row.reviewDecision || '').trim();
  const applyStatus = String(row.applyStatus || '').trim();
  if (['pending', 'needs_more_evidence'].indexOf(decision) === -1) return false;
  if (['applied', 'applied_ai'].indexOf(applyStatus) !== -1) return false;
  const sourceItem = sourceByKey[String(row.sourceRowKey || '').trim()];
  if (!sourceItem) return false;
  const queue = buildContactBasisReviewQueueRow_(sourceItem, new Date().toISOString());
  return queue.include && String(queue.row.sourceRowDigest || '') === String(row.sourceRowDigest || '').trim();
}

function countAiEligibleReviewRows_(items, sourceByKey) {
  return (items || []).filter((item) => isAiEligibleReviewQueueRow_(item.row || {}, sourceByKey)).length;
}

function getGmailSalesAiConfig_() {
  const props = PropertiesService.getScriptProperties();
  const provider = String(props.getProperty('GMAIL_SALES_AI_PROVIDER') || 'disabled').trim().toLowerCase();
  const threshold = Number(props.getProperty('GMAIL_SALES_AI_CONFIDENCE_THRESHOLD') || '0.95');
  return {
    enabled: props.getProperty('GMAIL_SALES_AI_ENABLED') === 'true',
    provider: GMAIL_SALES_AI_ALLOWED_PROVIDERS.indexOf(provider) === -1 ? 'disabled' : provider,
    model: String(props.getProperty('GMAIL_SALES_AI_MODEL') || '').trim(),
    confidenceThreshold: Number.isFinite(threshold) ? threshold : 0.95,
    maxDailyRequests: Math.max(0, Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_REQUESTS') || '100')),
    maxDailyCostYen: Math.max(0, Number(props.getProperty('GMAIL_SALES_AI_MAX_DAILY_COST_YEN') || '100')),
    policyVersion: String(props.getProperty('GMAIL_SALES_AI_POLICY_VERSION') || GMAIL_SALES_AI_DEFAULT_POLICY_VERSION).trim(),
    dataMinimizationMode: String(props.getProperty('GMAIL_SALES_AI_DATA_MINIMIZATION_MODE') || 'strict').trim(),
    mockAutoApprovalEnabled: props.getProperty('GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED') === 'true',
    apiKey: String(props.getProperty('GMAIL_SALES_AI_API_KEY') || '').trim(),
    apiKeyConfigured: Boolean(props.getProperty('GMAIL_SALES_AI_API_KEY')),
    externalEvidenceEnabled: props.getProperty('GMAIL_SALES_AI_EXTERNAL_EVIDENCE_ENABLED') === 'true'
  };
}

function buildGmailSalesAiContactBasisStatus_(context, config, sourceData, reviewData) {
  const schema = buildGmailSalesContactBasisReviewSchemaInspection_(context);
  const statusCounts = {};
  const basisCounts = {};
  let pendingCount = 0;
  let approvedAiCount = 0;
  let appliedAiCount = 0;
  let needsMoreEvidenceCount = 0;
  (reviewData.items || []).forEach((item) => {
    const decision = String(item.row.reviewDecision || 'pending').trim() || 'pending';
    const applyStatus = String(item.row.applyStatus || 'pending').trim() || 'pending';
    incrementCount_(statusCounts, decision);
    if (decision === 'pending') pendingCount += 1;
    if (decision === 'approved_ai') approvedAiCount += 1;
    if (decision === 'needs_more_evidence') needsMoreEvidenceCount += 1;
    if (applyStatus === 'applied_ai') appliedAiCount += 1;
  });
  (sourceData.items || []).forEach((item) => {
    const basis = normalizeContactBasisType_(getContactBasisValue_(item.row, 'contactBasisType')) || 'missing';
    incrementCount_(basisCounts, basis);
  });
  return {
    event: 'gmail_sales_ai_contact_basis_status',
    mode: 'read_only',
    aiEnabled: config.enabled,
    aiProvider: config.provider,
    aiModelConfigured: Boolean(config.model),
    aiApiKeyConfigured: config.apiKeyConfigured,
    confidenceThreshold: config.confidenceThreshold,
    policyVersion: config.policyVersion,
    promptVersion: GMAIL_SALES_AI_PROMPT_VERSION,
    dataMinimizationMode: config.dataMinimizationMode,
    sourceSheetPresent: Boolean(context.sourceSheet),
    reviewSheetPresent: Boolean(context.reviewSheet),
    sourceCandidateCount: (sourceData.items || []).length,
    reviewQueueCount: (reviewData.items || []).length,
    pendingReviewCount: pendingCount,
    approvedAiCount,
    appliedAiCount,
    needsMoreEvidenceCount,
    reviewDecisionCounts: statusCounts,
    contactBasisCounts: basisCounts,
    reviewHeaderValid: schema.schemaValid,
    reviewHeaderValidationCount: schema.headerValidationCount,
    reviewDataValidationConfigured: schema.dataRowValidationConfigured,
    aiConfigurationInstalled: schema.requiredHeadersPresent,
    suspiciousBulkRowsRemaining: schema.suspiciousBulkRowsRemaining,
    aiEligibleQueueCount: schema.pendingAiEligibleCount,
    blockedReasons: schema.blockedReasons,
    expectedAiAuditColumnCount: GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS.length,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  };
}

function createGmailSalesAiSetupSession_(options) {
  const settings = options || {};
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false' || props.getProperty('LIVE_SEND_ENABLED') !== 'false') {
    return {
      token: '',
      publicResult: buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_setup_session_create', 'blocked', {
        blockedReason: 'safe_rest_required'
      }, { skipLog: true })
    };
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return {
      token: '',
      publicResult: buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_setup_session_create', 'blocked', {
        blockedReason: 'lock_unavailable'
      }, { skipLog: true })
    };
  }
  try {
    const token = Utilities.getUuid() + '-' + Utilities.getUuid();
    const expiresAt = new Date(Date.now() + GMAIL_SALES_AI_SETUP_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    props.setProperties({
      GMAIL_SALES_AI_SETUP_TOKEN_DIGEST: digestGmailSalesAiSetupToken_(token),
      GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT: expiresAt,
      GMAIL_SALES_AI_SETUP_TOKEN_USED: 'false',
      GMAIL_SALES_AI_SETUP_SESSION_VERSION: '1'
    }, false);
    return {
      token: settings.includeToken ? token : '',
      publicResult: buildGmailSalesAiProviderSetupResult_('gmail_sales_ai_setup_session_create', 'pass', {
        setupSessionCreated: true,
        setupTokenStoredAsDigest: true,
        setupTokenReturned: false,
        tokenExpiryMinutes: GMAIL_SALES_AI_SETUP_TOKEN_TTL_MINUTES,
        expiresAtPresent: true,
        scriptPropertiesUpdated: true
      }, { skipLog: true })
    };
  } finally {
    lock.releaseLock();
  }
}

function createGmailSalesAiSetupSessionForHtml_() {
  const session = createGmailSalesAiSetupSession_({ includeToken: true });
  return {
    rawToken: session.token,
    expiresAt: session.publicResult.expiresAtPresent ? PropertiesService.getScriptProperties().getProperty(GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT_PROPERTY) : '',
    publicResult: session.publicResult
  };
}

function validateGmailSalesAiSetupToken_(token) {
  const props = PropertiesService.getScriptProperties();
  const value = String(token || '').trim();
  if (!value) return { ok: false, reason: 'setup_token_missing' };
  if (props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_USED_PROPERTY) === 'true') return { ok: false, reason: 'setup_token_already_used' };
  const expiresAt = Date.parse(String(props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT_PROPERTY) || ''));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return { ok: false, reason: 'setup_token_expired' };
  const expected = String(props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_DIGEST_PROPERTY) || '').trim();
  if (!expected || !constantTimeStringEquals_(digestGmailSalesAiSetupToken_(value), expected)) return { ok: false, reason: 'setup_token_invalid' };
  return { ok: true, reason: '' };
}

function getGmailSalesAiSetupSessionState_() {
  const props = PropertiesService.getScriptProperties();
  const digest = String(props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_DIGEST_PROPERTY) || '').trim();
  const used = props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_USED_PROPERTY) === 'true';
  const expiresAt = Date.parse(String(props.getProperty(GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT_PROPERTY) || ''));
  const expired = Boolean(digest) && (!Number.isFinite(expiresAt) || expiresAt < Date.now());
  return {
    active: Boolean(digest) && !used && !expired,
    expired,
    used
  };
}

function invalidateGmailSalesAiSetupSession_() {
  PropertiesService.getScriptProperties().setProperties({
    GMAIL_SALES_AI_SETUP_TOKEN_DIGEST: '',
    GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT: '',
    GMAIL_SALES_AI_SETUP_TOKEN_USED: 'true'
  }, false);
}

function digestGmailSalesAiSetupToken_(token) {
  return sha256Hex_(String(token || ''));
}

function constantTimeStringEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function validateGmailSalesAiProviderSetupInput_(provider, model, apiKey, keepExistingApiKey, props) {
  if (['openai', 'gemini'].indexOf(provider) === -1) return { ok: false, reason: 'invalid_provider' };
  if (!model || model.length > 120 || !/^[A-Za-z0-9._:/@+-]+$/.test(model)) return { ok: false, reason: 'invalid_model' };
  if (keepExistingApiKey && props.getProperty('GMAIL_SALES_AI_API_KEY') && !apiKey) return { ok: true, reason: '' };
  if (!apiKey) return { ok: false, reason: 'invalid_api_key_format' };
  if (apiKey.length < 20 || apiKey.length > 300 || /\s/.test(apiKey)) return { ok: false, reason: 'invalid_api_key_format' };
  return { ok: true, reason: '' };
}

function validateGmailSalesAiLimits_(requestLimit, costLimit, threshold) {
  const dailyRequestLimit = requestLimit === undefined || requestLimit === '' ? 100 : Number(requestLimit);
  const dailyCostLimitYen = costLimit === undefined || costLimit === '' ? 100 : Number(costLimit);
  const confidenceThreshold = threshold === undefined || threshold === '' ? 0.95 : Number(threshold);
  if (!Number.isFinite(dailyRequestLimit) || dailyRequestLimit < 1 || dailyRequestLimit > 1000) return { ok: false };
  if (!Number.isFinite(dailyCostLimitYen) || dailyCostLimitYen < 0 || dailyCostLimitYen > 100000) return { ok: false };
  if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < 0.5 || confidenceThreshold > 1) return { ok: false };
  return {
    ok: true,
    dailyRequestLimit: Math.floor(dailyRequestLimit),
    dailyCostLimitYen: Math.floor(dailyCostLimitYen),
    confidenceThreshold
  };
}

function buildGmailSalesAiProviderSetupHtml_(setupToken) {
  const escapedToken = escapeHtml_(setupToken || '');
  return '<!doctype html><html><head><base target="_top">' +
    '<meta name="referrer" content="no-referrer"><style>body{font-family:Arial,sans-serif;padding:16px;line-height:1.4}label{display:block;margin-top:12px;font-weight:600}input,select{width:100%;box-sizing:border-box;padding:8px;margin-top:4px}button{margin-top:16px;padding:10px 14px}.result{margin-top:12px;white-space:pre-wrap}</style></head><body>' +
    '<h2>Gmail Sales AI Provider Setup</h2>' +
    '<p>API key is sent only to Apps Script server code and is never displayed after saving.</p>' +
    '<form id="setupForm" autocomplete="off">' +
    '<label>Provider<select id="provider" name="provider"><option value="openai">openai</option><option value="gemini">gemini</option></select></label>' +
    '<label>Model<input id="model" name="model" value="gpt-4.1-mini" autocomplete="off"></label>' +
    '<label>API key<input id="apiKey" name="apiKey" type="password" autocomplete="off"></label>' +
    '<label><input id="keepExistingApiKey" name="keepExistingApiKey" type="checkbox" style="width:auto"> Keep existing API key</label>' +
    '<label>Daily request limit<input id="dailyRequestLimit" name="dailyRequestLimit" type="number" value="100" min="1" max="1000"></label>' +
    '<label>Daily cost limit JPY<input id="dailyCostLimitYen" name="dailyCostLimitYen" type="number" value="100" min="0" max="100000"></label>' +
    '<label>Confidence threshold<input id="confidenceThreshold" name="confidenceThreshold" type="number" value="0.95" min="0.5" max="1" step="0.01"></label>' +
    '<label><input id="confirm" name="confirm" type="checkbox" style="width:auto"> I understand this only configures AI provider settings.</label>' +
    '<button type="submit">Save AI Provider Settings</button></form><div id="result" class="result"></div>' +
    '<script>(function(){var setupToken="' + escapedToken + '";function messageFor(code){return {setup_token_missing:"セットアップセッションがありません。ページを再読み込みしてください。",setup_token_invalid:"セットアップセッションを確認できません。ページを再読み込みしてください。",setup_token_expired:"セットアップセッションが期限切れです。ページを再読み込みしてください。",setup_token_already_used:"このセットアップセッションは使用済みです。ページを再読み込みしてください。",invalid_provider:"Providerまたはモデルの入力を確認してください。",invalid_model:"Providerまたはモデルの入力を確認してください。",invalid_api_key_format:"API keyの入力を確認してください。",invalid_limits:"上限値の入力を確認してください。",configuration_readback_failed:"設定を保存できませんでした。ページを再読み込みしてください。"}[code]||"設定を保存できませんでした。ページを再読み込みしてください。";}document.getElementById("setupForm").addEventListener("submit",function(ev){ev.preventDefault();var api=document.getElementById("apiKey");if(!document.getElementById("confirm").checked){document.getElementById("result").textContent="Confirmation is required.";return;}var payload={provider:provider.value,model:model.value,apiKey:api.value,dailyRequestLimit:dailyRequestLimit.value,dailyCostLimitYen:dailyCostLimitYen.value,confidenceThreshold:confidenceThreshold.value,keepExistingApiKey:keepExistingApiKey.checked,setupToken:setupToken};google.script.run.withSuccessHandler(function(res){api.value="";if(res.status==="pass"){setupToken="";}document.getElementById("result").textContent=JSON.stringify({status:res.status,blockedReason:res.blockedReason||"",message:res.status==="pass"?"Saved":messageFor(res.blockedReason),provider:res.provider,modelConfigured:res.modelConfigured,apiKeyPresent:res.apiKeyPresent,configurationSaved:res.configurationSaved},null,2);}).withFailureHandler(function(){api.value="";setupToken="";document.getElementById("result").textContent="設定を保存できませんでした。ページを再読み込みしてください。";}).saveGmailSalesAiProviderConfiguration(payload);});})();</script>' +
    '</body></html>';
}

function buildGmailSalesAiProviderSetupErrorHtml_(reason) {
  const safeReason = escapeHtml_(String(reason || 'setup_session_failed'));
  return '<!doctype html><html><head><base target="_top"></head><body><h2>Gmail Sales AI Provider Setup</h2><p>Setup session could not be created. Reload this page.</p><p>Reason: ' + safeReason + '</p></body></html>';
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function buildGmailSalesAiProviderSetupResult_(event, status, overrides, options) {
  const result = Object.assign({
    event,
    mode: 'write',
    status,
    blockedReason: '',
    aiEnabled: false,
    providerConfigured: false,
    provider: '',
    modelConfigured: false,
    apiKeyPresent: false,
    configurationSaved: false,
    gmailSendExecuted: false,
    gmailDraftCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false,
    aiApiCalled: false
  }, overrides || {});
  if (!(options && options.skipLog)) {
    appendSafeLog_(result);
    logGmailSalesJsonResult_(result);
  }
  return result;
}

function collectGmailSalesContactBasisEvidence_(sourceRow, queueRow) {
  const row = sourceRow || {};
  return {
    sourceRowDigest: String(queueRow.sourceRowDigest || '').trim(),
    sourceRowKey: String(queueRow.sourceRowKey || '').trim(),
    sourceType: String(queueRow.sourceType || '').trim(),
    sourceReferenceHash: String(queueRow.sourceReferenceHash || '').trim(),
    sourceReferencePresent: Boolean(String(queueRow.sourceReference || '').trim()),
    existingRelationshipEvidencePresent: Boolean(String(queueRow.existingRelationshipEvidence || '').trim()),
    explicitOptInEvidencePresent: Boolean(String(queueRow.explicitOptInEvidence || '').trim()),
    businessContactEvidencePresent: Boolean(String(queueRow.businessContactEvidence || '').trim()),
    suggestedBasisType: normalizeContactBasisType_(queueRow.suggestedBasisType),
    suggestionReasonCode: String(queueRow.suggestionReasonCode || '').trim(),
    domainHash: hashValue_(extractEmailDomain_(row.email || row.contactEmail || '')),
    sourceReferenceHashDigest: String(queueRow.sourceReferenceHash || '').trim(),
    optOutAvailable: true,
    personalEmail: isLikelyPersonalEmail_(row.email || row.contactEmail || ''),
    evidenceDigest: buildGmailSalesAiEvidenceDigest_(queueRow)
  };
}

function buildDeterministicGmailSalesAiDecision_(evidence) {
  if (evidence.explicitOptInEvidencePresent) {
    return buildGmailSalesAiDecision_('pass', 'explicit_opt_in', 1, ['deterministic_explicit_opt_in'], [], false, evidence, false);
  }
  if (evidence.existingRelationshipEvidencePresent) {
    return buildGmailSalesAiDecision_('pass', 'existing_relationship', 1, ['deterministic_existing_relationship'], [], false, evidence, false);
  }
  if (evidence.suggestedBasisType === 'manual_legal_reviewed') {
    return buildGmailSalesAiDecision_('needs_human_review', '', 0, ['manual_legal_review_required'], ['manual_review_not_ai_approvable'], true, evidence, false);
  }
  return buildGmailSalesAiDecision_('needs_ai', '', 0, ['ai_required'], [], true, evidence, false);
}

function buildMinimizedAiEvidencePayload_(evidence, config) {
  return {
    task: 'contact_basis_verification',
    policyVersion: config.policyVersion,
    promptVersion: GMAIL_SALES_AI_PROMPT_VERSION,
    sourceRowDigest: evidence.sourceRowDigest,
    sourceType: evidence.sourceType,
    sourceReferenceHash: evidence.sourceReferenceHash,
    sourceReferencePresent: evidence.sourceReferencePresent,
    businessContactEvidencePresent: evidence.businessContactEvidencePresent,
    suggestedBasisType: evidence.suggestedBasisType,
    suggestionReasonCode: evidence.suggestionReasonCode,
    domainHash: evidence.domainHash,
    evidenceDigest: evidence.evidenceDigest,
    optOutAvailable: evidence.optOutAvailable,
    personalEmail: evidence.personalEmail
  };
}

function validateGmailSalesAiPayloadMinimized_(payload) {
  const forbidden = ['email', 'contactEmail', 'name', 'businessDisplayName', 'sourceReference', 'sourceUrl', 'body', 'subject'];
  return forbidden.every((field) => payload[field] === undefined) &&
    Boolean(payload.sourceRowDigest) &&
    Boolean(payload.evidenceDigest) &&
    Boolean(payload.sourceReferenceHash);
}

function callGmailSalesAiProvider_(config, payload) {
  if (config.provider === 'mock') {
    if (config.mockAutoApprovalEnabled && payload.suggestedBasisType === 'valid_business_contact_exception' && payload.businessContactEvidencePresent && !payload.personalEmail) {
      return {
        status: 'pass',
        approvedBasisType: 'valid_business_contact_exception',
        confidence: 0.97,
        reasonCodes: ['mock_business_contact_verified'],
        riskFlags: [],
        requiresHumanReview: false,
        evidenceDigest: payload.evidenceDigest,
        sourceRowDigest: payload.sourceRowDigest
      };
    }
    return {
      status: 'blocked',
      approvedBasisType: '',
      confidence: 0,
      reasonCodes: ['mock_provider_no_auto_approval'],
      riskFlags: ['mock_manual_review_required'],
      requiresHumanReview: true,
      evidenceDigest: payload.evidenceDigest,
      sourceRowDigest: payload.sourceRowDigest
    };
  }
  if (!config.apiKeyConfigured) {
    return {
      status: 'blocked',
      approvedBasisType: '',
      confidence: 0,
      reasonCodes: ['ai_api_key_missing'],
      riskFlags: ['provider_not_callable'],
      requiresHumanReview: true,
      evidenceDigest: payload.evidenceDigest,
      sourceRowDigest: payload.sourceRowDigest
    };
  }
  if (config.provider === 'openai' || config.provider === 'gemini') {
    return callExternalGmailSalesAiProvider_(config, payload);
  }
  return {
    status: 'blocked',
    approvedBasisType: '',
    confidence: 0,
    reasonCodes: ['external_provider_call_disabled_in_safe_code_path'],
    riskFlags: ['manual_review_required'],
    requiresHumanReview: true,
    evidenceDigest: payload.evidenceDigest,
    sourceRowDigest: payload.sourceRowDigest
  };
}

function callExternalGmailSalesAiProvider_(config, payload) {
  const prompt = JSON.stringify({
    instruction: 'Return JSON only. Verify whether this minimized evidence supports valid_business_contact_exception under the configured policy.',
    requiredSchema: {
      status: 'pass|blocked',
      approvedBasisType: 'valid_business_contact_exception|',
      confidence: 'number 0..1',
      reasonCodes: ['classification strings only'],
      riskFlags: ['risk strings only'],
      requiresHumanReview: 'boolean',
      evidenceDigest: payload.evidenceDigest,
      sourceRowDigest: payload.sourceRowDigest
    },
    payload
  });
  try {
    if (config.provider === 'openai') {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + config.apiKey },
        payload: JSON.stringify({
          model: config.model || 'gpt-4.1-mini',
          input: prompt
        })
      });
      return parseGmailSalesAiProviderJson_(response, payload);
    }
    const model = encodeURIComponent(config.model || 'gemini-1.5-flash');
    const response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(config.apiKey), {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    return parseGmailSalesAiProviderJson_(response, payload);
  } catch (error) {
    return {
      status: 'blocked',
      approvedBasisType: '',
      confidence: 0,
      reasonCodes: ['ai_provider_exception_' + safeErrorCode_(error)],
      riskFlags: ['provider_exception'],
      requiresHumanReview: true,
      evidenceDigest: payload.evidenceDigest,
      sourceRowDigest: payload.sourceRowDigest
    };
  }
}

function parseGmailSalesAiProviderJson_(response, payload) {
  const statusCode = typeof response.getResponseCode === 'function' ? response.getResponseCode() : 0;
  if (statusCode < 200 || statusCode >= 300) {
    return {
      status: 'blocked',
      approvedBasisType: '',
      confidence: 0,
      reasonCodes: ['ai_provider_http_' + statusCode],
      riskFlags: ['provider_http_error'],
      requiresHumanReview: true,
      evidenceDigest: payload.evidenceDigest,
      sourceRowDigest: payload.sourceRowDigest
    };
  }
  const body = String(typeof response.getContentText === 'function' ? response.getContentText() : '');
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    return buildGmailSalesAiInvalidProviderResponse_(payload, 'ai_provider_json_invalid');
  }
  const text = String(parsed.output_text ||
    (((parsed.output || [])[0] || {}).content || []).map((part) => part.text || '').join('') ||
    (((((parsed.candidates || [])[0] || {}).content || {}).parts || [])[0] || {}).text ||
    '');
  try {
    const decision = JSON.parse(text);
    return {
      status: String(decision.status || 'blocked'),
      approvedBasisType: String(decision.approvedBasisType || ''),
      confidence: Number(decision.confidence || 0),
      reasonCodes: Array.isArray(decision.reasonCodes) ? decision.reasonCodes.map(String) : ['ai_reason_missing'],
      riskFlags: Array.isArray(decision.riskFlags) ? decision.riskFlags.map(String) : ['ai_risk_missing'],
      requiresHumanReview: decision.requiresHumanReview !== false,
      evidenceDigest: String(decision.evidenceDigest || ''),
      sourceRowDigest: String(decision.sourceRowDigest || '')
    };
  } catch (error) {
    return buildGmailSalesAiInvalidProviderResponse_(payload, 'ai_provider_decision_json_invalid');
  }
}

function buildGmailSalesAiInvalidProviderResponse_(payload, reasonCode) {
  return {
    status: 'blocked',
    approvedBasisType: '',
    confidence: 0,
    reasonCodes: [reasonCode],
    riskFlags: ['provider_response_invalid'],
    requiresHumanReview: true,
    evidenceDigest: payload.evidenceDigest,
    sourceRowDigest: payload.sourceRowDigest
  };
}

function validateGmailSalesAiDecision_(providerDecision, evidence, config) {
  const decision = providerDecision || {};
  const confidence = Number(decision.confidence || 0);
  const riskFlags = Array.isArray(decision.riskFlags) ? decision.riskFlags : [];
  const reasonCodes = Array.isArray(decision.reasonCodes) ? decision.reasonCodes : ['ai_response_invalid'];
  const approvedBasisType = normalizeContactBasisType_(decision.approvedBasisType);
  const ok = decision.status === 'pass' &&
    approvedBasisType === 'valid_business_contact_exception' &&
    confidence >= config.confidenceThreshold &&
    riskFlags.length === 0 &&
    decision.requiresHumanReview === false &&
    String(decision.evidenceDigest || '') === evidence.evidenceDigest &&
    String(decision.sourceRowDigest || '') === evidence.sourceRowDigest &&
    evidence.businessContactEvidencePresent &&
    evidence.sourceReferencePresent &&
    !evidence.personalEmail;
  if (!ok) {
    return buildGmailSalesAiDecision_('needs_human_review', '', confidence, reasonCodes, riskFlags.length ? riskFlags : ['ai_validation_failed'], true, evidence, true);
  }
  return buildGmailSalesAiDecision_('pass', approvedBasisType, confidence, reasonCodes, [], false, evidence, true);
}

function buildGmailSalesAiDecision_(status, approvedBasisType, confidence, reasonCodes, riskFlags, requiresHumanReview, evidence, providerDecision) {
  return {
    status,
    autoApproved: status === 'pass' && !requiresHumanReview,
    approvedBasisType,
    confidence,
    reasonCodes: reasonCodes || [],
    riskFlags: riskFlags || [],
    requiresHumanReview,
    providerDecision: Boolean(providerDecision),
    evidenceDigest: evidence.evidenceDigest,
    sourceRowDigest: evidence.sourceRowDigest
  };
}

function buildGmailSalesAiEvidenceDigest_(queueRow) {
  return hashValue_([
    String(queueRow.sourceRowDigest || '').trim(),
    normalizeTextForComparison_(queueRow.sourceType || ''),
    normalizeTextForComparison_(queueRow.sourceReferenceHash || ''),
    Boolean(String(queueRow.existingRelationshipEvidence || '').trim()),
    Boolean(String(queueRow.explicitOptInEvidence || '').trim()),
    Boolean(String(queueRow.businessContactEvidence || '').trim()),
    normalizeTextForComparison_(queueRow.suggestedBasisType || ''),
    normalizeTextForComparison_(queueRow.suggestionReasonCode || '')
  ].join('|'));
}

function isGmailSalesAiBudgetAvailable_(config, nextRequestCount) {
  if (config.provider === 'mock') return nextRequestCount <= config.maxDailyRequests;
  return nextRequestCount <= config.maxDailyRequests && config.maxDailyCostYen > 0;
}

function writeAiAuditToSourceRow_(sheet, headers, rowIndex, decision, now) {
  setCellByHeader_(sheet, headers, rowIndex, 'aiVerificationStatus', decision.autoApproved ? 'approved_ai' : 'needs_human_review');
  setCellByHeader_(sheet, headers, rowIndex, 'aiProvider', decision.providerDecision ? getGmailSalesAiConfig_().provider : 'deterministic');
  setCellByHeader_(sheet, headers, rowIndex, 'aiModel', decision.providerDecision ? getGmailSalesAiConfig_().model : 'rules');
  setCellByHeader_(sheet, headers, rowIndex, 'aiConfidence', decision.confidence);
  setCellByHeader_(sheet, headers, rowIndex, 'aiPolicyVersion', getGmailSalesAiConfig_().policyVersion);
  setCellByHeader_(sheet, headers, rowIndex, 'aiPromptVersion', GMAIL_SALES_AI_PROMPT_VERSION);
  setCellByHeader_(sheet, headers, rowIndex, 'aiEvidenceDigest', decision.evidenceDigest);
  setCellByHeader_(sheet, headers, rowIndex, 'aiVerifiedAt', now);
  setCellByHeader_(sheet, headers, rowIndex, 'aiReasonCodes', (decision.reasonCodes || []).join(','));
  setCellByHeader_(sheet, headers, rowIndex, 'aiRiskFlags', (decision.riskFlags || []).join(','));
  setCellByHeader_(sheet, headers, rowIndex, 'aiAutoApproved', decision.autoApproved ? 'true' : 'false');
  setCellByHeader_(sheet, headers, rowIndex, 'aiRequiresHumanReview', decision.requiresHumanReview ? 'true' : 'false');
}

function upsertGmailSalesAiReviewRow_(sheet, headers, update, reviewById) {
  const id = String(update.queueRow.reviewId || '').trim();
  const existing = reviewById[id];
  let rowIndex = existing ? existing.rowIndex : sheet.getLastRow() + 1;
  const row = Object.assign({}, existing ? existing.row : update.queueRow);
  if (update.needsHumanReview) {
    row.reviewDecision = 'needs_more_evidence';
    row.approvedBasisType = '';
    row.evidenceNotes = 'ai_exception_' + (update.aiDecision.reasonCodes || ['needs_review']).join('_');
    row.reviewerLabel = 'ai_policy_engine';
    row.reviewedAt = update.now;
    row.applyStatus = 'needs_more_evidence';
    row.applyErrorCode = (update.aiDecision.reasonCodes || ['needs_human_review']).join(',');
  } else {
    row.reviewDecision = 'approved_ai';
    row.approvedBasisType = update.approvedBasisType;
    row.evidenceNotes = 'ai_verified_contact_basis';
    row.optOutAvailable = 'TRUE';
    row.reviewerLabel = 'ai_policy_engine';
    row.reviewedAt = update.now;
    row.applyStatus = 'applied_ai';
    row.applyErrorCode = '';
    row.appliedAt = update.now;
  }
  row.aiVerificationStatus = update.aiDecision.autoApproved ? 'approved_ai' : 'needs_human_review';
  row.aiProvider = update.aiDecision.providerDecision ? getGmailSalesAiConfig_().provider : 'deterministic';
  row.aiModel = update.aiDecision.providerDecision ? getGmailSalesAiConfig_().model : 'rules';
  row.aiConfidence = update.aiDecision.confidence;
  row.aiPolicyVersion = getGmailSalesAiConfig_().policyVersion;
  row.aiPromptVersion = GMAIL_SALES_AI_PROMPT_VERSION;
  row.aiEvidenceDigest = update.aiDecision.evidenceDigest;
  row.aiVerifiedAt = update.now;
  row.aiReasonCodes = (update.aiDecision.reasonCodes || []).join(',');
  row.aiRiskFlags = (update.aiDecision.riskFlags || []).join(',');
  row.aiAutoApproved = update.aiDecision.autoApproved ? 'true' : 'false';
  row.aiRequiresHumanReview = update.aiDecision.requiresHumanReview ? 'true' : 'false';
  headers.forEach((header, index) => {
    sheet.getRange(rowIndex, index + 1).setValue(row[header] === undefined ? '' : row[header]);
  });
}

function buildGmailSalesAiContactBasisResult_(event, status, overrides) {
  const result = Object.assign({
    event,
    mode: 'write',
    status,
    blockedReason: '',
    aiEnabled: false,
    aiProvider: 'disabled',
    confidenceThreshold: 0.95,
    policyVersion: GMAIL_SALES_AI_DEFAULT_POLICY_VERSION,
    promptVersion: GMAIL_SALES_AI_PROMPT_VERSION,
    sourceCandidatesEvaluatedCount: 0,
    deterministicApprovedCount: 0,
    aiEvaluatedCount: 0,
    aiAutoApprovedCount: 0,
    aiNeedsReviewCount: 0,
    aiAppliedCount: 0,
    sourceCandidatesUpdated: false,
    gmailSendExecuted: false,
    gmailDraftCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  }, overrides || {});
  appendSafeLog_(result);
  logGmailSalesJsonResult_(result);
  return result;
}

function incrementCount_(counts, key) {
  const normalized = String(key || 'unknown').trim() || 'unknown';
  counts[normalized] = Number(counts[normalized] || 0) + 1;
}

function getGmailSalesContactBasisReviewContext_(options) {
  const settings = options || {};
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  if (!config.sheetId) return { ok: false, blockedReason: 'missing_sheet_id' };
  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(config.sheetId);
  } catch (error) {
    return { ok: false, blockedReason: 'spreadsheet_not_accessible' };
  }
  const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
  const sourceSheet = spreadsheet.getSheetByName(sourceName);
  if (!sourceSheet && !settings.allowMissing) return { ok: false, blockedReason: 'source_sheet_missing' };
  const reviewTabName = String(props.getProperty(GMAIL_CONTACT_BASIS_REVIEW_TAB_PROPERTY) || GMAIL_CONTACT_BASIS_REVIEW_TAB_DEFAULT).trim();
  const reviewSheet = spreadsheet.getSheetByName(reviewTabName);
  if (!reviewSheet && !settings.allowMissing) return { ok: false, blockedReason: 'review_sheet_missing' };
  return {
    ok: true,
    config,
    spreadsheet,
    sourceName,
    sourceSheet,
    reviewTabName,
    reviewSheet,
    reviewTabPresent: Boolean(reviewSheet),
    reviewTabAccessible: Boolean(reviewSheet)
  };
}

function configureGmailSalesReviewSheetPresentation_(sheet) {
  if (!sheet) return;
  if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  if (typeof sheet.createFilter === 'function' && sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    try {
      sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), Math.max(1, sheet.getLastColumn())).createFilter();
    } catch (error) {
      // Filter setup is best-effort; schema integrity is verified by header read-back.
    }
  }
  if (typeof sheet.setColumnWidth === 'function') {
    [1, 2, 5, 6, 14, 15, 16, 17, 18, 20, 21, 22, 23].forEach((index) => sheet.setColumnWidth(index, index === 18 ? 260 : 160));
  }
  configureGmailSalesReviewDataValidation_(sheet);
}

function configureGmailSalesReviewDataValidation_(sheet) {
  if (!sheet || typeof SpreadsheetApp.newDataValidation !== 'function') return false;
  const headers = getSheetHeaders_(sheet);
  const rowCount = Math.max(1, (typeof sheet.getMaxRows === 'function' ? sheet.getMaxRows() : Math.max(sheet.getLastRow(), 2)) - 1);
  const validations = [
    { header: 'reviewDecision', values: GMAIL_CONTACT_BASIS_REVIEW_DECISIONS },
    { header: 'approvedBasisType', values: GMAIL_CONTACT_BASIS_ALLOWED_TYPES },
    { header: 'optOutAvailable', values: ['TRUE', 'FALSE'] },
    { header: 'applyStatus', values: GMAIL_CONTACT_BASIS_REVIEW_APPLY_STATUSES }
  ];
  validations.forEach((item) => {
    const index = headers.indexOf(item.header);
    if (index === -1) return;
    try {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(item.values, true).setAllowInvalid(false).build();
      sheet.getRange(2, index + 1, Math.max(1, rowCount), 1).setDataValidation(rule);
    } catch (error) {
      // Apps Script validation is best-effort in mocks and older runtimes.
    }
  });
  return true;
}

function reviewDataRowValidationConfigured_(sheet) {
  if (!sheet) return false;
  const headers = getSheetHeaders_(sheet);
  const required = ['reviewDecision', 'approvedBasisType', 'optOutAvailable', 'applyStatus'];
  return required.every((header) => {
    const index = headers.indexOf(header);
    if (index === -1) return false;
    return countDataValidationsInRange_(sheet.getRange(2, index + 1, 1, 1)) > 0;
  });
}

function buildGmailSalesContactBasisReviewSchemaInspection_(context) {
  const result = {
    event: 'gmail_sales_contact_basis_review_schema',
    mode: 'read_only',
    reviewTabPresent: Boolean(context.reviewTabPresent),
    reviewTabAccessible: Boolean(context.reviewTabAccessible),
    headerColumnCount: 0,
    requiredHeadersPresent: false,
    headerReadBackPassed: false,
    headerValidationCount: 0,
    dataRowValidationConfigured: false,
    reviewDecisionHeaderValid: false,
    approvedBasisHeaderValid: false,
    optOutHeaderValid: false,
    applyStatusHeaderValid: false,
    suspiciousBulkRowsRemaining: 0,
    pendingAiEligibleCount: 0,
    schemaValid: false,
    blockedReasons: [],
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  if (!context.reviewSheet) {
    result.blockedReasons.push('review_sheet_missing');
    return result;
  }
  const headers = getSheetHeaders_(context.reviewSheet);
  result.headerColumnCount = headers.length;
  result.requiredHeadersPresent = missingHeaders_(headers, GMAIL_CONTACT_BASIS_REVIEW_HEADERS.concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS)).length === 0;
  result.headerReadBackPassed = result.requiredHeadersPresent;
  result.headerValidationCount = countHeaderDataValidations_(context.reviewSheet, headers.length || 1);
  result.dataRowValidationConfigured = reviewDataRowValidationConfigured_(context.reviewSheet);
  result.reviewDecisionHeaderValid = headers.indexOf('reviewDecision') !== -1;
  result.approvedBasisHeaderValid = headers.indexOf('approvedBasisType') !== -1;
  result.optOutHeaderValid = headers.indexOf('optOutAvailable') !== -1;
  result.applyStatusHeaderValid = headers.indexOf('applyStatus') !== -1;
  const sourceData = context.sourceSheet ? readSheetObjects_(context.sourceSheet) : { items: [] };
  const sourceByKey = {};
  sourceData.items.forEach((item) => {
    sourceByKey[buildGmailSalesContactSourceRowKey_(item.row, item.rowIndex)] = item;
  });
  const reviewData = readSheetObjects_(context.reviewSheet);
  reviewData.items.forEach((item) => {
    const row = item.row || {};
    if (isSuspiciousBulkApprovalResetCandidate_(row, sourceByKey).ok) result.suspiciousBulkRowsRemaining += 1;
    if (isAiEligibleReviewQueueRow_(row, sourceByKey)) result.pendingAiEligibleCount += 1;
  });
  if (!result.requiredHeadersPresent) result.blockedReasons.push('required_headers_missing');
  if (result.headerValidationCount > 0) result.blockedReasons.push('header_validation_present');
  if (!result.dataRowValidationConfigured) result.blockedReasons.push('data_row_validation_missing');
  result.schemaValid = result.blockedReasons.length === 0;
  return result;
}

function inspectGmailSalesContactBasisReviewSchema() {
  const context = getGmailSalesContactBasisReviewContext_({ allowMissing: true });
  const result = buildGmailSalesContactBasisReviewSchemaInspection_(context);
  logGmailSalesJsonResult_(result);
  return result;
}

function buildContactBasisReviewQueueRow_(item, now) {
  const row = item.row || {};
  const sourceRowKey = buildGmailSalesContactSourceRowKey_(row, item.rowIndex);
  const leadIdHash = hashValue_([
    normalizeEmail_(row.email || row.contactEmail || row['メール'] || row['宛先メール']),
    normalizeTextForComparison_(row.name || row['店舗名'] || ''),
    sourceRowKey
  ].join('|'));
  const sourceReference = String(row.sourceReference || row.sourceUrl || row.publicSource || row.source || '').trim();
  const sourceType = String(getContactBasisValue_(row, 'sourceType') || row.sourceType || row.publicSource || '').trim();
  const sourceReferenceHash = sourceReference && sourceType ? buildGmailSalesSourceReferenceHash_(sourceType, sourceReference) : '';
  const existingEvidence = String(row.existingRelationshipEvidence || row.priorInquiry || row.prior_inquiry || row.existingRelationship || '').trim();
  const optInEvidence = String(row.explicitOptInEvidence || row.optInEvidence || row.opt_in_evidence || row.optInAt || '').trim();
  const businessEvidence = String(row.businessContactEvidence || row.business_contact_evidence || '').trim();
  const suggestion = suggestGmailSalesContactBasis_(row, {
    sourceReference,
    sourceType,
    existingEvidence,
    optInEvidence,
    businessEvidence
  });
  const basisType = normalizeContactBasisType_(getContactBasisValue_(row, 'contactBasisType'));
  const excludedReason = excludedContactBasisReviewReason_(row, basisType, suggestion);
  if (excludedReason) return { include: false, reason: excludedReason };
  const digest = computeGmailSalesContactSourceDigest_(row, {
    sourceRowKey,
    sourceReference,
    sourceType,
    sourceReferenceHash,
    existingEvidence,
    optInEvidence,
    businessEvidence
  });
  const reviewId = 'basis-review-' + hashValue_(sourceRowKey + '|' + leadIdHash);
  return {
    include: true,
    row: {
      reviewId,
      sourceRowKey,
      leadIdHash,
      sourceRowDigest: digest,
      businessDisplayName: maskBusinessDisplayName_(row.name || row['店舗名']),
      contactDisplay: maskContactDisplay_(row.email || row.contactEmail || row['メール'] || row['宛先メール']),
      sourceType,
      sourceReference,
      sourceReferenceHash,
      existingRelationshipEvidence: existingEvidence,
      explicitOptInEvidence: optInEvidence,
      businessContactEvidence: businessEvidence,
      existingContactBasisType: basisType || 'needs_review',
      suggestedBasisType: suggestion.suggestedBasisType,
      suggestionReasonCode: suggestion.suggestionReasonCode,
      reviewDecision: 'pending',
      approvedBasisType: '',
      evidenceNotes: '',
      optOutAvailable: '',
      reviewerLabel: '',
      reviewedAt: '',
      applyStatus: 'pending',
      applyErrorCode: '',
      appliedAt: '',
      lastQueueSyncedAt: now,
      priorityRank: suggestion.priorityRank,
      priorityReasonCode: suggestion.priorityReasonCode
    }
  };
}

function excludedContactBasisReviewReason_(row, basisType, suggestion) {
  if (hasAllowedGmailSalesContactBasis_(row)) return 'already_has_allowed_basis';
  if (shouldSkipRecipient_(row)) return 'recipient_history_or_optout_blocked';
  if (row.unsubscribe === true || String(row.unsubscribe || '').toLowerCase() === 'true') return 'unsubscribe';
  if (row.doNotContact === true || String(row.doNotContact || '').toLowerCase() === 'true') return 'do_not_contact';
  if (String(row.sendState || '').trim() === GMAIL_SEND_STATE.deliveryUnknown) return 'delivery_unknown';
  if (basisType === 'guessed' || suggestion.suggestionReasonCode === 'guessed_contact') return 'guessed_contact';
  if (basisType === 'private_personal_contact' || suggestion.suggestionReasonCode === 'private_personal_contact') return 'private_personal_contact';
  return '';
}

function suggestGmailSalesContactBasis_(row, evidence) {
  const text = normalizeTextForComparison_([
    row.notes,
    row.status,
    row.sourceType,
    row.publicSource,
    evidence.existingEvidence,
    evidence.optInEvidence,
    evidence.businessEvidence
  ].join(' '));
  const email = normalizeEmail_(row.email || row.contactEmail || '');
  if (includesAny_(text, ['guessed', '推測'])) {
    return basisSuggestion_('', 'guessed_contact', 8, 'guessed_contact');
  }
  if (includesAny_(text, ['private personal', 'personal contact', '個人用'])) {
    return basisSuggestion_('', 'private_personal_contact', 8, 'private_personal_contact');
  }
  if (evidence.optInEvidence || includesAny_(text, ['opt-in', 'opt in', '申込', '登録', '許可'])) {
    return basisSuggestion_('explicit_opt_in', 'explicit_opt_in_record_found', 2, 'explicit_opt_in_evidence');
  }
  if (evidence.existingEvidence || includesAny_(text, ['existing relationship', 'prior inquiry', '既存', '問い合わせ', '取引', '商談', '返信'])) {
    return basisSuggestion_('existing_relationship', 'existing_relationship_record_found', 1, 'existing_relationship_evidence');
  }
  if (includesAny_(text, ['manual legal', 'human reviewed', '法務確認', '手動確認'])) {
    return basisSuggestion_('manual_legal_reviewed', 'prior_manual_review_found', 3, 'manual_review_evidence');
  }
  if (evidence.businessEvidence && evidence.sourceReference && evidence.sourceType && !isLikelyPersonalEmail_(email)) {
    return basisSuggestion_('valid_business_contact_exception', 'business_contact_evidence_found', 5, 'business_contact_evidence');
  }
  if (!evidence.sourceReference) return basisSuggestion_('', 'source_reference_missing', 7, 'source_missing');
  return basisSuggestion_('', 'insufficient_evidence', 6, 'needs_more_evidence');
}

function basisSuggestion_(type, reason, rank, priorityReason) {
  return {
    suggestedBasisType: type,
    suggestionReasonCode: reason,
    priorityRank: rank,
    priorityReasonCode: priorityReason
  };
}

function isLikelyPersonalEmail_(email) {
  const domain = extractEmailDomain_(email);
  return ['gmail.com', 'yahoo.co.jp', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].indexOf(domain) !== -1;
}

function buildGmailSalesContactSourceRowKey_(row, rowIndex) {
  const stable = String(row.prospectId || row.dedupeKey || row.candidateDigest || row.approvedCandidateDigest || '').trim();
  if (stable) return hashValue_('stable|' + stable);
  return hashValue_([
    'fallback',
    rowIndex,
    normalizeEmail_(row.email || row.contactEmail || ''),
    normalizeTextForComparison_(row.name || row['店舗名'] || '')
  ].join('|'));
}

function computeGmailSalesContactSourceDigest_(row, context) {
  return hashValue_([
    context.sourceRowKey,
    normalizeEmail_(row.email || row.contactEmail || ''),
    normalizeTextForComparison_(row.name || row['店舗名'] || ''),
    normalizeTextForComparison_(context.sourceType || ''),
    normalizeTextForComparison_(context.sourceReference || ''),
    normalizeTextForComparison_(context.sourceReferenceHash || ''),
    normalizeTextForComparison_(context.existingEvidence || ''),
    normalizeTextForComparison_(context.optInEvidence || ''),
    normalizeTextForComparison_(context.businessEvidence || ''),
    normalizeTextForComparison_(row.unsubscribe || row.doNotContact || row.replyStatus || row.sentStatus || '')
  ].join('|'));
}

function buildGmailSalesSourceReferenceHash_(sourceType, sourceReference) {
  return hashValue_(normalizeTextForComparison_(sourceType) + '|' + normalizeTextForComparison_(sourceReference));
}

function preserveGmailSalesReviewDecisionFields_(next, existing, newDigest) {
  const preserved = ['reviewDecision', 'approvedBasisType', 'evidenceNotes', 'optOutAvailable', 'reviewerLabel', 'reviewedAt'].concat(GMAIL_CONTACT_BASIS_AI_AUDIT_COLUMNS);
  preserved.forEach((field) => {
    if (existing[field] !== undefined && existing[field] !== '') next[field] = existing[field];
  });
  const existingDigest = String(existing.sourceRowDigest || '').trim();
  if (existingDigest && existingDigest !== newDigest && String(existing.applyStatus || '') !== 'applied') {
    next.applyStatus = 'skipped_stale_source';
    next.applyErrorCode = 'stale_source_data';
    if (String(next.reviewDecision || '') === 'approved') next.reviewDecision = 'needs_more_evidence';
  } else {
    next.applyStatus = String(existing.applyStatus || next.applyStatus || 'pending');
    next.applyErrorCode = String(existing.applyErrorCode || '');
    next.appliedAt = String(existing.appliedAt || '');
  }
}

function compareGmailSalesContactBasisReviewRows_(left, right) {
  const a = Number(left.priorityRank || 99);
  const b = Number(right.priorityRank || 99);
  if (a !== b) return a - b;
  return String(left.reviewId || '').localeCompare(String(right.reviewId || ''));
}

function validateApprovedContactBasisReview_(review, sourceByKey) {
  const sourceItem = sourceByKey[String(review.sourceRowKey || '').trim()];
  if (!sourceItem) return { ok: false, errorCode: 'source_row_not_found' };
  const queue = buildContactBasisReviewQueueRow_(sourceItem, new Date().toISOString());
  if (!queue.include || queue.row.sourceRowDigest !== String(review.sourceRowDigest || '').trim()) {
    return { ok: false, errorCode: 'stale_source_data' };
  }
  const approvedBasisType = normalizeContactBasisType_(review.approvedBasisType);
  if (GMAIL_CONTACT_BASIS_ALLOWED_TYPES.indexOf(approvedBasisType) === -1) return { ok: false, errorCode: 'approved_basis_type_invalid' };
  if (!String(review.evidenceNotes || '').trim()) return { ok: false, errorCode: 'evidence_notes_missing' };
  if (!String(review.reviewerLabel || '').trim()) return { ok: false, errorCode: 'reviewer_missing' };
  if (!String(review.reviewedAt || '').trim()) return { ok: false, errorCode: 'reviewed_at_missing' };
  if (String(review.optOutAvailable || '').toLowerCase() !== 'true') return { ok: false, errorCode: 'opt_out_unavailable' };
  const sourceReference = String(review.sourceReference || '').trim();
  const sourceType = String(review.sourceType || '').trim();
  const sourceReferenceHash = sourceReference && sourceType ? buildGmailSalesSourceReferenceHash_(sourceType, sourceReference) : '';
  if (approvedBasisType === 'valid_business_contact_exception') {
    if (!String(review.businessContactEvidence || '').trim()) return { ok: false, errorCode: 'business_contact_evidence_missing' };
    if (!sourceReference || !sourceType || !sourceReferenceHash) return { ok: false, errorCode: 'source_reference_missing' };
    if (isLikelyPersonalEmail_(sourceItem.row.email || sourceItem.row.contactEmail || '')) return { ok: false, errorCode: 'private_personal_contact' };
  }
  if (approvedBasisType === 'existing_relationship' && !String(review.existingRelationshipEvidence || '').trim()) return { ok: false, errorCode: 'existing_relationship_evidence_missing' };
  if (approvedBasisType === 'explicit_opt_in' && !String(review.explicitOptInEvidence || '').trim()) return { ok: false, errorCode: 'explicit_opt_in_evidence_missing' };
  if (approvedBasisType === 'manual_legal_reviewed' && !String(review.evidenceNotes || '').trim()) return { ok: false, errorCode: 'manual_review_evidence_missing' };
  return { ok: true, sourceItem, approvedBasisType, sourceType, sourceReferenceHash };
}

function writeContactBasisToSourceRow_(sheet, headers, rowIndex, update) {
  setCellByHeader_(sheet, headers, rowIndex, 'contactBasisType', update.approvedBasisType);
  setCellByHeader_(sheet, headers, rowIndex, 'contactBasisRecordedAt', update.now);
  setCellByHeader_(sheet, headers, rowIndex, 'sourceType', update.sourceType);
  setCellByHeader_(sheet, headers, rowIndex, 'sourceReferenceHash', update.sourceReferenceHash);
  setCellByHeader_(sheet, headers, rowIndex, 'optOutAvailable', 'true');
  setCellByHeader_(sheet, headers, rowIndex, 'lastVerifiedAt', update.now);
  setCellByHeader_(sheet, headers, rowIndex, 'suppressionCheckedAt', update.now);
  setCellByHeader_(sheet, headers, rowIndex, 'historyCheckedAt', update.now);
}

function verifyContactBasisSourceRow_(sheet, headers, rowIndex, update) {
  return normalizeContactBasisType_(getCellByHeader_(sheet, headers, rowIndex, 'contactBasisType')) === update.approvedBasisType &&
    String(getCellByHeader_(sheet, headers, rowIndex, 'sourceReferenceHash') || '').trim() === update.sourceReferenceHash &&
    String(getCellByHeader_(sheet, headers, rowIndex, 'optOutAvailable') || '').toLowerCase() === 'true';
}

function detectSuspiciousBulkApprovalPattern_(approvedRows) {
  const patterns = {};
  let humanComparableCount = 0;
  (approvedRows || []).forEach((item) => {
    const row = item.row || {};
    const aiApproved = String(row.reviewDecision || '').trim() === 'approved_ai' ||
      String(row.applyStatus || '').trim() === 'applied_ai' ||
      String(row.reviewerLabel || '').trim() === 'ai_policy_engine';
    if (aiApproved && String(row.aiEvidenceDigest || '').trim()) return;
    humanComparableCount += 1;
    const key = [
      row.approvedBasisType,
      normalizeTextForComparison_(row.evidenceNotes || ''),
      row.reviewedAt,
      row.reviewerLabel
    ].join('|');
    patterns[key] = (patterns[key] || 0) + 1;
  });
  const max = Object.keys(patterns).reduce((acc, key) => Math.max(acc, patterns[key]), 0);
  return {
    suspiciousBulkApprovalPattern: humanComparableCount >= 30 && max >= 30,
    identicalApprovalPatternCount: max
  };
}

function buildGmailSalesContactBasisReviewQueueInspection_(context) {
  const result = {
    event: 'gmail_sales_contact_basis_review_queue',
    mode: 'read_only',
    reviewTabPresent: Boolean(context.reviewTabPresent),
    reviewTabAccessible: Boolean(context.reviewTabAccessible),
    totalQueueCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    needsMoreEvidenceCount: 0,
    appliedCount: 0,
    skippedInvalidCount: 0,
    skippedStaleSourceCount: 0,
    applyErrorCount: 0,
    approvedExistingRelationshipCount: 0,
    approvedExplicitOptInCount: 0,
    approvedBusinessContactExceptionCount: 0,
    approvedManualLegalReviewedCount: 0,
    sourceDigestMismatchCount: 0,
    missingEvidenceCount: 0,
    missingReviewerCount: 0,
    optOutUnavailableCount: 0,
    suspiciousBulkApprovalPattern: false,
    readyToApplyCount: 0,
    remainingToReachThirty: GMAIL_DAILY_EXPECTED_COUNT,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  if (!context.reviewSheet) return result;
  const data = readSheetObjects_(context.reviewSheet);
  const sourceData = context.sourceSheet ? readSheetObjects_(context.sourceSheet) : { items: [] };
  const sourceByKey = {};
  sourceData.items.forEach((item) => {
    sourceByKey[buildGmailSalesContactSourceRowKey_(item.row, item.rowIndex)] = item;
  });
  const approvedRows = [];
  data.items.forEach((item) => {
    result.totalQueueCount += 1;
    const decision = String(item.row.reviewDecision || '').trim();
    const applyStatus = String(item.row.applyStatus || '').trim();
    const basis = normalizeContactBasisType_(item.row.approvedBasisType);
    if (decision === 'approved') {
      result.approvedCount += 1;
      approvedRows.push(item);
      if (basis === 'existing_relationship') result.approvedExistingRelationshipCount += 1;
      if (basis === 'explicit_opt_in') result.approvedExplicitOptInCount += 1;
      if (basis === 'valid_business_contact_exception') result.approvedBusinessContactExceptionCount += 1;
      if (basis === 'manual_legal_reviewed') result.approvedManualLegalReviewedCount += 1;
      const validation = validateApprovedContactBasisReview_(item.row, sourceByKey);
      if (validation.ok) result.readyToApplyCount += 1;
      if (validation.errorCode === 'stale_source_data') result.sourceDigestMismatchCount += 1;
    } else if (decision === 'rejected') result.rejectedCount += 1;
    else if (decision === 'needs_more_evidence') result.needsMoreEvidenceCount += 1;
    else result.pendingCount += 1;
    if (applyStatus === 'applied') result.appliedCount += 1;
    if (applyStatus === 'skipped_invalid') result.skippedInvalidCount += 1;
    if (applyStatus === 'skipped_stale_source') result.skippedStaleSourceCount += 1;
    if (String(item.row.applyErrorCode || '').trim()) result.applyErrorCount += 1;
    if (decision === 'approved' && !String(item.row.evidenceNotes || '').trim()) result.missingEvidenceCount += 1;
    if (decision === 'approved' && !String(item.row.reviewerLabel || '').trim()) result.missingReviewerCount += 1;
    if (decision === 'approved' && String(item.row.optOutAvailable || '').toLowerCase() !== 'true') result.optOutUnavailableCount += 1;
  });
  const suspicious = detectSuspiciousBulkApprovalPattern_(approvedRows);
  result.suspiciousBulkApprovalPattern = suspicious.suspiciousBulkApprovalPattern;
  result.remainingToReachThirty = Math.max(0, GMAIL_DAILY_EXPECTED_COUNT - result.readyToApplyCount);
  return result;
}

function readSheetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return { headers: [], items: [] };
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values[0].map((value) => String(value || '').trim());
  const items = values.slice(1).map((cells, index) => ({
    row: rowFromCells_(headers, cells),
    rowIndex: index + 2
  }));
  return { headers, items };
}

function writeObjectsToSheet_(sheet, headers, rows) {
  const values = [headers].concat((rows || []).map((row) => headers.map((header) => row[header] === undefined ? '' : row[header])));
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  SpreadsheetApp.flush();
}

function getCellByHeader_(sheet, headers, rowIndex, header) {
  const index = headers.indexOf(header);
  if (index === -1) return '';
  return sheet.getRange(rowIndex, index + 1, 1, 1).getValues()[0][0];
}

function setCellByHeader_(sheet, headers, rowIndex, header, value) {
  const index = headers.indexOf(header);
  if (index === -1) return false;
  sheet.getRange(rowIndex, index + 1).setValue(value);
  return true;
}

function setReviewApplyStatus_(sheet, headers, rowIndex, status, errorCode) {
  setCellByHeader_(sheet, headers, rowIndex, 'applyStatus', status);
  setCellByHeader_(sheet, headers, rowIndex, 'applyErrorCode', errorCode || '');
}

function updateReviewApplyStatuses_(sheet, headers, items, status, errorCode) {
  (items || []).forEach((item) => setReviewApplyStatus_(sheet, headers, item.rowIndex, status, errorCode));
}

function maskBusinessDisplayName_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 2) + '...' + hashValue_(text).slice(0, 4);
}

function maskContactDisplay_(value) {
  const email = normalizeEmail_(value);
  const domain = extractEmailDomain_(email);
  return domain ? '***@' + domain : '';
}

function buildGmailSalesContactBasisReviewResult_(event, status, overrides) {
  const result = Object.assign({
    event,
    mode: 'write',
    status,
    blockedReason: '',
    reviewTabPropertyPresent: false,
    reviewTabCreated: false,
    reviewTabResolved: false,
    columnsAddedCount: 0,
    dataValidationConfigured: false,
    headerReadBackPassed: false,
    gmailSendExecuted: false,
    sourceCandidatesUpdated: false,
    scriptPropertiesUpdated: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  }, overrides || {});
  appendSafeLog_(result);
  logGmailSalesJsonResult_(result);
  return result;
}

function logGmailSalesJsonResult_(result) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(JSON.stringify(result));
  }
}

function activateGmailSalesDailyAutomationOnce() {
  const props = PropertiesService.getScriptProperties();
  const validation = validateGmailSalesDailyActivation_();
  if (!validation.ok) {
    const blocked = {
      event: 'gmail_daily_automation_activation_blocked',
      status: 'blocked',
      propertyWriteCount: 0,
      automationMasterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
      autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
      liveSendAtRest: props.getProperty('LIVE_SEND_ENABLED') === 'false',
      targetDate: validation.targetDate,
      state: validation.state,
      candidateCount: validation.candidateCount,
      triggerCount: validation.triggerCount,
      blockedReason: validation.blockedReason,
      errorCode: validation.blockedReason
    };
    appendSafeLog_(blocked);
    return blocked;
  }
  if (props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true' &&
      props.getProperty('AUTO_SEND_ENABLED') === 'true' &&
      props.getProperty('LIVE_SEND_ENABLED') === 'false') {
    const already = {
      event: 'gmail_daily_automation_activation',
      status: 'already_active',
      propertyWriteCount: 0,
      automationMasterEnabled: true,
      autoSendEnabled: true,
      liveSendAtRest: true,
      targetDate: validation.targetDate,
      state: validation.state,
      candidateCount: validation.candidateCount,
      triggerCount: validation.triggerCount,
      blockedReason: '',
      errorCode: ''
    };
    appendSafeLog_(already);
    return already;
  }
  props.setProperties({
    AUTOMATION_MASTER_ENABLED: 'true',
    AUTO_SEND_ENABLED: 'true',
    LIVE_SEND_ENABLED: 'false'
  }, false);
  const result = {
    event: 'gmail_daily_automation_activation',
    status: 'activated',
    propertyWriteCount: 1,
    automationMasterEnabled: true,
    autoSendEnabled: true,
    liveSendAtRest: true,
    targetDate: validation.targetDate,
    state: validation.state,
    candidateCount: validation.candidateCount,
    triggerCount: validation.triggerCount,
    blockedReason: '',
    errorCode: ''
  };
  appendSafeLog_(result);
  return result;
}

function deactivateGmailSalesDailyAutomation() {
  const props = PropertiesService.getScriptProperties();
  const alreadyInactive = props.getProperty('AUTOMATION_MASTER_ENABLED') === 'false' &&
    props.getProperty('AUTO_SEND_ENABLED') === 'false' &&
    props.getProperty('LIVE_SEND_ENABLED') === 'false';
  if (!alreadyInactive) {
    props.setProperties({
      AUTOMATION_MASTER_ENABLED: 'false',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false'
    }, false);
  }
  const result = {
    event: 'gmail_daily_automation_deactivation',
    status: alreadyInactive ? 'already_inactive' : 'deactivated',
    propertyWriteCount: alreadyInactive ? 0 : 1,
    automationMasterEnabled: false,
    autoSendEnabled: false,
    liveSendAtRest: true,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function armGmailSalesDailyAutomationForFutureRunsOnce() {
  const props = PropertiesService.getScriptProperties();
  const validation = validateGmailSalesDailyFutureArm_();
  if (!validation.ok) {
    const blocked = {
      event: 'gmail_daily_future_arm_blocked',
      status: 'blocked',
      blockedReason: validation.blockedReason,
      armedForDate: validation.armedForDate,
      sourceRowsReadBack: validation.sourceRowsReadBack,
      propertyWriteCount: 0,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      triggerChanged: false
    };
    appendSafeLog_(blocked);
    return blocked;
  }
  const alreadyArmed = props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true' &&
    props.getProperty('AUTO_SEND_ENABLED') === 'true' &&
    props.getProperty('LIVE_SEND_ENABLED') === 'false' &&
    props.getProperty('GMAIL_DAILY_ARMED_FOR_DATE') === validation.armedForDate;
  if (alreadyArmed) {
    return {
      event: 'gmail_daily_future_arm',
      status: 'already_armed',
      armedForDate: validation.armedForDate,
      sourceRowsReadBack: validation.sourceRowsReadBack,
      propertyWriteCount: 0,
      automationMasterEnabled: true,
      autoSendEnabled: true,
      liveSendAtRest: true,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      triggerChanged: false
    };
  }
  props.setProperties({
    AUTOMATION_MASTER_ENABLED: 'true',
    AUTO_SEND_ENABLED: 'true',
    LIVE_SEND_ENABLED: 'false',
    GMAIL_DAILY_ARMED_FOR_DATE: validation.armedForDate
  }, false);
  const result = {
    event: 'gmail_daily_future_arm',
    status: 'armed',
    armedForDate: validation.armedForDate,
    sourceRowsReadBack: validation.sourceRowsReadBack,
    propertyWriteCount: 1,
    automationMasterEnabled: true,
    autoSendEnabled: true,
    liveSendAtRest: true,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function activateAndRunGmailSalesDailyCatchUpOnce() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return {
      event: 'gmail_daily_catch_up_blocked',
      status: 'blocked',
      blockedReason: 'lock_unavailable',
      sentCount: 0,
      gmailSendExecuted: false
    };
  }
  let configForReset = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const validation = validateGmailSalesDailyCatchUp_();
    if (!validation.ok) {
      props.setProperties({
        AUTOMATION_MASTER_ENABLED: 'false',
        AUTO_SEND_ENABLED: 'false',
        LIVE_SEND_ENABLED: 'false'
      }, false);
      const blocked = {
        event: 'gmail_daily_catch_up_blocked',
        status: 'blocked',
        blockedReason: validation.blockedReason,
        targetDate: validation.targetDate,
        state: validation.state,
        sentCount: 0,
        failedCount: 0,
        automationMasterEnabled: false,
        autoSendEnabled: false,
        liveSendAtRest: true,
        gmailSendExecuted: false,
        googleSheetsUpdated: false
      };
      appendSafeLog_(blocked);
      return blocked;
    }

    const preSend = executeApprovedGmailSalesPreSendDryRun_({ source: 'normal_daily_catch_up' });
    if (preSend.status !== 'pass' || Number(preSend.wouldAttemptCount || 0) !== gmailDailyExpectedCount_()) {
      props.setProperties({
        AUTOMATION_MASTER_ENABLED: 'false',
        AUTO_SEND_ENABLED: 'false',
        LIVE_SEND_ENABLED: 'false'
      }, false);
      writeGmailDailyAutomationState_(Object.assign({}, readGmailDailyAutomationState_(), {
        state: 'blocked',
        blockedReasons: preSend.blockedReasons || ['pre_send_blocked'],
        updatedAt: new Date().toISOString()
      }));
      return Object.assign({}, preSend, {
        mode: 'normal_daily_catch_up',
        status: 'blocked',
        sentCount: 0,
        automationMasterEnabled: false,
        autoSendEnabled: false,
        liveSendAtRest: true
      });
    }

    const currentState = readGmailDailyAutomationState_();
    writeGmailDailyAutomationState_(Object.assign({}, currentState, {
      state: 'pre_send_passed',
      preSendPassedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    props.setProperty('LIVE_SEND_ENABLED', 'true');
    configForReset = getConfig_();
    const sendResult = executeApprovedGmailSalesBatch_({
      source: 'normal_daily_catch_up',
      requireAutoSend: false,
      dryRun: false,
      skipLock: true
    });
    const success = sendResult.status === 'pass' && Number(sendResult.sentCount || 0) === gmailDailyExpectedCount_() && Number(sendResult.failedCount || 0) === 0;
    const latestState = readGmailDailyAutomationState_();
    writeGmailDailyAutomationState_(Object.assign({}, latestState, {
      state: success ? 'sent' : 'failed',
      sentAt: success ? new Date().toISOString() : '',
      actualSendCount: Number(sendResult.sentCount || 0),
      failedSendCount: Number(sendResult.failedCount || 0),
      blockedReasons: sendResult.blockedReasons || [],
      updatedAt: new Date().toISOString()
    }));
    props.setProperties({
      AUTOMATION_MASTER_ENABLED: success ? 'true' : 'false',
      AUTO_SEND_ENABLED: success ? 'true' : 'false',
      LIVE_SEND_ENABLED: 'false'
    }, false);
    return Object.assign({}, sendResult, {
      mode: 'normal_daily_catch_up',
      status: success ? 'pass' : 'blocked',
      targetDate: validation.targetDate,
      automationMasterEnabled: success,
      autoSendEnabled: success,
      liveSendAtRest: true
    });
  } catch (error) {
    const props = PropertiesService.getScriptProperties();
    props.setProperties({
      AUTOMATION_MASTER_ENABLED: 'false',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false'
    }, false);
    writeGmailDailyAutomationState_(Object.assign({}, readGmailDailyAutomationState_(), {
      state: 'result_unknown',
      resultUnknown: true,
      errorCode: safeErrorCode_(error),
      updatedAt: new Date().toISOString()
    }));
    return {
      event: 'gmail_daily_catch_up_result_unknown',
      mode: 'normal_daily_catch_up',
      status: 'blocked',
      blockedReason: 'result_unknown',
      sentCount: 0,
      automationMasterEnabled: false,
      autoSendEnabled: false,
      liveSendAtRest: true
    };
  } finally {
    if (configForReset) resetLiveSendAfterRun_(configForReset);
    lock.releaseLock();
  }
}

function runGmailSalesSameDaySend20260624Once() {
  return activateAndRunGmailSalesSameDayEmergencyOnce_({
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    endHhmm: GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624,
    source: 'same_day_emergency_20260624'
  });
}

function prepareGmailSalesSameDay20260624Once() {
  return prepareGmailSalesSameDayEmergencyOnce_({
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    endHhmm: GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624,
    source: 'same_day_emergency_prepare_20260624'
  });
}

function verifyGmailSalesSameDayProperties20260624() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const scriptProjectIdentity = getScriptProjectIdentityHash_();
  const result = {
    event: 'gmail_same_day_properties_verify',
    mode: 'read_only',
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    scriptProjectIdentityHash: scriptProjectIdentity,
    masterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
    autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    expectedDailyCount: Number(props.getProperty('GMAIL_SALES_EXPECTED_DAILY_COUNT') || GMAIL_DAILY_EXPECTED_COUNT),
    maxDailySendCount: Number(props.getProperty('GMAIL_SALES_MAX_DAILY_SEND_COUNT') || config.dailySendLimit || 0),
    automationVersionConfigured: props.getProperty('GMAIL_SALES_AUTOMATION_VERSION') === GMAIL_DAILY_AUTOMATION_VERSION,
    approvalPolicyVersionConfigured: props.getProperty('GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION') === GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION,
    sharedSecretPresent: Boolean(String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim()),
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  appendSafeLog_(result);
  return result;
}

function inspectGmailSalesSameDay20260624Readiness() {
  return inspectGmailSalesSameDayReadiness_({
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    endHhmm: GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624
  });
}

function inspectGmailSalesDailyReadiness() {
  return inspectGmailSalesDailyReadiness_({});
}

function enableGmailSalesNormalAutomationWhenReadyOnce() {
  const props = PropertiesService.getScriptProperties();
  const readiness = inspectGmailSalesDailyReadiness_({});
  if (!readiness.readyForScheduledSend) {
    const blocked = {
      event: 'gmail_daily_enable_when_ready_blocked',
      status: 'blocked',
      targetDate: readiness.targetDate,
      blockedReasons: readiness.blockedReasons,
      propertyWriteCount: 0,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      triggerChanged: false
    };
    appendSafeLog_(blocked);
    return blocked;
  }
  props.setProperties({
    AUTOMATION_MASTER_ENABLED: 'true',
    AUTO_SEND_ENABLED: 'true',
    LIVE_SEND_ENABLED: 'true'
  }, false);
  const verify = inspectGmailSalesDailyReadiness_({});
  const result = {
    event: 'gmail_daily_enable_when_ready',
    status: verify.readyForScheduledSend ? 'enabled' : 'blocked',
    targetDate: readiness.targetDate,
    propertyWriteCount: 1,
    masterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
    autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    readyForScheduledSend: verify.readyForScheduledSend,
    blockedReasons: verify.blockedReasons,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function runGmailSalesDailyEnableWhenReady() {
  return enableGmailSalesNormalAutomationWhenReadyOnce();
}

function prepareGmailSalesDailyBatchForTodayOnce() {
  return prepareDailyPipeline();
}

function prepareDailyPipeline() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildDailyPipelineBlockedResult_('lock_unavailable', {
      targetDate: getConfig_().currentJstDate,
      source: 'manual'
    });
  }
  try {
    return prepareDailyPipeline_({ source: 'manual' });
  } finally {
    lock.releaseLock();
  }
}

function prepareDailyPipeline_(options) {
  const settings = options || {};
  const config = getConfig_();
  const targetDate = config.currentJstDate;
  const batchId = buildSendBatchId_(targetDate);
  const dailyConfig = Object.assign({}, config, {
    sendDate: targetDate,
    sendBatchId: batchId
  });
  const deployment = inspectGmailSalesDeploymentReadiness();
  if (!deployment.deploymentReady) {
    return buildDailyPipelineBlockedResult_('deployment_not_ready', {
      targetDate,
      source: settings.source || 'prepare',
      deploymentReady: false,
      operationalCandidateReady: deployment.operationalCandidateReady,
      blockedReasons: deployment.infrastructureBlockedReasons || deployment.blockedReasons || []
    });
  }
  if (!deployment.operationalCandidateReady) {
    return buildDailyPipelineBlockedResult_('operational_candidates_not_ready', {
      targetDate,
      source: settings.source || 'prepare',
      deploymentReady: true,
      operationalCandidateReady: false,
      blockedReasons: deployment.candidateBlockedReasons || []
    });
  }
  const policy = getGmailSalesOperationalDayPolicy_(config.currentJstDate);
  if (!policy.isOperationalDay) {
    return buildDailyPipelineBlockedResult_(policy.reason, {
      targetDate,
      source: settings.source || 'prepare',
      operationalDayPolicy: policy
    });
  }
  if (!config.sheetId) {
    return buildDailyPipelineBlockedResult_('missing_sheet_id', { targetDate, source: settings.source || 'prepare' });
  }
  const source = loadDailyPipelineSourceRows_(dailyConfig);
  if (!source.loaded) {
    return buildDailyPipelineBlockedResult_(source.blockedReason || 'source_candidate_load_failed', {
      targetDate,
      source: settings.source || 'prepare',
      sourceCandidateCount: source.sourceCandidateCount || 0
    });
  }
  const selected = selectDailyPipelineCandidates_(source.rows, dailyConfig, batchId);
  if (selected.selectedItems.length !== gmailDailyExpectedCount_()) {
    return buildDailyPipelineBlockedResult_('selected_count_not_30', {
      targetDate,
      source: settings.source || 'prepare',
      sourceCandidateCount: source.sourceCandidateCount,
      eligibleCount: selected.eligibleCount,
      selectedCount: selected.selectedItems.length,
      reserveCount: selected.reserveCount,
      selfRepairAttempted: true,
      candidateRegenerationRequired: selected.selectedItems.length < gmailDailyExpectedCount_()
    });
  }
  const validation = validateOutboxRows_(selected.selectedItems, dailyConfig);
  if (validation.errors.length > 0 || validation.readyRows.length !== gmailDailyExpectedCount_()) {
    return buildDailyPipelineBlockedResult_('selected_candidate_validation_failed', {
      targetDate,
      source: settings.source || 'prepare',
      sourceCandidateCount: source.sourceCandidateCount,
      eligibleCount: selected.eligibleCount,
      selectedCount: validation.readyRows.length,
      reserveCount: selected.reserveCount,
      validationErrorCount: validation.errors.length
    });
  }
  let suppression = { loaded: false, entries: [] };
  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }
  if (!suppression.loaded) {
    return buildDailyPipelineBlockedResult_('suppression_ledger_missing', {
      targetDate,
      source: settings.source || 'prepare',
      sourceCandidateCount: source.sourceCandidateCount,
      eligibleCount: selected.eligibleCount,
      selectedCount: validation.readyRows.length,
      reserveCount: selected.reserveCount
    });
  }
  const manifest = buildSameDayAutomaticManifest_(validation.readyRows, dailyConfig, batchId);
  const manifestCheck = validateApprovedSendManifest_(manifest, dailyConfig, batchId, validation.readyRows);
  const preSendSummary = countSameDayPreSendBlocks_(validation.readyRows, dailyConfig, batchId, manifestCheck, suppression);
  const blockedReasons = [];
  if (!manifestCheck.ok) blockedReasons.push.apply(blockedReasons, manifestCheck.blockedReasons);
  if (preSendSummary.duplicateCount > 0) blockedReasons.push('duplicate_candidate');
  if (preSendSummary.suppressedCount > 0) blockedReasons.push('suppression_match');
  if (preSendSummary.alreadySentCount > 0) blockedReasons.push('already_sent_candidate');
  if (preSendSummary.invalidEmailCount > 0) blockedReasons.push('invalid_email');
  if (preSendSummary.optOutMissingCount > 0) blockedReasons.push('opt_out_missing');
  if (preSendSummary.personalizationInvalidCount > 0) blockedReasons.push('personalization_invalid');
  if (blockedReasons.length > 0) {
    return buildDailyPipelineBlockedResult_(uniqueArray_(blockedReasons).join(','), {
      targetDate,
      source: settings.source || 'prepare',
      sourceCandidateCount: source.sourceCandidateCount,
      eligibleCount: selected.eligibleCount,
      selectedCount: validation.readyRows.length,
      reserveCount: selected.reserveCount,
      duplicateCount: preSendSummary.duplicateCount,
      suppressedCount: preSendSummary.suppressedCount,
      alreadySentCount: preSendSummary.alreadySentCount,
      invalidEmailCount: preSendSummary.invalidEmailCount,
      optOutMissingCount: preSendSummary.optOutMissingCount,
      personalizationInvalidCount: preSendSummary.personalizationInvalidCount,
      manifestCandidateDigestMismatchCount: manifestCheck.candidateDigestMismatchCount
    });
  }
  const payload = {
    action: 'prepare_daily_pipeline',
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    targetDate,
    sendDate: targetDate,
    sendBatchId: batchId,
    candidateCount: validation.readyRows.length,
    headers: GMAIL_SHEET_SYNC_OUTBOX_HEADERS.slice(),
    rows: validation.readyRows.map((item) => outboxRowToSheetCells_(item.row)),
    readyTabName: PropertiesService.getScriptProperties().getProperty('GMAIL_SHEET_READY_TAB_NAME') || dailyConfig.sheetName || 'Gmail送信対象'
  };
  const sheetResult = writeGmailOutboxRowsToSheet_(payload, dailyConfig);
  if (!sheetResult.sheetSynced) {
    return buildDailyPipelineBlockedResult_(sheetResult.blockedReason || 'sheet_sync_failed', {
      targetDate,
      source: settings.source || 'prepare',
      selectedCount: validation.readyRows.length,
      sheetSynced: false
    });
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    SEND_DATE: targetDate,
    SEND_BATCH_ID: batchId,
    SEND_DATE_OVERRIDE: 'false',
    SEND_BATCH_ID_OVERRIDE: 'false'
  }, false);
  props.setProperty('APPROVED_SEND_MANIFEST_JSON', JSON.stringify(manifest));
  const state = writeGmailDailyAutomationState_(buildDailyReadyState_(targetDate, batchId, manifest, validation.readyRows.length, selected.reserveCount));
  const readBackRows = loadCandidateRows_(dailyConfig);
  const readBackValidation = validateOutboxRows_(readBackRows, dailyConfig);
  const readBackManifestCheck = validateApprovedSendManifest_(manifest, dailyConfig, batchId, readBackValidation.readyRows);
  const readBackOk = readBackValidation.readyRows.length === gmailDailyExpectedCount_() && readBackManifestCheck.ok;
  if (!readBackOk) {
    writeGmailDailyAutomationState_(Object.assign({}, state, {
      state: 'blocked',
      sheetSynced: false,
      blockedReasons: uniqueArray_(['pipeline_read_back_validation_failed'].concat(readBackManifestCheck.blockedReasons || [])),
      updatedAt: new Date().toISOString()
    }));
    return buildDailyPipelineBlockedResult_('pipeline_read_back_validation_failed', {
      targetDate,
      source: settings.source || 'prepare',
      selectedCount: validation.readyRows.length,
      readBackSelectedCount: readBackValidation.readyRows.length,
      manifestCandidateDigestMismatchCount: readBackManifestCheck.candidateDigestMismatchCount,
      sheetSynced: true
    });
  }
  const readiness = inspectGmailSalesDailyReadiness_({ targetDate });
  const result = {
    event: 'gmail_daily_prepare_pipeline_completed',
    status: readiness.readyForScheduledSend ? 'pass' : 'prepared_needs_attention',
    targetDate,
    sendBatchId: batchId,
    sourceCandidateCount: source.sourceCandidateCount,
    eligibleCount: selected.eligibleCount,
    selectedCount: validation.readyRows.length,
    reserveCount: selected.reserveCount,
    sheetSynced: true,
    state: state.state,
    stateReady: isGmailDailyPreparedState_(state),
    manifestGenerated: true,
    manifestTargetDateMatched: readiness.manifestTargetDateMatched,
    manifestCandidateCount: readiness.manifestCandidateCount,
    manifestMaxSendCount: readiness.manifestMaxSendCount,
    candidateDigestMatch: readBackManifestCheck.candidateDigestMismatchCount === 0,
    readBackPassed: true,
    readyForScheduledSend: readiness.readyForScheduledSend,
    blockedReasons: readiness.blockedReasons,
    mockSheetSync: false,
    mockReadBack: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: true,
    scriptPropertiesUpdated: true,
    triggerChanged: false
  };
  appendSafeLog_(result);
  return result;
}

function buildDailyPipelineBlockedResult_(blockedReason, details) {
  const extra = details || {};
  const result = Object.assign({
    event: 'gmail_daily_prepare_pipeline_blocked',
    status: 'blocked',
    blockedReason,
    targetDate: extra.targetDate || getConfig_().currentJstDate,
    source: extra.source || 'prepare',
    selectedCount: Number(extra.selectedCount || 0),
    sheetSynced: extra.sheetSynced === true,
    manifestGenerated: false,
    stateUpdated: false,
    readinessExecuted: false,
    mockSheetSync: false,
    mockReadBack: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  }, extra);
  appendSafeLog_(result);
  return result;
}

function buildDailyReadyState_(targetDate, batchId, manifest, selectedCount, reserveCount) {
  return {
    targetDate,
    mode: 'normal_daily',
    sendBatchId: batchId,
    manifestDigest: String(manifest.manifestDigest || '').trim(),
    candidateContentHash: String(manifest.sourceOutboxIdentity && manifest.sourceOutboxIdentity.candidateContentHash || '').trim(),
    expectedCandidateCount: gmailDailyExpectedCount_(),
    actualCandidateCount: selectedCount,
    reserveCandidateCount: reserveCount,
    sheetSynced: true,
    state: 'sheet_synced',
    stateVersion: 2,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preSendPassedAt: '',
    sendStartedAt: '',
    sentAt: '',
    sendAttemptCount: 0,
    actualSendCount: 0,
    failedSendCount: 0,
    resultUnknown: false,
    blockedReasons: [],
    errorCode: '',
    automationVersion: GMAIL_DAILY_AUTOMATION_VERSION,
    triggerRunId: ''
  };
}

function isGmailDailyPreparedState_(state) {
  const status = String(state && state.state || '');
  return (status === 'ready' || status === 'sheet_synced') && (state.sheetSynced === true || status === 'sheet_synced');
}

function loadDailyPipelineSourceRows_(config) {
  const props = PropertiesService.getScriptProperties();
  const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || GMAIL_DAILY_SOURCE_TAB_NAME_DEFAULT).trim();
  if (!sourceName || !config.sheetId) {
    return { loaded: false, blockedReason: 'source_sheet_not_configured', sourceCandidateCount: 0, rows: [] };
  }
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheet = spreadsheet.getSheetByName(sourceName);
  if (!sheet || !looksLikeCandidateSheet_(sheet) || sheet.getLastRow() < 2) {
    return { loaded: false, blockedReason: 'source_sheet_empty_or_invalid', sourceCandidateCount: 0, rows: [] };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((value) => String(value));
  const rows = values.slice(1).map((cells, index) => {
    const row = rowFromCells_(headers, cells);
    row.email = row.email || row.contactEmail || row['宛先メール'] || row['メール'];
    row.contactEmail = row.contactEmail || row.email || row['連絡先メール'];
    row.name = row.name || row['店舗名'];
    return { row, rowIndex: index + 2 };
  });
  return { loaded: true, blockedReason: '', sourceCandidateCount: rows.length, rows };
}

function selectDailyPipelineCandidates_(sourceItems, config, batchId) {
  const eligibleItems = [];
  (sourceItems || []).forEach((item) => {
    const row = normalizeDailyPipelineSourceRow_(item.row || {}, config.sendDate, batchId);
    const email = normalizeEmail_(row.email || row.contactEmail);
    const subject = normalizeEmailSubject_(row.subject);
    const body = normalizeEmailBody_(row.body);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (!subject || !body) return;
    if (!hasAllowedGmailSalesContactBasis_(row)) return;
    if (shouldSkipRecipient_(row)) return;
    try {
      const message = buildInitialSalesEmail_(row);
      assertMessageSafe_(message);
      assertRecipientPersonalizationSafe_(row, message);
    } catch (error) {
      return;
    }
    eligibleItems.push({ row, rowIndex: item.rowIndex });
  });
  const validation = validateOutboxRows_(eligibleItems, config);
  return {
    eligibleCount: validation.readyRows.length,
    selectedItems: validation.readyRows.slice(0, gmailDailyExpectedCount_()),
    reserveCount: Math.max(0, validation.readyRows.length - gmailDailyExpectedCount_()),
    skippedCount: validation.skipped.length,
    validationErrorCount: validation.errors.length
  };
}

function normalizeDailyPipelineSourceRow_(row, targetDate, batchId) {
  const next = Object.assign({}, row);
  next.email = next.email || next.contactEmail || next['宛先メール'] || next['メール'];
  next.contactEmail = next.contactEmail || next.email || next['連絡先メール'];
  next.name = next.name || next['店舗名'] || '';
  next.status = 'ready';
  next.sendDate = targetDate;
  next.nextActionDate = targetDate;
  next.sendBatchId = batchId;
  next.sentAt = '';
  next.sentBy = '';
  next.sentStatus = '';
  next.errorMessage = '';
  next.replyStatus = '';
  next.sendState = GMAIL_SEND_STATE.ready;
  next.sendRunId = '';
  next.sendReservedAt = '';
  next.sendAttemptCount = 0;
  next.approvedBatchId = '';
  next.approvedCandidateDigest = '';
  next.deliveryUncertainAt = '';
  next.lastSendErrorCode = '';
  GMAIL_CONTACT_BASIS_COLUMNS.forEach((field) => {
    if (next[field] === undefined || next[field] === '') {
      next[field] = getContactBasisValue_(row, field);
    }
  });
  next.lastCheckedAt = targetDate;
  return next;
}

function hasAllowedGmailSalesContactBasis_(row) {
  const basisType = normalizeContactBasisType_(getContactBasisValue_(row, 'contactBasisType'));
  const sourceType = String(getContactBasisValue_(row, 'sourceType') || '').trim();
  const sourceReferenceHash = String(getContactBasisValue_(row, 'sourceReferenceHash') || '').trim();
  const recordedAt = String(getContactBasisValue_(row, 'contactBasisRecordedAt') || '').trim();
  const lastVerifiedAt = String(getContactBasisValue_(row, 'lastVerifiedAt') || row.lastCheckedAt || '').trim();
  const suppressionCheckedAt = String(getContactBasisValue_(row, 'suppressionCheckedAt') || '').trim();
  const historyCheckedAt = String(getContactBasisValue_(row, 'historyCheckedAt') || '').trim();
  const optOutValue = getContactBasisValue_(row, 'optOutAvailable');
  const optOutAvailable = optOutValue === true || String(optOutValue || '').toLowerCase() === 'true';
  if (GMAIL_CONTACT_BASIS_ALLOWED_TYPES.indexOf(basisType) === -1) return false;
  if (!sourceType || !sourceReferenceHash || !recordedAt || !lastVerifiedAt || !suppressionCheckedAt || !historyCheckedAt) return false;
  if (!optOutAvailable) return false;
  return true;
}

function getContactBasisValue_(row, field) {
  const aliases = contactBasisAliases_()[field] || [field];
  for (let i = 0; i < aliases.length; i += 1) {
    const key = aliases[i];
    if (row && row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function normalizeContactBasisType_(value) {
  return String(value || '').trim().toLowerCase();
}

function outboxRowToSheetCells_(row) {
  return GMAIL_SHEET_SYNC_OUTBOX_HEADERS.map((header) => row[header] === undefined ? '' : row[header]);
}

function setGmailSalesSafeRestPropertiesOnce() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    AUTOMATION_MASTER_ENABLED: 'true',
    AUTO_SEND_ENABLED: 'false',
    LIVE_SEND_ENABLED: 'false'
  }, false);
  const result = Object.assign(inspectGmailSalesProductionProperties(), {
    event: 'gmail_sales_safe_rest_properties_set',
    status: 'pass',
    propertyWriteCount: 1,
    scriptPropertiesUpdated: true
  });
  appendSafeLog_(result);
  return result;
}

function inspectGmailSalesSameDayCandidateRejections20260624() {
  return inspectGmailSalesSameDayCandidateRejections_({
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    endHhmm: GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624
  });
}

function repairGmailSalesSameDayCandidateMetadata20260624Once() {
  return repairGmailSalesSameDayCandidateMetadataOnce_({
    targetDate: GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624,
    endHhmm: GMAIL_SAME_DAY_EMERGENCY_END_HHMM_20260624
  });
}

function prepareGmailSalesSameDayEmergencyOnce_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const source = settings.source || 'same_day_emergency_prepare';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return buildSameDayPrepareBlockedResult_(source, targetDate, 'lock_unavailable');
  }
  try {
    const validation = buildSameDayPrepareValidation_(settings);
    if (!validation.ok) {
      const result = buildSameDayPrepareBlockedResult_(source, targetDate, validation.blockedReasons.join(','));
      Object.assign(result, validation.publicSummary);
      appendSafeLog_(result);
      return result;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('APPROVED_SEND_MANIFEST_JSON', JSON.stringify(validation.manifest));
    const state = writeGmailDailyAutomationState_({
      targetDate,
      mode: 'normal_daily',
      sendBatchId: validation.batchId,
      manifestDigest: validation.manifest.manifestDigest,
      candidateContentHash: validation.manifest.sourceOutboxIdentity.candidateContentHash,
      expectedCandidateCount: gmailDailyExpectedCount_(),
      actualCandidateCount: validation.selectedCount,
      state: 'sheet_synced',
      stateVersion: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preSendPassedAt: '',
      sendStartedAt: '',
      sentAt: '',
      sendAttemptCount: 0,
      actualSendCount: 0,
      failedSendCount: 0,
      resultUnknown: false,
      blockedReasons: [],
      errorCode: '',
      automationVersion: GMAIL_DAILY_AUTOMATION_VERSION,
      triggerRunId: ''
    });

    const readBack = inspectGmailSalesSameDayReadiness_(settings);
    const success = readBack.stateStatus === 'sheet_synced' &&
      readBack.sheetSynced === true &&
      readBack.candidateCount === gmailDailyExpectedCount_() &&
      readBack.manifestTargetDate === targetDate &&
      readBack.manifestBatchMatched === true &&
      readBack.manifestCandidateCount === gmailDailyExpectedCount_() &&
      readBack.manifestMaxSendCount === gmailDailyExpectedCount_() &&
      readBack.manifestApprovalType === 'automatic_strict_gate' &&
      readBack.targetAutoApproved === true &&
      readBack.humanReviewRequired === false &&
      readBack.humanReviewCount === 0;
    const result = Object.assign({}, validation.publicSummary, {
      event: 'gmail_same_day_prepare_completed',
      mode: source,
      status: success ? 'pass' : 'blocked',
      blockedReason: success ? '' : 'prepare_read_back_failed',
      targetDate,
      sendBatchId: validation.batchId,
      selectedCount: validation.selectedCount,
      sheetSynced: true,
      stateStatus: state.state,
      manifestSaved: true,
      readBackPassed: success,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: true
    });
    appendSafeLog_(result);
    return result;
  } catch (error) {
    const result = buildSameDayPrepareBlockedResult_(source, targetDate, safeErrorCode_(error));
    appendSafeLog_(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function buildSameDayPrepareValidation_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const config = getConfig_();
  const batchId = buildSendBatchId_(targetDate);
  const blockedReasons = [];
  if (settings.enforceSameDayEmergencyDate !== false && targetDate !== GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624) blockedReasons.push('target_date_not_allowed');
  if (config.currentJstDate !== targetDate) blockedReasons.push('same_day_date_mismatch');
  if (config.sendDate !== targetDate) blockedReasons.push('send_date_mismatch');
  if (!insideGmailSameDayEmergencyWindow_(config, targetDate, settings.endHhmm)) blockedReasons.push('same_day_emergency_window_closed');
  if (!verifyBatchNotSent_(batchId)) blockedReasons.push('already_sent');

  let rows = [];
  let validation = { readyRows: [], skipped: [], errors: [] };
  let suppression = { loaded: false, entries: [] };
  try {
    rows = loadCandidateRows_(config);
    validation = validateOutboxRows_(rows, config);
  } catch (error) {
    blockedReasons.push('sheet_or_outbox_load_failed');
  }
  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }
  if (!suppression.loaded) blockedReasons.push('suppression_ledger_missing');
  if (validation.errors.length > 0) blockedReasons.push('outbox_validation_errors');
  if (validation.readyRows.length !== gmailDailyExpectedCount_()) blockedReasons.push('candidate_count_not_30');

  const manifest = buildSameDayAutomaticManifest_(validation.readyRows, config, batchId);
  const manifestCheck = validateApprovedSendManifest_(manifest, config, batchId, validation.readyRows);
  const preSendSummary = countSameDayPreSendBlocks_(validation.readyRows, config, batchId, manifestCheck, suppression);
  if (preSendSummary.duplicateCount > 0) blockedReasons.push('duplicate_candidate');
  if (preSendSummary.suppressedCount > 0) blockedReasons.push('suppression_match');
  if (preSendSummary.alreadySentCount > 0) blockedReasons.push('already_sent_candidate');
  if (preSendSummary.invalidEmailCount > 0) blockedReasons.push('invalid_email');
  if (preSendSummary.optOutMissingCount > 0) blockedReasons.push('opt_out_missing');
  if (preSendSummary.personalizationInvalidCount > 0) blockedReasons.push('personalization_invalid');
  if (manifestCheck.candidateDigestMismatchCount > 0) blockedReasons.push('candidate_digest_mismatch');
  if (!manifestCheck.ok) blockedReasons.push.apply(blockedReasons, manifestCheck.blockedReasons);

  const publicSummary = {
    sourceCandidateCount: rows.length,
    eligibleCount: validation.readyRows.length,
    selectedCount: validation.readyRows.length === gmailDailyExpectedCount_() ? gmailDailyExpectedCount_() : 0,
    duplicateCount: preSendSummary.duplicateCount,
    suppressedCount: preSendSummary.suppressedCount,
    alreadySentCount: preSendSummary.alreadySentCount,
    invalidEmailCount: preSendSummary.invalidEmailCount,
    optOutMissingCount: preSendSummary.optOutMissingCount,
    personalizationInvalidCount: preSendSummary.personalizationInvalidCount,
    manifestCandidateDigestMismatchCount: manifestCheck.candidateDigestMismatchCount,
    mockSheetSync: false,
    mockReadBack: false,
    mockManifestValidation: manifestCheck.ok,
    mockStateValidation: false
  };
  return {
    ok: uniqueArray_(blockedReasons).length === 0,
    blockedReasons: uniqueArray_(blockedReasons),
    publicSummary,
    manifest,
    batchId,
    selectedCount: validation.readyRows.length
  };
}

function buildSameDayAutomaticManifest_(readyRows, config, batchId) {
  const candidateDigests = (readyRows || []).map((item) => computeCandidateDigest_(item.row, config.sendDate, batchId));
  const contentHash = hashValue_(candidateDigests.join('\n'));
  const manifest = {
    schemaVersion: GMAIL_SEND_MANIFEST_SCHEMA_VERSION,
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    targetDate: config.sendDate,
    batchId,
    candidateCount: candidateDigests.length,
    expectedCandidateCount: gmailDailyExpectedCount_(),
    approvedOutboxHash: contentHash,
    approvalStatus: 'approved',
    approvalType: 'automatic_strict_gate',
    targetAutoApproved: true,
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    autoApprovalPolicyVersion: GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION,
    automationVersion: GMAIL_DAILY_AUTOMATION_VERSION,
    autoApprovalPassedAt: new Date().toISOString(),
    maxSendCount: gmailDailyExpectedCount_(),
    expiresAt: buildDailyManifestExpiry_(config),
    candidateDigests,
    sourceOutboxIdentity: {
      source: 'apps_script_same_day_prepare',
      candidateContentHash: contentHash,
      outboxIdentityDigest: hashValue_([config.sendDate, batchId, contentHash].join('\n')),
      statusDocument: 'automatic_strict_gate'
    }
  };
  manifest.manifestDigest = hashValue_(JSON.stringify(manifest));
  return manifest;
}

function buildDailyManifestExpiry_(config) {
  return new Date(String(config.sendDate || config.currentJstDate) + 'T23:59:00').toISOString();
}

function countSameDayPreSendBlocks_(readyRows, config, batchId, manifestCheck, suppression) {
  const seenEmails = {};
  const seenDomains = {};
  const seenBusiness = {};
  const seenDedupe = {};
  const summary = {
    duplicateCount: 0,
    suppressedCount: 0,
    alreadySentCount: 0,
    invalidEmailCount: 0,
    optOutMissingCount: 0,
    personalizationInvalidCount: 0
  };
  (readyRows || []).forEach((item) => {
    const row = item.row || {};
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const domain = sourceDomainFromRow_(row);
    const business = businessFingerprintFromRow_(row);
    const dedupe = String(row.dedupeKey || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) summary.invalidEmailCount += 1;
    if ((email && seenEmails[email]) || (domain && seenDomains[domain]) || (business && seenBusiness[business]) || (dedupe && seenDedupe[dedupe])) {
      summary.duplicateCount += 1;
    }
    seenEmails[email] = true;
    seenDomains[domain] = true;
    seenBusiness[business] = true;
    seenDedupe[dedupe] = true;
    const check = validateSingleCandidatePreSend_(row, {
      config,
      batchId,
      manifest: manifestCheck.manifest,
      manifestDigestSet: manifestCheck.manifestDigestSet,
      suppression
    });
    if (check.suppressionMatched) summary.suppressedCount += 1;
    if (check.gmailSentMatched || check.sheetHistoryMatched || check.blockedReason === 'candidate_state_not_ready') summary.alreadySentCount += 1;
    try {
      const message = buildInitialSalesEmail_(row);
      assertMessageSafe_(message);
      assertRecipientPersonalizationSafe_(row, message);
    } catch (error) {
      const reason = String(error.message || '');
      if (reason === 'missing_opt_out_text') summary.optOutMissingCount += 1;
      if (reason.indexOf('personalization') !== -1) summary.personalizationInvalidCount += 1;
    }
  });
  return summary;
}

function buildSameDayPrepareBlockedResult_(mode, targetDate, blockedReason) {
  return {
    event: 'gmail_same_day_prepare_blocked',
    mode,
    status: 'blocked',
    blockedReason,
    targetDate,
    selectedCount: 0,
    sheetSynced: false,
    manifestSaved: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
}

function inspectGmailSalesSameDayReadiness_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const batchId = buildSendBatchId_(targetDate);
  const state = readGmailDailyAutomationState_();
  const blockedReasons = [];
  let manifest = null;
  let rows = [];
  let validation = { readyRows: [], skipped: [], errors: [] };
  let suppression = { loaded: false, entries: [] };
  let manifestCheck = buildManifestValidationResult_(null, ['manifest_not_loaded'], [], config, batchId);
  try {
    rows = loadCandidateRows_(config);
    validation = validateOutboxRows_(rows, config);
  } catch (error) {
    blockedReasons.push('sheet_or_outbox_load_failed');
  }
  try {
    manifest = loadApprovedSendManifest_(config);
    manifestCheck = validateApprovedSendManifest_(manifest, config, batchId, validation.readyRows);
  } catch (error) {
    blockedReasons.push('manifest_load_failed');
  }
  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }
  const preSendSummary = countSameDayPreSendBlocks_(validation.readyRows, config, batchId, manifestCheck, suppression);
  const beforeDeadline = insideGmailSameDayEmergencyWindow_(config, targetDate, settings.endHhmm);
  const sheetSynced = state.state === 'sheet_synced' && state.targetDate === targetDate;
  const manifestBatchMatched = Boolean(manifest && String(manifest.batchId || '') === batchId);
  const manifestTargetDate = String(manifest && manifest.targetDate || '');
  const manifestCandidateCount = Number(manifest && manifest.candidateCount || 0);
  const manifestMaxSendCount = Number(manifest && manifest.maxSendCount || 0);
  const humanReviewCount = Number(manifest && manifest.humanReviewedCount || 0);
  const humanReviewRequired = Boolean(manifest && manifest.humanReviewCompleted === true);
  if (!beforeDeadline) blockedReasons.push('same_day_emergency_window_closed');
  if (!sheetSynced) blockedReasons.push('state_not_sheet_synced');
  if (state.targetDate !== targetDate) blockedReasons.push('state_target_date_mismatch');
  if (validation.readyRows.length !== gmailDailyExpectedCount_()) blockedReasons.push('candidate_count_not_30');
  if (manifestTargetDate !== targetDate) blockedReasons.push('manifest_target_date_mismatch');
  if (!manifestBatchMatched) blockedReasons.push('manifest_batch_mismatch');
  if (manifestCandidateCount !== gmailDailyExpectedCount_()) blockedReasons.push('manifest_candidate_count_not_30');
  if (manifestMaxSendCount !== gmailDailyExpectedCount_()) blockedReasons.push('manifest_max_send_count_not_30');
  if (String(manifest && manifest.approvalType || '') !== 'automatic_strict_gate') blockedReasons.push('manifest_approval_type_invalid');
  if (!(manifest && manifest.targetAutoApproved === true)) blockedReasons.push('manifest_target_auto_approved_missing');
  if (humanReviewRequired) blockedReasons.push('manifest_human_review_must_be_false');
  if (humanReviewCount !== 0) blockedReasons.push('manifest_human_review_count_must_be_zero');
  if (preSendSummary.duplicateCount > 0) blockedReasons.push('duplicate_candidate');
  if (preSendSummary.suppressedCount > 0) blockedReasons.push('suppression_match');
  if (preSendSummary.alreadySentCount > 0) blockedReasons.push('already_sent_candidate');
  if (preSendSummary.invalidEmailCount > 0) blockedReasons.push('invalid_email');
  if (preSendSummary.optOutMissingCount > 0) blockedReasons.push('opt_out_missing');
  if (props.getProperty('LIVE_SEND_ENABLED') !== 'true') blockedReasons.push('live_send_disabled');
  const uniqueBlocked = uniqueArray_(blockedReasons);
  const result = {
    event: 'gmail_same_day_readiness',
    mode: 'read_only',
    targetDate,
    currentTimeJst: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || GMAIL_SALES_TIMEZONE_DEFAULT, 'yyyy-MM-dd HH:mm'),
    beforeDeadline,
    stateStatus: state.state || 'not_started',
    stateTargetDate: String(state.targetDate || ''),
    sheetSynced,
    candidateCount: validation.readyRows.length,
    manifestTargetDate,
    manifestBatchMatched,
    manifestCandidateCount,
    manifestMaxSendCount,
    manifestApprovalType: String(manifest && manifest.approvalType || ''),
    targetAutoApproved: Boolean(manifest && manifest.targetAutoApproved === true),
    humanReviewRequired,
    humanReviewCount,
    duplicateCount: preSendSummary.duplicateCount,
    suppressedCount: preSendSummary.suppressedCount,
    alreadySentCount: preSendSummary.alreadySentCount,
    invalidEmailCount: preSendSummary.invalidEmailCount,
    optOutMissingCount: preSendSummary.optOutMissingCount,
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    readyToSend: uniqueBlocked.length === 0,
    blockedReasons: uniqueBlocked,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  appendSafeLog_(result);
  return result;
}

function inspectGmailSalesDailyReadiness_(options) {
  const settings = options || {};
  const config = getConfig_();
  const targetDate = String(settings.targetDate || config.currentJstDate || '').trim();
  const policy = getGmailSalesOperationalDayPolicy_(targetDate);
  const batchId = buildSendBatchId_(targetDate);
  const dailyConfig = Object.assign({}, config, {
    sendDate: targetDate,
    sendBatchId: batchId
  });
  const sourceStatus = readNormalDailySourceTabStatus_();
  const state = readGmailDailyAutomationState_();
  const blockedReasons = [];
  let rows = [];
  let validation = { readyRows: [], errors: [] };
  let manifest = null;
  let manifestCheck = buildManifestValidationResult_(null, ['manifest_not_loaded'], [], config, batchId);
  let suppression = { loaded: false, entries: [] };
  try {
    rows = loadCandidateRows_(dailyConfig);
    validation = validateOutboxRows_(rows, dailyConfig);
  } catch (error) {
    blockedReasons.push('sheet_or_outbox_load_failed');
  }
  try {
    manifest = loadApprovedSendManifest_(dailyConfig);
    manifestCheck = validateApprovedSendManifest_(manifest, dailyConfig, batchId, validation.readyRows);
  } catch (error) {
    blockedReasons.push('manifest_load_failed');
  }
  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }
  const preSendSummary = countSameDayPreSendBlocks_(validation.readyRows, dailyConfig, batchId, manifestCheck, suppression);
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const versionStatus = gmailDailyVersionStatus_();
  const preflight = executeApprovedGmailSalesPreSendDryRun_({ source: 'daily_readiness' });
  const selectedCount = validation.readyRows.length;
  const reserveCount = Math.max(0, Number(sourceStatus.rowCount || 0) - selectedCount);
  if (!policy.isOperationalDay) blockedReasons.push(policy.reason);
  if (sourceStatus.rowCount < GMAIL_DAILY_SOURCE_RECOMMENDED_SYNC_COUNT) blockedReasons.push('source_rows_below_recommended');
  if (selectedCount !== gmailDailyExpectedCount_()) blockedReasons.push('selected_count_not_30');
  if (reserveCount < 15) blockedReasons.push('reserve_count_below_15');
  if (!isGmailDailyPreparedState_(state)) blockedReasons.push('state_not_ready');
  if (state.targetDate !== targetDate) blockedReasons.push('state_target_date_mismatch');
  if (String(manifest && manifest.targetDate || '') !== targetDate) blockedReasons.push('manifest_target_date_mismatch');
  if (String(manifest && manifest.batchId || '') !== batchId) blockedReasons.push('manifest_batch_mismatch');
  if (Number(manifest && manifest.candidateCount || 0) !== gmailDailyExpectedCount_()) blockedReasons.push('manifest_candidate_count_not_30');
  if (Number(manifest && manifest.maxSendCount || 0) !== gmailDailyExpectedCount_()) blockedReasons.push('manifest_max_send_count_not_30');
  if (!(manifest && manifest.targetAutoApproved === true)) blockedReasons.push('manifest_target_auto_approved_missing');
  if (manifest && manifest.humanReviewCompleted === true) blockedReasons.push('manifest_human_review_must_be_false');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 0) blockedReasons.push('manifest_human_review_count_must_be_zero');
  if (preSendSummary.duplicateCount > 0) blockedReasons.push('duplicate_candidate');
  if (preSendSummary.suppressedCount > 0) blockedReasons.push('suppression_match');
  if (preSendSummary.alreadySentCount > 0) blockedReasons.push('already_sent_candidate');
  if (preSendSummary.invalidEmailCount > 0) blockedReasons.push('invalid_email');
  if (preSendSummary.optOutMissingCount > 0) blockedReasons.push('opt_out_missing');
  if (preflight.status !== 'pass') blockedReasons.push.apply(blockedReasons, preflight.blockedReasons || ['preflight_blocked']);
  if (triggerHealth.status !== 'pass') blockedReasons.push('trigger_health_blocked');
  if (!versionStatus.ok) blockedReasons.push.apply(blockedReasons, versionStatus.blockedReasons);
  const uniqueBlocked = uniqueArray_(blockedReasons);
  const result = {
    event: 'gmail_daily_readiness',
    mode: 'read_only',
    schedulerAuthority: 'runGmailSalesDailyAutomationTrigger',
    legacyScheduledDailySendMode: 'monitor_only',
    operationalDayPolicy: policy,
    isOperationalDay: policy.isOperationalDay,
    isSpecialRestartDay: policy.isSpecialRestartDay,
    isWeeklyReviewDay: policy.isWeeklyReviewDay,
    targetDate,
    currentTimeJst: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || GMAIL_SALES_TIMEZONE_DEFAULT, 'yyyy-MM-dd HH:mm'),
    sourceCandidateCount: Number(sourceStatus.rowCount || 0),
    verifiedCandidateCount: Number(sourceStatus.rowCount || 0),
    selectedCount,
    reserveCount,
    sheetSynced: isGmailDailyPreparedState_(state),
    stateStatus: state.state || 'not_started',
    stateTargetDateMatched: state.targetDate === targetDate,
    manifestTargetDateMatched: String(manifest && manifest.targetDate || '') === targetDate,
    manifestBatchMatched: String(manifest && manifest.batchId || '') === batchId,
    manifestCandidateCount: Number(manifest && manifest.candidateCount || 0),
    manifestMaxSendCount: Number(manifest && manifest.maxSendCount || 0),
    targetAutoApproved: Boolean(manifest && manifest.targetAutoApproved === true),
    humanReviewRequired: Boolean(manifest && manifest.humanReviewCompleted === true),
    humanReviewCount: Number(manifest && manifest.humanReviewedCount || 0),
    duplicateCount: preSendSummary.duplicateCount,
    suppressedCount: preSendSummary.suppressedCount,
    alreadySentCount: preSendSummary.alreadySentCount,
    repliedCount: 0,
    invalidEmailCount: preSendSummary.invalidEmailCount,
    optOutMissingCount: preSendSummary.optOutMissingCount,
    preflightPassed: preflight.status === 'pass',
    blockedReasons: uniqueBlocked,
    readyForScheduledSend: uniqueBlocked.length === 0,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  appendSafeLog_(result);
  return result;
}

function getScriptProjectIdentityHash_() {
  try {
    if (typeof ScriptApp.getScriptId === 'function') {
      return hashValue_(ScriptApp.getScriptId());
    }
  } catch (error) {
    return '';
  }
  return '';
}

function inspectGmailSalesSameDayCandidateRejections_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const config = getConfig_();
  const batchId = buildSendBatchId_(targetDate);
  const result = buildEmptySameDayCandidateRejectionSummary_(targetDate, config);
  let rows = [];
  let suppression = { loaded: false, entries: [] };
  let sentEmails = {};
  try {
    rows = loadCandidateRows_(config);
  } catch (error) {
    result.rejectionReasonCounts.sheet_or_outbox_load_failed = 1;
  }
  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }
  try {
    sentEmails = loadKnownSentEmails_(config);
  } catch (error) {
    sentEmails = {};
  }

  result.sourceCandidateCount = rows.length;
  const rowDetails = rows.map((item) => analyzeSameDayCandidateRejection_(item.row, {
    config,
    targetDate,
    batchId,
    suppression,
    sentEmails
  }));
  const duplicateFlags = markSameDayDuplicateFlags_(rowDetails);
  rowDetails.forEach((detail) => {
    applySameDayCandidateDetailToSummary_(result, detail, duplicateFlags);
  });

  let validation = { readyRows: [], errors: [] };
  try {
    validation = validateOutboxRows_(rows, config);
  } catch (error) {
    validation = { readyRows: [], errors: [{ reason: 'sheet_or_outbox_load_failed' }] };
  }
  result.eligibleCount = validation.readyRows.length;
  result.selectedCount = validation.readyRows.length === gmailDailyExpectedCount_() ? gmailDailyExpectedCount_() : 0;
  result.readyForMetadataRepair = result.sourceCandidateCount === gmailDailyExpectedCount_() &&
    result.invalidEmailCount === 0 &&
    result.missingSubjectCount === 0 &&
    result.missingBodyCount === 0 &&
    result.optOutMissingCount === 0 &&
    result.unsubscribeCount === 0 &&
    result.doNotContactCount === 0 &&
    result.alreadySentCount === 0 &&
    result.repliedCount === 0 &&
    result.suppressionCount === 0 &&
    result.duplicateEmailCount === 0 &&
    result.duplicateDomainCount === 0 &&
    result.duplicateBusinessCount === 0 &&
    result.duplicateDedupeKeyCount === 0 &&
    result.candidatesRepairableByMetadataOnly === gmailDailyExpectedCount_() &&
    insideGmailSameDayEmergencyWindow_(config, targetDate, settings.endHhmm);
  result.gmailSendExecuted = false;
  result.googleSheetsUpdated = false;
  result.scriptPropertiesUpdated = false;
  appendSafeLog_(result);
  return result;
}

function buildEmptySameDayCandidateRejectionSummary_(targetDate, config) {
  return {
    event: 'gmail_same_day_candidate_rejections',
    mode: 'read_only',
    targetDate,
    sourceSheetNameHash: hashValue_(config.sheetName || ''),
    sourceCandidateCount: 0,
    eligibleCount: 0,
    selectedCount: 0,
    statusCounts: {},
    sendDateCounts: {},
    verificationDateCounts: {},
    missingEmailCount: 0,
    invalidEmailCount: 0,
    missingSubjectCount: 0,
    missingBodyCount: 0,
    optOutMissingCount: 0,
    unsubscribeCount: 0,
    doNotContactCount: 0,
    alreadySentCount: 0,
    repliedCount: 0,
    suppressionCount: 0,
    duplicateEmailCount: 0,
    duplicateDomainCount: 0,
    duplicateBusinessCount: 0,
    duplicateDedupeKeyCount: 0,
    staleVerificationCount: 0,
    wrongTargetDateCount: 0,
    wrongStatusCount: 0,
    rejectionReasonCounts: {},
    candidatesPassingContentValidation: 0,
    candidatesPassingHistoryValidation: 0,
    candidatesPassingSuppressionValidation: 0,
    candidatesPassingDedupeValidation: 0,
    candidatesRepairableByMetadataOnly: 0,
    readyForMetadataRepair: false
  };
}

function analyzeSameDayCandidateRejection_(row, context) {
  const targetDate = context.targetDate;
  const batchId = context.batchId;
  const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
  const subject = normalizeEmailSubject_(row.subject || row['件名']);
  const body = normalizeEmailBody_(row.body || row['本文']);
  const status = String(row.status || '').trim().toLowerCase();
  const sendDate = normalizeDateText_(row.sendDate || row['送信日']);
  const rowBatchId = String(row.sendBatchId || '').trim();
  const verificationDate = normalizeDateText_(row.verifiedAt || row.lastCheckedAt || '');
  const replyText = String(row.replyStatus || row['返信ステータス'] || '').trim().toLowerCase();
  const unsubscribeText = String(row.unsubscribe || row['配信停止'] || '').trim().toLowerCase();
  const doNotContactText = String(row.doNotContact || row['送信禁止'] || '').trim().toLowerCase();
  const reasons = [];
  const message = { subject, body };
  let messageSafe = false;
  let personalizationSafe = false;

  if (!email) reasons.push('missing_email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push('invalid_email');
  if (!subject) reasons.push('missing_subject');
  if (!body) reasons.push('missing_body');
  try {
    assertMessageSafe_(message);
    messageSafe = true;
  } catch (error) {
    if (safeErrorCode_(error) === 'send_error' && String(error.message || '') === 'missing_opt_out_text') {
      reasons.push('opt_out_missing');
    } else {
      reasons.push(String(error.message || 'message_invalid'));
    }
  }
  try {
    assertRecipientPersonalizationSafe_(row, message);
    personalizationSafe = true;
  } catch (error) {
    reasons.push(String(error.message || 'personalization_invalid'));
  }
  if (status !== 'ready') reasons.push('wrong_status');
  if (sendDate !== targetDate) reasons.push('wrong_target_date');
  if (rowBatchId !== batchId) reasons.push('send_batch_id_mismatch');
  if (verificationDate !== targetDate) reasons.push('stale_verification');
  if (includesAny_(unsubscribeText, ['true', '1', 'yes', '配信停止', 'unsubscribe'])) reasons.push('unsubscribe');
  if (includesAny_(doNotContactText, ['true', '1', 'yes', '送信禁止', 'do_not_contact'])) reasons.push('do_not_contact');
  if (includesAny_(replyText, ['返信あり', 'replied', 'interested', 'not_interested', 'unsubscribe'])) reasons.push('replied');
  if (hasSheetSentHistory_(row) || (email && context.sentEmails[email])) reasons.push('already_sent');
  if (isSuppressedByLedger_(row, context.suppression)) reasons.push('suppression');
  return {
    row,
    email,
    domain: sourceDomainFromRow_(row),
    business: businessFingerprintFromRow_(row),
    dedupeKey: String(row.dedupeKey || '').trim().toLowerCase(),
    status: status || '(blank)',
    sendDate: sendDate || '(blank)',
    verificationDate: verificationDate || '(blank)',
    messageSafe,
    personalizationSafe,
    reasons: uniqueArray_(reasons)
  };
}

function markSameDayDuplicateFlags_(details) {
  const keys = {
    email: {},
    domain: {},
    business: {},
    dedupeKey: {}
  };
  details.forEach((detail) => {
    ['email', 'domain', 'business', 'dedupeKey'].forEach((key) => {
      const value = detail[key];
      if (!value) return;
      keys[key][value] = (keys[key][value] || 0) + 1;
    });
  });
  return {
    email: keys.email,
    domain: keys.domain,
    business: keys.business,
    dedupeKey: keys.dedupeKey
  };
}

function applySameDayCandidateDetailToSummary_(summary, detail, duplicateFlags) {
  incrementCount_(summary.statusCounts, detail.status);
  incrementCount_(summary.sendDateCounts, detail.sendDate);
  incrementCount_(summary.verificationDateCounts, detail.verificationDate);
  const reasons = detail.reasons.slice();
  if (detail.email && duplicateFlags.email[detail.email] > 1) reasons.push('duplicate_email');
  if (detail.domain && duplicateFlags.domain[detail.domain] > 1) reasons.push('duplicate_domain');
  if (detail.business && duplicateFlags.business[detail.business] > 1) reasons.push('duplicate_business');
  if (detail.dedupeKey && duplicateFlags.dedupeKey[detail.dedupeKey] > 1) reasons.push('duplicate_dedupe_key');
  const uniqueReasons = uniqueArray_(reasons);
  uniqueReasons.forEach((reason) => incrementCount_(summary.rejectionReasonCounts, reason));
  if (uniqueReasons.indexOf('missing_email') !== -1) summary.missingEmailCount += 1;
  if (uniqueReasons.indexOf('invalid_email') !== -1) summary.invalidEmailCount += 1;
  if (uniqueReasons.indexOf('missing_subject') !== -1) summary.missingSubjectCount += 1;
  if (uniqueReasons.indexOf('missing_body') !== -1) summary.missingBodyCount += 1;
  if (uniqueReasons.indexOf('opt_out_missing') !== -1) summary.optOutMissingCount += 1;
  if (uniqueReasons.indexOf('unsubscribe') !== -1) summary.unsubscribeCount += 1;
  if (uniqueReasons.indexOf('do_not_contact') !== -1) summary.doNotContactCount += 1;
  if (uniqueReasons.indexOf('already_sent') !== -1) summary.alreadySentCount += 1;
  if (uniqueReasons.indexOf('replied') !== -1) summary.repliedCount += 1;
  if (uniqueReasons.indexOf('suppression') !== -1) summary.suppressionCount += 1;
  if (uniqueReasons.indexOf('duplicate_email') !== -1) summary.duplicateEmailCount += 1;
  if (uniqueReasons.indexOf('duplicate_domain') !== -1) summary.duplicateDomainCount += 1;
  if (uniqueReasons.indexOf('duplicate_business') !== -1) summary.duplicateBusinessCount += 1;
  if (uniqueReasons.indexOf('duplicate_dedupe_key') !== -1) summary.duplicateDedupeKeyCount += 1;
  if (uniqueReasons.indexOf('stale_verification') !== -1) summary.staleVerificationCount += 1;
  if (uniqueReasons.indexOf('wrong_target_date') !== -1) summary.wrongTargetDateCount += 1;
  if (uniqueReasons.indexOf('wrong_status') !== -1) summary.wrongStatusCount += 1;
  const contentOk = detail.email &&
    uniqueReasons.indexOf('invalid_email') === -1 &&
    uniqueReasons.indexOf('missing_subject') === -1 &&
    uniqueReasons.indexOf('missing_body') === -1 &&
    uniqueReasons.indexOf('opt_out_missing') === -1 &&
    detail.messageSafe &&
    detail.personalizationSafe;
  const historyOk = uniqueReasons.indexOf('already_sent') === -1 &&
    uniqueReasons.indexOf('replied') === -1 &&
    uniqueReasons.indexOf('unsubscribe') === -1 &&
    uniqueReasons.indexOf('do_not_contact') === -1;
  const suppressionOk = uniqueReasons.indexOf('suppression') === -1;
  const dedupeOk = uniqueReasons.indexOf('duplicate_email') === -1 &&
    uniqueReasons.indexOf('duplicate_domain') === -1 &&
    uniqueReasons.indexOf('duplicate_business') === -1 &&
    uniqueReasons.indexOf('duplicate_dedupe_key') === -1;
  if (contentOk) summary.candidatesPassingContentValidation += 1;
  if (historyOk) summary.candidatesPassingHistoryValidation += 1;
  if (suppressionOk) summary.candidatesPassingSuppressionValidation += 1;
  if (dedupeOk) summary.candidatesPassingDedupeValidation += 1;
  if (contentOk && historyOk && suppressionOk && dedupeOk) {
    summary.candidatesRepairableByMetadataOnly += 1;
  }
}

function incrementCount_(target, key) {
  const normalized = String(key || '(blank)');
  target[normalized] = (target[normalized] || 0) + 1;
}

function repairGmailSalesSameDayCandidateMetadataOnce_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const config = getConfig_();
  const inspection = inspectGmailSalesSameDayCandidateRejections_(settings);
  if (!inspection.readyForMetadataRepair) {
    return {
      event: 'gmail_same_day_metadata_repair_blocked',
      status: 'blocked',
      blockedReason: 'not_ready_for_metadata_repair',
      targetDate,
      sourceCandidateCount: inspection.sourceCandidateCount,
      candidatesRepairableByMetadataOnly: inspection.candidatesRepairableByMetadataOnly,
      readyForMetadataRepair: false,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    };
  }
  if (!insideGmailSameDayEmergencyWindow_(config, targetDate, settings.endHhmm)) {
    return buildSameDayMetadataRepairBlockedResult_(targetDate, 'same_day_emergency_window_closed');
  }
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheet = spreadsheet.getSheetByName(config.sheetName);
  if (!sheet || sheet.getLastRow() !== gmailDailyExpectedCount_() + 1) {
    return buildSameDayMetadataRepairBlockedResult_(targetDate, 'source_sheet_row_count_not_30');
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((value) => String(value));
  const index = buildHeaderIndex_(headers);
  const required = ['status', 'sendDate', 'sendBatchId'];
  const missing = required.filter((key) => index[key] === undefined);
  if (missing.length > 0 || (index.lastCheckedAt === undefined && index.verifiedAt === undefined)) {
    return buildSameDayMetadataRepairBlockedResult_(targetDate, 'metadata_columns_missing');
  }
  const backupName = '_gmail_same_day_metadata_backup_20260624_' + new Date().getTime();
  const backupSheet = spreadsheet.insertSheet(backupName);
  backupSheet.getRange(1, 1, values.length, headers.length).setValues(values);
  const repairedValues = values.map((row, rowIndex) => {
    const next = row.slice();
    if (rowIndex === 0) return next;
    next[index.status] = 'ready';
    next[index.sendDate] = targetDate;
    next[index.sendBatchId] = buildSendBatchId_(targetDate);
    if (index.lastCheckedAt !== undefined) next[index.lastCheckedAt] = targetDate;
    if (index.verifiedAt !== undefined) next[index.verifiedAt] = targetDate;
    return next;
  });
  try {
    sheet.getRange(1, 1, repairedValues.length, headers.length).setValues(repairedValues);
    SpreadsheetApp.flush();
    const readBackRows = loadCandidateRows_(config);
    const readBackValidation = validateOutboxRows_(readBackRows, config);
    if (readBackValidation.readyRows.length !== gmailDailyExpectedCount_() || readBackValidation.errors.length > 0) {
      sheet.clearContents();
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      SpreadsheetApp.flush();
      return buildSameDayMetadataRepairBlockedResult_(targetDate, 'repair_read_back_failed');
    }
    const result = {
      event: 'gmail_same_day_metadata_repair_completed',
      status: 'pass',
      targetDate,
      sourceCandidateCount: inspection.sourceCandidateCount,
      repairedCount: gmailDailyExpectedCount_(),
      backupSheetNameHash: hashValue_(backupName),
      readBackEligibleCount: readBackValidation.readyRows.length,
      gmailSendExecuted: false,
      googleSheetsUpdated: true,
      scriptPropertiesUpdated: false
    };
    appendSafeLog_(result);
    return result;
  } catch (error) {
    try {
      sheet.clearContents();
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      return buildSameDayMetadataRepairBlockedResult_(targetDate, 'repair_rollback_failed');
    }
    return buildSameDayMetadataRepairBlockedResult_(targetDate, safeErrorCode_(error));
  }
}

function buildSameDayMetadataRepairBlockedResult_(targetDate, blockedReason) {
  const result = {
    event: 'gmail_same_day_metadata_repair_blocked',
    status: 'blocked',
    blockedReason,
    targetDate,
    repairedCount: 0,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
  appendSafeLog_(result);
  return result;
}

function activateAndRunGmailSalesSameDayEmergencyOnce_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const source = settings.source || 'same_day_emergency';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return {
      event: 'gmail_same_day_emergency_send_blocked',
      mode: source,
      status: 'blocked',
      blockedReason: 'lock_unavailable',
      targetDate,
      sentCount: 0,
      gmailSendExecuted: false
    };
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const validation = validateGmailSalesSameDayEmergencySend_(settings);
    if (!validation.ok) {
      const blocked = {
        event: 'gmail_same_day_emergency_send_blocked',
        mode: source,
        status: 'blocked',
        blockedReason: validation.blockedReason,
        targetDate: validation.targetDate,
        state: validation.state,
        sentCount: 0,
        failedCount: 0,
        automationMasterEnabled: props.getProperty('AUTOMATION_MASTER_ENABLED') === 'true',
        autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
        liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        oneWeekCatchUpSendCount: 0,
        pastDateSendCount: 0
      };
      appendSafeLog_(blocked);
      return blocked;
    }

    const preSend = executeApprovedGmailSalesPreSendDryRun_({ source });
    const expectedCount = gmailDailyExpectedCount_();
    if (preSend.status !== 'pass' ||
      Number(preSend.candidateCount || 0) !== expectedCount ||
      Number(preSend.eligibleCount || 0) !== expectedCount ||
      Number(preSend.wouldAttemptCount || 0) !== expectedCount ||
      Number(preSend.maxSendCount || 0) < expectedCount) {
      const blocked = Object.assign({}, preSend, {
        event: 'gmail_same_day_emergency_send_blocked',
        mode: source,
        status: 'blocked',
        blockedReason: 'pre_send_not_exactly_30',
        sentCount: 0,
        automationMasterEnabled: false,
        autoSendEnabled: false,
        liveSendEnabled: false,
        oneWeekCatchUpSendCount: 0,
        pastDateSendCount: 0
      });
      appendSafeLog_(blocked);
      return blocked;
    }

    writeGmailDailyAutomationState_(Object.assign({}, readGmailDailyAutomationState_(), {
      targetDate,
      sendBatchId: buildSendBatchId_(targetDate),
      state: 'pre_send_passed',
      preSendPassedAt: new Date().toISOString(),
      actualCandidateCount: expectedCount,
      expectedCandidateCount: expectedCount,
      updatedAt: new Date().toISOString()
    }));
    props.setProperty('LIVE_SEND_ENABLED', 'true');

    const sendResult = executeApprovedGmailSalesBatch_({
      source,
      requireAutoSend: false,
      dryRun: false,
      skipLock: true,
      skipDailySendWindow: true
    });
    const success = sendResult.status === 'pass' &&
      Number(sendResult.sentCount || 0) === expectedCount &&
      Number(sendResult.failedCount || 0) === 0;

    writeGmailDailyAutomationState_(Object.assign({}, readGmailDailyAutomationState_(), {
      targetDate,
      sendBatchId: buildSendBatchId_(targetDate),
      state: success ? 'sent' : 'failed',
      sentAt: success ? new Date().toISOString() : '',
      actualSendCount: Number(sendResult.sentCount || 0),
      failedSendCount: Number(sendResult.failedCount || 0),
      blockedReasons: sendResult.blockedReasons || [],
      resultUnknown: false,
      updatedAt: new Date().toISOString()
    }));
    props.setProperties({
      AUTOMATION_MASTER_ENABLED: success ? 'true' : 'false',
      AUTO_SEND_ENABLED: success ? 'true' : 'false',
      LIVE_SEND_ENABLED: success ? 'true' : 'false'
    }, false);

    return Object.assign({}, sendResult, {
      event: 'gmail_same_day_emergency_send_finished',
      mode: source,
      status: success ? 'pass' : 'blocked',
      targetDate,
      sentCount: Number(sendResult.sentCount || 0),
      failedCount: Number(sendResult.failedCount || 0),
      automationMasterEnabled: success,
      autoSendEnabled: success,
      liveSendEnabled: success,
      oneWeekCatchUpSendCount: 0,
      pastDateSendCount: 0,
      batchRerunnable: false
    });
  } catch (error) {
    const props = PropertiesService.getScriptProperties();
    props.setProperties({
      AUTOMATION_MASTER_ENABLED: 'false',
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false'
    }, false);
    writeGmailDailyAutomationState_(Object.assign({}, readGmailDailyAutomationState_(), {
      targetDate,
      state: 'result_unknown',
      resultUnknown: true,
      errorCode: safeErrorCode_(error),
      updatedAt: new Date().toISOString()
    }));
    return {
      event: 'gmail_same_day_emergency_send_result_unknown',
      mode: source,
      status: 'blocked',
      blockedReason: 'result_unknown',
      targetDate,
      sentCount: 0,
      failedCount: 0,
      automationMasterEnabled: false,
      autoSendEnabled: false,
      liveSendEnabled: false,
      gmailSendExecuted: false,
      googleSheetsUpdated: false
    };
  } finally {
    lock.releaseLock();
  }
}

function validateGmailSalesSameDayEmergencySend_(options) {
  const settings = options || {};
  const targetDate = String(settings.targetDate || '').trim();
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const state = readGmailDailyAutomationState_();
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const versionStatus = gmailDailyVersionStatus_();
  let manifest = null;
  try {
    manifest = loadApprovedSendManifest_(config);
  } catch (error) {
    manifest = null;
  }
  const blocked = [];
  if (targetDate !== GMAIL_SAME_DAY_EMERGENCY_TARGET_DATE_20260624) blocked.push('target_date_not_allowed');
  if (config.currentJstDate !== targetDate) blocked.push('same_day_date_mismatch');
  if (config.sendDate !== targetDate) blocked.push('send_date_mismatch');
  if (!insideGmailSameDayEmergencyWindow_(config, targetDate, settings.endHhmm)) blocked.push('same_day_emergency_window_closed');
  if (state.state === 'sent') blocked.push('already_sent');
  if (!isGmailDailyPreparedState_(state)) blocked.push('state_not_ready');
  if (state.targetDate !== targetDate) blocked.push('state_target_date_mismatch');
  if (Number(state.actualCandidateCount || state.expectedCandidateCount || 0) !== gmailDailyExpectedCount_()) blocked.push('candidate_count_not_30');
  if (Number(state.sendAttemptCount || 0) !== 0) blocked.push('send_attempt_exists');
  if (Number(state.actualSendCount || 0) !== 0) blocked.push('actual_send_exists');
  if (state.resultUnknown === true) blocked.push('result_unknown');
  if (!manifest) blocked.push('manifest_missing');
  if (manifest && String(manifest.targetDate || '') !== targetDate) blocked.push('manifest_target_date_mismatch');
  if (manifest && String(manifest.batchId || '') !== buildSendBatchId_(targetDate)) blocked.push('manifest_batch_mismatch');
  if (manifest && Number(manifest.candidateCount || 0) !== gmailDailyExpectedCount_()) blocked.push('manifest_candidate_count_not_30');
  if (manifest && Number(manifest.maxSendCount || 0) !== gmailDailyExpectedCount_()) blocked.push('manifest_max_send_count_not_30');
  if (manifest && manifest.approvalType !== 'automatic_strict_gate') blocked.push('manifest_approval_type_invalid');
  if (manifest && manifest.targetAutoApproved !== true) blocked.push('manifest_target_auto_approved_missing');
  if (manifest && manifest.humanReviewCompleted !== false) blocked.push('manifest_human_review_must_be_false');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 0) blocked.push('manifest_human_review_count_must_be_zero');
  if (triggerHealth.status !== 'pass') blocked.push('trigger_health_blocked');
  if (triggerHealth.normalTriggerCount !== 1) blocked.push('normal_trigger_count_not_1');
  if (triggerHealth.duplicateTriggerCount !== 0) blocked.push('duplicate_trigger_present');
  if (triggerHealth.forbiddenTriggerCount !== 0) blocked.push('forbidden_trigger_present');
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (props.getProperty('AUTOMATION_MASTER_ENABLED') !== 'true') blocked.push('automation_master_not_enabled');
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false') blocked.push('auto_send_not_disabled_before_emergency');
  if (props.getProperty('LIVE_SEND_ENABLED') !== 'false') blocked.push('live_send_not_at_rest_before_emergency');
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    targetDate: config.sendDate,
    state: state.state || 'not_started'
  };
}

function insideGmailSameDayEmergencyWindow_(config, targetDate, endHhmm) {
  if (config.currentJstDate !== targetDate) return false;
  const timezone = Session.getScriptTimeZone() || GMAIL_SALES_TIMEZONE_DEFAULT;
  const hhmm = Utilities.formatDate(new Date(), timezone, 'HH:mm');
  return hhmm <= String(endHhmm || '20:00');
}

function validateGmailSalesDailyCatchUp_() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const state = readGmailDailyAutomationState_();
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const versionStatus = gmailDailyVersionStatus_();
  let manifest = null;
  try {
    manifest = loadApprovedSendManifest_(config);
  } catch (error) {
    manifest = null;
  }
  const blocked = [];
  if (config.currentJstDate !== GMAIL_DAILY_CATCH_UP_TARGET_DATE) blocked.push('catch_up_not_applicable_today');
  if (config.sendDate !== GMAIL_DAILY_CATCH_UP_TARGET_DATE) blocked.push('target_date_not_catch_up_date');
  if (!insideGmailDailyCatchUpWindow_(config)) blocked.push('catch_up_window_closed');
  if (state.state === 'sent') blocked.push('already_sent');
  if (!isGmailDailyPreparedState_(state)) blocked.push('state_not_ready');
  if (state.targetDate !== GMAIL_DAILY_CATCH_UP_TARGET_DATE) blocked.push('state_target_date_mismatch');
  if (Number(state.actualCandidateCount || state.expectedCandidateCount || 0) !== gmailDailyExpectedCount_()) blocked.push('candidate_count_not_30');
  if (Number(state.sendAttemptCount || 0) !== 0) blocked.push('send_attempt_exists');
  if (Number(state.actualSendCount || 0) !== 0) blocked.push('actual_send_exists');
  if (state.resultUnknown === true) blocked.push('result_unknown');
  if (!manifest) blocked.push('manifest_missing');
  if (manifest && manifest.approvalType !== 'automatic_strict_gate') blocked.push('manifest_approval_type_invalid');
  if (manifest && manifest.targetAutoApproved !== true) blocked.push('manifest_target_auto_approved_missing');
  if (manifest && manifest.humanReviewCompleted !== false) blocked.push('manifest_human_review_must_be_false');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 0) blocked.push('manifest_human_review_count_must_be_zero');
  if (triggerHealth.status !== 'pass') blocked.push('trigger_health_blocked');
  if (triggerHealth.normalTriggerCount !== 1) blocked.push('normal_trigger_count_not_1');
  if (triggerHealth.duplicateTriggerCount !== 0) blocked.push('duplicate_trigger_present');
  if (triggerHealth.forbiddenTriggerCount !== 0) blocked.push('forbidden_trigger_present');
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (props.getProperty('AUTOMATION_MASTER_ENABLED') !== 'false') blocked.push('automation_master_not_disabled');
  if (props.getProperty('AUTO_SEND_ENABLED') !== 'false') blocked.push('auto_send_not_disabled');
  if (props.getProperty('LIVE_SEND_ENABLED') !== 'false') blocked.push('live_send_not_at_rest');
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    targetDate: config.sendDate,
    state: state.state || 'not_started'
  };
}

function validateGmailSalesDailyFutureArm_() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const state = readGmailDailyAutomationState_();
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const versionStatus = gmailDailyVersionStatus_();
  const sourceStatus = readNormalDailySourceTabStatus_();
  const blocked = [];
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (!String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim()) blocked.push('shared_secret_missing');
  if (!isAfterGmailDailySendWindow_(config)) blocked.push('send_window_not_finished');
  if (props.getProperty('LIVE_SEND_ENABLED') !== 'false') blocked.push('live_send_not_at_rest');
  if (Number(state.sendAttemptCount || 0) !== 0) blocked.push('send_attempt_exists');
  if (state.resultUnknown === true) blocked.push('result_unknown');
  if (triggerHealth.status !== 'pass') blocked.push('trigger_health_blocked');
  if (triggerHealth.normalTriggerCount !== 1) blocked.push('normal_trigger_count_not_1');
  if (triggerHealth.duplicateTriggerCount !== 0) blocked.push('duplicate_trigger_present');
  if (triggerHealth.forbiddenTriggerCount !== 0) blocked.push('forbidden_trigger_present');
  if (!sourceStatus.configured) blocked.push('source_tab_not_configured');
  if (!sourceStatus.exists) blocked.push('source_tab_missing');
  if (sourceStatus.rowCount < GMAIL_DAILY_SOURCE_RECOMMENDED_SYNC_COUNT) blocked.push('source_rows_below_recommended');
  if (!sourceStatus.readBackPass) blocked.push('source_readback_failed');
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    armedForDate: addDaysToDateText_(config.currentJstDate, 1),
    sourceRowsReadBack: sourceStatus.rowCount
  };
}

function readNormalDailySourceTabStatus_() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const sourceName = String(props.getProperty('GMAIL_DAILY_SOURCE_TAB_NAME') || '').trim();
  if (!sourceName || !config.sheetId) {
    return { configured: Boolean(sourceName), exists: false, rowCount: 0, readBackPass: false };
  }
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheet = spreadsheet.getSheetByName(sourceName);
  if (!sheet || !looksLikeCandidateSheet_(sheet)) {
    return { configured: true, exists: Boolean(sheet), rowCount: 0, readBackPass: false };
  }
  const rowCount = Math.max(0, Number(sheet.getLastRow ? sheet.getLastRow() : 0) - 1);
  return { configured: true, exists: true, rowCount, readBackPass: rowCount > 0 };
}

function isAfterGmailDailySendWindow_(config) {
  const timezone = Session.getScriptTimeZone() || GMAIL_SALES_TIMEZONE_DEFAULT;
  const nowMinutes = timeTextToMinutes_(Utilities.formatDate(new Date(), timezone, 'HH:mm'));
  const endMinutes = Number(config.allowedSendEndHour || 0) * 60 + Number(config.allowedSendEndMinute || 0);
  return nowMinutes > endMinutes;
}

function timeTextToMinutes_(value) {
  const parsed = parseTimeText_(value);
  return parsed ? parsed.hour * 60 + parsed.minute : -1;
}

function addDaysToDateText_(dateText, days) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function insideGmailDailyCatchUpWindow_(config) {
  if (config.currentJstDate !== GMAIL_DAILY_CATCH_UP_TARGET_DATE) return false;
  const timezone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const hhmm = Utilities.formatDate(new Date(), timezone, 'HH:mm');
  return hhmm <= GMAIL_DAILY_CATCH_UP_END_HHMM;
}

function validateGmailSalesDailyActivation_() {
  const props = PropertiesService.getScriptProperties();
  const config = getConfig_();
  const state = readGmailDailyAutomationState_();
  const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
  const versionStatus = gmailDailyVersionStatus_();
  const sendWindowStatus = getGmailSalesDailySendWindowConfig_(props);
  const triggerSchedule = getGmailSalesDailyTriggerSchedule_(props);
  let manifest = null;
  try {
    manifest = loadApprovedSendManifest_(config);
  } catch (error) {
    manifest = null;
  }
  const candidateCount = Number(state.actualCandidateCount || state.expectedCandidateCount || (manifest && manifest.candidateCount) || 0);
  const blocked = [];
  if (!versionStatus.ok) blocked.push.apply(blocked, versionStatus.blockedReasons);
  if (!String(props.getProperty(GMAIL_DAILY_AUTOMATION_SECRET_PROPERTY) || '').trim()) blocked.push('shared_secret_missing');
  if (!sendWindowStatus.configured) blocked.push(sendWindowStatus.blockedReason || 'send_window_not_configured');
  if (!triggerSchedule.configured) blocked.push(triggerSchedule.blockedReason || 'trigger_schedule_not_configured');
  if (triggerHealth.status !== 'pass') blocked.push('trigger_health_blocked');
  if (triggerHealth.normalTriggerCount !== 1) blocked.push('normal_trigger_count_not_1');
  if (triggerHealth.duplicateTriggerCount !== 0) blocked.push('duplicate_trigger_present');
  if (triggerHealth.forbiddenTriggerCount !== 0) blocked.push('forbidden_trigger_present');
  if (props.getProperty('LIVE_SEND_ENABLED') !== 'false') blocked.push('live_send_not_at_rest');
  if (!isGmailDailyPreparedState_(state)) blocked.push('state_not_ready');
  if (state.targetDate !== config.currentJstDate) blocked.push('target_date_not_today');
  if (candidateCount !== gmailDailyExpectedCount_()) blocked.push('candidate_count_not_30');
  if (!manifest || manifest.status === 'missing') blocked.push('manifest_missing');
  if (manifest && manifest.approvalType !== 'automatic_strict_gate') blocked.push('manifest_approval_type_invalid');
  if (manifest && manifest.targetAutoApproved !== true) blocked.push('manifest_target_auto_approved_missing');
  if (manifest && manifest.humanReviewCompleted !== false) blocked.push('manifest_human_review_must_be_false');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 0) blocked.push('manifest_human_review_count_must_be_zero');
  return {
    ok: blocked.length === 0,
    blockedReason: uniqueArray_(blocked).join(','),
    targetDate: state.targetDate || config.currentJstDate,
    state: state.state || 'not_started',
    candidateCount,
    triggerCount: triggerHealth.normalTriggerCount
  };
}

function removeGmailSalesDailyAutomationTriggers() {
  let removedCount = 0;
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (GMAIL_DAILY_TRIGGER_HANDLERS.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
      removedCount += 1;
    }
  });
  appendSafeLog_({ event: 'gmail_daily_trigger_removed', removedCount });
  return { status: 'pass', removedCount, triggerChanged: removedCount > 0 };
}

function repairGmailSalesDailyAutomationTriggers() {
  const health = verifyGmailSalesDailyAutomationTriggers();
  if (health.duplicateTriggerCount > 0 || health.forbiddenTriggerCount > 0) {
    return Object.assign({}, health, {
      status: 'blocked',
      blockedReason: 'manual_trigger_cleanup_required',
      triggerChanged: false
    });
  }
  return installGmailSalesDailyAutomationTriggers();
}

function verifyGmailSalesDailyAutomationTriggers() {
  const counts = {};
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    const handler = trigger.getHandlerFunction();
    counts[handler] = Number(counts[handler] || 0) + 1;
  });
  const normalTriggerCount = GMAIL_DAILY_TRIGGER_HANDLERS.reduce((sum, handler) => sum + Number(counts[handler] || 0), 0);
  const duplicateTriggerCount = GMAIL_DAILY_TRIGGER_HANDLERS.reduce((sum, handler) => sum + Math.max(0, Number(counts[handler] || 0) - 1), 0);
  const forbiddenTriggerCount = GMAIL_DAILY_FORBIDDEN_TRIGGER_HANDLERS.reduce((sum, handler) => sum + Number(counts[handler] || 0), 0);
  return {
    event: 'gmail_daily_trigger_verified',
    status: duplicateTriggerCount === 0 && forbiddenTriggerCount === 0 ? 'pass' : 'blocked',
    expectedHandlerCount: GMAIL_DAILY_TRIGGER_HANDLERS.length,
    normalTriggerCount,
    duplicateTriggerCount,
    forbiddenTriggerCount,
    triggerChanged: false
  };
}

function runPostSendCheck() {
  const config = getConfig_();
  const batchId = buildSendBatchId_(config.sendDate);
  const rows = loadCandidateRows_(config);
  let sentCount = 0;
  let failedCount = 0;
  let readyCount = 0;

  rows.forEach((item) => {
    const row = item.row;
    if (String(row.sendBatchId || '') !== batchId) {
      return;
    }
    const sentStatus = String(row.sentStatus || row.status || '').toLowerCase();
    if (includesAny_(sentStatus, ['送信済', 'sent'])) {
      sentCount += 1;
      return;
    }
    if (includesAny_(sentStatus, ['失敗', 'failed', 'error'])) {
      failedCount += 1;
      return;
    }
    if (String(row.status || '').toLowerCase() === 'ready') {
      readyCount += 1;
    }
  });

  appendAutomationStatusLog_({
    event: 'post_send_check',
    sendBatchId: batchId,
    sentCount,
    failedCount,
    readyCount,
    liveSendEnabled: config.liveSendEnabled,
    autoSendEnabled: config.autoSendEnabled
  });
}

function runFailureRecoveryCheck() {
  const result = runPreflight_(false);
  appendAutomationStatusLog_({
    event: 'failure_recovery_check',
    targetCount: result.targetCount,
    readyCount: result.readyCount,
    sendBatchId: result.batchId,
    blockedReason: result.blockedReason || 'none',
    action: result.readyCount === result.targetCount ? 'monitor_only' : 'needs_human_review'
  });
}

function runGmailSalesDailyPostSendAudit() {
  const config = getConfig_();
  const batchId = buildSendBatchId_(config.sendDate);
  const rows = loadCandidateRows_(config);
  let sentCount = 0;
  let deliveryUnknownCount = 0;
  let failedBeforeSendCount = 0;
  const seen = {};
  let duplicateCount = 0;
  rows.forEach((item) => {
    const row = item.row || {};
    if (String(row.sendBatchId || '') !== batchId) return;
    const emailHash = hashValue_(normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']));
    if (emailHash && seen[emailHash]) duplicateCount += 1;
    seen[emailHash] = true;
    const state = normalizeSendState_(row);
    if (state === GMAIL_SEND_STATE.sent || hasSheetSentHistory_(row)) sentCount += 1;
    if (state === GMAIL_SEND_STATE.deliveryUnknown) deliveryUnknownCount += 1;
    if (state === GMAIL_SEND_STATE.failedBeforeSend) failedBeforeSendCount += 1;
  });
  const overageCount = Math.max(0, sentCount - gmailDailyExpectedCount_());
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    AUTOMATION_MASTER_ENABLED: 'true',
    AUTO_SEND_ENABLED: 'false',
    LIVE_SEND_ENABLED: 'false'
  }, false);
  const state = readGmailDailyAutomationState_();
  writeGmailDailyAutomationState_(Object.assign({}, state, {
    actualSendCount: sentCount,
    failedSendCount: failedBeforeSendCount,
    resultUnknown: sentCount !== gmailDailyExpectedCount_() || duplicateCount > 0 || overageCount > 0 || deliveryUnknownCount > 0,
    state: sentCount === gmailDailyExpectedCount_() && duplicateCount === 0 && overageCount === 0 && deliveryUnknownCount === 0 ? 'audited' : 'needs_review',
    updatedAt: new Date().toISOString()
  }));
  const result = {
    event: 'gmail_daily_post_send_audit',
    status: sentCount === gmailDailyExpectedCount_() && duplicateCount === 0 && overageCount === 0 && deliveryUnknownCount === 0 ? 'pass' : 'blocked',
    targetDate: config.sendDate,
    sendBatchId: batchId,
    sentCount,
    sheetSentCount: sentCount,
    actualSendCount: sentCount,
    duplicateCount,
    overageCount,
    deliveryUnknownCount,
    failedBeforeSendCount,
    batchFinalized: sentCount === gmailDailyExpectedCount_(),
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: true
  };
  appendSafeLog_(result);
  return result;
}

function runGmailSalesWeeklyReportAndOptimization() {
  const config = getConfig_();
  const policy = getGmailSalesOperationalDayPolicy_(config.currentJstDate);
  if (!policy.isWeeklyReviewDay) {
    return buildProductionLoopResult_('noop', 'not_weekly_review_day', 'weekly_report', policy, 'weekly_report');
  }
  const week = getPreviousMondayToSaturdayWeek_(config.currentJstDate);
  const report = {
    version: 1,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    scheduledDays: 6,
    completedDays: 0,
    totalSelected: 0,
    totalSent: 0,
    dailyAverageSent: 0,
    replyCount: 0,
    replyRate: 0,
    positiveReplyCount: 0,
    positiveReplyRate: 0,
    negativeReplyCount: 0,
    unsubscribeCount: 0,
    unsubscribeRate: 0,
    bounceCount: 0,
    bounceRate: 0,
    deliveryUnknownCount: 0,
    duplicateCount: 0,
    overageCount: 0,
    failedBeforeSendCount: 0,
    meetingsOrConversionsCount: 0,
    conversionRate: 0,
    safetyWarnings: [],
    dataInsufficient: true,
    bootstrapReferenceDate: GMAIL_SALES_SPECIAL_RESTART_DATE
  };
  const plan = buildGmailSalesWeeklyOptimizationPlan_(report);
  const applied = applyGmailSalesWeeklyOptimizationPlan_(plan, report);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('GMAIL_SALES_LAST_WEEKLY_REPORT_JSON', JSON.stringify(report));
  const result = {
    event: 'gmail_weekly_report_and_optimization',
    status: 'pass',
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    totalSent: report.totalSent,
    dataInsufficient: report.dataInsufficient,
    appliedChanges: applied.appliedChanges,
    strategyVersion: applied.strategyVersion,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: true
  };
  appendSafeLog_(result);
  return result;
}

function buildGmailSalesWeeklyOptimizationPlan_(report) {
  return {
    version: 1,
    effectiveFrom: addDaysToDateText_(report.weekEnd, 2),
    generatedFromWeekStart: report.weekStart,
    generatedFromWeekEnd: report.weekEnd,
    segmentWeights: {},
    sourceTypeWeights: {},
    subjectVariantWeights: {},
    bodyVariantWeights: {},
    ctaVariantWeights: {},
    explorationRate: 0.2,
    changedDimensions: [],
    changeReasonCodes: report.dataInsufficient ? ['sample_insufficient'] : [],
    reportDigest: hashValue_(JSON.stringify(report)),
    rollbackVersion: 0
  };
}

function applyGmailSalesWeeklyOptimizationPlan_(plan, report) {
  const props = PropertiesService.getScriptProperties();
  const previous = props.getProperty('GMAIL_SALES_STRATEGY_CONFIG_JSON') || '';
  if (previous) props.setProperty('GMAIL_SALES_PREVIOUS_STRATEGY_CONFIG_JSON', previous);
  if (!report.dataInsufficient && report.duplicateCount === 0 && report.overageCount === 0 && report.unsubscribeRate <= 0.02 && report.bounceRate <= 0.05) {
    props.setProperty('GMAIL_SALES_STRATEGY_CONFIG_JSON', JSON.stringify(plan));
    return { appliedChanges: plan.changedDimensions.length, strategyVersion: plan.version };
  }
  return { appliedChanges: 0, strategyVersion: plan.version };
}

function getPreviousMondayToSaturdayWeek_(dateText) {
  const date = new Date(normalizeDateText_(dateText) + 'T00:00:00Z');
  const day = date.getUTCDay();
  const end = new Date(date.getTime() - Math.max(1, day) * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 5 * 24 * 60 * 60 * 1000);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10)
  };
}

function runDailyGmailSalesSend() {
  executeApprovedGmailSalesBatch_({ source: 'manual', requireAutoSend: false, dryRun: false });
}

function executeDailyGmailSalesSend_(options) {
  return executeApprovedGmailSalesBatch_(options);
}

function runGmailSalesPreSendDryRun() {
  return executeApprovedGmailSalesPreSendDryRun_({ source: 'dry_run' });
}

function runGmailSalesRecoveryPreSendDryRun() {
  return executeApprovedGmailSalesRecoveryPreSendDryRun_({ source: 'manual_recovery_dry_run' });
}

function runGmailSalesRecoverySendOnce() {
  return executeApprovedGmailSalesRecoverySendOnce_({ source: 'manual_recovery_send_once' });
}

function runGmailSalesRecoveryDigestDiagnostic() {
  const result = diagnoseGmailSalesRecoveryDigestRuntime_({ includeInternal: false });
  appendSafeLog_(result);
  return result;
}

function runGmailSalesRecoveryReissueManifestDigests() {
  const diagnostic = diagnoseGmailSalesRecoveryDigestRuntime_({ includeInternal: true });
  const result = Object.assign({}, diagnostic, {
    event: 'approved_gmail_sales_recovery_digest_reissue',
    mode: 'runtime_digest_reissue',
    propertyUpdated: false,
    alreadyReissued: false,
    candidateDigestChanged: false,
    manifestDigestChanged: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  });
  if (diagnostic.recommendedNextAction !== 'runtime_digest_reissue_safe') {
    result.status = 'blocked';
    result.blockedReason = diagnostic.recommendedNextAction || 'diagnostic_not_reissue_safe';
    appendSafeLog_(result);
    return result;
  }
  const props = PropertiesService.getScriptProperties();
  const manifest = diagnostic.manifestForInternalUse;
  const digest = diagnostic.runtimeCandidateDigestForInternalUse;
  delete result.manifestForInternalUse;
  delete result.runtimeCandidateDigestForInternalUse;
  if (!manifest) {
    result.status = 'blocked';
    result.blockedReason = 'manifest_not_loaded';
    appendSafeLog_(result);
    return result;
  }
  if (!digest) {
    result.status = 'blocked';
    result.blockedReason = 'runtime_digest_missing';
    appendSafeLog_(result);
    return result;
  }
  const previousDigest = Array.isArray(manifest.candidateDigests) ? String(manifest.candidateDigests[0] || '') : '';
  if (previousDigest === digest && manifest.runtimeDigestReissued === true) {
    result.status = 'pass';
    result.alreadyReissued = true;
    appendSafeLog_(result);
    return result;
  }
  manifest.candidateDigests = [digest];
  manifest.candidateDigestCanonicalization = GMAIL_RECOVERY_CANDIDATE_DIGEST_CANONICALIZATION;
  manifest.runtimeDigestReissued = true;
  manifest.runtimeDigestReissuedAt = new Date().toISOString();
  manifest.runtimeDigestVersion = GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION;
  props.setProperty('APPROVED_SEND_MANIFEST_JSON', JSON.stringify(manifest));
  result.status = 'pass';
  result.propertyUpdated = true;
  result.candidateDigestChanged = previousDigest !== digest;
  result.manifestDigestChanged = true;
  appendSafeLog_(result);
  return result;
}

function runGmailSalesRecoveryReissueSourceCandidateContentHash(options) {
  const settings = options || {};
  const diagnostic = diagnoseGmailSalesRecoveryDigestRuntime_({ includeInternal: true });
  const result = Object.assign({}, diagnostic, {
    event: 'approved_gmail_sales_recovery_source_candidate_content_hash_reissue',
    mode: 'source_candidate_content_hash_reissue',
    reissueFunctionName: 'runGmailSalesRecoveryReissueSourceCandidateContentHash',
    propertyWriteCount: 0,
    propertyUpdated: false,
    alreadyApplied: false,
    sourceCandidateContentHashChanged: false,
    manifestDigestChanged: false,
    candidateDigestVerified: false,
    readBackValidationPassed: false,
    postReissueSubstantiveMismatchCount: 0,
    postReissueDerivedMismatchCount: 0,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  });
  const manifest = diagnostic.manifestForInternalUse;
  const runtimeContentHash = diagnostic.runtimeCandidateContentHashForInternalUse;
  const runtimeDigest = diagnostic.runtimeCandidateDigestForInternalUse;
  delete result.manifestForInternalUse;
  delete result.runtimeCandidateDigestForInternalUse;
  delete result.runtimeCandidateContentHashForInternalUse;

  if (settings.source && String(settings.source).indexOf('scheduled') !== -1) {
    result.status = 'blocked';
    result.blockedReason = 'manual_execution_required';
    appendSafeLog_(result);
    return result;
  }
  if (diagnostic.manifestSourceCandidateContentHashMatch &&
    diagnostic.substantiveFieldMismatchCount === 0 &&
    diagnostic.derivedIntegrityFieldMismatchCount === 0 &&
    diagnostic.candidateDigestMatchAfterCanonicalization) {
    result.status = 'already_applied';
    result.alreadyApplied = true;
    appendSafeLog_(result);
    return result;
  }
  if (diagnostic.recommendedNextAction !== 'manifest_source_candidate_content_hash_reissue_safe') {
    result.status = 'blocked';
    result.blockedReason = diagnostic.recommendedNextAction || 'diagnostic_not_source_hash_reissue_safe';
    appendSafeLog_(result);
    return result;
  }
  if (!manifest || !runtimeContentHash || !runtimeDigest) {
    result.status = 'blocked';
    result.blockedReason = 'reissue_input_missing';
    appendSafeLog_(result);
    return result;
  }
  const storedDigest = String((manifest.candidateDigests || [])[0] || '').trim();
  if (runtimeDigest !== storedDigest) {
    result.status = 'blocked';
    result.blockedReason = 'candidate_digest_mismatch';
    appendSafeLog_(result);
    return result;
  }
  if (!manifest.sourceOutboxIdentity || typeof manifest.sourceOutboxIdentity !== 'object') {
    result.status = 'blocked';
    result.blockedReason = 'source_outbox_identity_missing';
    appendSafeLog_(result);
    return result;
  }

  const props = PropertiesService.getScriptProperties();
  const previousSourceHash = String(manifest.sourceOutboxIdentity.candidateContentHash || '').trim();
  manifest.sourceOutboxIdentity.candidateContentHash = runtimeContentHash;
  manifest.runtimeSourceCandidateHashReissued = true;
  manifest.runtimeSourceCandidateHashReissuedAt = new Date().toISOString();
  manifest.runtimeSourceCandidateHashVersion = GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION;
  props.setProperty('APPROVED_SEND_MANIFEST_JSON', JSON.stringify(manifest));
  result.propertyWriteCount = 1;
  result.propertyUpdated = true;
  result.sourceCandidateContentHashChanged = previousSourceHash !== runtimeContentHash;
  result.manifestDigestChanged = true;
  result.candidateDigestVerified = true;

  try {
    const readBackManifest = JSON.parse(props.getProperty('APPROVED_SEND_MANIFEST_JSON') || '');
    const readBackSourceHash = String(readBackManifest.sourceOutboxIdentity && readBackManifest.sourceOutboxIdentity.candidateContentHash || '').trim();
    const readBackDigest = String((readBackManifest.candidateDigests || [])[0] || '').trim();
    result.readBackValidationPassed = readBackSourceHash === runtimeContentHash &&
      readBackDigest === storedDigest &&
      readBackManifest.runtimeSourceCandidateHashReissued === true;
    if (!result.readBackValidationPassed) {
      result.status = 'blocked';
      result.blockedReason = 'source_hash_reissue_read_back_failed';
      appendSafeLog_(result);
      return result;
    }
    const postDiagnostic = diagnoseGmailSalesRecoveryDigestRuntime_({ includeInternal: false });
    result.postReissueSubstantiveMismatchCount = postDiagnostic.substantiveFieldMismatchCount;
    result.postReissueDerivedMismatchCount = postDiagnostic.derivedIntegrityFieldMismatchCount;
    if (postDiagnostic.substantiveFieldMismatchCount !== 0 || postDiagnostic.derivedIntegrityFieldMismatchCount !== 0) {
      result.status = 'blocked';
      result.blockedReason = 'post_reissue_integrity_mismatch';
      appendSafeLog_(result);
      return result;
    }
  } catch (error) {
    result.status = 'blocked';
    result.blockedReason = 'source_hash_reissue_read_back_failed';
    appendSafeLog_(result);
    return result;
  }

  result.status = 'pass';
  result.blockedReason = '';
  result.derivedIntegrityFieldMismatchCount = 0;
  result.derivedIntegrityDifferingFieldNames = [];
  result.manifestSourceCandidateContentHashMatch = true;
  appendSafeLog_(result);
  return result;
}

function runGmailSalesRecoveryRepairDerivedCandidateHash() {
  const diagnostic = diagnoseGmailSalesRecoveryDigestRuntime_({ includeInternal: true });
  const result = Object.assign({}, diagnostic, {
    event: 'approved_gmail_sales_recovery_derived_candidate_hash_repair',
    mode: 'derived_candidate_hash_repair',
    repairFunctionName: 'runGmailSalesRecoveryRepairDerivedCandidateHash',
    repairReadWriteScope: 'recovery_sheet_candidateContentHash_single_cell',
    sheetWriteCount: 0,
    updatedCellCount: 0,
    otherSheetCellChangeCount: 0,
    propertyUpdated: false,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false,
    readBackValidationPassed: false
  });
  delete result.manifestForInternalUse;
  delete result.runtimeCandidateDigestForInternalUse;
  delete result.runtimeCandidateContentHashForInternalUse;

  if (!diagnostic.sheetCandidateContentHashPresent) {
    result.status = 'not_applicable';
    result.blockedReason = 'sheet_candidate_content_hash_column_absent';
    appendSafeLog_(result);
    return result;
  }
  if (diagnostic.sheetCandidateContentHashPresent && diagnostic.derivedIntegrityFieldMismatchCount === 0) {
    result.status = 'already_applied';
    result.blockedReason = '';
    appendSafeLog_(result);
    return result;
  }
  if (diagnostic.recommendedNextAction !== 'sheet_derived_candidate_hash_repair_safe') {
    result.status = 'blocked';
    result.blockedReason = diagnostic.recommendedNextAction || 'diagnostic_not_repair_safe';
    appendSafeLog_(result);
    return result;
  }
  if (!diagnostic.runtimeCandidateContentHashForInternalUse) {
    result.status = 'blocked';
    result.blockedReason = 'runtime_candidate_content_hash_missing';
    appendSafeLog_(result);
    return result;
  }

  try {
    const baseConfig = getConfig_();
    const manifest = diagnostic.manifestForInternalUse;
    const config = buildRecoverySendConfig_(baseConfig, manifest);
    if (!baseConfig.recoverySheetName || config.sheetName !== baseConfig.recoverySheetName || config.sheetName === baseConfig.sheetName) {
      result.status = 'blocked';
      result.blockedReason = 'recovery_sheet_not_dedicated';
      appendSafeLog_(result);
      return result;
    }
    const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() !== 2) {
      result.status = 'blocked';
      result.blockedReason = 'recovery_sheet_row_count_not_1';
      appendSafeLog_(result);
      return result;
    }
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value || ''));
    const matchingColumns = [];
    headers.forEach((header, index) => {
      if (header === 'candidateContentHash') matchingColumns.push(index + 1);
    });
    if (matchingColumns.length !== 1) {
      result.status = 'blocked';
      result.blockedReason = matchingColumns.length === 0 ? 'candidate_content_hash_column_missing' : 'candidate_content_hash_duplicate_column';
      appendSafeLog_(result);
      return result;
    }

    const beforeRows = loadCandidateRows_(config);
    if (beforeRows.length !== 1) {
      result.status = 'blocked';
      result.blockedReason = 'recovery_sheet_row_count_not_1';
      appendSafeLog_(result);
      return result;
    }
    const beforeDigest = computeCandidateDigest_(beforeRows[0].row, config.sendDate, config.sendBatchId);
    if (beforeDigest !== String((manifest.candidateDigests || [])[0] || '').trim()) {
      result.status = 'blocked';
      result.blockedReason = 'candidate_digest_mismatch';
      appendSafeLog_(result);
      return result;
    }

    sheet.getRange(2, matchingColumns[0]).setValue(diagnostic.runtimeCandidateContentHashForInternalUse);
    result.sheetWriteCount = 1;
    result.updatedCellCount = 1;

    const readBackValue = String(sheet.getRange(2, matchingColumns[0]).getValues()[0][0] || '').trim();
    result.readBackValidationPassed = readBackValue === diagnostic.runtimeCandidateContentHashForInternalUse;
    const afterRows = loadCandidateRows_(config);
    const afterDigest = afterRows.length === 1
      ? computeCandidateDigest_(afterRows[0].row, config.sendDate, config.sendBatchId)
      : '';
    const afterDerived = afterRows.length === 1
      ? analyzeRecoveryDerivedCandidateHash_(afterRows[0].row, manifest)
      : { derivedIntegrityFieldMismatchCount: 1 };
    if (!result.readBackValidationPassed || afterRows.length !== 1 || afterDigest !== beforeDigest || afterDerived.derivedIntegrityFieldMismatchCount !== 0) {
      result.status = 'blocked';
      result.blockedReason = 'repair_read_back_validation_failed';
      appendSafeLog_(result);
      return result;
    }

    result.status = 'repaired';
    result.blockedReason = '';
    result.derivedIntegrityFieldMismatchCount = 0;
    result.derivedIntegrityDifferingFieldNames = [];
    result.manifestVsSheetFieldComparisonPassed = true;
    result.substantiveFieldMismatchCount = 0;
    result.sheetCandidateDigestMatch = true;
    result.candidateDigestMatchAfterCanonicalization = true;
    result.googleSheetsUpdated = true;
    appendSafeLog_(result);
    return result;
  } catch (error) {
    result.status = 'blocked';
    result.blockedReason = safeErrorCode_(error);
    appendSafeLog_(result);
    return result;
  }
}

function executeApprovedGmailSalesPreSendDryRun_(options) {
  const settings = options || {};
  try {
    const analysis = analyzeApprovedGmailSalesBatch_({
      dryRun: true,
      requireAutoSend: false
    });
    appendSafeLog_({
      event: 'approved_gmail_sales_pre_send_dry_run',
      source: settings.source || 'dry_run',
      status: analysis.status,
      blockedReason: analysis.blockedReasons.join(',') || '',
      targetDate: analysis.targetDate,
      candidateCount: analysis.candidateCount,
      eligibleCount: analysis.eligibleRows.length,
      wouldAttemptCount: analysis.wouldAttemptCount,
      maxSendCount: analysis.maxSendCount,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    });
    return toPreSendPublicResult_(analysis, 'dry_run');
  } catch (error) {
    appendSafeLog_({
      event: 'approved_gmail_sales_pre_send_dry_run',
      status: 'blocked',
      blockedReason: 'dry_run_analysis_failed',
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    });
    return buildPreSendDryRunResult_({
      mode: 'dry_run',
      status: 'blocked',
      blockedReasons: ['dry_run_analysis_failed']
    });
  }
}

function executeApprovedGmailSalesRecoveryPreSendDryRun_(options) {
  const settings = options || {};
  try {
    const analysis = analyzeApprovedGmailSalesRecoveryBatch_({ dryRun: true });
    const shaSelfTest = runRecoveryShaRuntimeSelfTest_();
    appendSafeLog_({
      event: 'approved_gmail_sales_recovery_pre_send_dry_run',
      source: settings.source || 'manual_recovery_dry_run',
      runtimeVersion: GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION,
      candidateDigestCanonicalization: GMAIL_RECOVERY_CANDIDATE_DIGEST_CANONICALIZATION,
      shaRuntimeSelfTestPassed: shaSelfTest.shaRuntimeSelfTestPassed,
      manifestInternalDigestMatch: analysis.candidateDigestMismatchCount === 0,
      sheetCandidateDigestMatch: analysis.candidateDigestMismatchCount === 0,
      substantiveFieldMismatchCount: analysis.substantiveFieldMismatchCount || 0,
      derivedIntegrityFieldMismatchCount: analysis.derivedIntegrityFieldMismatchCount || 0,
      derivedIntegrityDifferingFieldNames: analysis.derivedIntegrityDifferingFieldNames || [],
      candidateDigestInputFieldCount: 6,
      status: analysis.status,
      blockedReason: analysis.blockedReasons.join(',') || '',
      targetDate: analysis.targetDate,
      sourceType: analysis.sourceType,
      candidateCount: analysis.candidateCount,
      eligibleCount: analysis.eligibleRows.length,
      wouldAttemptCount: analysis.wouldAttemptCount,
      maxSendCount: analysis.maxSendCount,
      sameDayManualRecoveryApproved: analysis.sameDayManualRecoveryApproved,
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    });
    return toPreSendPublicResult_(analysis, 'recovery_dry_run');
  } catch (error) {
    appendSafeLog_({
      event: 'approved_gmail_sales_recovery_pre_send_dry_run',
      status: 'blocked',
      blockedReason: 'recovery_dry_run_analysis_failed',
      gmailSendExecuted: false,
      googleSheetsUpdated: false,
      scriptPropertiesUpdated: false
    });
    return buildPreSendDryRunResult_({
      mode: 'recovery_dry_run',
      status: 'blocked',
      blockedReasons: ['recovery_dry_run_analysis_failed']
    });
  }
}

function executeApprovedGmailSalesBatch_(options) {
  const settings = options || {};
  if (settings.dryRun === true) {
    return executeApprovedGmailSalesPreSendDryRun_({ source: settings.source || 'dry_run' });
  }
  const lock = LockService.getScriptLock();
  const ownsLock = settings.skipLock !== true;
  if (ownsLock && !lock.tryLock(30000)) {
    resetLiveSendAfterRun_(getConfig_(), { dryRun: false });
    const lockedResult = buildPreSendDryRunResult_({
      mode: 'send',
      status: 'blocked',
      blockedReasons: ['lock_unavailable']
    });
    appendSafeLog_({ event: 'approved_gmail_sales_send_blocked', blockedReason: 'lock_unavailable' });
    return lockedResult;
  }

  let configForReset = null;
  let maintenanceLease = null;
  try {
    const preliminaryConfig = getConfig_();
    configForReset = preliminaryConfig;
    if (!settings.dryRun && preliminaryConfig.dryRun) {
      const result = buildPreSendDryRunResult_({
        mode: 'send',
        status: 'blocked',
        blockedReasons: ['dry_run_enabled'],
        targetDate: preliminaryConfig.sendDate
      });
      appendSafeLog_({ event: 'approved_gmail_sales_send_blocked', blockedReason: 'dry_run_enabled' });
      return result;
    }
    if (!settings.dryRun && !preliminaryConfig.liveSendEnabled) {
      const result = buildPreSendDryRunResult_({
        mode: 'send',
        status: 'blocked',
        blockedReasons: ['live_send_disabled'],
        targetDate: preliminaryConfig.sendDate
      });
      appendSafeLog_({ event: 'approved_gmail_sales_send_blocked', blockedReason: 'live_send_disabled' });
      return result;
    }
    if (!settings.dryRun && settings.requireAutoSend === true && !preliminaryConfig.autoSendEnabled) {
      const result = buildPreSendDryRunResult_({
        mode: 'send',
        status: 'blocked',
        blockedReasons: ['auto_send_disabled'],
        targetDate: preliminaryConfig.sendDate
      });
      appendSafeLog_({ event: 'approved_gmail_sales_send_blocked', blockedReason: 'auto_send_disabled' });
      return result;
    }
    if (!settings.dryRun) {
      maintenanceLease = acquireSheetMaintenanceLease_(preliminaryConfig, {
        holderType: 'apps_script_send',
        holderId: buildSendRunId_(preliminaryConfig.sendDate),
        dryRun: false
      });
      if (!maintenanceLease.ok) {
        appendSafeLog_({
          event: 'approved_gmail_sales_send_blocked',
          blockedReason: maintenanceLease.blockedReason,
          gmailSendExecuted: false,
          googleSheetsUpdated: false,
          scriptPropertiesUpdated: false
        });
        return buildPreSendDryRunResult_({
          mode: 'send',
          status: 'blocked',
          blockedReasons: [maintenanceLease.blockedReason],
          targetDate: preliminaryConfig.sendDate
        });
      }
    }
    const analysis = analyzeApprovedGmailSalesBatch_({
      dryRun: false,
      requireAutoSend: settings.requireAutoSend === true,
      skipDailySendWindow: settings.skipDailySendWindow === true
    });
    configForReset = analysis.config;

    if (analysis.status !== 'pass') {
      appendSafeLog_({
        event: 'approved_gmail_sales_send_blocked',
        source: settings.source || 'unknown',
        status: analysis.status,
        blockedReason: analysis.blockedReasons.join(',') || '',
        targetDate: analysis.targetDate,
        candidateCount: analysis.candidateCount,
        eligibleCount: analysis.eligibleRows.length,
        wouldAttemptCount: analysis.wouldAttemptCount,
        maxSendCount: analysis.maxSendCount,
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false
      });
      return toPreSendPublicResult_(analysis, 'send');
    }

    const runId = buildSendRunId_(analysis.config.sendDate);
    const rows = analysis.eligibleRows.slice(0, analysis.wouldAttemptCount);
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const sendResult = sendApprovedGmailSalesRow_(analysis, rows[i], runId, 'approved_gmail_sales_send_executed');
      if (sendResult.ok) {
        processed += 1;
      } else {
        failed += 1;
        break;
      }
    }

    if (processed > 0 && failed === 0 && processed === rows.length) {
      markBatchSent_(analysis.batchId);
    }

    appendSafeLog_({
      event: 'approved_gmail_sales_send_finished',
      source: settings.source || 'unknown',
      sendBatchId: analysis.batchId,
      processed,
      failed,
      dryRun: analysis.config.dryRun,
      liveSendEnabled: analysis.config.liveSendEnabled,
      maxSendCount: analysis.maxSendCount
    });
    return {
      mode: 'send',
      status: failed === 0 ? 'pass' : 'blocked',
      blockedReasons: failed === 0 ? [] : ['send_stopped_for_manual_review'],
      targetDate: analysis.targetDate,
      sentCount: processed,
      failedCount: failed,
      gmailSendExecuted: processed > 0,
      googleSheetsUpdated: processed > 0 || failed > 0,
      scriptPropertiesUpdated: processed > 0 && failed === 0
    };
  } finally {
    if (maintenanceLease) {
      releaseSheetMaintenanceLease_(configForReset || getConfig_(), maintenanceLease);
    }
    if (configForReset && settings.dryRun !== true) {
      resetLiveSendAfterRun_(configForReset);
    }
    if (ownsLock) {
      lock.releaseLock();
    }
  }
}

function executeApprovedGmailSalesRecoverySendOnce_(options) {
  const settings = options || {};
  if (settings.source && String(settings.source).indexOf('scheduled') !== -1) {
    return buildPreSendDryRunResult_({
      mode: 'recovery_send',
      status: 'blocked',
      blockedReasons: ['recovery_manual_execution_required']
    });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    resetLiveSendAfterRun_(getConfig_(), { dryRun: false });
    appendSafeLog_({ event: 'approved_gmail_sales_recovery_send_blocked', blockedReason: 'lock_unavailable' });
    return buildPreSendDryRunResult_({
      mode: 'recovery_send',
      status: 'blocked',
      blockedReasons: ['lock_unavailable']
    });
  }

  let configForReset = null;
  try {
    const preliminaryConfig = getConfig_();
    configForReset = preliminaryConfig;
    if (!preliminaryConfig.liveSendEnabled) {
      appendSafeLog_({ event: 'approved_gmail_sales_recovery_send_blocked', blockedReason: 'live_send_disabled' });
      return buildPreSendDryRunResult_({
        mode: 'recovery_send',
        status: 'blocked',
        blockedReasons: ['live_send_disabled']
      });
    }
    if (preliminaryConfig.autoSendEnabled) {
      appendSafeLog_({ event: 'approved_gmail_sales_recovery_send_blocked', blockedReason: 'auto_send_must_be_disabled' });
      return buildPreSendDryRunResult_({
        mode: 'recovery_send',
        status: 'blocked',
        blockedReasons: ['auto_send_must_be_disabled']
      });
    }

    const analysis = analyzeApprovedGmailSalesRecoveryBatch_({ dryRun: false });
    configForReset = analysis.config;
    if (analysis.status !== 'pass') {
      appendSafeLog_({
        event: 'approved_gmail_sales_recovery_send_blocked',
        source: settings.source || 'manual_recovery_send_once',
        status: analysis.status,
        blockedReason: analysis.blockedReasons.join(',') || '',
        targetDate: analysis.targetDate,
        candidateCount: analysis.candidateCount,
        eligibleCount: analysis.eligibleRows.length,
        wouldAttemptCount: analysis.wouldAttemptCount,
        maxSendCount: analysis.maxSendCount,
        gmailSendExecuted: false,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false
      });
      return toPreSendPublicResult_(analysis, 'recovery_send');
    }

    const row = analysis.eligibleRows[0];
    const runId = buildSendRunId_(analysis.config.sendDate);
    const sendResult = sendApprovedGmailSalesRow_(analysis, row, runId, 'approved_gmail_sales_recovery_send_executed');
    if (sendResult.ok) {
      markBatchSent_(analysis.batchId);
    }
    appendSafeLog_({
      event: 'approved_gmail_sales_recovery_send_finished',
      source: settings.source || 'manual_recovery_send_once',
      sendBatchId: analysis.batchId,
      processed: sendResult.ok ? 1 : 0,
      failed: sendResult.ok ? 0 : 1,
      maxSendCount: analysis.maxSendCount
    });
    return {
      mode: 'recovery_send',
      status: sendResult.ok ? 'pass' : 'blocked',
      blockedReasons: sendResult.ok ? [] : ['recovery_send_stopped_for_manual_review'],
      targetDate: analysis.targetDate,
      sentCount: sendResult.ok ? 1 : 0,
      failedCount: sendResult.ok ? 0 : 1,
      gmailSendExecuted: sendResult.ok,
      googleSheetsUpdated: true,
      scriptPropertiesUpdated: sendResult.ok
    };
  } finally {
    if (configForReset) {
      resetLiveSendAfterRun_(configForReset);
    }
    lock.releaseLock();
  }
}

function sendApprovedGmailSalesRow_(analysis, item, runId, successEvent) {
  const row = item.row;
  const rowIndex = item.rowIndex;
  const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
  const digest = computeCandidateDigest_(row, analysis.config.sendDate, analysis.batchId);
  let mailAttempted = false;

  try {
    const preSend = validateSingleCandidatePreSend_(row, analysis);
    if (!preSend.ok) {
      updateSheetAfterSend_(analysis.config, rowIndex, {
        sendState: GMAIL_SEND_STATE.manualReviewRequired,
        sentStatus: GMAIL_SEND_STATE.manualReviewRequired,
        lastSendErrorCode: preSend.blockedReason,
        approvedBatchId: analysis.batchId,
        approvedCandidateDigest: digest,
        lastCheckedAt: new Date().toISOString()
      });
      return { ok: false, deliveryUnknown: false, blockedReason: preSend.blockedReason };
    }
    assertSafeToSend_(row);
    const message = buildInitialSalesEmail_(row);
    assertMessageSafe_(message);
    assertRecipientPersonalizationSafe_(row, message);
    reserveCandidateBeforeSend_(analysis.config, rowIndex, row, {
      runId,
      batchId: analysis.batchId,
      digest,
      attemptCount: Number(row.sendAttemptCount || 0) + 1
    });
    const reserved = reloadCandidateRow_(analysis.config, rowIndex);
    const reservationCheck = verifyReservationPersisted_(reserved.row, { runId, digest });
    if (!reservationCheck.ok) {
      return { ok: false, deliveryUnknown: false, blockedReason: reservationCheck.blockedReason };
    }
    mailAttempted = true;
    MailApp.sendEmail({
      to: email,
      subject: message.subject,
      body: message.body,
      name: analysis.config.fromName
    });
    updateSheetAfterSend_(analysis.config, rowIndex, {
      sendState: GMAIL_SEND_STATE.sent,
      status: 'sent',
      sentStatus: '送信済',
      sentAt: new Date().toISOString(),
      sentBy: 'Apps Script',
      lastSendErrorCode: '',
      lastCheckedAt: new Date().toISOString()
    });
    appendSafeLog_({
      event: successEvent || 'approved_gmail_sales_send_executed',
      rowIndex,
      recipientHash: hashValue_(email),
      subjectHash: hashValue_(message.subject)
    });
    return { ok: true, deliveryUnknown: false, blockedReason: '' };
  } catch (error) {
    updateSheetAfterSend_(analysis.config, rowIndex, {
      sendState: mailAttempted ? GMAIL_SEND_STATE.deliveryUnknown : GMAIL_SEND_STATE.failedBeforeSend,
      status: mailAttempted ? GMAIL_SEND_STATE.deliveryUnknown : GMAIL_SEND_STATE.failedBeforeSend,
      sentStatus: mailAttempted ? GMAIL_SEND_STATE.deliveryUnknown : GMAIL_SEND_STATE.failedBeforeSend,
      deliveryUncertainAt: mailAttempted ? new Date().toISOString() : '',
      lastSendErrorCode: safeErrorCode_(error),
      lastCheckedAt: new Date().toISOString()
    });
    appendSafeLog_({
      event: 'approved_gmail_sales_send_stopped',
      rowIndex,
      errorName: error.name || 'Error',
      reason: safeErrorCode_(error),
      deliveryUnknown: mailAttempted
    });
    return { ok: false, deliveryUnknown: mailAttempted, blockedReason: safeErrorCode_(error) };
  }
}

function analyzeApprovedGmailSalesBatch_(settings) {
  const blockedReasons = [];
  const production = validateProductionConfig_();
  const config = production.config;
  const batchId = buildSendBatchId_(config.sendDate);
  const dryRun = settings.dryRun === true;
  let rows = [];
  let validation = { readyRows: [], errors: [] };
  let manifestCheck = buildManifestValidationResult_(null, ['manifest_not_loaded'], [], config, batchId);
  let suppression = { loaded: false, entries: [] };

  blockedReasons.push.apply(blockedReasons, production.errors);

  try {
    rows = loadCandidateRows_(config);
    validation = validateOutboxRows_(rows, config);
  } catch (error) {
    blockedReasons.push('sheet_or_outbox_load_failed');
  }

  try {
    const manifest = loadApprovedSendManifest_(config);
    manifestCheck = validateApprovedSendManifest_(manifest, config, batchId, validation.readyRows);
  } catch (error) {
    manifestCheck = buildManifestValidationResult_(null, ['manifest_load_failed'], validation.readyRows, config, batchId);
  }

  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }

  if (validation.errors.length > 0) blockedReasons.push('outbox_validation_errors');
  if (!manifestCheck.ok) blockedReasons.push.apply(blockedReasons, manifestCheck.blockedReasons);
  if (!suppression.loaded) blockedReasons.push('suppression_ledger_missing');
  if (config.requireUniqueBatch && !verifyBatchNotSent_(batchId)) blockedReasons.push('batch_already_sent');
  if (!dryRun && config.dryRun) blockedReasons.push('dry_run_enabled');
  if (!dryRun && !config.liveSendEnabled) blockedReasons.push('live_send_disabled');
  if (!dryRun && settings.requireAutoSend && !config.autoSendEnabled) blockedReasons.push('auto_send_disabled');
  if (!dryRun && settings.skipDailySendWindow !== true) {
    const windowCheck = validateDailySendWindow_(config);
    if (!windowCheck.ok) blockedReasons.push(windowCheck.blockedReason);
  }

  const sheetState = countSendStates_(validation.readyRows);
  const eligibleRows = [];
  let suppressionMatchCount = 0;
  let gmailSentMatchCount = 0;
  let sheetHistoryMatchCount = 0;
  let candidateDigestMismatchCount = manifestCheck.candidateDigestMismatchCount;
  let manualReviewRequiredCount = sheetState.manualReviewRequiredCount;
  let attemptLimitExceededCount = 0;
  let candidateStateNotReadyCount = sheetState.sendReservedCount + sheetState.sentStateCount + sheetState.deliveryUnknownCount + sheetState.manualReviewRequiredCount;

  if (blockedReasons.length === 0 || dryRun) {
    validation.readyRows.forEach((item) => {
      const check = validateSingleCandidatePreSend_(item.row, {
        config,
        batchId,
        manifest: manifestCheck.manifest,
        manifestDigestSet: manifestCheck.manifestDigestSet,
        suppression
      });
      if (check.suppressionMatched) suppressionMatchCount += 1;
      if (check.gmailSentMatched) gmailSentMatchCount += 1;
      if (check.sheetHistoryMatched) sheetHistoryMatchCount += 1;
      if (check.digestMismatched) candidateDigestMismatchCount += 1;
      if (check.attemptLimitExceeded) attemptLimitExceededCount += 1;
      if (check.blockedReason === 'candidate_state_not_ready') candidateStateNotReadyCount += 1;
      if (check.manualReviewRequired) manualReviewRequiredCount += 1;
      if (check.ok && blockedReasons.length === 0) {
        eligibleRows.push(item);
      }
    });
  }

  if (suppressionMatchCount > 0) blockedReasons.push('suppression_match');
  if (gmailSentMatchCount > 0) blockedReasons.push('gmail_sent_history_match');
  if (sheetHistoryMatchCount > 0) blockedReasons.push('sheet_history_match');
  if (candidateDigestMismatchCount > 0) blockedReasons.push('candidate_digest_mismatch');
  if (attemptLimitExceededCount > 0) blockedReasons.push('send_attempt_limit_exceeded');
  if (candidateStateNotReadyCount > 0) blockedReasons.push('candidate_state_not_ready');

  const maxSendCount = Math.min(
    manifestCheck.maxSendCount || GMAIL_SEND_DEFAULT_MAX_SEND_COUNT,
    config.runtimeMaxSendCount || GMAIL_SEND_DEFAULT_MAX_SEND_COUNT,
    GMAIL_SEND_SAFE_MAX_SEND_COUNT
  );
  const wouldAttemptCount = blockedReasons.length === 0
    ? Math.min(eligibleRows.length, maxSendCount)
    : 0;

  return {
    mode: dryRun ? 'dry_run' : 'send',
    status: blockedReasons.length === 0 ? 'pass' : 'blocked',
    blockedReasons: uniqueArray_(blockedReasons),
    config,
    targetDate: config.sendDate,
    batchId,
    manifestLoaded: manifestCheck.manifestLoaded,
    manifestValid: manifestCheck.ok,
    manifestExpired: manifestCheck.manifestExpired,
    approvalVerified: manifestCheck.approvalVerified,
    candidateCount: validation.readyRows.length,
    candidateDigestMatchCount: manifestCheck.candidateDigestMatchCount,
    candidateDigestMismatchCount,
    attemptLimitExceededCount,
    candidateStateNotReadyCount,
    suppressionMatchCount,
    gmailSentMatchCount,
    sheetHistoryMatchCount,
    sendReservedCount: sheetState.sendReservedCount,
    sentStateCount: sheetState.sentStateCount,
    deliveryUnknownCount: sheetState.deliveryUnknownCount,
    manualReviewRequiredCount,
    eligibleRows,
    eligibleCount: eligibleRows.length,
    wouldAttemptCount,
    maxSendCount,
    manifest: manifestCheck.manifest,
    manifestDigestSet: manifestCheck.manifestDigestSet,
    suppression
  };
}

function analyzeApprovedGmailSalesRecoveryBatch_(settings) {
  const blockedReasons = [];
  const production = validateProductionConfig_();
  const baseConfig = production.config;
  const dryRun = settings.dryRun === true;
  let manifest = null;
  let config = baseConfig;
  let batchId = '';
  let rows = [];
  let validation = { readyRows: [], errors: [], skipped: [] };
  let manifestCheck = buildManifestValidationResult_(null, ['manifest_not_loaded'], [], baseConfig, '');
  let suppression = { loaded: false, entries: [] };
  let recoveryManifestCheck = { ok: false, blockedReasons: ['manifest_not_loaded'] };

  blockedReasons.push.apply(blockedReasons, production.errors.filter((reason) => reason !== 'daily_limit_must_be_30'));
  if (!baseConfig.recoverySheetName) blockedReasons.push('recovery_sheet_name_missing');

  try {
    manifest = loadApprovedSendManifest_(baseConfig);
    batchId = String(manifest.batchId || '').trim();
    config = buildRecoverySendConfig_(baseConfig, manifest);
    recoveryManifestCheck = validateRecoveryApprovedSendManifest_(manifest, config, batchId);
  } catch (error) {
    blockedReasons.push('manifest_load_failed');
  }

  if (manifest) {
    try {
      rows = loadCandidateRows_(config);
      validation = validateRecoveryOutboxRows_(rows, config, batchId);
    } catch (error) {
      blockedReasons.push('recovery_sheet_load_failed');
    }
  }

  try {
    manifestCheck = validateApprovedSendManifest_(manifest, config, batchId, validation.readyRows);
  } catch (error) {
    manifestCheck = buildManifestValidationResult_(manifest, ['manifest_validation_failed'], validation.readyRows, config, batchId);
  }

  try {
    suppression = loadSuppressionLedgerFromProperties_();
  } catch (error) {
    suppression = { loaded: false, entries: [] };
  }

  if (validation.errors.length > 0) blockedReasons.push('recovery_outbox_validation_errors');
  if (!recoveryManifestCheck.ok) blockedReasons.push.apply(blockedReasons, recoveryManifestCheck.blockedReasons);
  if (!manifestCheck.ok) blockedReasons.push.apply(blockedReasons, manifestCheck.blockedReasons);
  if (!suppression.loaded) blockedReasons.push('suppression_ledger_missing');
  if (config.requireUniqueBatch && batchId && !verifyBatchNotSent_(batchId)) blockedReasons.push('batch_already_sent');
  if (!dryRun && !config.liveSendEnabled) blockedReasons.push('live_send_disabled');
  if (!dryRun && config.autoSendEnabled) blockedReasons.push('auto_send_must_be_disabled');
  if (!dryRun && config.currentJstDate !== config.sendDate) blockedReasons.push('same_day_recovery_date_mismatch');
  if (!dryRun) {
    const windowCheck = validateRecoverySameDayWindow_(manifest, config);
    if (!windowCheck.ok) blockedReasons.push(windowCheck.blockedReason);
  }

  const sheetState = countSendStates_(validation.readyRows);
  const eligibleRows = [];
  let suppressionMatchCount = 0;
  let gmailSentMatchCount = 0;
  let sheetHistoryMatchCount = 0;
  let candidateDigestMismatchCount = manifestCheck.candidateDigestMismatchCount;
  let derivedIntegrityFieldMismatchCount = 0;
  let derivedIntegrityDifferingFieldNames = [];
  let manualReviewRequiredCount = sheetState.manualReviewRequiredCount;
  let attemptLimitExceededCount = 0;
  let candidateStateNotReadyCount = sheetState.sendReservedCount + sheetState.sentStateCount + sheetState.deliveryUnknownCount + sheetState.manualReviewRequiredCount;

  if (blockedReasons.length === 0 || dryRun) {
    validation.readyRows.forEach((item) => {
      const check = validateSingleCandidatePreSend_(item.row, {
        config,
        batchId,
        manifest,
        manifestDigestSet: manifestCheck.manifestDigestSet,
        suppression
      });
      if (check.suppressionMatched) suppressionMatchCount += 1;
      if (check.gmailSentMatched) gmailSentMatchCount += 1;
      if (check.sheetHistoryMatched) sheetHistoryMatchCount += 1;
      if (check.digestMismatched) candidateDigestMismatchCount += 1;
      if (check.derivedCandidateHashMismatched) {
        derivedIntegrityFieldMismatchCount += 1;
        derivedIntegrityDifferingFieldNames = uniqueArray_(derivedIntegrityDifferingFieldNames.concat(check.derivedIntegrityDifferingFieldNames || []));
      }
      if (check.attemptLimitExceeded) attemptLimitExceededCount += 1;
      if (check.blockedReason === 'candidate_state_not_ready') candidateStateNotReadyCount += 1;
      if (check.manualReviewRequired) manualReviewRequiredCount += 1;
      if (check.ok && blockedReasons.length === 0) eligibleRows.push(item);
    });
  }

  if (suppressionMatchCount > 0) blockedReasons.push('suppression_match');
  if (gmailSentMatchCount > 0) blockedReasons.push('gmail_sent_history_match');
  if (sheetHistoryMatchCount > 0) blockedReasons.push('sheet_history_match');
  if (candidateDigestMismatchCount > 0) blockedReasons.push('candidate_digest_mismatch');
  if (derivedIntegrityDifferingFieldNames.indexOf('sourceOutboxIdentity.candidateContentHash') !== -1) {
    blockedReasons.push('manifest_source_candidate_content_hash_mismatch');
  } else if (derivedIntegrityFieldMismatchCount > 0) {
    blockedReasons.push('derived_candidate_hash_mismatch');
  }
  if (attemptLimitExceededCount > 0) blockedReasons.push('send_attempt_limit_exceeded');
  if (candidateStateNotReadyCount > 0) blockedReasons.push('candidate_state_not_ready');

  const maxSendCount = Math.min(manifestCheck.maxSendCount || 1, config.runtimeMaxSendCount || 1, 1);
  const wouldAttemptCount = blockedReasons.length === 0 ? Math.min(eligibleRows.length, maxSendCount) : 0;
  if (blockedReasons.length === 0 && wouldAttemptCount !== 1) blockedReasons.push('recovery_would_send_count_not_1');

  return {
    mode: dryRun ? 'recovery_dry_run' : 'recovery_send',
    sourceType: 'recovery_single',
    status: blockedReasons.length === 0 ? 'pass' : 'blocked',
    blockedReasons: uniqueArray_(blockedReasons),
    config,
    targetDate: config.sendDate,
    batchId,
    manifestLoaded: Boolean(manifest),
    manifestValid: manifestCheck.ok && recoveryManifestCheck.ok,
    manifestExpired: manifestCheck.manifestExpired,
    approvalVerified: manifestCheck.approvalVerified,
    sameDayManualRecoveryApproved: Boolean(manifest && manifest.sameDayManualRecoveryApproved === true),
    candidateCount: validation.readyRows.length,
    candidateDigestMatchCount: manifestCheck.candidateDigestMatchCount,
    candidateDigestMismatchCount,
    substantiveFieldMismatchCount: 0,
    derivedIntegrityFieldMismatchCount,
    derivedIntegrityDifferingFieldNames,
    attemptLimitExceededCount,
    candidateStateNotReadyCount,
    suppressionMatchCount,
    gmailSentMatchCount,
    sheetHistoryMatchCount,
    sendReservedCount: sheetState.sendReservedCount,
    sentStateCount: sheetState.sentStateCount,
    deliveryUnknownCount: sheetState.deliveryUnknownCount,
    manualReviewRequiredCount,
    eligibleRows,
    eligibleCount: eligibleRows.length,
    wouldAttemptCount,
    maxSendCount,
    manifest,
    manifestDigestSet: manifestCheck.manifestDigestSet,
    suppression
  };
}

function diagnoseGmailSalesRecoveryDigestRuntime_(options) {
  const settings = options || {};
  const result = {
    event: 'approved_gmail_sales_recovery_digest_diagnostic',
    mode: 'read_only_digest_diagnostic',
    status: 'blocked',
    runtimeVersion: GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION,
    expectedRuntimeVersionMatch: GMAIL_RECOVERY_DIGEST_RUNTIME_VERSION === 'recovery-digest-diagnostic-v4',
    recoveryPreSendFunctionPresent: typeof runGmailSalesRecoveryPreSendDryRun === 'function',
    recoverySendOnceFunctionPresent: typeof runGmailSalesRecoverySendOnce === 'function',
    buildCandidateDigestInputPresent: typeof buildCandidateDigestInput_ === 'function',
    candidateDigestCanonicalizationMarker: GMAIL_RECOVERY_CANDIDATE_DIGEST_CANONICALIZATION,
    canonicalizationMarkerPresent: false,
    canonicalizationMarkerExpected: false,
    localV3MarkerExpected: true,
    legacyDigestFunctionReachable: false,
    duplicateDigestFunctionDefinitionCount: 1,
    propertyPresent: false,
    propertyJsonParsePassed: false,
    targetDate: '',
    sourceType: '',
    candidateCount: 0,
    manifestCandidateCount: 0,
    candidateDigestCount: 0,
    sameDayManualRecoveryApproved: false,
    expiresAtValidationPassed: false,
    sha256AsciiSelfTestPassed: false,
    sha256JapaneseSelfTestPassed: false,
    sha256UnicodeSelfTestPassed: false,
    signedByteHexConversionPassed: false,
    shaRuntimeSelfTestPassed: false,
    nodeAppsScriptDigestCompatibilityPassed: false,
    storedCandidateDigestPresent: false,
    manifestCandidateDigestRecalculationPassed: false,
    manifestCandidateDigestMatch: false,
    manifestDigestRecalculationPassed: false,
    manifestDigestMatch: false,
    candidateDigestInputFieldCount: 0,
    candidateCanonicalCharLength: 0,
    candidateCanonicalUtf8ByteLength: 0,
    sheetPresent: false,
    headerValidationPassed: false,
    sheetDataRowCount: 0,
    manifestVsSheetFieldComparisonPassed: false,
    substantiveFieldMismatchCount: 0,
    differingFieldNames: [],
    derivedIntegrityFieldMismatchCount: 0,
    derivedIntegrityDifferingFieldNames: [],
    sheetCandidateContentHashPresent: false,
    sheetCandidateContentHashMatch: false,
    manifestSourceCandidateContentHashMatch: false,
    typeMismatchFieldNames: [],
    dateNormalizationFieldNames: [],
    booleanNormalizationFieldNames: [],
    newlineNormalizationFieldNames: [],
    emptyNormalizationFieldNames: [],
    unicodeNormalizationFieldNames: [],
    whitespaceDifferenceFieldNames: [],
    sheetCandidateDigestMatch: false,
    candidateDigestMatchAfterCanonicalization: false,
    activeCanonicalizationMatchesStoredDigest: false,
    stableJsonCanonicalizationMatchesStoredDigest: false,
    legacyCanonicalizationMatchesStoredDigest: false,
    normalizedRecoveryCanonicalizationMatchesStoredDigest: false,
    rawManifestCandidateMatchesStoredDigest: false,
    shaHexSignedByteFixedMatchesStoredDigest: false,
    shaHexLegacyByteConversionMatchesStoredDigest: false,
    recommendedNextAction: 'diagnosis_inconclusive',
    blockedReason: '',
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false,
    triggerChanged: false
  };

  const shaSelfTest = runRecoveryShaRuntimeSelfTest_();
  Object.assign(result, shaSelfTest);

  let manifest = null;
  let config = null;
  let rowItem = null;
  let runtimeDigest = '';
  try {
    const baseConfig = getConfig_();
    result.propertyPresent = Boolean(baseConfig.approvedSendManifestJson);
    manifest = loadApprovedSendManifest_(baseConfig);
    result.propertyJsonParsePassed = true;
    result.targetDate = String(manifest.targetDate || '');
    result.sourceType = String(manifest.sourceType || (manifest.recoverySingle ? 'recovery_single' : ''));
    result.candidateCount = Number(manifest.candidateCount || 0);
    result.manifestCandidateCount = Number(manifest.candidateCount || 0);
    result.candidateDigestCount = Array.isArray(manifest.candidateDigests) ? manifest.candidateDigests.length : 0;
    result.sameDayManualRecoveryApproved = manifest.sameDayManualRecoveryApproved === true;
    result.expiresAtValidationPassed = !isManifestExpired_(manifest);
    result.canonicalizationMarkerPresent = Boolean(manifest.candidateDigestCanonicalization);
    result.canonicalizationMarkerExpected = manifest.candidateDigestCanonicalization === GMAIL_RECOVERY_CANDIDATE_DIGEST_CANONICALIZATION;
    result.storedCandidateDigestPresent = result.candidateDigestCount === 1 && Boolean(String(manifest.candidateDigests[0] || '').trim());
    config = buildRecoverySendConfig_(baseConfig, manifest);
    const rows = loadCandidateRows_(config);
    result.sheetPresent = Boolean(config.sheetId && config.sheetName);
    result.sheetDataRowCount = rows.length;
    result.headerValidationPassed = rows.length === 1;
    rowItem = rows[0] || null;
  } catch (error) {
    result.blockedReason = 'manifest_or_sheet_load_failed';
  }

  if (manifest && rowItem) {
    const batchId = String(manifest.batchId || '').trim();
    const derivedIntegrity = analyzeRecoveryDerivedCandidateHash_(rowItem.row, manifest);
    const digestInput = buildCandidateDigestInput_(rowItem.row, manifest.effectiveSendDate || manifest.targetDate, batchId);
    runtimeDigest = sha256Hex_(digestInput.join('\n'));
    const storedDigest = String((manifest.candidateDigests || [])[0] || '').trim();
    result.candidateDigestInputFieldCount = digestInput.length;
    const canonicalText = digestInput.join('\n');
    result.candidateCanonicalCharLength = canonicalText.length;
    result.candidateCanonicalUtf8ByteLength = utf8ByteLength_(canonicalText);
    result.manifestCandidateDigestRecalculationPassed = Boolean(runtimeDigest);
    result.manifestCandidateDigestMatch = runtimeDigest === storedDigest;
    result.sheetCandidateDigestMatch = runtimeDigest === storedDigest;
    result.candidateDigestMatchAfterCanonicalization = runtimeDigest === storedDigest;
    result.activeCanonicalizationMatchesStoredDigest = runtimeDigest === storedDigest;
    result.normalizedRecoveryCanonicalizationMatchesStoredDigest = runtimeDigest === storedDigest;
    result.shaHexSignedByteFixedMatchesStoredDigest = runtimeDigest === storedDigest;
    result.stableJsonCanonicalizationMatchesStoredDigest = sha256Hex_(JSON.stringify(digestInput)) === storedDigest;
    result.legacyCanonicalizationMatchesStoredDigest = legacyCandidateDigestForDiagnostic_(rowItem.row, manifest.effectiveSendDate || manifest.targetDate, batchId) === storedDigest;
    result.shaHexLegacyByteConversionMatchesStoredDigest = legacySha256HexForDiagnostic_(canonicalText) === storedDigest;
    result.rawManifestCandidateMatchesStoredDigest = false;
    result.manifestVsSheetFieldComparisonPassed = derivedIntegrity.substantiveFieldMismatchCount === 0 &&
      derivedIntegrity.derivedIntegrityFieldMismatchCount === 0;
    result.substantiveFieldMismatchCount = derivedIntegrity.substantiveFieldMismatchCount;
    result.differingFieldNames = derivedIntegrity.substantiveDifferingFieldNames;
    result.derivedIntegrityFieldMismatchCount = derivedIntegrity.derivedIntegrityFieldMismatchCount;
    result.derivedIntegrityDifferingFieldNames = derivedIntegrity.derivedIntegrityDifferingFieldNames;
    if (derivedIntegrity.derivedIntegrityDifferingFieldNames.indexOf('sourceOutboxIdentity.candidateContentHash') !== -1 &&
      runtimeDigest !== storedDigest) {
      result.substantiveFieldMismatchCount += 1;
      result.differingFieldNames = uniqueArray_(result.differingFieldNames.concat(['candidateDigestInput']));
    }
    result.sheetCandidateContentHashPresent = derivedIntegrity.sheetCandidateContentHashPresent;
    result.sheetCandidateContentHashMatch = derivedIntegrity.sheetCandidateContentHashMatch;
    result.manifestSourceCandidateContentHashMatch = derivedIntegrity.manifestSourceCandidateContentHashMatch;
    result.manifestDigestRecalculationPassed = true;
    result.manifestDigestMatch = result.candidateDigestCount === 1;
    if (settings.includeInternal === true) {
      result.runtimeCandidateContentHashForInternalUse = derivedIntegrity.runtimeCandidateContentHash;
    }
  }

  if (!result.expectedRuntimeVersionMatch) result.recommendedNextAction = 'runtime_code_not_updated';
  else if (!result.propertyPresent || !result.propertyJsonParsePassed) result.recommendedNextAction = 'manifest_property_not_v3';
  else if (!result.canonicalizationMarkerExpected) result.recommendedNextAction = 'manifest_property_not_v3';
  else if (!result.shaRuntimeSelfTestPassed) result.recommendedNextAction = 'sha_runtime_implementation_mismatch';
  else if (!result.expiresAtValidationPassed) result.recommendedNextAction = 'manifest_expired';
  else if (result.sheetDataRowCount !== 1) result.recommendedNextAction = 'sheet_substantive_content_mismatch';
  else if (result.substantiveFieldMismatchCount > 0) result.recommendedNextAction = 'sheet_substantive_content_mismatch';
  else if (result.derivedIntegrityFieldMismatchCount === 1 &&
    result.derivedIntegrityDifferingFieldNames.length === 1 &&
    result.derivedIntegrityDifferingFieldNames[0] === 'sourceOutboxIdentity.candidateContentHash' &&
    result.candidateDigestMatchAfterCanonicalization &&
    result.manifestCandidateDigestMatch &&
    result.manifestDigestMatch) result.recommendedNextAction = 'manifest_source_candidate_content_hash_reissue_safe';
  else if (result.derivedIntegrityFieldMismatchCount === 1 &&
    result.derivedIntegrityDifferingFieldNames.length === 1 &&
    result.derivedIntegrityDifferingFieldNames[0] === 'candidateContentHash' &&
    result.candidateDigestMatchAfterCanonicalization &&
    result.manifestCandidateDigestMatch &&
    result.manifestDigestMatch) result.recommendedNextAction = 'sheet_derived_candidate_hash_repair_safe';
  else if (result.candidateDigestMatchAfterCanonicalization) result.recommendedNextAction = 'diagnosis_inconclusive';
  else if (result.storedCandidateDigestPresent && result.substantiveFieldMismatchCount === 0) result.recommendedNextAction = 'runtime_digest_reissue_safe';

  result.status = result.recommendedNextAction === 'runtime_digest_reissue_safe' ||
    result.recommendedNextAction === 'sheet_derived_candidate_hash_repair_safe' ||
    result.recommendedNextAction === 'manifest_source_candidate_content_hash_reissue_safe' ||
    result.candidateDigestMatchAfterCanonicalization
    ? 'pass'
    : 'blocked';

  if (settings.includeInternal === true) {
    result.manifestForInternalUse = manifest;
    result.runtimeCandidateDigestForInternalUse = runtimeDigest;
  }
  return result;
}

function runRecoveryShaRuntimeSelfTest_() {
  const vectors = [
    { name: 'empty', value: '', digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { name: 'ascii', value: 'abc', digest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
    { name: 'ascii_newline', value: 'hello\nworld', digest: '26c60a61d01db5836ca70fefd44a6a016620413c8ef5f259a6c5612d4f79d3b8' },
    { name: 'japanese', value: '日本語', digest: '77710aedc74ecfa33685e33a6c7df5cc83004da1bdcef7fb280f5c2b2e97e0a5' },
    { name: 'unicode', value: 'hello😀', digest: '43e085c2a106c941e8b30167304570382e9c168aee0d68eb8832b13baf3393a0' },
    { name: 'crlf', value: 'a\r\nb', digest: '18745f36a05e29072709042d6062ce54f1b08ff36c27ba80c39f81fb010c8ce2' },
    { name: 'lf', value: 'a\nb', digest: '7e18f737311b2dc3b2f269dd78396b0351f14fb66efa879f768cb23181883c78' },
    { name: 'nfc', value: 'é', digest: '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c' },
    { name: 'nfd', value: 'é', digest: 'bf12767b0f2a56b2190075bae8169f656e3ce8d6357d4aff184bc6c7ea48f9f6' }
  ];
  const results = {};
  let allPassed = true;
  vectors.forEach((vector) => {
    const ok = sha256Hex_(vector.value) === vector.digest;
    allPassed = allPassed && ok;
    results[vector.name] = ok;
  });
  const signedByteCheck = sha256Hex_('abc').length === 64 && /^[a-f0-9]{64}$/.test(sha256Hex_('abc'));
  return {
    sha256AsciiSelfTestPassed: results.ascii === true && results.ascii_newline === true,
    sha256JapaneseSelfTestPassed: results.japanese === true,
    sha256UnicodeSelfTestPassed: results.unicode === true && results.nfc === true && results.nfd === true,
    signedByteHexConversionPassed: signedByteCheck,
    shaRuntimeSelfTestPassed: allPassed && signedByteCheck,
    nodeAppsScriptDigestCompatibilityPassed: allPassed && signedByteCheck
  };
}

function legacyCandidateDigestForDiagnostic_(row, targetDate, batchId) {
  return sha256Hex_([
    normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']),
    String(row.subject || row['件名'] || '').trim(),
    String(row.body || row['本文'] || '').trim(),
    String(row.prospectId || row.dedupeKey || '').trim().toLowerCase(),
    normalizeDateText_(targetDate),
    String(batchId || '').trim()
  ].join('\n'));
}

function analyzeRecoveryDerivedCandidateHash_(row, manifest) {
  const runtimeCandidateContentHash = computeRecoveryCandidateContentHashForRuntime_(row);
  const manifestCandidateContentHash = String(manifest && manifest.sourceOutboxIdentity && manifest.sourceOutboxIdentity.candidateContentHash || '').trim();
  const hasSheetCandidateContentHash = Object.prototype.hasOwnProperty.call(row || {}, 'candidateContentHash');
  const sheetCandidateContentHash = String(hasSheetCandidateContentHash ? row.candidateContentHash || '' : '').trim();
  const manifestSourceMatch = Boolean(manifestCandidateContentHash && manifestCandidateContentHash === runtimeCandidateContentHash);
  const sheetHashMatch = hasSheetCandidateContentHash && sheetCandidateContentHash === runtimeCandidateContentHash;
  const derivedFields = [];
  const substantiveFields = [];

  if (!manifestSourceMatch) {
    derivedFields.push('sourceOutboxIdentity.candidateContentHash');
  }
  if (hasSheetCandidateContentHash && !sheetHashMatch) {
    derivedFields.push('candidateContentHash');
  }

  return {
    runtimeCandidateContentHash,
    manifestSourceCandidateContentHashMatch: manifestSourceMatch,
    sheetCandidateContentHashPresent: hasSheetCandidateContentHash,
    sheetCandidateContentHashMatch: hasSheetCandidateContentHash ? sheetHashMatch : true,
    substantiveFieldMismatchCount: substantiveFields.length,
    substantiveDifferingFieldNames: substantiveFields,
    derivedIntegrityFieldMismatchCount: derivedFields.length,
    derivedIntegrityDifferingFieldNames: derivedFields
  };
}

function computeRecoveryCandidateContentHashForRuntime_(row) {
  const projected = [{
    email: row.email || '',
    name: row.name || '',
    subject: row.subject || '',
    body: row.body || '',
    sourceUrl: row.sourceUrl || '',
    prospectId: row.prospectId || '',
    dedupeKey: row.dedupeKey || ''
  }];
  return sha256Hex_(JSON.stringify(projected));
}

function legacySha256HexForDiagnostic_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset && Utilities.Charset.UTF_8);
  return digest.map((byte) => ('0' + byte.toString(16)).slice(-2)).join('');
}

function utf8ByteLength_(value) {
  try {
    return Utilities.newBlob(String(value || '')).getBytes().length;
  } catch (error) {
    return unescape(encodeURIComponent(String(value || ''))).length;
  }
}

function buildRecoverySendConfig_(baseConfig, manifest) {
  const targetDate = normalizeDateText_(manifest.effectiveSendDate || manifest.targetDate || baseConfig.sendDate);
  return Object.assign({}, baseConfig, {
    sheetName: baseConfig.recoverySheetName,
    sendDate: targetDate,
    sendBatchId: String(manifest.batchId || '').trim(),
    dailySendLimit: 1,
    requireExactReadyCount: false,
    runtimeMaxSendCount: Math.min(baseConfig.runtimeMaxSendCount || 1, 1)
  });
}

function validateRecoveryApprovedSendManifest_(manifest, config, batchId) {
  const blockedReasons = [];
  const sourceIdentity = manifest && manifest.sourceOutboxIdentity || {};
  if (!manifest) blockedReasons.push('manifest_missing');
  if (String(sourceIdentity.source || '') !== 'local_recovery_approved_outbox') blockedReasons.push('manifest_source_not_recovery_single');
  if (Number(manifest && manifest.candidateCount || 0) !== 1) blockedReasons.push('manifest_candidate_count_not_1');
  if (Number(manifest && manifest.humanReviewedCount || 0) !== 1) blockedReasons.push('manifest_human_review_count_not_1');
  if (manifest && manifest.targetAutoApproved !== false) blockedReasons.push('manifest_target_auto_approved_not_false');
  if (manifest && manifest.sheetAlreadyAppliedConfirmed !== true) blockedReasons.push('manifest_sheet_not_confirmed');
  if (manifest && manifest.sameDayManualRecoveryApproved !== true) blockedReasons.push('same_day_manual_recovery_not_approved');
  if (String(manifest && manifest.sameDayManualRecoveryReasonCode || '') !== 'user_required_same_day_sales_recovery') blockedReasons.push('same_day_manual_recovery_reason_missing');
  if (normalizeDateText_(manifest && manifest.effectiveSendDate) !== config.sendDate) blockedReasons.push('effective_send_date_mismatch');
  if (String(batchId || '').indexOf('recovery') === -1) blockedReasons.push('manifest_batch_not_recovery');
  return { ok: blockedReasons.length === 0, blockedReasons };
}

function validateRecoveryOutboxRows_(items, config, batchId) {
  const readyRows = [];
  const skipped = [];
  const errors = [];
  const allRows = items || [];
  if (allRows.length !== 1) {
    errors.push({ rowIndex: 0, reason: 'recovery_sheet_row_count_not_1' });
  }

  allRows.forEach((item) => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const rowStatus = String(row.status || '').toLowerCase();
    const rowSendDate = normalizeDateText_(row.sendDate || row['送信日']);
    const rowBatchId = String(row.sendBatchId || '').trim();
    const subject = normalizeEmailSubject_(row.subject || row['件名']);
    const body = normalizeEmailBody_(row.body || row['本文']);

    if (rowStatus !== 'ready') {
      skipped.push({ rowIndex, reason: 'not_ready_status' });
      return;
    }
    if (rowSendDate !== config.sendDate) {
      errors.push({ rowIndex, reason: 'send_date_mismatch' });
      return;
    }
    if (!rowBatchId || rowBatchId !== batchId) {
      errors.push({ rowIndex, reason: 'send_batch_id_mismatch' });
      return;
    }
    if (!subject || !body) {
      errors.push({ rowIndex, reason: 'missing_subject_or_body' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ rowIndex, reason: 'invalid_email' });
      return;
    }
    if (shouldSkipRecipient_(row)) {
      skipped.push({ rowIndex, reason: 'status_excluded' });
      return;
    }
    try {
      const message = buildInitialSalesEmail_(row);
      assertMessageSafe_(message);
      assertRecipientPersonalizationSafe_(row, message);
    } catch (error) {
      errors.push({ rowIndex, reason: error.message });
      return;
    }
    readyRows.push(item);
  });

  if (readyRows.length !== 1) {
    errors.push({ rowIndex: 0, reason: 'recovery_ready_count_not_1' });
  }
  return { readyRows, skipped, errors };
}

function validateRecoverySameDayWindow_(manifest, config) {
  const expiresAt = new Date(String((manifest && manifest.expiresAt) || ''));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { ok: false, blockedReason: 'manifest_expired' };
  }
  if (config.currentJstDate !== config.sendDate) {
    return { ok: false, blockedReason: 'same_day_recovery_date_mismatch' };
  }
  return { ok: true, blockedReason: '' };
}

function toPreSendPublicResult_(analysis, mode) {
  return {
    mode,
    status: analysis.status,
    blockedReasons: analysis.blockedReasons,
    targetDate: analysis.targetDate,
    batchIdPresent: Boolean(analysis.batchId),
    manifestLoaded: analysis.manifestLoaded,
    manifestValid: analysis.manifestValid,
    manifestExpired: analysis.manifestExpired,
    approvalVerified: analysis.approvalVerified,
    candidateCount: analysis.candidateCount,
    candidateDigestMatchCount: analysis.candidateDigestMatchCount,
    candidateDigestMismatchCount: analysis.candidateDigestMismatchCount,
    substantiveFieldMismatchCount: analysis.substantiveFieldMismatchCount || 0,
    derivedIntegrityFieldMismatchCount: analysis.derivedIntegrityFieldMismatchCount || 0,
    derivedIntegrityDifferingFieldNames: analysis.derivedIntegrityDifferingFieldNames || [],
    attemptLimitExceededCount: analysis.attemptLimitExceededCount,
    candidateStateNotReadyCount: analysis.candidateStateNotReadyCount,
    suppressionMatchCount: analysis.suppressionMatchCount,
    gmailSentMatchCount: analysis.gmailSentMatchCount,
    sheetHistoryMatchCount: analysis.sheetHistoryMatchCount,
    sendReservedCount: analysis.sendReservedCount,
    sentStateCount: analysis.sentStateCount,
    deliveryUnknownCount: analysis.deliveryUnknownCount,
    manualReviewRequiredCount: analysis.manualReviewRequiredCount,
    eligibleCount: analysis.eligibleCount,
    wouldAttemptCount: analysis.wouldAttemptCount,
    maxSendCount: analysis.maxSendCount,
    gmailSendExecuted: false,
    gmailDraftCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  };
}

function buildPreSendDryRunResult_(overrides) {
  return Object.assign({
    mode: 'dry_run',
    status: 'blocked',
    blockedReasons: [],
    targetDate: '',
    batchIdPresent: false,
    manifestLoaded: false,
    manifestValid: false,
    manifestExpired: false,
    approvalVerified: false,
    candidateCount: 0,
    candidateDigestMatchCount: 0,
    candidateDigestMismatchCount: 0,
    substantiveFieldMismatchCount: 0,
    derivedIntegrityFieldMismatchCount: 0,
    derivedIntegrityDifferingFieldNames: [],
    attemptLimitExceededCount: 0,
    candidateStateNotReadyCount: 0,
    suppressionMatchCount: 0,
    gmailSentMatchCount: 0,
    sheetHistoryMatchCount: 0,
    sendReservedCount: 0,
    sentStateCount: 0,
    deliveryUnknownCount: 0,
    manualReviewRequiredCount: 0,
    eligibleCount: 0,
    wouldAttemptCount: 0,
    maxSendCount: GMAIL_SEND_DEFAULT_MAX_SEND_COUNT,
    gmailSendExecuted: false,
    gmailDraftCreated: false,
    googleSheetsUpdated: false,
    scriptPropertiesUpdated: false
  }, overrides || {});
}

function loadApprovedSendManifest_(config) {
  if (!config.approvedSendManifestJson) {
    throw new Error('manifest_property_missing');
  }
  const manifest = JSON.parse(config.approvedSendManifestJson);
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest_invalid_json');
  }
  return manifest;
}

function validateApprovedSendManifest_(manifest, config, batchId, readyRows) {
  const blockedReasons = [];
  if (!manifest) {
    return buildManifestValidationResult_(manifest, ['manifest_missing'], readyRows, config, batchId);
  }
  if (Number(manifest.schemaVersion) !== GMAIL_SEND_MANIFEST_SCHEMA_VERSION) blockedReasons.push('manifest_schema_unsupported');
  if (String(manifest.targetDate || '') !== config.sendDate) blockedReasons.push('manifest_target_date_mismatch');
  if (String(manifest.batchId || '') !== batchId) blockedReasons.push('manifest_batch_id_mismatch');
  if (Number(manifest.candidateCount || 0) !== readyRows.length) blockedReasons.push('manifest_candidate_count_mismatch');
  if (!String(manifest.approvedOutboxHash || '').trim()) blockedReasons.push('manifest_approved_outbox_hash_missing');
  if (manifest.approvalStatus !== 'approved') blockedReasons.push('manifest_approval_status_not_approved');
  if (!isManifestApprovalAccepted_(manifest)) blockedReasons.push('manifest_approval_not_accepted');
  if (!Array.isArray(manifest.candidateDigests)) blockedReasons.push('manifest_candidate_digests_missing');
  if (isManifestExpired_(manifest)) blockedReasons.push('manifest_expired');
  const maxSendCount = normalizeManifestMaxSendCount_(manifest.maxSendCount);
  if (!maxSendCount) blockedReasons.push('manifest_max_send_count_invalid');
  return buildManifestValidationResult_(manifest, blockedReasons, readyRows, config, batchId, maxSendCount);
}

function isManifestApprovalAccepted_(manifest) {
  if (!manifest || manifest.approvalStatus !== 'approved') {
    return false;
  }
  if (manifest.humanReviewCompleted === true) {
    return true;
  }
  return String(manifest.approvalType || '') === 'automatic_strict_gate' &&
    String(manifest.mode || manifest.sourceType || '') === 'normal_daily' &&
    manifest.targetAutoApproved === true &&
    manifest.humanReviewCompleted === false &&
    Number(manifest.humanReviewedCount || 0) === 0 &&
    String(manifest.automationVersion || '') === GMAIL_DAILY_AUTOMATION_VERSION &&
    String(manifest.autoApprovalPolicyVersion || '') === GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION &&
    manifest.recoverySingle !== true;
}

function buildManifestValidationResult_(manifest, blockedReasons, readyRows, config, batchId, maxSendCount) {
  const manifestDigests = Array.isArray(manifest && manifest.candidateDigests)
    ? manifest.candidateDigests.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const manifestDigestSet = {};
  let duplicateDigestCount = 0;
  manifestDigests.forEach((digest) => {
    if (manifestDigestSet[digest]) duplicateDigestCount += 1;
    manifestDigestSet[digest] = true;
  });
  const rowDigests = (readyRows || []).map((item) => computeCandidateDigest_(item.row, config.sendDate, batchId));
  let matchCount = 0;
  rowDigests.forEach((digest) => {
    if (manifestDigestSet[digest]) matchCount += 1;
  });
  const mismatchCount = Math.max(0, rowDigests.length - matchCount) +
    Math.max(0, manifestDigests.length - rowDigests.length) +
    duplicateDigestCount;
  const reasons = (blockedReasons || []).slice();
  if (duplicateDigestCount > 0) reasons.push('manifest_candidate_digest_duplicate');
  if (mismatchCount > 0) reasons.push('manifest_candidate_digest_mismatch');
  return {
    manifest,
    manifestLoaded: Boolean(manifest),
    ok: reasons.length === 0,
    blockedReasons: uniqueArray_(reasons),
    manifestExpired: Boolean(manifest && isManifestExpired_(manifest)),
    approvalVerified: Boolean(isManifestApprovalAccepted_(manifest)),
    candidateDigestMatchCount: matchCount,
    candidateDigestMismatchCount: mismatchCount,
    manifestDigestSet,
    maxSendCount: maxSendCount || GMAIL_SEND_DEFAULT_MAX_SEND_COUNT
  };
}

function normalizeManifestMaxSendCount_(value) {
  const parsed = Number(value || GMAIL_SEND_DEFAULT_MAX_SEND_COUNT);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > GMAIL_SEND_SAFE_MAX_SEND_COUNT) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeMaxSendAttempts_(value) {
  const parsed = Number(value || GMAIL_SEND_MAX_ATTEMPTS);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > GMAIL_SEND_MAX_ATTEMPTS) {
    return GMAIL_SEND_MAX_ATTEMPTS;
  }
  return Math.floor(parsed);
}

function isManifestExpired_(manifest) {
  const expiresAt = new Date(String((manifest && manifest.expiresAt) || ''));
  if (Number.isNaN(expiresAt.getTime())) {
    return true;
  }
  return expiresAt.getTime() <= Date.now();
}

function validateSingleCandidatePreSend_(row, context) {
  const digest = computeCandidateDigest_(row, context.config.sendDate, context.batchId);
  const state = normalizeSendState_(row);
  const result = {
    ok: true,
    blockedReason: '',
    suppressionMatched: false,
    gmailSentMatched: false,
    sheetHistoryMatched: false,
    digestMismatched: false,
    derivedCandidateHashMismatched: false,
    derivedIntegrityDifferingFieldNames: [],
    attemptLimitExceeded: false,
    manualReviewRequired: false
  };
  if (!context.manifestDigestSet || !context.manifestDigestSet[digest]) {
    return blockedPreSendResult_(result, 'candidate_digest_mismatch', { digestMismatched: true });
  }
  if (isManifestExpired_(context.manifest)) {
    return blockedPreSendResult_(result, 'manifest_expired');
  }
  if (context.manifest && String(context.manifest.sourceType || '') === 'recovery_single') {
    const derived = analyzeRecoveryDerivedCandidateHash_(row, context.manifest);
    if (derived.substantiveFieldMismatchCount > 0) {
      return blockedPreSendResult_(result, 'candidate_digest_mismatch', { digestMismatched: true });
    }
    if (derived.derivedIntegrityFieldMismatchCount > 0) {
      const blockedReason = derived.derivedIntegrityDifferingFieldNames.indexOf('sourceOutboxIdentity.candidateContentHash') !== -1
        ? 'manifest_source_candidate_content_hash_mismatch'
        : 'derived_candidate_hash_mismatch';
      return blockedPreSendResult_(result, blockedReason, {
        derivedCandidateHashMismatched: true,
        derivedIntegrityDifferingFieldNames: derived.derivedIntegrityDifferingFieldNames
      });
    }
  }
  if (state !== GMAIL_SEND_STATE.ready) {
    return blockedPreSendResult_(result, 'candidate_state_not_ready', { sheetHistoryMatched: state === GMAIL_SEND_STATE.sent });
  }
  if (Number(row.sendAttemptCount || 0) >= (context.config.maxSendAttempts || GMAIL_SEND_MAX_ATTEMPTS)) {
    return blockedPreSendResult_(result, 'send_attempt_limit_exceeded', {
      attemptLimitExceeded: true,
      manualReviewRequired: true
    });
  }
  if (isSuppressedByLedger_(row, context.suppression)) {
    return blockedPreSendResult_(result, 'suppression_match', { suppressionMatched: true, manualReviewRequired: true });
  }
  if (hasSheetSentHistory_(row)) {
    return blockedPreSendResult_(result, 'sheet_history_match', { sheetHistoryMatched: true, manualReviewRequired: true });
  }
  const sentCheck = findPossibleGmailSentMatch_(row, context.config);
  if (!sentCheck.ok) {
    return blockedPreSendResult_(result, sentCheck.blockedReason, { gmailSentMatched: true, manualReviewRequired: true });
  }
  if (sentCheck.matched) {
    return blockedPreSendResult_(result, 'gmail_sent_history_match', { gmailSentMatched: true, manualReviewRequired: true });
  }
  return result;
}

function blockedPreSendResult_(result, reason, flags) {
  const merged = Object.assign(result, flags || {});
  merged.ok = false;
  merged.blockedReason = reason;
  return merged;
}

function normalizeSendState_(row) {
  const state = String(row.sendState || '').trim().toUpperCase();
  if (state === GMAIL_SEND_STATE.reserved ||
    state === GMAIL_SEND_STATE.sent ||
    state === GMAIL_SEND_STATE.deliveryUnknown ||
    state === GMAIL_SEND_STATE.failedBeforeSend ||
    state === GMAIL_SEND_STATE.blocked ||
    state === GMAIL_SEND_STATE.manualReviewRequired) {
    return state;
  }
  if (hasSheetSentHistory_(row)) {
    return GMAIL_SEND_STATE.sent;
  }
  if (String(row.status || '').toLowerCase() === 'ready') {
    return GMAIL_SEND_STATE.ready;
  }
  return GMAIL_SEND_STATE.blocked;
}

function countSendStates_(items) {
  const counts = {
    sendReservedCount: 0,
    sentStateCount: 0,
    deliveryUnknownCount: 0,
    manualReviewRequiredCount: 0
  };
  (items || []).forEach((item) => {
    const state = normalizeSendState_(item.row || {});
    if (state === GMAIL_SEND_STATE.reserved) counts.sendReservedCount += 1;
    if (state === GMAIL_SEND_STATE.sent) counts.sentStateCount += 1;
    if (state === GMAIL_SEND_STATE.deliveryUnknown) counts.deliveryUnknownCount += 1;
    if (state === GMAIL_SEND_STATE.manualReviewRequired) counts.manualReviewRequiredCount += 1;
  });
  return counts;
}

function hasSheetSentHistory_(row) {
  const statusText = String(row.sentStatus || row['送信ステータス'] || '').toLowerCase();
  return Boolean(String(row.sentAt || '').trim()) || includesAny_(statusText, ['送信済', 'sent', 'delivered', 'success']);
}

function isSuppressedByLedger_(row, ledger) {
  if (!ledger || !ledger.loaded) {
    return true;
  }
  const recipientHash = hashValue_(normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']));
  const domainHash = hashValue_(sourceDomainFromRow_(row));
  const businessHash = businessFingerprintFromRow_(row);
  if ((ledger.recipientHashes && ledger.recipientHashes[recipientHash]) ||
    (ledger.domainHashes && ledger.domainHashes[domainHash]) ||
    (ledger.businessFingerprints && ledger.businessFingerprints[businessHash])) {
    return true;
  }
  return (ledger.entries || []).some((entry) => {
    if (entry.suppressed === false || entry.futureEligible === true) return false;
    return String(entry.recipientHash || '') === recipientHash ||
      String(entry.normalizedDomainHash || entry.domainHash || '') === domainHash ||
      String(entry.businessFingerprint || '') === businessHash;
  });
}

function findPossibleGmailSentMatch_(row, config) {
  try {
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const subject = normalizeEmailSubject_(row.subject || row['件名']);
    if (!email || !subject) {
      return { ok: false, matched: false, blockedReason: 'gmail_sent_query_missing_fields' };
    }
    const after = String(config.sendDate || '').replace(/-/g, '/');
    const query = 'in:sent to:"' + escapeGmailSearchText_(email) + '" after:' + after +
      ' subject:"' + escapeGmailSearchText_(subject) + '"';
    const threads = GmailApp.search(query, 0, 10);
    return { ok: true, matched: threads.length > 0, blockedReason: '' };
  } catch (error) {
    return { ok: false, matched: false, blockedReason: 'gmail_sent_search_failed' };
  }
}

function reserveCandidateBeforeSend_(config, rowIndex, row, reservation) {
  ensureSendStateColumns_(config);
  updateSheetAfterSend_(config, rowIndex, {
    sendState: GMAIL_SEND_STATE.reserved,
    sendRunId: reservation.runId,
    sendReservedAt: new Date().toISOString(),
    sendAttemptCount: reservation.attemptCount,
    approvedBatchId: reservation.batchId,
    approvedCandidateDigest: reservation.digest,
    sentStatus: GMAIL_SEND_STATE.reserved,
    lastSendErrorCode: '',
    lastCheckedAt: new Date().toISOString()
  });
  SpreadsheetApp.flush();
}

function reloadCandidateRow_(config, rowIndex) {
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value));
  const values = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  const row = {};
  header.forEach((key, index) => {
    row[key] = values[index];
  });
  row.email = row.email || row['宛先メール'] || row['メール'];
  row.contactEmail = row.contactEmail || row['連絡先メール'];
  row.name = row.name || row['店舗名'];
  return { row, rowIndex };
}

function verifyReservationPersisted_(row, expected) {
  const ok = String(row.sendState || '') === GMAIL_SEND_STATE.reserved &&
    String(row.sendRunId || '') === expected.runId &&
    String(row.approvedCandidateDigest || '') === expected.digest;
  return {
    ok,
    blockedReason: ok ? '' : 'send_reservation_not_persisted'
  };
}

function ensureSendStateColumns_(config) {
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value));
  const missing = GMAIL_SEND_STATE_COLUMNS.filter((column) => header.indexOf(column) === -1);
  if (missing.length === 0) {
    return;
  }
  sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
  SpreadsheetApp.flush();
}

function computeCandidateDigest_(row, targetDate, batchId) {
  return sha256Hex_(buildCandidateDigestInput_(row, targetDate, batchId).join('\n'));
}

function buildCandidateDigestInput_(row, targetDate, batchId) {
  const candidateId = String(row.prospectId || row.dedupeKey || '').trim().toLowerCase();
  return [
    normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']),
    normalizeEmailSubject_(row.subject || row['件名']),
    normalizeEmailBody_(row.body || row['本文']),
    candidateId,
    normalizeDateText_(targetDate),
    String(batchId || '').trim()
  ];
}

function sha256Hex_(value) {
  const charset = Utilities.Charset && Utilities.Charset.UTF_8;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), charset);
  return digest.map((byte) => {
    const normalized = byte & 0xff;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function sourceDomainFromRow_(row) {
  const raw = String(row.sourceUrl || row.publicSource || row.source || '').trim().toLowerCase();
  const match = raw.match(/^https?:\/\/([^\/?#]+)/);
  return match ? match[1].replace(/^www\./, '') : String(row.sourceDomain || '').trim().toLowerCase();
}

function businessFingerprintFromRow_(row) {
  return hashValue_(sourceDomainFromRow_(row) + '|' + normalizeTextForComparison_(row.name || row['店舗名']));
}

function buildSendRunId_(targetDate) {
  return 'gmail-sales-send-' + normalizeDateText_(targetDate) + '-' + Utilities.getUuid();
}

function safeErrorCode_(error) {
  const text = String(error && error.message ? error.message : 'send_failed').toLowerCase();
  if (text.indexOf('quota') !== -1) return 'quota_error';
  if (text.indexOf('permission') !== -1 || text.indexOf('auth') !== -1) return 'permission_error';
  if (text.indexOf('reservation') !== -1) return 'reservation_error';
  return 'send_error';
}

function uniqueArray_(values) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function scanGmailRepliesJob() {
  const config = getConfig_();
  Object.keys(LABELS).forEach((key) => createOrGetLabel_(LABELS[key]));

  const threads = GmailApp.search('newer_than:14d -label:"' + LABELS.processed + '"');
  const processedLabel = createOrGetLabel_(LABELS.processed);

  threads.forEach((thread) => {
    const messages = thread.getMessages();
    const latest = messages[messages.length - 1];
    const subject = latest.getSubject() || '';
    const body = latest.getPlainBody() || '';
    const classification = classifyReply_(subject, body);

    applyReplyLabel_(thread, classification);
    maybeSendAutoReply_(thread, classification, config);
    processedLabel.addToThread(thread);

    appendLog_({
      event: 'reply_classified',
      classification,
      threadHash: hashValue_(thread.getId())
    });
  });
}

function setupReplyCheckTriggers() {
  const triggerSpecs = [
    { handler: 'runScheduledGmailReplyCheck', hour: 9 },
    { handler: 'runScheduledGmailReplyCheck', hour: 12 },
    { handler: 'runScheduledGmailReplyCheck', hour: 17 }
  ];

  triggerSpecs.forEach((spec) => {
    if (hasTrigger_(spec.handler)) {
      appendReplyCheckSafeLog_({ event: 'reply_check_trigger_exists', handler: spec.handler });
      return;
    }
    ScriptApp.newTrigger(spec.handler).timeBased().everyDays(1).atHour(spec.hour).create();
    appendReplyCheckSafeLog_({ event: 'reply_check_trigger_created', handler: spec.handler, hour: spec.hour });
  });
}

function removeReplyCheckTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'runScheduledGmailReplyCheck') {
      ScriptApp.deleteTrigger(trigger);
      appendReplyCheckSafeLog_({ event: 'reply_check_trigger_removed' });
    }
  });
}

function runGmailReplyCheckOnly() {
  const summary = checkRepliesForSentRows_();
  appendReplyCheckSafeLog_(Object.assign({ event: 'reply_check_only' }, summary));
  updateReplyCheckAgentStatus_(summary);
  return summary;
}

function runScheduledGmailReplyCheck() {
  const summary = checkRepliesForSentRows_();
  appendReplyCheckSafeLog_(Object.assign({ event: 'scheduled_reply_check' }, summary));
  updateReplyCheckAgentStatus_(summary);
  return summary;
}

function checkRepliesForSentRows_() {
  const config = getConfig_();
  const rows = loadCandidateRows_(config);
  const summary = buildReplyCheckSummary_();

  rows.forEach((item) => {
    const row = item.row;
    const sentStatus = String(row.sentStatus || row.status || '').toLowerCase();
    if (!includesAny_(sentStatus, ['送信済', 'sent'])) {
      return;
    }

    summary.sentRowsChecked += 1;
    const signal = findReplySignalsForRow_(row);
    updateReplyStatusForRow_(config, item.rowIndex, signal);

    if (signal.replied) {
      summary.repliedCount += 1;
    }
    if (signal.status === 'handled') {
      summary.handledReplyCount += 1;
    }
    if (signal.unreadReplyCount > 0) {
      summary.unreadReplyCount += signal.unreadReplyCount;
    }
    if (signal.needsHumanEmailCheck) {
      summary.needsHumanReviewCount += 1;
      summary.needsHumanEmailCheck = true;
    }
    if (signal.status === 'bounced') {
      summary.bouncedCount += 1;
    }
    if (signal.status === 'unknown') {
      summary.unknownCount += 1;
    }
  });

  summary.lastReplyCheckAt = new Date().toISOString();
  summary.nextReplyCheckAt = nextReplyCheckAt_();
  return summary;
}

function findReplySignalsForRow_(row) {
  const handledAt = String(row.humanHandledAt || '').trim();
  const handledStatus = String(row.humanHandledStatus || '').trim();
  if (handledAt || handledStatus === 'handled') {
    return {
      status: 'handled',
      replied: true,
      unreadReplyCount: 0,
      replyCount: Number(row.replyCount || 0),
      needsHumanEmailCheck: false
    };
  }

  try {
    const threads = findReplyThreadsForRow_(row);
    let replyCount = 0;
    let unreadReplyCount = 0;
    let bounced = false;
    const sentAt = parseDateOrNull_(row.sentAt);

    threads.forEach((thread) => {
      thread.getMessages().forEach((message) => {
        const messageDate = message.getDate();
        if (sentAt && messageDate <= sentAt) {
          return;
        }
        if (typeof message.isDraft === 'function' && message.isDraft()) {
          return;
        }
        const subject = message.getSubject() || '';
        const body = message.getPlainBody() || '';
        const classification = classifyReply_(subject, body);
        if (classification === CLASSIFICATION.bounce) {
          bounced = true;
        }
        replyCount += 1;
        if (message.isUnread()) {
          unreadReplyCount += 1;
        }
      });
    });

    if (bounced) {
      return {
        status: 'bounced',
        replied: true,
        unreadReplyCount,
        replyCount,
        needsHumanEmailCheck: true
      };
    }

    if (unreadReplyCount > 0) {
      return {
        status: 'unread_reply',
        replied: true,
        unreadReplyCount,
        replyCount,
        needsHumanEmailCheck: true
      };
    }

    if (replyCount > 0) {
      return {
        status: 'needs_human_review',
        replied: true,
        unreadReplyCount,
        replyCount,
        needsHumanEmailCheck: true
      };
    }

    return {
      status: 'none',
      replied: false,
      unreadReplyCount: 0,
      replyCount: 0,
      needsHumanEmailCheck: false
    };
  } catch (error) {
    return {
      status: 'unknown',
      replied: false,
      unreadReplyCount: 0,
      replyCount: 0,
      needsHumanEmailCheck: true
    };
  }
}

function findReplyThreadsForRow_(row) {
  const threadId = String(row.gmailThreadId || '').trim();
  if (threadId) {
    try {
      return [GmailApp.getThreadById(threadId)].filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  const subject = String(row.subject || row['件名'] || '').trim();
  if (!subject) {
    return [];
  }

  const sentAt = parseDateOrNull_(row.sentAt);
  const dateText = sentAt
    ? Utilities.formatDate(sentAt, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd')
    : Utilities.formatDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd');
  const query = 'subject:"' + escapeGmailSearchText_(subject) + '" after:' + dateText;
  return GmailApp.search(query, 0, 10);
}

function updateReplyStatusForRow_(config, rowIndex, replySignal) {
  const now = new Date().toISOString();
  markSheetRow_(config, rowIndex, {
    replyStatus: replySignal.status,
    replyDetectedAt: replySignal.replied ? now : '',
    unreadReplyCount: replySignal.unreadReplyCount,
    replyCount: replySignal.replyCount,
    lastReplyCheckedAt: now,
    needsHumanEmailCheck: replySignal.needsHumanEmailCheck,
    replyCheckNotes: replySignal.needsHumanEmailCheck ? 'human_check_required' : 'no_reply_action_required'
  });
}

function buildReplyCheckSummary_() {
  return {
    sentRowsChecked: 0,
    repliedCount: 0,
    unreadReplyCount: 0,
    needsHumanReviewCount: 0,
    handledReplyCount: 0,
    bouncedCount: 0,
    unknownCount: 0,
    needsHumanEmailCheck: false,
    autoReplyEnabled: false,
    lastReplyCheckAt: '',
    nextReplyCheckAt: ''
  };
}

function appendReplyCheckSafeLog_(summary) {
  appendSafeLog_({
    event: summary.event || 'reply_check_summary',
    sentRowsChecked: summary.sentRowsChecked,
    repliedCount: summary.repliedCount,
    unreadReplyCount: summary.unreadReplyCount,
    needsHumanReviewCount: summary.needsHumanReviewCount,
    bouncedCount: summary.bouncedCount,
    unknownCount: summary.unknownCount,
    needsHumanEmailCheck: summary.needsHumanEmailCheck,
    autoReplyEnabled: false,
    lastReplyCheckAt: summary.lastReplyCheckAt,
    nextReplyCheckAt: summary.nextReplyCheckAt
  });
}

function updateReplyCheckAgentStatus_(summary) {
  appendSafeLog_({
    event: 'reply_check_agent_status_planned',
    status: summary.needsHumanEmailCheck ? 'needs_review' : 'success',
    repliedCount: summary.repliedCount,
    unreadReplyCount: summary.unreadReplyCount,
    needsHumanEmailCheck: summary.needsHumanEmailCheck,
    autoReplyEnabled: false
  });
}

function classifyReply_(subject, body) {
  const text = String(subject + ' ' + body).toLowerCase();

  if (includesAny_(text, ['配信停止', '今後不要', '送らないで', '不要です', '連絡不要'])) {
    return CLASSIFICATION.unsubscribe;
  }
  if (includesAny_(text, ['迷惑', '不快', '通報', '営業禁止'])) {
    return CLASSIFICATION.complaint;
  }
  if (includesAny_(text, ['delivery', 'undelivered', 'returned mail', 'mail delivery', 'failure notice', '宛先不明', '配信不能'])) {
    return CLASSIFICATION.bounce;
  }
  if (includesAny_(text, ['自動応答', '不在', 'out of office', 'auto reply', 'automatic reply'])) {
    return CLASSIFICATION.autoReply;
  }
  if (includesAny_(text, ['資料', '概要', '送って', 'ください'])) {
    return CLASSIFICATION.requestInfo;
  }
  if (includesAny_(text, ['興味', '詳しく', '話を聞', '診断希望', 'お願いします'])) {
    return CLASSIFICATION.interested;
  }
  if (includesAny_(text, ['結構です', '不要', '必要ありません'])) {
    return CLASSIFICATION.notInterested;
  }

  return CLASSIFICATION.needsHuman;
}

function maybeSendAutoReply_(thread, classification, config) {
  if (!config.liveSendEnabled || config.dryRun) {
    appendLog_({ event: 'auto_reply_planned_only', classification, threadHash: hashValue_(thread.getId()) });
    return;
  }

  if (classification !== CLASSIFICATION.interested && classification !== CLASSIFICATION.requestInfo) {
    appendLog_({ event: 'auto_reply_skipped', classification, threadHash: hashValue_(thread.getId()) });
    return;
  }

  const row = {};
  const message = classification === CLASSIFICATION.interested
    ? buildInterestedAutoReply_(row)
    : buildInfoRequestAutoReply_(row);

  thread.reply(message.body);
  createOrGetLabel_(LABELS.autoReply).addToThread(thread);
  appendLog_({ event: 'auto_reply_sent', classification, threadHash: hashValue_(thread.getId()) });
}

function buildInitialSalesEmail_(row) {
  const subject = normalizeEmailSubject_(row.subject || row['件名']);
  const body = normalizeEmailBody_(row.body || row['本文']);
  if (subject && body) {
    return { subject, body };
  }

  const storeName = row.name || row['店舗名'] || 'ご担当者';
  const signature = getConfig_().replySignature;
  return {
    subject: normalizeEmailSubject_('SNSの見え方について、簡単な無料確認のご案内'),
    body: normalizeEmailBody_(
      storeName + ' さま\n\n' +
      '突然のご連絡失礼いたします。\n' +
      'ICHI Socialです。\n\n' +
      '小規模店舗さま向けに、Instagramプロフィールや予約導線の見え方を整理するSNS運用サポートを行っています。\n\n' +
      'もしよろしければ、現在のSNSについて「初めて見る方に何のお店か伝わるか」「予約や問い合わせまで迷わず進めるか」を無料で簡単に確認できます。\n\n' +
      'ご興味があれば、このメールに「診断希望」とだけご返信ください。\n\n' +
      '今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\n' +
      signature
    )
  };
}

function buildFollowupEmail_(row) {
  const storeName = row.name || row['店舗名'] || 'ご担当者';
  return {
    subject: normalizeEmailSubject_('SNSプロフィール確認の件'),
    body: normalizeEmailBody_(
      storeName + ' さま\n\n' +
      '先日、SNSの見え方確認についてご案内したICHI Socialです。\n\n' +
      '必要なタイミングがあれば、プロフィールや固定投稿の見え方を簡単に確認できます。\n\n' +
      'ご不要でしたら返信不要です。今後のご案内を控えてほしい場合は、その旨だけご返信ください。\n\n' +
      getConfig_().replySignature
    )
  };
}

function buildInterestedAutoReply_(row) {
  return {
    subject: normalizeEmailSubject_('Re: SNS診断の件'),
    body: normalizeEmailBody_(
      'ご返信ありがとうございます。\n\n' +
      '無料SNS診断では、プロフィール、固定投稿、予約導線、投稿テーマの見え方を中心に確認します。\n\n' +
      'まずは公開されているSNSを拝見し、簡単な診断メモをお送りします。\n\n' +
      getConfig_().replySignature
    )
  };
}

function buildInfoRequestAutoReply_(row) {
  return {
    subject: normalizeEmailSubject_('Re: 資料のご希望について'),
    body: normalizeEmailBody_(
      'ご返信ありがとうございます。\n\n' +
      'ICHI Socialでは、小規模店舗向けにSNSの伝わり方、投稿テーマ、予約導線の整理を支援しています。\n\n' +
      '概要を確認し、必要に応じて人間担当から詳細をご案内します。\n\n' +
      getConfig_().replySignature
    )
  };
}

function markSheetRow_(config, rowIndex, updates) {
  if (!config.sheetId || !config.sheetName || !rowIndex) {
    appendLog_({ event: 'sheet_mark_skipped', reason: 'missing_sheet_config' });
    return;
  }

  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  if (!sheet) {
    appendLog_({ event: 'sheet_mark_skipped', reason: 'sheet_not_found' });
    return;
  }

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(updates).forEach((key) => {
    const columnIndex = header.indexOf(key) + 1;
    if (columnIndex > 0) {
      sheet.getRange(rowIndex, columnIndex).setValue(updates[key]);
    }
  });
}

function appendLog_(event) {
  appendSafeLog_(event);
}

function appendSafeLog_(event) {
  const safe = Object.assign({ at: new Date().toISOString() }, event);
  delete safe.email;
  delete safe.contactEmail;
  delete safe.body;
  delete safe.messageBody;
  delete safe.sheetId;
  delete safe.outboxRows;
  delete safe.token;
  delete safe.webhookUrl;
  delete safe.url;
  delete safe.payload;
  delete safe.rows;
  delete safe.headers;
  delete safe.candidateDigest;
  delete safe.approvedCandidateDigest;
  delete safe.approvedSendManifestJson;
  delete safe.manifest;
  delete safe.manifestForInternalUse;
  delete safe.runtimeCandidateDigestForInternalUse;
  delete safe.runtimeCandidateContentHashForInternalUse;
  delete safe.query;
  Logger.log(JSON.stringify(safe));
}

function resolveDailySendContext_(props) {
  const timezone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const currentJstDate = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  const prefix = props.getProperty('SEND_BATCH_ID_PREFIX') || 'gmail-sales';
  const rawSendDate = String(props.getProperty('SEND_DATE') || '').trim();
  const rawBatchId = String(props.getProperty('SEND_BATCH_ID') || '').trim();
  const allowStaleDateOverride = props.getProperty('SEND_DATE_OVERRIDE') === 'true';
  const allowStaleBatchOverride = props.getProperty('SEND_BATCH_ID_OVERRIDE') === 'true';
  const normalizedRawDate = normalizeDateText_(rawSendDate);
  const staleSendDate = Boolean(normalizedRawDate && normalizedRawDate !== currentJstDate);
  let sendDate = currentJstDate;
  let sendDateSource = 'auto_today_jst';
  let usingStaleSendDate = false;

  if (normalizedRawDate) {
    if (!staleSendDate) {
      sendDate = normalizedRawDate;
      sendDateSource = 'script_property';
    } else if (allowStaleDateOverride) {
      sendDate = normalizedRawDate;
      sendDateSource = 'override';
      usingStaleSendDate = true;
    }
  }

  const batchDateMatch = rawBatchId.match(/\d{4}-\d{2}-\d{2}/);
  const batchDate = batchDateMatch ? batchDateMatch[0] : '';
  const staleBatchId = Boolean(batchDate && batchDate !== sendDate);
  let sendBatchId = prefix + '-' + sendDate;
  let sendBatchIdSource = 'auto_daily';
  let usingStaleBatchId = false;

  if (rawBatchId) {
    if (batchDate) {
      if (!staleBatchId) {
        sendBatchId = rawBatchId;
        sendBatchIdSource = 'script_property';
      } else if (allowStaleBatchOverride) {
        sendBatchId = rawBatchId;
        sendBatchIdSource = 'override';
        usingStaleBatchId = true;
      }
    } else if (rawBatchId === prefix) {
      sendBatchId = rawBatchId + '-' + sendDate;
      sendBatchIdSource = 'auto_daily';
    } else if (allowStaleBatchOverride) {
      sendBatchId = rawBatchId;
      sendBatchIdSource = 'override';
    } else {
      sendBatchId = rawBatchId + '-' + sendDate;
      sendBatchIdSource = 'auto_daily';
    }
  }

  return {
    currentJstDate,
    sendDate,
    sendBatchId,
    sendDateSource,
    sendBatchIdSource,
    staleSendDate,
    staleBatchId,
    usingStaleSendDate,
    usingStaleBatchId
  };
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const dailyLimit = Number(props.getProperty('DAILY_SEND_LIMIT') || '30');
  const sendContext = resolveDailySendContext_(props);
  const sendWindowStart = parseTimeText_(props.getProperty(GMAIL_SALES_SEND_WINDOW_START_PROPERTY));
  const sendWindowEnd = parseTimeText_(props.getProperty(GMAIL_SALES_SEND_WINDOW_END_PROPERTY));
  return {
    sheetId: props.getProperty('SHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME') || 'sales',
    recoverySheetName: props.getProperty('GMAIL_SHEET_RECOVERY_TAB_NAME') || '',
    dryRun: props.getProperty('DRY_RUN') !== 'false',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
    autoResetLiveSendAfterRun: props.getProperty('AUTO_RESET_LIVE_SEND_AFTER_RUN') !== 'false',
    dailySendLimit: Math.min(Number.isFinite(dailyLimit) ? dailyLimit : 30, 30),
    preflightHour: normalizeHour_(props.getProperty('PREFLIGHT_HOUR'), 11),
    sendHour: normalizeHour_(props.getProperty('SEND_HOUR'), 12),
    postSendCheckHour: normalizeHour_(props.getProperty('POST_SEND_CHECK_HOUR'), 12),
    allowedSendStartHour: normalizeHour_(props.getProperty('ALLOWED_SEND_START_HOUR'), sendWindowStart ? sendWindowStart.hour : 11),
    allowedSendStartMinute: normalizeMinute_(props.getProperty('ALLOWED_SEND_START_MINUTE'), sendWindowStart ? sendWindowStart.minute : 55),
    allowedSendEndHour: normalizeHour_(props.getProperty('ALLOWED_SEND_END_HOUR'), sendWindowEnd ? sendWindowEnd.hour : 12),
    allowedSendEndMinute: normalizeMinute_(props.getProperty('ALLOWED_SEND_END_MINUTE'), sendWindowEnd ? sendWindowEnd.minute : 15),
    sendBatchIdPrefix: props.getProperty('SEND_BATCH_ID_PREFIX') || 'gmail-sales',
    sendBatchId: sendContext.sendBatchId,
    currentJstDate: sendContext.currentJstDate,
    sendDateSource: sendContext.sendDateSource,
    sendBatchIdSource: sendContext.sendBatchIdSource,
    staleSendDate: sendContext.staleSendDate,
    staleBatchId: sendContext.staleBatchId,
    usingStaleSendDate: sendContext.usingStaleSendDate,
    usingStaleBatchId: sendContext.usingStaleBatchId,
    requireExactReadyCount: props.getProperty('REQUIRE_EXACT_READY_COUNT') !== 'false',
    requireOptOutText: props.getProperty('REQUIRE_OPT_OUT_TEXT') !== 'false',
    requireUniqueBatch: props.getProperty('REQUIRE_UNIQUE_BATCH') !== 'false',
    requireExplicitBatchApproval: props.getProperty('REQUIRE_EXPLICIT_BATCH_APPROVAL') !== 'false',
    approvedBatchId: String(props.getProperty('APPROVED_BATCH_ID') || '').trim(),
    approvedBatchChecksum: String(props.getProperty('APPROVED_BATCH_CHECKSUM') || '').trim(),
    approvedSendManifestJson: String(props.getProperty('APPROVED_SEND_MANIFEST_JSON') || '').trim(),
    approvalExpiresAt: String(props.getProperty('APPROVAL_EXPIRES_AT') || '').trim(),
    runtimeMaxSendCount: normalizePositiveInt_(props.getProperty('GMAIL_SEND_MAX_SEND_COUNT'), GMAIL_SEND_DEFAULT_MAX_SEND_COUNT, GMAIL_SEND_SAFE_MAX_SEND_COUNT),
    maxSendAttempts: normalizeMaxSendAttempts_(props.getProperty('GMAIL_SEND_MAX_ATTEMPTS')),
    maxFailuresBeforeStop: Math.max(1, Number(props.getProperty('MAX_FAILURES_BEFORE_STOP') || '1')),
    sendDate: sendContext.sendDate,
    nextActionDate: props.getProperty('NEXT_ACTION_DATE') || '',
    fromName: props.getProperty('FROM_NAME') || 'ICHI Social',
    replySignature: props.getProperty('REPLY_SIGNATURE') || 'ICHI Social',
    createTriggers: props.getProperty('CREATE_TRIGGERS') || 'false'
  };
}

function assertSafeToSend_(row) {
  const email = normalizeEmail_(row.email || row['宛先メール']);
  if (!email) {
    throw new Error('Recipient email is missing.');
  }
  if (shouldSkipRecipient_(row)) {
    throw new Error('Recipient is not safe to send.');
  }
}

function validateProductionConfig_() {
  const config = getConfig_();
  const errors = [];

  if (!config.sheetId || !config.sheetName) {
    errors.push('missing_sheet_config');
  }
  if (config.dailySendLimit > 30) {
    errors.push('daily_limit_exceeds_30');
  }
  if (config.dailySendLimit !== 30) {
    errors.push('daily_limit_must_be_30');
  }
  if (!verifyNoSensitiveLogging_()) {
    errors.push('unsafe_logging');
  }

  return { config, errors };
}

function confirmDryRunMode_() {
  return getConfig_().dryRun;
}

function confirmLiveSendEnabled_() {
  return getConfig_().liveSendEnabled;
}

function getRemainingGmailQuota_() {
  return MailApp.getRemainingDailyQuota();
}

function validateOutboxRows_(items, config) {
  const sentEmails = loadKnownSentEmails_(config);
  const seenEmails = {};
  const seenBusiness = {};
  const batchId = buildSendBatchId_(config.sendDate);
  const readyRows = [];
  const skipped = [];
  const errors = [];

  items.forEach((item) => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const businessName = String(row.name || row['店舗名'] || '').trim().toLowerCase();
    const rowStatus = String(row.status || '').toLowerCase();
    const rowSendDate = normalizeDateText_(row.sendDate || row['送信日']);
    const rowBatchId = String(row.sendBatchId || '').trim();
    const subject = normalizeEmailSubject_(row.subject || row['件名']);
    const body = normalizeEmailBody_(row.body || row['本文']);

    if (rowStatus !== 'ready') {
      skipped.push({ rowIndex, reason: 'not_ready_status' });
      return;
    }
    if (rowSendDate !== config.sendDate) {
      skipped.push({ rowIndex, reason: 'send_date_mismatch' });
      return;
    }
    if (!rowBatchId || rowBatchId !== batchId) {
      errors.push({ rowIndex, reason: 'send_batch_id_mismatch' });
      return;
    }
    if (!subject || !body) {
      errors.push({ rowIndex, reason: 'missing_subject_or_body' });
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ rowIndex, reason: 'invalid_email' });
      return;
    }
    if (sentEmails[email]) {
      skipped.push({ rowIndex, reason: 'previously_sent' });
      return;
    }
    if (seenEmails[email]) {
      errors.push({ rowIndex, reason: 'duplicate_email' });
      return;
    }
    if (businessName && seenBusiness[businessName]) {
      errors.push({ rowIndex, reason: 'duplicate_business' });
      return;
    }
    if (shouldSkipRecipient_(row)) {
      skipped.push({ rowIndex, reason: 'status_excluded' });
      return;
    }

    const message = buildInitialSalesEmail_(row);
    try {
      assertMessageSafe_(message);
      assertRecipientPersonalizationSafe_(row, message);
    } catch (error) {
      errors.push({ rowIndex, reason: error.message });
      return;
    }

    seenEmails[email] = true;
    if (businessName) {
      seenBusiness[businessName] = true;
    }
    readyRows.push(item);
  });

  return { readyRows, skipped, errors };
}

function buildPreflightDiagnosticsSummary_(items, config, batchId) {
  const seenEmails = {};
  const seenBusiness = {};
  let sentEmails = {};
  try {
    sentEmails = loadKnownSentEmails_(config);
  } catch (error) {
    sentEmails = {};
  }
  const summary = {
    totalRows: items.length,
    candidateRows: 0,
    readyRows: 0,
    missingEmailCount: 0,
    invalidEmailCount: 0,
    missingSubjectCount: 0,
    missingBodyCount: 0,
    missingOptOutTextCount: 0,
    statusMismatchCount: 0,
    sendDateMismatchCount: 0,
    sendBatchIdMismatchCount: 0,
    duplicateInSheetCount: 0,
    duplicateBusinessCount: 0,
    excludedStatusCount: 0,
    previouslySentCount: 0,
    validationErrorCount: 0,
    validationErrorRowNumbers: [],
    validationErrorReasonCounts: {},
    validationErrorReasonSamples: [],
    prohibitedExpressionCount: 0,
    bodyLengthErrorCount: 0,
    subjectLengthErrorCount: 0,
    optOutPatternMismatchCount: 0,
    unknownValidationErrorCount: 0,
    malformedRowCount: 0,
    requiredFieldWhitespaceOnlyCount: 0,
    escapedNewlineBodyCount: 0,
    escapedNewlineSubjectCount: 0,
    bodyNormalizedCount: 0,
    subjectNormalizedCount: 0,
    expectedBodyWouldContainLiteralBackslashN: false
  };

  items.forEach((item) => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const businessName = String(row.name || row['店舗名'] || '').trim().toLowerCase();
    const rowStatus = String(row.status || '').toLowerCase();
    const rowSendDate = normalizeDateText_(row.sendDate || row['送信日']);
    const rowBatchId = String(row.sendBatchId || '').trim();
    const rawSubject = String(row.subject || row['件名'] || '');
    const rawBody = String(row.body || row['本文'] || '');
    const subject = normalizeEmailSubject_(rawSubject);
    const body = normalizeEmailBody_(rawBody);
    const isCandidate = rowStatus === 'ready' || rowSendDate === config.sendDate || rowBatchId === batchId;
    const escapedSubject = hasEscapedNewline_(rawSubject);
    const escapedBody = hasEscapedNewline_(rawBody);
    if (escapedSubject) {
      summary.escapedNewlineSubjectCount += 1;
    }
    if (escapedBody) {
      summary.escapedNewlineBodyCount += 1;
    }
    if (subject !== String(rawSubject || '').trim()) {
      summary.subjectNormalizedCount += 1;
    }
    if (body !== String(rawBody || '').trim()) {
      summary.bodyNormalizedCount += 1;
    }

    if (isCandidate) {
      summary.candidateRows += 1;
    }
    if (rowStatus !== 'ready') {
      summary.statusMismatchCount += 1;
      return;
    }
    if (rowSendDate !== config.sendDate) {
      summary.sendDateMismatchCount += 1;
      return;
    }
    if (!rowBatchId || rowBatchId !== batchId) {
      summary.sendBatchIdMismatchCount += 1;
      recordPreflightValidationError_(summary, rowIndex, 'SEND_BATCH_ID_MISMATCH');
      return;
    }
    if (!subject) {
      summary.missingSubjectCount += 1;
    }
    if (!body) {
      summary.missingBodyCount += 1;
    }
    if (!subject || !body) {
      const reason = (rawSubject || rawBody) ? 'REQUIRED_FIELD_WHITESPACE_ONLY' : 'MISSING_SUBJECT_OR_BODY';
      recordPreflightValidationError_(summary, rowIndex, reason);
      return;
    }
    if (!email) {
      summary.missingEmailCount += 1;
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      summary.invalidEmailCount += 1;
      return;
    } else if (sentEmails[email]) {
      summary.previouslySentCount += 1;
      return;
    } else if (seenEmails[email]) {
      summary.duplicateInSheetCount += 1;
      recordPreflightValidationError_(summary, rowIndex, 'DUPLICATE_EMAIL');
      return;
    }
    if (businessName && seenBusiness[businessName]) {
      summary.duplicateBusinessCount += 1;
      recordPreflightValidationError_(summary, rowIndex, 'DUPLICATE_BUSINESS');
      return;
    }
    if (shouldSkipRecipient_(row)) {
      summary.excludedStatusCount += 1;
      return;
    }
    try {
      assertMessageSafe_(buildInitialSalesEmail_(row));
    } catch (error) {
      if (String(error.message) === 'missing_opt_out_text') {
        summary.missingOptOutTextCount += 1;
      }
      recordPreflightValidationError_(summary, rowIndex, classifyPreflightValidationError_(error));
      return;
    }
    summary.readyRows += 1;
    if (email) {
      seenEmails[email] = true;
    }
    if (businessName) {
      seenBusiness[businessName] = true;
    }
  });

  return summary;
}

function recordPreflightValidationError_(summary, rowIndex, reasonCode) {
  const reason = String(reasonCode || 'UNKNOWN_VALIDATION_ERROR');
  summary.validationErrorCount += 1;
  if (rowIndex) {
    summary.validationErrorRowNumbers.push(rowIndex);
  }
  summary.validationErrorReasonCounts[reason] = (summary.validationErrorReasonCounts[reason] || 0) + 1;
  if (summary.validationErrorReasonSamples.indexOf(reason) === -1) {
    summary.validationErrorReasonSamples.push(reason);
  }

  if (reason === 'PROHIBITED_EXPRESSION') {
    summary.prohibitedExpressionCount += 1;
  } else if (reason === 'BODY_LENGTH_ERROR') {
    summary.bodyLengthErrorCount += 1;
  } else if (reason === 'SUBJECT_LENGTH_ERROR') {
    summary.subjectLengthErrorCount += 1;
  } else if (reason === 'OPT_OUT_PATTERN_MISMATCH') {
    summary.optOutPatternMismatchCount += 1;
  } else if (reason === 'REQUIRED_FIELD_WHITESPACE_ONLY') {
    summary.requiredFieldWhitespaceOnlyCount += 1;
  } else if (reason === 'MALFORMED_ROW') {
    summary.malformedRowCount += 1;
  } else if (reason === 'UNKNOWN_VALIDATION_ERROR') {
    summary.unknownValidationErrorCount += 1;
  }
}

function classifyPreflightValidationError_(error) {
  const message = String((error && error.message) || '');
  if (message === 'missing_opt_out_text') {
    return 'OPT_OUT_PATTERN_MISMATCH';
  }
  if (message === 'guaranteed_result_expression') {
    return 'PROHIBITED_EXPRESSION';
  }
  return 'UNKNOWN_VALIDATION_ERROR';
}

function verifyNoSensitiveLogging_() {
  return true;
}

function acquireSheetMaintenanceLease_(config, options) {
  const settings = options || {};
  if (settings.dryRun) {
    return {
      ok: true,
      dryRun: true,
      lockName: GMAIL_SALES_SHEET_MAINTENANCE_LOCK,
      holderType: settings.holderType || '',
      holderId: settings.holderId || ''
    };
  }
  if (!config || !config.sheetId) {
    return { ok: false, blockedReason: 'maintenance_lease_missing_sheet_id' };
  }

  const holderType = String(settings.holderType || '').trim();
  const holderId = String(settings.holderId || '').trim();
  if (!holderType || !holderId) {
    return { ok: false, blockedReason: 'maintenance_lease_missing_holder' };
  }

  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheetName = getMaintenanceSheetName_();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length) {
    return { ok: false, blockedReason: 'maintenance_sheet_missing' };
  }

  const headers = sheet.getRange(1, 1, 1, GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length).getValues()[0].map((value) => String(value));
  if (!maintenanceHeadersValid_(headers)) {
    return { ok: false, blockedReason: 'maintenance_sheet_header_invalid' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + GMAIL_SALES_SHEET_MAINTENANCE_LEASE_MS);
  const values = sheet.getDataRange().getValues();
  let rowIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0] || '') === GMAIL_SALES_SHEET_MAINTENANCE_LOCK) {
      rowIndex = index + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    const current = values[rowIndex - 1];
    const currentHolderId = String(current[2] || '');
    const currentExpiresAt = parseIsoDate_(current[4]);
    if (!currentExpiresAt) {
      return { ok: false, blockedReason: 'maintenance_lease_expiry_invalid' };
    }
    if (currentExpiresAt.getTime() > now.getTime() && currentHolderId && currentHolderId !== holderId) {
      return { ok: false, blockedReason: 'maintenance_lease_held' };
    }
  } else {
    rowIndex = Math.max(2, sheet.getLastRow() + 1);
  }

  sheet.getRange(rowIndex, 1, 1, GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length).setValues([[
    GMAIL_SALES_SHEET_MAINTENANCE_LOCK,
    holderType,
    holderId,
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString(),
    '1'
  ]]);
  SpreadsheetApp.flush();

  const reread = sheet.getRange(rowIndex, 1, 1, GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length).getValues()[0];
  if (String(reread[0] || '') !== GMAIL_SALES_SHEET_MAINTENANCE_LOCK ||
    String(reread[1] || '') !== holderType ||
    String(reread[2] || '') !== holderId) {
    return { ok: false, blockedReason: 'maintenance_lease_owner_verification_failed' };
  }
  const rereadExpiresAt = parseIsoDate_(reread[4]);
  if (!rereadExpiresAt || rereadExpiresAt.getTime() <= now.getTime()) {
    return { ok: false, blockedReason: 'maintenance_lease_expiry_invalid' };
  }

  return {
    ok: true,
    dryRun: false,
    sheetName,
    rowIndex,
    lockName: GMAIL_SALES_SHEET_MAINTENANCE_LOCK,
    holderType,
    holderId
  };
}

function releaseSheetMaintenanceLease_(config, lease) {
  try {
    if (!lease || !lease.ok || lease.dryRun || !config || !config.sheetId) {
      return;
    }
    const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(lease.sheetName || getMaintenanceSheetName_());
    if (!sheet || !lease.rowIndex) {
      return;
    }
    const current = sheet.getRange(lease.rowIndex, 1, 1, GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length).getValues()[0];
    if (String(current[0] || '') !== GMAIL_SALES_SHEET_MAINTENANCE_LOCK || String(current[2] || '') !== lease.holderId) {
      return;
    }
    sheet.getRange(lease.rowIndex, 1, 1, GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.length).setValues([[
      GMAIL_SALES_SHEET_MAINTENANCE_LOCK,
      '',
      '',
      '',
      new Date(Date.now() - 1000).toISOString(),
      '',
      '1'
    ]]);
    SpreadsheetApp.flush();
  } catch (error) {
    appendSafeLog_({ event: 'maintenance_lease_release_failed', reason: safeErrorCode_(error) });
  }
}

function getMaintenanceSheetName_() {
  return String(PropertiesService.getScriptProperties().getProperty('GMAIL_MAINTENANCE_SHEET_NAME') || GMAIL_SALES_SHEET_MAINTENANCE_SHEET);
}

function maintenanceHeadersValid_(headers) {
  return GMAIL_SALES_SHEET_MAINTENANCE_HEADERS.every((header, index) => String(headers[index] || '') === header);
}

function parseIsoDate_(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function updateSheetAfterSend_(config, rowIndex, updates) {
  ensureSendStateColumns_(config);
  markSheetRow_(config, rowIndex, updates);
}

function runPreflight_(forSend) {
  const production = validateProductionConfig_();
  const config = production.config;
  const batchId = buildSendBatchId_(config.sendDate);
  let remainingQuota = 0;
  let sheetConnected = false;
  let rows = [];
  let validation = { readyRows: [], errors: [] };
  const blockedReasons = production.errors.slice();

  try {
    remainingQuota = getRemainingGmailQuota_();
  } catch (error) {
    blockedReasons.push('quota_check_failed');
  }

  try {
    rows = loadCandidateRows_(config);
    sheetConnected = Boolean(config.sheetId && config.sheetName);
    validation = validateOutboxRows_(rows, config);
  } catch (error) {
    blockedReasons.push('sheet_or_outbox_load_failed');
  }

  const targetCount = Math.min(config.dailySendLimit, 30);
  const readyCount = validation.readyRows.length;

  if (validation.errors.length > 0) {
    blockedReasons.push('outbox_validation_errors');
  }
  if (readyCount === 0) {
    blockedReasons.push('no_ready_rows');
  }
  if (config.requireExactReadyCount && readyCount !== targetCount) {
    blockedReasons.push('exact_ready_count_not_met');
  } else if (readyCount > targetCount) {
    blockedReasons.push('ready_count_exceeds_limit');
  }
  if (remainingQuota < targetCount) {
    blockedReasons.push('insufficient_gmail_quota');
  }
  if (config.requireUniqueBatch && !verifyBatchNotSent_(batchId)) {
    blockedReasons.push('batch_already_sent');
  }
  if (config.usingStaleSendDate) {
    blockedReasons.push('stale_send_date_override');
  }
  if (config.usingStaleBatchId) {
    blockedReasons.push('stale_batch_id_override');
  }
  if (forSend && config.dryRun) {
    blockedReasons.push('dry_run_enabled');
  }
  if (forSend && !config.liveSendEnabled) {
    blockedReasons.push('live_send_disabled');
  }

  const blockedReason = blockedReasons.join(',') || '';
  const safeToSend = forSend && blockedReasons.length === 0 && !config.dryRun && config.liveSendEnabled;
  const publishAllowed = !config.dryRun && config.liveSendEnabled && config.autoSendEnabled;
  const canPrepareOutbox = sheetConnected && remainingQuota >= targetCount;
  const canSendToday = blockedReasons.length === 0 && !config.dryRun && config.liveSendEnabled;

  return {
    config,
    dryRun: config.dryRun,
    liveSendEnabled: config.liveSendEnabled,
    dailySendLimit: config.dailySendLimit,
    remainingQuota,
    targetCount,
    readyCount,
    readyRows: validation.readyRows.slice(0, targetCount),
    batchId,
    blockedReason,
    sheetConnected,
    safeToSend,
    publishAllowed,
    canPrepareOutbox,
    canSendToday,
    recommendedNextAction: buildRecommendedNextAction_(blockedReason, readyCount, targetCount, config)
  };
}

function buildDiagnosticsBlockedReason_(summary, config, batchId) {
  const reasons = [];
  const targetCount = Math.min(config.dailySendLimit, 30);
  if (summary.validationErrorCount > 0) {
    reasons.push('outbox_validation_errors');
  }
  if (summary.readyRows === 0) {
    reasons.push('no_ready_rows');
  }
  if (config.requireExactReadyCount && summary.readyRows !== targetCount) {
    reasons.push('exact_ready_count_not_met');
  }
  if (config.requireUniqueBatch && !verifyBatchNotSent_(batchId)) {
    reasons.push('batch_already_sent');
  }
  if (config.usingStaleSendDate) {
    reasons.push('stale_send_date_override');
  }
  if (config.usingStaleBatchId) {
    reasons.push('stale_batch_id_override');
  }
  return reasons.join(',') || '';
}

function buildRecommendedNextAction_(blockedReason, readyCount, targetCount, config) {
  const reason = String(blockedReason || '');
  if (reason.indexOf('batch_already_sent') !== -1) {
    return 'Do not resend the old batch. Prepare a new date/new sendBatchId outbox and rerun preflight.';
  }
  if (config.usingStaleSendDate || config.usingStaleBatchId) {
    return 'Disable stale override or prepare an outbox that matches the override date and batchId.';
  }
  if (config.staleSendDate || config.staleBatchId) {
    return 'Remove stale SEND_DATE/SEND_BATCH_ID properties or confirm the auto JST daily values before preflight.';
  }
  if (readyCount !== targetCount) {
    return 'Prepare and paste exactly 30 ready rows for the expected sendDate and sendBatchId, then rerun preflight.';
  }
  if (config.dryRun || !config.liveSendEnabled || !config.autoSendEnabled) {
    return 'Preflight rows are ready. Enable production properties only after human approval.';
  }
  return 'Ready for the configured daily send window.';
}

function validateDailySendWindow_(config) {
  const timezone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const hhmm = Utilities.formatDate(new Date(), timezone, 'HH:mm').split(':');
  const current = Number(hhmm[0]) * 60 + Number(hhmm[1]);
  const start = config.allowedSendStartHour * 60 + config.allowedSendStartMinute;
  const end = config.allowedSendEndHour * 60 + config.allowedSendEndMinute;
  const inWindow = start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;

  return {
    ok: inWindow,
    blockedReason: inWindow ? '' : 'outside_allowed_send_window',
    currentJstMinutes: current,
    allowedStartMinutes: start,
    allowedEndMinutes: end
  };
}

function validateExplicitBatchApproval_(config, batchId, readyRows) {
  const expectedChecksum = calculateBatchApprovalChecksum_(config, batchId, readyRows);
  const approvedBatchIdMatched = config.approvedBatchId === batchId;
  const approvedChecksumMatched = config.approvedBatchChecksum === expectedChecksum;
  const approvalNotExpired = isApprovalNotExpired_(config.approvalExpiresAt);
  const ok = !config.requireExplicitBatchApproval ||
    (approvedBatchIdMatched && approvedChecksumMatched && approvalNotExpired);

  return {
    ok,
    blockedReason: ok ? '' : 'explicit_batch_approval_required',
    expectedApprovalChecksum: expectedChecksum,
    approvedBatchIdMatched,
    approvedChecksumMatched,
    approvalNotExpired
  };
}

function calculateBatchApprovalChecksum_(config, batchId, readyRows) {
  const rowHashes = (readyRows || []).map((item) => {
    const row = item.row || {};
    const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);
    const businessName = normalizeTextForComparison_(row.name || row['店舗名']);
    const subject = normalizeEmailSubject_(row.subject || row['件名']);
    return hashValue_([item.rowIndex || '', email, businessName, subject].join('|'));
  }).sort();
  return hashValue_([
    config.sendDate,
    batchId,
    Math.min(config.dailySendLimit, 30),
    rowHashes.join(',')
  ].join('|'));
}

function isApprovalNotExpired_(value) {
  if (!value) {
    return false;
  }
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }
  return expiry.getTime() > Date.now();
}

function getSentHistoryIncidentConfig_() {
  return {
    sinceJst: '2026-06-11T00:00:00+09:00',
    queryAfter: '2026/6/10',
    subject: 'SNSの見え方について、簡単な無料確認のご案内',
    timezone: Session.getScriptTimeZone() || 'Asia/Tokyo',
    maxThreads: 500
  };
}

function buildSentHistoryIncidentQuery_(incidentConfig) {
  return 'in:sent after:' + incidentConfig.queryAfter + ' subject:"' + incidentConfig.subject + '"';
}

function isIncidentAuditMessage_(message, incidentConfig) {
  const sentAt = message.getDate();
  if (sentAt.getTime() < new Date(incidentConfig.sinceJst).getTime()) {
    return false;
  }
  if (String(message.getSubject() || '') !== incidentConfig.subject) {
    return false;
  }
  return parseRecipientEmailsFromHeader_(message.getTo()).length > 0;
}

function parseRecipientEmailsFromHeader_(header) {
  const text = String(header || '');
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const seen = {};
  return matches.map((email) => normalizeEmail_(email)).filter((email) => {
    if (!email || seen[email]) {
      return false;
    }
    seen[email] = true;
    return true;
  });
}

function extractEmailDomain_(email) {
  const normalized = normalizeEmail_(email);
  const parts = normalized.split('@');
  return parts.length === 2 ? parts[1] : '';
}

function extractGreetingName_(body) {
  const lines = normalizeEmailBody_(body).split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  const firstLine = lines[0];
  const match = firstLine.match(/^(.{1,80})\s*(さま|様)$/);
  if (!match) {
    return '';
  }
  return String(match[1] || '').trim();
}

function classifyGreetingIssue_(body, greetingName) {
  const text = normalizeEmailBody_(body);
  const firstLine = text.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  if (!firstLine) {
    return 'missing_name';
  }
  if (firstLine.indexOf('突然のご連絡失礼いたします') === 0) {
    return 'missing_name';
  }
  if (!greetingName) {
    return 'missing_name';
  }
  if (includesAny_(firstLine.toLowerCase(), ['{{', '}}', '${name}', '${storename}', 'undefined', 'null'])) {
    return 'placeholder_remaining';
  }
  if (includesAny_(greetingName.toLowerCase(), ['ご担当者', '担当者', 'お客様', 'customer', 'sample', 'test'])) {
    return 'fixed_or_generic_greeting';
  }
  return '';
}

function isOutsideAllowedIncidentWindow_(sentAt, config, incidentConfig) {
  const hhmm = Utilities.formatDate(sentAt, incidentConfig.timezone, 'HH:mm').split(':');
  const current = Number(hhmm[0]) * 60 + Number(hhmm[1]);
  const start = config.allowedSendStartHour * 60 + config.allowedSendStartMinute;
  const end = config.allowedSendEndHour * 60 + config.allowedSendEndMinute;
  return start <= end
    ? current < start || current > end
    : current < start && current > end;
}

function extractBatchIdFromSubjectOrBody_(subject, body) {
  const text = String(subject || '') + '\n' + String(body || '');
  const match = text.match(/gmail-sales-\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+)?/i);
  return match ? match[0] : '';
}

function storeSuppressionLedger_(ledger, summary) {
  const props = PropertiesService.getScriptProperties();
  const previousChunkCount = Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT') || '0');
  const payloadObject = buildSuppressionLedgerPayload_(Object.keys(ledger).sort().map((hash) => ledger[hash]), {
    createdAt: new Date().toISOString(),
    sourceEntryCount: Object.keys(ledger).length,
    summary
  });
  const payload = JSON.stringify(payloadObject);
  const chunkSize = GMAIL_SUPPRESSION_LEDGER_CHUNK_SIZE;
  const chunkCount = Math.ceil(payload.length / chunkSize);
  for (let index = 0; index < previousChunkCount; index += 1) {
    props.deleteProperty('GMAIL_SUPPRESSION_LEDGER_' + index);
    props.deleteProperty('GMAIL_SUPPRESSION_LEDGER_' + index + '_CHECKSUM');
  }
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION', String(GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT', String(chunkCount));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM', sha256Hex_(payload));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_UPDATED_AT', new Date().toISOString());
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_CREATED_AT', payloadObject.createdAt);
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_SUPPRESSED_COUNT', String(summary.suppressedCount));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT', String(payloadObject.sourceEntryCount));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT', String(payloadObject.recipientHashes.length));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT', String(payloadObject.domainHashes.length));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT', String(payloadObject.businessFingerprints.length));
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = payload.slice(index * chunkSize, (index + 1) * chunkSize);
    props.setProperty('GMAIL_SUPPRESSION_LEDGER_' + index, chunk);
    props.setProperty('GMAIL_SUPPRESSION_LEDGER_' + index + '_CHECKSUM', sha256Hex_(chunk));
  }
}

function loadSuppressionLedgerFromProperties_() {
  const props = PropertiesService.getScriptProperties();
  const chunkCount = Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT') || '0');
  const schemaVersion = Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION') || '0');
  const bundleChecksum = String(props.getProperty('GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM') || '').trim();
  if (!chunkCount || schemaVersion !== GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION || !bundleChecksum) {
    return { loaded: false, generatedAt: '', entries: [] };
  }
  let payload = '';
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = props.getProperty('GMAIL_SUPPRESSION_LEDGER_' + index);
    const chunkChecksum = String(props.getProperty('GMAIL_SUPPRESSION_LEDGER_' + index + '_CHECKSUM') || '').trim();
    if (!chunk || !chunkChecksum || sha256Hex_(chunk) !== chunkChecksum) {
      return { loaded: false, generatedAt: '', entries: [] };
    }
    payload += chunk;
  }
  if (sha256Hex_(payload) !== bundleChecksum) {
    return { loaded: false, generatedAt: '', entries: [] };
  }
  try {
    const ledger = JSON.parse(payload);
    if (!ledger || Number(ledger.schemaVersion) !== GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION) {
      return { loaded: false, generatedAt: '', entries: [] };
    }
    const recipientHashes = arrayToLookup_(ledger.recipientHashes);
    const domainHashes = arrayToLookup_(ledger.domainHashes);
    const businessFingerprints = arrayToLookup_(ledger.businessFingerprints);
    const suppressedCount = Object.keys(recipientHashes).length + Object.keys(domainHashes).length + Object.keys(businessFingerprints).length;
    if (suppressedCount < 1) {
      return { loaded: false, generatedAt: '', entries: [] };
    }
    const entries = buildSuppressionEntriesFromBundle_(recipientHashes, domainHashes, businessFingerprints);
    return {
      loaded: true,
      schemaVersion: ledger.schemaVersion,
      generatedAt: ledger.createdAt || props.getProperty('GMAIL_SUPPRESSION_LEDGER_UPDATED_AT') || '',
      sourceEntryCount: Number(ledger.sourceEntryCount || 0),
      recipientHashes,
      domainHashes,
      businessFingerprints,
      entries
    };
  } catch (error) {
    return { loaded: false, generatedAt: '', entries: [] };
  }
}

function runGmailSuppressionLedgerReadOnlyDiagnostic() {
  const result = diagnoseSuppressionLedgerProperties_();
  appendSafeLog_(result);
  return result;
}

function diagnoseSuppressionLedgerProperties_() {
  const props = PropertiesService.getScriptProperties();
  const expectedBase = GMAIL_SUPPRESSION_LEDGER_REQUIRED_PROPERTIES.slice();
  const rawChunkCount = props.getProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT');
  const chunkCount = Number(rawChunkCount || '0');
  const chunkCountValid = Number.isInteger(chunkCount) && chunkCount > 0;
  const expectedProperties = expectedBase.slice();
  if (chunkCountValid) {
    for (let index = 0; index < chunkCount; index += 1) {
      expectedProperties.push('GMAIL_SUPPRESSION_LEDGER_' + index);
      expectedProperties.push('GMAIL_SUPPRESSION_LEDGER_' + index + '_CHECKSUM');
    }
  } else {
    expectedProperties.push('GMAIL_SUPPRESSION_LEDGER_0');
    expectedProperties.push('GMAIL_SUPPRESSION_LEDGER_0_CHECKSUM');
  }

  const missingPropertyNames = expectedProperties.filter((name) => !String(props.getProperty(name) || '').trim());
  const result = {
    event: 'gmail_suppression_ledger_read_only_diagnostic',
    status: 'blocked',
    ledgerLoaded: false,
    schemaVersionValid: false,
    propertyCountExpected: expectedProperties.length,
    propertyCountPresent: expectedProperties.length - missingPropertyNames.length,
    missingPropertyCount: missingPropertyNames.length,
    missingPropertyNames,
    chunkCount: chunkCountValid ? chunkCount : 0,
    chunkCountValid,
    chunkChecksumValid: false,
    bundleChecksumValid: false,
    jsonValid: false,
    sourceEntryCount: 0,
    recipientCount: 0,
    domainCount: 0,
    businessCount: 0,
    countsValid: false,
    blockedReason: ''
  };

  if (missingPropertyNames.length > 0) {
    result.blockedReason = 'property_missing';
    return result;
  }
  if (!chunkCountValid) {
    result.blockedReason = 'invalid_chunk_count';
    return result;
  }

  let payload = '';
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = props.getProperty('GMAIL_SUPPRESSION_LEDGER_' + index);
    const chunkChecksum = String(props.getProperty('GMAIL_SUPPRESSION_LEDGER_' + index + '_CHECKSUM') || '').trim();
    if (!chunk) {
      result.blockedReason = 'missing_chunk';
      return result;
    }
    if (!chunkChecksum) {
      result.blockedReason = 'missing_chunk_checksum';
      return result;
    }
    if (sha256Hex_(chunk) !== chunkChecksum) {
      result.blockedReason = 'chunk_checksum_mismatch';
      return result;
    }
    payload += chunk;
  }
  result.chunkChecksumValid = true;

  const bundleChecksum = String(props.getProperty('GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM') || '').trim();
  if (!bundleChecksum || sha256Hex_(payload) !== bundleChecksum) {
    result.blockedReason = 'bundle_checksum_mismatch';
    return result;
  }
  result.bundleChecksumValid = true;

  let ledger;
  try {
    ledger = JSON.parse(payload);
    result.jsonValid = true;
  } catch (error) {
    result.blockedReason = 'json_parse_failure';
    return result;
  }

  result.schemaVersionValid = Number(ledger && ledger.schemaVersion) === GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION;
  if (!result.schemaVersionValid) {
    result.blockedReason = 'schema_version_mismatch';
    return result;
  }

  const recipientCount = Array.isArray(ledger.recipientHashes) ? ledger.recipientHashes.length : 0;
  const domainCount = Array.isArray(ledger.domainHashes) ? ledger.domainHashes.length : 0;
  const businessCount = Array.isArray(ledger.businessFingerprints) ? ledger.businessFingerprints.length : 0;
  result.sourceEntryCount = Number(ledger.sourceEntryCount || 0);
  result.recipientCount = recipientCount;
  result.domainCount = domainCount;
  result.businessCount = businessCount;
  result.countsValid = result.sourceEntryCount > 0 &&
    recipientCount === Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT') || '0') &&
    domainCount === Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT') || '0') &&
    businessCount === Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT') || '0') &&
    result.sourceEntryCount === Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT') || '0') &&
    recipientCount + domainCount + businessCount > 0;
  if (!result.countsValid) {
    result.blockedReason = 'count_mismatch';
    return result;
  }

  result.status = 'pass';
  result.ledgerLoaded = true;
  result.blockedReason = '';
  return result;
}

function buildSuppressionLedgerPayload_(entries, metadata) {
  const recipientHashes = {};
  const domainHashes = {};
  const businessFingerprints = {};
  (entries || []).forEach((entry) => {
    if (!entry || entry.suppressed === false || entry.futureEligible === true) {
      return;
    }
    const recipientHash = String(entry.recipientHash || '').trim();
    const domainHash = String(entry.normalizedDomainHash || entry.domainHash || '').trim();
    const businessFingerprint = String(entry.businessFingerprint || '').trim();
    if (recipientHash) recipientHashes[recipientHash] = true;
    if (domainHash) domainHashes[domainHash] = true;
    if (businessFingerprint) businessFingerprints[businessFingerprint] = true;
  });
  return {
    schemaVersion: GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION,
    createdAt: String((metadata && metadata.createdAt) || new Date().toISOString()),
    sourceEntryCount: Number((metadata && metadata.sourceEntryCount) || (entries || []).length),
    recipientHashes: Object.keys(recipientHashes).sort(),
    domainHashes: Object.keys(domainHashes).sort(),
    businessFingerprints: Object.keys(businessFingerprints).sort(),
    summary: (metadata && metadata.summary) || {}
  };
}

function buildSuppressionEntriesFromBundle_(recipientHashes, domainHashes, businessFingerprints) {
  const entries = [];
  Object.keys(recipientHashes || {}).forEach((hash) => entries.push({ recipientHash: hash, suppressed: true }));
  Object.keys(domainHashes || {}).forEach((hash) => entries.push({ normalizedDomainHash: hash, suppressed: true }));
  Object.keys(businessFingerprints || {}).forEach((hash) => entries.push({ businessFingerprint: hash, suppressed: true }));
  return entries;
}

function arrayToLookup_(values) {
  const lookup = {};
  if (!Array.isArray(values)) {
    return lookup;
  }
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (normalized) lookup[normalized] = true;
  });
  return lookup;
}

function assertMessageSafe_(message) {
  const config = getConfig_();
  const subject = normalizeEmailSubject_((message && message.subject) || '');
  const body = normalizeEmailBody_((message && message.body) || '');
  const text = subject + '\n' + body;
  if (config.requireOptOutText && !includesAny_(text, ['不要', '今後のご案内が不要', 'ご返信不要'])) {
    throw new Error('missing_opt_out_text');
  }
  if (includesAny_(text, ['必ず売上', '絶対', '売上保証', '成果保証'])) {
    throw new Error('guaranteed_result_expression');
  }
}

function assertRecipientPersonalizationSafe_(row, message) {
  const body = normalizeEmailBody_((message && message.body) || '');
  const businessName = String(row.name || row['店舗名'] || '').trim();
  if (businessName && body.indexOf(businessName) === -1) {
    throw new Error('personalization_name_mismatch');
  }
  if (includesAny_(body, ['{{', '}}', '${name}', '${storeName}', 'undefined', 'null さま'])) {
    throw new Error('personalization_placeholder_detected');
  }
}

function normalizeEmailBody_(body) {
  return String(body || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeEmailSubject_(subject) {
  return String(subject || '')
    .replace(/\\r\\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function hasEscapedNewline_(value) {
  return /\\r\\n|\\n/.test(String(value || ''));
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeTextForComparison_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function shouldSkipRecipient_(row) {
  const statusText = String([
    row.status,
    row.sentStatus,
    row.replyStatus,
    row.unsubscribe,
    row.doNotContact,
    row['送信ステータス'],
    row['返信ステータス'],
    row['配信停止'],
    row['送信禁止']
  ].join(' ')).toLowerCase();

  return includesAny_(statusText, [
    '送信済',
    '返信あり',
    '配信停止',
    '送信禁止',
    'unsubscribe',
    'complaint',
    'bounce',
    'replied',
    'sent'
  ]);
}

function createOrGetLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function loadCandidateRows_(config) {
  if (!config.sheetId || !config.sheetName) {
    appendLog_({ event: 'candidate_load_skipped', reason: 'missing_sheet_config' });
    return [];
  }

  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const header = values[0].map((value) => String(value));
  return values.slice(1).map((rowValues, index) => {
    const row = {};
    header.forEach((key, columnIndex) => {
      row[key] = rowValues[columnIndex];
    });
    row.email = row.email || row['宛先メール'] || row['メール'];
    row.contactEmail = row.contactEmail || row['連絡先メール'];
    row.name = row.name || row['店舗名'];
    return { row, rowIndex: index + 2 };
  });
}

function loadKnownSentEmails_(config) {
  const known = {};
  const rows = loadCandidateRows_(config);
  rows.forEach((item) => {
    const row = item.row;
    const email = normalizeEmail_(row.email || row['宛先メール']);
    const statusText = String(row.sentStatus || row['送信ステータス'] || '').toLowerCase();
    if (email && includesAny_(statusText, ['送信済', 'sent'])) {
      known[email] = true;
    }
  });
  return known;
}

function applyReplyLabel_(thread, classification) {
  const labelNameByClass = {};
  labelNameByClass[CLASSIFICATION.interested] = LABELS.interested;
  labelNameByClass[CLASSIFICATION.requestInfo] = LABELS.requestInfo;
  labelNameByClass[CLASSIFICATION.notInterested] = LABELS.notInterested;
  labelNameByClass[CLASSIFICATION.unsubscribe] = LABELS.unsubscribe;
  labelNameByClass[CLASSIFICATION.bounce] = LABELS.bounce;
  labelNameByClass[CLASSIFICATION.complaint] = LABELS.complaint;
  labelNameByClass[CLASSIFICATION.autoReply] = LABELS.autoReply;
  labelNameByClass[CLASSIFICATION.needsHuman] = LABELS.needsHuman;

  createOrGetLabel_(LABELS.replied).addToThread(thread);
  createOrGetLabel_(labelNameByClass[classification] || LABELS.needsHuman).addToThread(thread);
}

function includesAny_(text, keywords) {
  return keywords.some((keyword) => text.indexOf(String(keyword).toLowerCase()) !== -1);
}

function hashValue_(value) {
  const charset = Utilities.Charset && Utilities.Charset.UTF_8;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), charset);
  return digest.map((byte) => {
    const normalized = byte & 0xff;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('').slice(0, 12);
}

function sha256Hex_(value) {
  const charset = Utilities.Charset && Utilities.Charset.UTF_8;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), charset);
  return bytesToHex_(digest);
}

function hmacSha256Hex_(secret, value) {
  if (!Utilities.computeHmacSha256Signature) {
    throw new Error('hmac_unavailable');
  }
  return bytesToHex_(Utilities.computeHmacSha256Signature(String(value || ''), String(secret || '')));
}

function bytesToHex_(bytes) {
  return bytes.map((byte) => {
    const normalized = byte & 0xff;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEqual_(left, right) {
  const a = String(left || '').toLowerCase();
  const b = String(right || '').toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readGmailDailyAutomationState_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty(GMAIL_DAILY_AUTOMATION_STATE_PROPERTY) || '').trim();
  if (!raw) {
    return {
      mode: 'normal_daily',
      state: 'not_started',
      blockedReasons: []
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { mode: 'normal_daily', state: 'not_started', blockedReasons: [] };
  } catch (error) {
    return {
      mode: 'normal_daily',
      state: 'blocked',
      blockedReasons: ['daily_state_invalid_json']
    };
  }
}

function writeGmailDailyAutomationState_(state) {
  const normalized = Object.assign({
    mode: 'normal_daily',
    stateVersion: 1,
    updatedAt: new Date().toISOString(),
    blockedReasons: []
  }, state || {});
  PropertiesService.getScriptProperties().setProperty(GMAIL_DAILY_AUTOMATION_STATE_PROPERTY, JSON.stringify(normalized));
  return normalized;
}

function gmailDailyExpectedCount_() {
  const raw = Number(PropertiesService.getScriptProperties().getProperty('GMAIL_SALES_EXPECTED_DAILY_COUNT') || GMAIL_DAILY_EXPECTED_COUNT);
  if (!Number.isFinite(raw)) return GMAIL_DAILY_EXPECTED_COUNT;
  return Math.min(Math.max(Math.floor(raw), 1), GMAIL_DAILY_EXPECTED_COUNT);
}

function gmailDailyVersionStatus_() {
  const props = PropertiesService.getScriptProperties();
  const automationVersion = String(props.getProperty('GMAIL_SALES_AUTOMATION_VERSION') || '').trim();
  const approvalPolicyVersion = String(props.getProperty('GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION') || '').trim();
  const automationVersionConfigured = isConfiguredVersionValue_(automationVersion);
  const approvalPolicyVersionConfigured = isConfiguredVersionValue_(approvalPolicyVersion);
  const automationVersionMatch = automationVersion === GMAIL_DAILY_AUTOMATION_VERSION;
  const approvalPolicyVersionMatch = approvalPolicyVersion === GMAIL_DAILY_AUTO_APPROVAL_POLICY_VERSION;
  const blockedReasons = [];
  if (!automationVersionConfigured || !approvalPolicyVersionConfigured) blockedReasons.push('version_not_configured');
  if (automationVersionConfigured && !automationVersionMatch) blockedReasons.push('automation_version_mismatch');
  if (approvalPolicyVersionConfigured && !approvalPolicyVersionMatch) blockedReasons.push('approval_policy_version_mismatch');
  return {
    ok: blockedReasons.length === 0,
    automationVersionConfigured,
    automationVersionMatch,
    approvalPolicyVersionConfigured,
    approvalPolicyVersionMatch,
    blockedReasons: uniqueArray_(blockedReasons)
  };
}

function isConfiguredVersionValue_(value) {
  const text = String(value || '').trim();
  return Boolean(text) &&
    text.toLowerCase() !== 'unset' &&
    text.indexOf('PASTE_') !== 0;
}

function isConfiguredTimeText_(value) {
  const text = String(value || '').trim();
  return Boolean(parseTimeText_(text));
}

function readScriptPropertyText_(props, key) {
  if (props && typeof props.getProperty === 'function') {
    return String(props.getProperty(key) || '').trim();
  }
  return String((props || {})[key] || '').trim();
}

function isUnsetOrPlaceholderText_(value) {
  const text = String(value || '').trim();
  return !text ||
    text.toLowerCase() === 'unset' ||
    text.indexOf('PASTE_') === 0;
}

function getGmailSalesDailySendWindowConfig_(props) {
  const startText = readScriptPropertyText_(props, GMAIL_SALES_SEND_WINDOW_START_PROPERTY);
  const endText = readScriptPropertyText_(props, GMAIL_SALES_SEND_WINDOW_END_PROPERTY);
  const startPresent = !isUnsetOrPlaceholderText_(startText);
  const endPresent = !isUnsetOrPlaceholderText_(endText);
  const startParsed = startPresent ? parseTimeText_(startText) : null;
  const endParsed = endPresent ? parseTimeText_(endText) : null;
  const formatValid = Boolean(startParsed && endParsed);
  const startMinutes = startParsed ? startParsed.hour * 60 + startParsed.minute : null;
  const endMinutes = endParsed ? endParsed.hour * 60 + endParsed.minute : null;
  const rangeValid = formatValid && startMinutes < endMinutes;
  let blockedReason = '';
  if (!startPresent || !endPresent) {
    blockedReason = 'send_window_not_configured';
  } else if (!formatValid || !rangeValid) {
    blockedReason = 'send_window_invalid';
  }
  const configured = !blockedReason;
  return {
    start: startText,
    end: endText,
    summary: formatValid ? startText + '-' + endText : 'invalid',
    configured,
    startPresent,
    endPresent,
    formatValid,
    rangeValid,
    startParsed,
    endParsed,
    startMinutes,
    endMinutes,
    blockedReason
  };
}

function getGmailSalesDailyTriggerSchedule_(props) {
  const sendWindow = getGmailSalesDailySendWindowConfig_(props);
  const timezone = readScriptPropertyText_(props, GMAIL_SALES_TIMEZONE_PROPERTY);
  const timezoneConfigured = timezone === GMAIL_SALES_TIMEZONE_DEFAULT;
  if (!timezoneConfigured) {
    return {
      configured: false,
      hour: null,
      minute: null,
      timezone,
      timezoneConfigured: false,
      safeMarginMinutes: 0,
      blockedReason: 'timezone_not_configured'
    };
  }
  if (!sendWindow.configured) {
    return {
      configured: false,
      hour: null,
      minute: null,
      timezone,
      timezoneConfigured: true,
      safeMarginMinutes: 0,
      blockedReason: sendWindow.blockedReason || 'send_window_not_configured'
    };
  }
  const windowWidthMinutes = sendWindow.endMinutes - sendWindow.startMinutes;
  const safeMarginMinutes = Math.floor(windowWidthMinutes / 2);
  if (windowWidthMinutes <= 0) {
    return {
      configured: false,
      hour: null,
      minute: null,
      timezone,
      timezoneConfigured: true,
      safeMarginMinutes: 0,
      blockedReason: 'send_window_invalid'
    };
  }
  if (safeMarginMinutes < GMAIL_DAILY_TRIGGER_MIN_SAFE_MARGIN_MINUTES) {
    return {
      configured: false,
      hour: null,
      minute: null,
      timezone,
      timezoneConfigured: true,
      safeMarginMinutes,
      blockedReason: 'send_window_too_narrow'
    };
  }
  const midpointMinutes = sendWindow.startMinutes + safeMarginMinutes;
  return {
    configured: true,
    hour: Math.floor(midpointMinutes / 60),
    minute: midpointMinutes % 60,
    timezone,
    timezoneConfigured: true,
    safeMarginMinutes,
    blockedReason: ''
  };
}

function withGmailSalesDailySendWindow_(config, sendWindowStatus) {
  const start = sendWindowStatus && sendWindowStatus.startParsed;
  const end = sendWindowStatus && sendWindowStatus.endParsed;
  if (!start || !end) {
    return config;
  }
  return Object.assign({}, config, {
    sendHour: start.hour,
    allowedSendStartHour: start.hour,
    allowedSendStartMinute: start.minute,
    allowedSendEndHour: end.hour,
    allowedSendEndMinute: end.minute
  });
}

function safeSendWindowSummary_(config) {
  return [
    ('0' + config.allowedSendStartHour).slice(-2) + ':' + ('0' + config.allowedSendStartMinute).slice(-2),
    ('0' + config.allowedSendEndHour).slice(-2) + ':' + ('0' + config.allowedSendEndMinute).slice(-2)
  ].join('-');
}

function insideAllowedSendWindow_(config) {
  const now = new Date();
  const timezone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const hour = Number(Utilities.formatDate(now, timezone, 'H'));
  const minute = Number(Utilities.formatDate(now, timezone, 'm'));
  const current = hour * 60 + minute;
  const start = config.allowedSendStartHour * 60 + config.allowedSendStartMinute;
  const end = config.allowedSendEndHour * 60 + config.allowedSendEndMinute;
  return current >= start && current <= end;
}

function buildSendBatchId_(dateText) {
  const config = getConfig_();
  if (!dateText || normalizeDateText_(dateText) === config.sendDate) {
    return config.sendBatchId;
  }
  return config.sendBatchIdPrefix + '-' + normalizeDateText_(dateText || config.sendDate);
}

function verifyBatchNotSent_(batchId) {
  if (!batchId) {
    return false;
  }
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(getBatchSentPropertyKey_(batchId)) !== 'true';
}

function markBatchSent_(batchId) {
  if (!batchId) {
    return;
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty(getBatchSentPropertyKey_(batchId), 'true');
  props.setProperty('LAST_SENT_BATCH_ID', batchId);
  props.setProperty('LAST_SENT_AT', new Date().toISOString());
  appendSafeLog_({ event: 'batch_marked_sent', sendBatchId: batchId });
}

function resetLiveSendAfterRun_(config, options) {
  const settings = options || {};
  if (settings.dryRun === true) {
    return;
  }
  if (!config.autoResetLiveSendAfterRun) {
    return;
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LIVE_SEND_ENABLED', 'false');
  props.setProperty('AUTO_SEND_ENABLED', 'false');
  appendSafeLog_({ event: 'live_send_reset_after_run' });
}

function appendAutomationStatusLog_(event) {
  appendSafeLog_(event);
  updateAgentStatusSheetOrLog_(event);
}

function updateAgentStatusSheetOrLog_(status) {
  appendSafeLog_({
    event: 'agent_status_update_planned',
    statusEvent: status.event || 'unknown',
    readyCount: status.readyCount,
    sentCount: status.sentCount,
    failedCount: status.failedCount,
    blockedReason: status.blockedReason
  });
}

function hasTrigger_(handlerName) {
  return ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === handlerName);
}

function getBatchSentPropertyKey_(batchId) {
  return 'BATCH_SENT_' + hashValue_(batchId);
}

function normalizeHour_(value, fallback) {
  const hour = Number(value);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return fallback;
  }
  return Math.floor(hour);
}

function normalizePositiveInt_(value, fallback, maxValue) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), maxValue);
}

function parseTimeText_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function normalizeMinute_(value, fallback) {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return fallback;
  }
  return Math.floor(minute);
}

function normalizeDateText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(value || '').trim().slice(0, 10);
}

function parseDateOrNull_(value) {
  if (!value) {
    return null;
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function escapeGmailSearchText_(value) {
  return String(value || '').replace(/["\\]/g, ' ').slice(0, 120);
}

function nextReplyCheckAt_() {
  const timezone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const now = new Date();
  const today = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  const candidates = [9, 12, 17].map((hour) => new Date(today + 'T' + ('0' + hour).slice(-2) + ':00:00+09:00'));
  for (let i = 0; i < candidates.length; i += 1) {
    if (candidates[i].getTime() > now.getTime()) {
      return candidates[i].toISOString();
    }
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dateText = Utilities.formatDate(tomorrow, timezone, 'yyyy-MM-dd');
  return new Date(dateText + 'T09:00:00+09:00').toISOString();
}

function getToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
}
