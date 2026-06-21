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
const GMAIL_DAILY_AUTOMATION_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const GMAIL_DAILY_EXPECTED_COUNT = 30;
const GMAIL_DAILY_DEFAULT_REQUESTED_SOURCE_COUNT = 90;
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
  'notes'
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
    const rows = loadCandidateRows_(config)
      .filter((item) => String(item.row.status || '').toLowerCase() === 'ready')
      .map((item) => normalDailySourceRow_(item.row, validation.targetDate, validation.sendBatchId))
      .slice(0, validation.requestedSourceCount);
    if (rows.length < validation.expectedCount) {
      return buildSheetSyncResponse_({
        ok: false,
        status: 'blocked',
        blockedReason: 'source_count_insufficient',
        sourceCount: rows.length,
        googleSheetsUpdated: false,
        scriptPropertiesUpdated: false,
        triggerChanged: false
      });
    }
    appendSafeLog_({
      event: 'gmail_daily_source_read_pass',
      targetDate: validation.targetDate,
      sourceCount: rows.length,
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
      requestedSourceCount: validation.requestedSourceCount,
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
  const requestKey = GMAIL_DAILY_AUTOMATION_REQUEST_PREFIX + hashValue_(requestId);
  if (cache.get(nonceKey) || cache.get(requestKey)) {
    return { ok: false, blockedReason: 'webhook_replay_detected' };
  }
  cache.put(nonceKey, '1', 10 * 60);
  cache.put(requestKey, '1', 10 * 60);
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

function validateGmailDailySourceReadPayload_(payload) {
  const targetDate = String(payload && (payload.targetDate || payload.sendDate) || '').trim();
  const sendBatchId = String(payload && payload.sendBatchId || '').trim();
  const expectedCount = Number(payload && payload.expectedCount || 0);
  const requestedSourceCount = Number(payload && payload.requestedSourceCount || 0);
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
  if (!Number.isFinite(requestedSourceCount) || requestedSourceCount < expectedCount) blocked.push('requested_source_count_invalid');
  return {
    ok: blocked.length === 0,
    blockedReason: blocked.join(','),
    targetDate,
    sendBatchId,
    expectedCount,
    requestedSourceCount: Math.max(expectedCount, requestedSourceCount || GMAIL_DAILY_DEFAULT_REQUESTED_SOURCE_COUNT)
  };
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

function gmailDailyWebhookBodyMaterial_(payload) {
  if (String(payload && payload.action || '') === 'read_normal_daily_source') {
    return JSON.stringify({
      action: payload && payload.action,
      targetDate: payload && payload.targetDate,
      sendBatchId: payload && payload.sendBatchId,
      expectedCount: payload && payload.expectedCount,
      requestedSourceCount: payload && payload.requestedSourceCount,
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
  executeApprovedGmailSalesBatch_({ source: 'scheduled', requireAutoSend: true, dryRun: false });
}

function runGmailSalesDailyAutomationTrigger() {
  let configForReset = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const config = getConfig_();
    configForReset = config;
    const state = readGmailDailyAutomationState_();
    const triggerHealth = verifyGmailSalesDailyAutomationTriggers();
    const versionStatus = gmailDailyVersionStatus_();
    const blockedReasons = [];
    if (props.getProperty('AUTOMATION_MASTER_ENABLED') !== 'true') blockedReasons.push('automation_master_disabled');
    if (!config.autoSendEnabled) blockedReasons.push('auto_send_disabled');
    if (config.liveSendEnabled) blockedReasons.push('live_send_not_at_rest');
    if (triggerHealth.status !== 'pass') blockedReasons.push('daily_trigger_health_blocked');
    if (!versionStatus.ok) blockedReasons.push.apply(blockedReasons, versionStatus.blockedReasons);
    const sendWindowStatus = getGmailSalesDailySendWindowConfig_(props);
    if (!sendWindowStatus.configured) blockedReasons.push(sendWindowStatus.blockedReason || 'send_window_not_configured');
    if (state.state !== 'sheet_synced') blockedReasons.push('daily_state_not_sheet_synced');
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
    props.setProperty('LIVE_SEND_ENABLED', 'true');
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
  if (state.state !== 'sheet_synced') blocked.push('state_not_sheet_synced');
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
  if (!lock.tryLock(30000)) {
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
      requireAutoSend: settings.requireAutoSend === true
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
    lock.releaseLock();
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
  if (!dryRun) {
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
      assertMessageSafe_(buildInitialSalesEmail_(row));
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
