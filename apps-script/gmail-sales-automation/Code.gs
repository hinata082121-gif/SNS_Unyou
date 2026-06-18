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
  runDailyGmailSalesSend();
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
  const result = writeGmailOutboxRowsToSheet_(payload, config);
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
  executeDailyGmailSalesSend_({ source: 'scheduled', requireAutoSend: true });
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
  executeDailyGmailSalesSend_({ source: 'manual', requireAutoSend: false });
}

function executeDailyGmailSalesSend_(options) {
  const settings = options || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    appendSafeLog_({ event: 'daily_job_lock_skipped' });
    return;
  }

  let configForReset = null;
  try {
    const preflight = runPreflight_(true);
    configForReset = preflight.config;

    if (settings.requireAutoSend && !preflight.config.autoSendEnabled) {
      appendSafeLog_({
        event: 'daily_job_blocked',
        source: settings.source || 'unknown',
        blockedReason: 'auto_send_disabled',
        dryRun: preflight.dryRun,
        liveSendEnabled: preflight.liveSendEnabled,
        autoSendEnabled: preflight.config.autoSendEnabled,
        readyCount: preflight.readyCount
      });
      return;
    }

    if (!preflight.safeToSend) {
      appendSafeLog_({
        event: 'daily_job_blocked',
        source: settings.source || 'unknown',
        blockedReason: preflight.blockedReason,
        dryRun: preflight.dryRun,
        liveSendEnabled: preflight.liveSendEnabled,
        autoSendEnabled: preflight.config.autoSendEnabled,
        readyCount: preflight.readyCount,
        remainingQuota: preflight.remainingQuota,
        sendBatchId: preflight.batchId
      });
      return;
    }

    const config = preflight.config;
    const windowCheck = validateDailySendWindow_(config);
    if (!windowCheck.ok) {
      appendSafeLog_({
        event: 'daily_job_blocked',
        source: settings.source || 'unknown',
        blockedReason: windowCheck.blockedReason,
        currentJstMinutes: windowCheck.currentJstMinutes,
        allowedStartMinutes: windowCheck.allowedStartMinutes,
        allowedEndMinutes: windowCheck.allowedEndMinutes,
        sendBatchId: preflight.batchId,
        readyCount: preflight.readyCount
      });
      return;
    }

    const approvalCheck = validateExplicitBatchApproval_(config, preflight.batchId, preflight.readyRows);
    if (!approvalCheck.ok) {
      appendSafeLog_({
        event: 'daily_job_blocked',
        source: settings.source || 'unknown',
        blockedReason: approvalCheck.blockedReason,
        sendBatchId: preflight.batchId,
        expectedApprovalChecksum: approvalCheck.expectedApprovalChecksum,
        approvedBatchIdMatched: approvalCheck.approvedBatchIdMatched,
        approvedChecksumMatched: approvalCheck.approvedChecksumMatched,
        approvalNotExpired: approvalCheck.approvalNotExpired,
        readyCount: preflight.readyCount
      });
      return;
    }

    const maxToProcess = preflight.targetCount;
    const rows = preflight.readyRows;
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length && processed < maxToProcess; i += 1) {
      const item = rows[i];
      const row = item.row;
      const rowIndex = item.rowIndex;
      const email = normalizeEmail_(row.email || row.contactEmail || row['宛先メール'] || row['メール']);

      try {
        assertSafeToSend_(row);
        const message = buildInitialSalesEmail_(row);
        assertMessageSafe_(message);
        assertRecipientPersonalizationSafe_(row, message);
        MailApp.sendEmail({
          to: email,
          subject: message.subject,
          body: message.body,
          name: config.fromName
        });
        updateSheetAfterSend_(config, rowIndex, {
          status: 'sent',
          sentStatus: '送信済',
          sentAt: new Date().toISOString(),
          sentBy: 'Apps Script',
          lastCheckedAt: new Date().toISOString()
        });
        appendSafeLog_({
          event: 'send_executed',
          rowIndex,
          recipientHash: hashValue_(email),
          subjectHash: hashValue_(message.subject)
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        updateSheetAfterSend_(config, rowIndex, {
          sentStatus: 'needs_review',
          errorMessage: String(error.message || 'send_failed'),
          lastCheckedAt: new Date().toISOString()
        });
        appendSafeLog_({
          event: 'send_failed_stopped',
          rowIndex,
          errorName: error.name || 'Error',
          reason: error.message
        });
        if (failed >= config.maxFailuresBeforeStop) {
          break;
        }
      }
    }

    if (processed === maxToProcess && failed === 0) {
      markBatchSent_(preflight.batchId);
    }

    appendSafeLog_({
      event: 'daily_job_finished',
      source: settings.source || 'unknown',
      sendBatchId: preflight.batchId,
      processed,
      failed,
      dryRun: config.dryRun,
      liveSendEnabled: config.liveSendEnabled
    });
  } finally {
    if (configForReset) {
      resetLiveSendAfterRun_(configForReset);
    }
    lock.releaseLock();
  }
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
    approvalExpiresAt: String(props.getProperty('APPROVAL_EXPIRES_AT') || '').trim(),
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

function updateSheetAfterSend_(config, rowIndex, updates) {
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
  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary,
    entries: Object.keys(ledger).sort().map((hash) => ledger[hash])
  });
  const chunkSize = 7500;
  const chunkCount = Math.ceil(payload.length / chunkSize);
  for (let index = 0; index < previousChunkCount; index += 1) {
    props.deleteProperty('GMAIL_SUPPRESSION_LEDGER_' + index);
  }
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT', String(chunkCount));
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_UPDATED_AT', new Date().toISOString());
  props.setProperty('GMAIL_SUPPRESSION_LEDGER_SUPPRESSED_COUNT', String(summary.suppressedCount));
  for (let index = 0; index < chunkCount; index += 1) {
    props.setProperty('GMAIL_SUPPRESSION_LEDGER_' + index, payload.slice(index * chunkSize, (index + 1) * chunkSize));
  }
}

function loadSuppressionLedgerFromProperties_() {
  const props = PropertiesService.getScriptProperties();
  const chunkCount = Number(props.getProperty('GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT') || '0');
  if (!chunkCount) {
    return { loaded: false, generatedAt: '', entries: [] };
  }
  let payload = '';
  for (let index = 0; index < chunkCount; index += 1) {
    payload += props.getProperty('GMAIL_SUPPRESSION_LEDGER_' + index) || '';
  }
  try {
    const ledger = JSON.parse(payload);
    return {
      loaded: Array.isArray(ledger.entries),
      generatedAt: ledger.generatedAt || props.getProperty('GMAIL_SUPPRESSION_LEDGER_UPDATED_AT') || '',
      entries: Array.isArray(ledger.entries) ? ledger.entries : []
    };
  } catch (error) {
    return { loaded: false, generatedAt: '', entries: [] };
  }
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

function resetLiveSendAfterRun_(config) {
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
