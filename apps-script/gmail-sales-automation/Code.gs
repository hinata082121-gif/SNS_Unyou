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

  const providedToken = String((payload && payload.token) || '').trim();
  if (!expectedToken || providedToken !== expectedToken) {
    appendSafeLog_({ event: 'gmail_sheet_sync_rejected', blockedReason: 'token_mismatch' });
    return buildSheetSyncResponse_({ ok: false, sheetSynced: false, blockedReason: 'token_mismatch' });
  }

  const validation = validateSheetSyncPayload_(payload);
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
      const item = rows[i];
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
          failed += 1;
          break;
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
          failed += 1;
          break;
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
          event: 'approved_gmail_sales_send_executed',
          rowIndex,
          recipientHash: hashValue_(email),
          subjectHash: hashValue_(message.subject)
        });
        processed += 1;
      } catch (error) {
        failed += 1;
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
  if (manifest.humanReviewCompleted !== true) blockedReasons.push('manifest_human_review_not_completed');
  if (!Array.isArray(manifest.candidateDigests)) blockedReasons.push('manifest_candidate_digests_missing');
  if (isManifestExpired_(manifest)) blockedReasons.push('manifest_expired');
  const maxSendCount = normalizeManifestMaxSendCount_(manifest.maxSendCount);
  if (!maxSendCount) blockedReasons.push('manifest_max_send_count_invalid');
  return buildManifestValidationResult_(manifest, blockedReasons, readyRows, config, batchId, maxSendCount);
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
    approvalVerified: Boolean(manifest && manifest.approvalStatus === 'approved' && manifest.humanReviewCompleted === true),
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
    attemptLimitExceeded: false,
    manualReviewRequired: false
  };
  if (!context.manifestDigestSet || !context.manifestDigestSet[digest]) {
    return blockedPreSendResult_(result, 'candidate_digest_mismatch', { digestMismatched: true });
  }
  if (isManifestExpired_(context.manifest)) {
    return blockedPreSendResult_(result, 'manifest_expired');
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
  const candidateId = String(row.prospectId || row.dedupeKey || '').trim().toLowerCase();
  return sha256Hex_([
    normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']),
    normalizeEmailSubject_(row.subject || row['件名']),
    normalizeEmailBody_(row.body || row['本文']),
    candidateId,
    normalizeDateText_(targetDate),
    String(batchId || '').trim()
  ].join('\n'));
}

function sha256Hex_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''));
  return digest.map((byte) => {
    const normalized = byte < 0 ? byte + 256 : byte;
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
  return {
    sheetId: props.getProperty('SHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME') || 'sales',
    dryRun: props.getProperty('DRY_RUN') !== 'false',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    autoSendEnabled: props.getProperty('AUTO_SEND_ENABLED') === 'true',
    autoResetLiveSendAfterRun: props.getProperty('AUTO_RESET_LIVE_SEND_AFTER_RUN') !== 'false',
    dailySendLimit: Math.min(Number.isFinite(dailyLimit) ? dailyLimit : 30, 30),
    preflightHour: normalizeHour_(props.getProperty('PREFLIGHT_HOUR'), 11),
    sendHour: normalizeHour_(props.getProperty('SEND_HOUR'), 12),
    postSendCheckHour: normalizeHour_(props.getProperty('POST_SEND_CHECK_HOUR'), 12),
    allowedSendStartHour: normalizeHour_(props.getProperty('ALLOWED_SEND_START_HOUR'), 11),
    allowedSendStartMinute: normalizeMinute_(props.getProperty('ALLOWED_SEND_START_MINUTE'), 55),
    allowedSendEndHour: normalizeHour_(props.getProperty('ALLOWED_SEND_END_HOUR'), 12),
    allowedSendEndMinute: normalizeMinute_(props.getProperty('ALLOWED_SEND_END_MINUTE'), 15),
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
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''));
  return digest.map((byte) => {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('').slice(0, 12);
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
