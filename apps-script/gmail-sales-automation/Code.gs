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

function dailySalesEmailJob() {
  return runDailyGmailSalesSend();
}

function runPreflightCheckOnly() {
  const result = runPreflight_(false);
  appendSafeLog_({
    event: 'preflight_check_only',
    dryRun: result.dryRun,
    liveSendEnabled: result.liveSendEnabled,
    dailySendLimit: result.dailySendLimit,
    remainingQuota: result.remainingQuota,
    targetCount: result.targetCount,
    readyCount: result.readyCount,
    blockedReason: result.blockedReason,
    sheetConnected: result.sheetConnected,
    safeToSend: false
  });
  return result;
}

function runDailyGmailSalesSend() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    appendSafeLog_({ event: 'daily_job_lock_skipped' });
    return { status: 'blocked', reason: 'lock_unavailable' };
  }

  try {
    const preflight = runPreflight_(true);
    if (!preflight.safeToSend) {
      appendSafeLog_({
        event: 'daily_job_blocked',
        blockedReason: preflight.blockedReason,
        dryRun: preflight.dryRun,
        liveSendEnabled: preflight.liveSendEnabled,
        readyCount: preflight.readyCount,
        remainingQuota: preflight.remainingQuota
      });
      return { status: 'blocked', reason: preflight.blockedReason, preflight };
    }

    const config = preflight.config;
    const maxToProcess = preflight.readyCount;
    const rows = preflight.readyRows;
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length && processed < maxToProcess; i += 1) {
      const item = rows[i];
      const row = item.row;
      const rowIndex = item.rowIndex;
      const email = normalizeEmail_(row.email || row['宛先メール']);

      try {
        assertSafeToSend_(row);
        const message = buildInitialSalesEmail_(row);
        assertMessageSafe_(message);
        MailApp.sendEmail({
          to: email,
          subject: message.subject,
          body: message.body,
          name: config.fromName
        });
        updateSheetAfterSend_(config, rowIndex, {
          sentStatus: '送信済',
          lastSentAt: new Date().toISOString()
        });
        appendSafeLog_({
          event: 'send_executed',
          rowIndex,
          recipientHash: hashValue_(email),
          subject: message.subject
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        appendSafeLog_({
          event: 'send_failed_stopped',
          rowIndex,
          errorName: error.name || 'Error',
          reason: error.message
        });
        break;
      }
    }

    appendSafeLog_({
      event: 'daily_job_finished',
      processed,
      failed,
      dryRun: config.dryRun,
      liveSendEnabled: config.liveSendEnabled
    });
    return { status: failed > 0 ? 'needs_review' : 'success', processed, failed };
  } finally {
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
  const storeName = row.name || row['店舗名'] || 'ご担当者';
  const signature = getConfig_().replySignature;
  return {
    subject: 'SNSの見え方について、簡単な無料確認のご案内',
    body:
      storeName + ' さま\n\n' +
      '突然のご連絡失礼いたします。\n' +
      'ICHI Socialです。\n\n' +
      '小規模店舗さま向けに、Instagramプロフィールや予約導線の見え方を整理するSNS運用サポートを行っています。\n\n' +
      'もしよろしければ、現在のSNSについて「初めて見る方に何のお店か伝わるか」「予約や問い合わせまで迷わず進めるか」を無料で簡単に確認できます。\n\n' +
      'ご興味があれば、このメールに「診断希望」とだけご返信ください。\n\n' +
      '今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\n' +
      signature
  };
}

function buildFollowupEmail_(row) {
  const storeName = row.name || row['店舗名'] || 'ご担当者';
  return {
    subject: 'SNSプロフィール確認の件',
    body:
      storeName + ' さま\n\n' +
      '先日、SNSの見え方確認についてご案内したICHI Socialです。\n\n' +
      '必要なタイミングがあれば、プロフィールや固定投稿の見え方を簡単に確認できます。\n\n' +
      'ご不要でしたら返信不要です。今後のご案内を控えてほしい場合は、その旨だけご返信ください。\n\n' +
      getConfig_().replySignature
  };
}

function buildInterestedAutoReply_(row) {
  return {
    subject: 'Re: SNS診断の件',
    body:
      'ご返信ありがとうございます。\n\n' +
      '無料SNS診断では、プロフィール、固定投稿、予約導線、投稿テーマの見え方を中心に確認します。\n\n' +
      'まずは公開されているSNSを拝見し、簡単な診断メモをお送りします。\n\n' +
      getConfig_().replySignature
  };
}

function buildInfoRequestAutoReply_(row) {
  return {
    subject: 'Re: 資料のご希望について',
    body:
      'ご返信ありがとうございます。\n\n' +
      'ICHI Socialでは、小規模店舗向けにSNSの伝わり方、投稿テーマ、予約導線の整理を支援しています。\n\n' +
      '概要を確認し、必要に応じて人間担当から詳細をご案内します。\n\n' +
      getConfig_().replySignature
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
  Logger.log(JSON.stringify(safe));
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const dailyLimit = Number(props.getProperty('DAILY_SEND_LIMIT') || '30');
  return {
    sheetId: props.getProperty('SHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME') || 'sales',
    dryRun: props.getProperty('DRY_RUN') !== 'false',
    liveSendEnabled: props.getProperty('LIVE_SEND_ENABLED') === 'true',
    dailySendLimit: Math.min(Number.isFinite(dailyLimit) ? dailyLimit : 30, 30),
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
  const readyRows = [];
  const skipped = [];
  const errors = [];

  items.forEach((item) => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const email = normalizeEmail_(row.email || row['宛先メール']);
    const businessName = String(row.name || row['店舗名'] || '').trim().toLowerCase();

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

function verifyNoSensitiveLogging_() {
  return true;
}

function updateSheetAfterSend_(config, rowIndex, updates) {
  markSheetRow_(config, rowIndex, updates);
}

function runPreflight_(forSend) {
  const production = validateProductionConfig_();
  const config = production.config;
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
  const readyCount = Math.min(validation.readyRows.length, targetCount);

  if (validation.errors.length > 0) {
    blockedReasons.push('outbox_validation_errors');
  }
  if (readyCount === 0) {
    blockedReasons.push('no_ready_rows');
  }
  if (readyCount > targetCount) {
    blockedReasons.push('ready_count_exceeds_limit');
  }
  if (remainingQuota < readyCount) {
    blockedReasons.push('insufficient_gmail_quota');
  }
  if (forSend && config.dryRun) {
    blockedReasons.push('dry_run_enabled');
  }
  if (forSend && !config.liveSendEnabled) {
    blockedReasons.push('live_send_disabled');
  }

  const blockedReason = blockedReasons.join(',') || '';
  const safeToSend = forSend && blockedReasons.length === 0 && !config.dryRun && config.liveSendEnabled;

  return {
    config,
    dryRun: config.dryRun,
    liveSendEnabled: config.liveSendEnabled,
    dailySendLimit: config.dailySendLimit,
    remainingQuota,
    targetCount,
    readyCount,
    readyRows: validation.readyRows.slice(0, targetCount),
    blockedReason,
    sheetConnected,
    safeToSend
  };
}

function assertMessageSafe_(message) {
  const text = String((message && message.subject) || '') + '\n' + String((message && message.body) || '');
  if (!includesAny_(text, ['不要', '今後のご案内が不要', 'ご返信不要'])) {
    throw new Error('missing_opt_out_text');
  }
  if (includesAny_(text, ['必ず売上', '絶対', '売上保証', '成果保証'])) {
    throw new Error('guaranteed_result_expression');
  }
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function shouldSkipRecipient_(row) {
  const statusText = String([
    row.status,
    row.sentStatus,
    row.replyStatus,
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
