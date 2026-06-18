import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_POOL_FILE,
  addDaysToDate,
  asCandidates,
  buildBatchId,
  candidateEmail,
  candidateName,
  dedupeKey,
  hashValue,
  hasOptOutText,
  isAvailable,
  isValidEmail,
  normalizeEmailBody,
  normalizeEmailSubject,
  parseArgs,
  readJson,
  sourceDomain,
  toTsv,
  writeJson
} from './pool-utils.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const targetDate = resolveTargetDate(args.date);
const sendBatchId = buildBatchId(targetDate);
const taskId = `gmail-sales-safe-preparation-${targetDate}`;
const statusFile = args['status-file'] || `data/agent-status/tasks/${taskId}.json`;
const poolFile = args.pool || DEFAULT_POOL_FILE;
const suppressionLedgerFile = args['suppression-ledger'] || 'tmp/gmail-incident/suppression-ledger-safe.json';
const sheetHistoryFile = args['sheet-history'] || 'tmp/gmail-incident/google-sheet-send-history-safe.json';
const localHistoryDir = args['history-dir'] || 'data/gmail/outbox';
const outboxFile = args['outbox-file'] || `data/gmail/outbox/gmail-sales-${targetDate}.json`;
const sheetsReadyJson = args['sheets-json'] || `data/gmail/outbox/gmail-sales-${targetDate}-sheets-ready.json`;
const sheetsReadyTsv = args['sheets-tsv'] || `data/gmail/outbox/gmail-sales-${targetDate}-sheets-ready.tsv`;
const privatePreview = args['private-preview'] || `tmp/gmail-sales-preview/gmail-sales-${targetDate}-private.tsv`;

const pool = readJson(poolFile, {});
const candidates = asCandidates(pool);
const suppression = loadSuppressionLedger(suppressionLedgerFile);
const sheetHistory = loadHistoryHashes(sheetHistoryFile);
const localHistory = loadLocalHistoryHashes(localHistoryDir);
const freshness = evaluateSourceFreshness(pool, targetDate, args['freshness-days']);
const seen = {
  email: new Set(),
  business: new Set(),
  domain: new Set(),
  sourceRow: new Set()
};
const metrics = {
  targetDate,
  sendBatchId,
  inferredDate: !args.date,
  sourceFresh: freshness.ok,
  sourceFreshnessReason: freshness.reason,
  suppressionLedgerLoaded: suppression.loaded,
  gmailSentHistoryLoaded: suppression.loaded,
  sheetHistoryLoaded: sheetHistory.loaded,
  localHistoryLoaded: localHistory.loaded,
  availablePoolCount: 0,
  suppressedRecipientCount: 0,
  suppressedDomainCount: 0,
  suppressedBusinessCount: 0,
  sheetHistoryExcludedCount: 0,
  localHistoryExcludedCount: 0,
  staleSourceCount: freshness.ok ? 0 : candidates.length,
  invalidPersonalizationCount: 0,
  duplicateWithinCandidateCount: 0,
  invalidEmailCount: 0,
  safeCandidateCount: 0,
  selectedCount: 0,
  previewCreated: false,
  outboxCreated: false,
  sheetsReadyTsvCreated: false,
  humanApprovalPending: true,
  liveSendEnabled: false,
  autoSendEnabled: false,
  gmailSendExecutedByThisRun: false,
  googleSheetsUpdatedByThisRun: false,
  appsScriptTriggerChangedByThisRun: false
};

const blockingReasons = [];
if (!freshness.ok) blockingReasons.push('stale_source_list');
if (!suppression.loaded) blockingReasons.push('suppression_ledger_missing');
if (!sheetHistory.loaded) blockingReasons.push('sheet_history_missing');
if (!localHistory.loaded) blockingReasons.push('local_history_missing');
if (targetDate < jstDate()) blockingReasons.push('target_date_in_past');
if (isWeekend(targetDate)) blockingReasons.push('target_date_weekend');

const safeRows = [];
const previewRows = [];

if (blockingReasons.length === 0) {
  for (const candidate of candidates) {
    if (!isAvailable(candidate)) continue;
    metrics.availablePoolCount += 1;
    const normalized = normalizeCandidate(candidate, targetDate, sendBatchId);
    if (!normalized.email || !isValidEmail(normalized.email)) {
      metrics.invalidEmailCount += 1;
      continue;
    }
    const suppressionReason = suppressionReasonFor(normalized, suppression);
    if (suppressionReason === 'recipient') {
      metrics.suppressedRecipientCount += 1;
      continue;
    }
    if (suppressionReason === 'domain') {
      metrics.suppressedDomainCount += 1;
      continue;
    }
    if (suppressionReason === 'business') {
      metrics.suppressedBusinessCount += 1;
      continue;
    }
    if (isInHistory(normalized, sheetHistory)) {
      metrics.sheetHistoryExcludedCount += 1;
      continue;
    }
    if (isInHistory(normalized, localHistory)) {
      metrics.localHistoryExcludedCount += 1;
      continue;
    }
    if (hasDuplicateWithinBatch(normalized, seen)) {
      metrics.duplicateWithinCandidateCount += 1;
      continue;
    }
    const personalization = validatePersonalization(normalized);
    if (!personalization.ok) {
      metrics.invalidPersonalizationCount += 1;
      continue;
    }

    safeRows.push(normalized.outboxRow);
    previewRows.push(buildSafePreviewRow(normalized, personalization));
    markSeen(normalized, seen);
    if (safeRows.length === 30) break;
  }
}

metrics.safeCandidateCount = safeRows.length;
metrics.selectedCount = safeRows.length;

if (blockingReasons.length === 0 && safeRows.length > 0) {
  writePrivatePreview(privatePreview, safeRows);
  metrics.previewCreated = true;
  writeJson(outboxFile, {
    generatedAt: new Date().toISOString(),
    sendDate: targetDate,
    sendBatchId,
    status: 'needs_human_review',
    approved: false,
    liveSendEnabled: false,
    autoSendEnabled: false,
    salesCompletionStatus: 'not_sent',
    safePreview: previewRows,
    candidates: safeRows
  });
  writeJson(sheetsReadyJson, { generatedAt: new Date().toISOString(), sendDate: targetDate, sendBatchId, rows: safeRows });
  fs.mkdirSync(path.dirname(sheetsReadyTsv), { recursive: true });
  fs.writeFileSync(sheetsReadyTsv, toTsv(safeRows), 'utf8');
  metrics.outboxCreated = true;
  metrics.sheetsReadyTsvCreated = true;
} else if (safeRows.length === 0 && blockingReasons.length === 0) {
  blockingReasons.push('no_safe_candidates');
}

const status = buildStatusTask({
  taskId,
  targetDate,
  sendBatchId,
  statusFile,
  metrics,
  blockingReasons,
  privatePreview
});
writeJson(statusFile, status);
console.log(JSON.stringify({
  targetDate,
  sendBatchId,
  status: status.status,
  blockedReasons: blockingReasons,
  sourceFresh: metrics.sourceFresh,
  suppressionLedgerLoaded: metrics.suppressionLedgerLoaded,
  gmailSentHistoryLoaded: metrics.gmailSentHistoryLoaded,
  sheetHistoryLoaded: metrics.sheetHistoryLoaded,
  localHistoryLoaded: metrics.localHistoryLoaded,
  availablePoolCount: metrics.availablePoolCount,
  suppressedRecipientCount: metrics.suppressedRecipientCount,
  suppressedDomainCount: metrics.suppressedDomainCount,
  suppressedBusinessCount: metrics.suppressedBusinessCount,
  invalidPersonalizationCount: metrics.invalidPersonalizationCount,
  safeCandidateCount: metrics.safeCandidateCount,
  selectedCount: metrics.selectedCount,
  outboxCreated: metrics.outboxCreated,
  privatePreviewCreated: metrics.previewCreated,
  gmailSendExecutedByThisRun: false,
  googleSheetsUpdatedByThisRun: false
}, null, 2));

function printHelp() {
  console.log('Usage: node scripts/gmail/prepare-daily-safe-sales-batch.mjs --date YYYY-MM-DD');
}

function resolveTargetDate(value) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  let date = addDaysToDate(jstDate(), 1);
  while (isWeekend(date)) date = addDaysToDate(date, 1);
  return date;
}

function jstDate() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function isWeekend(dateText) {
  const day = new Date(`${dateText}T00:00:00+09:00`).getDay();
  return day === 0 || day === 6;
}

function evaluateSourceFreshness(poolValue, targetDateText, freshnessDaysArg) {
  const freshnessDays = Number(freshnessDaysArg || 3);
  const raw = poolValue.generatedAt || poolValue.updatedAt || poolValue.sourceGeneratedAt || poolValue.selectedAt || poolValue.lastRefreshedAt;
  if (!raw) return { ok: false, reason: 'missing_source_timestamp' };
  const sourceDate = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return { ok: false, reason: 'invalid_source_timestamp' };
  const ageDays = Math.floor((new Date(`${targetDateText}T00:00:00+09:00`) - new Date(`${sourceDate}T00:00:00+09:00`)) / 86400000);
  return { ok: ageDays >= 0 && ageDays <= freshnessDays, reason: ageDays >= 0 && ageDays <= freshnessDays ? 'fresh' : 'stale_source_list' };
}

function loadSuppressionLedger(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value));
  return {
    loaded: Boolean(value && entries.length > 0),
    recipientHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.recipientHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.normalizedDomainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadHistoryHashes(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value.rows || value));
  return {
    loaded: Boolean(value),
    recipientHashes: new Set(entries.map((entry) => String(entry.recipientHash || entry.emailHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadLocalHistoryHashes(dir) {
  if (!fs.existsSync(dir)) return { loaded: false, recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  const history = { loaded: true, recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const rows = asCandidates(readJson(path.join(dir, entry.name), {}));
    rows.forEach((row) => addHistoryHash(row, history));
  }
  return history;
}

function addHistoryHash(row, history) {
  const email = candidateEmail(row);
  const domain = sourceDomain(row);
  const business = businessFingerprint(row);
  if (email) history.recipientHashes.add(hashValue(email));
  if (domain) history.domainHashes.add(hashValue(domain));
  if (business) history.businessFingerprints.add(business);
}

function normalizeCandidate(candidate, sendDate, batchId) {
  const email = candidateEmail(candidate);
  const businessName = candidate.name || candidate.businessName || candidate.storeName || '';
  const greetingName = candidate.customerName || candidate.greetingName || businessName;
  const subject = normalizeEmailSubject(candidate.subject || 'SNSの見え方について、簡単な無料確認のご案内');
  const body = normalizeEmailBody(candidate.body || buildDefaultBody(greetingName));
  const domain = sourceDomain(candidate);
  const sourceRowId = candidate.sourceRowId || candidate.prospectId || candidate.id || dedupeKey(candidate);
  return {
    email,
    businessName: String(businessName || '').trim(),
    greetingName: String(greetingName || '').trim(),
    domain,
    recipientHash: hashValue(email),
    domainHash: hashValue(domain),
    businessFingerprint: businessFingerprint(candidate),
    sourceRowId,
    sourceRowHash: hashValue(sourceRowId),
    templateVersion: candidate.templateVersion || 'default-v1',
    subject,
    body,
    outboxRow: {
      prospectId: candidate.prospectId || dedupeKey(candidate),
      name: businessName,
      businessType: candidate.businessType || '',
      area: candidate.area || '',
      email,
      contactEmail: candidate.contactEmail || '',
      publicSource: candidate.publicSource || '',
      sourceUrl: candidate.sourceUrl || '',
      issueHypothesis: candidate.issueHypothesis || '',
      salesAngle: candidate.salesAngle || '',
      subject,
      body,
      status: 'ready',
      sendDate,
      nextActionDate: addDaysToDate(sendDate, 2),
      dedupeKey: dedupeKey(candidate),
      sendBatchId: batchId,
      sentAt: '',
      sentBy: '',
      sentStatus: '',
      errorMessage: '',
      replyStatus: '',
      unsubscribe: false,
      doNotContact: false,
      lastCheckedAt: '',
      notes: 'safe daily preparation; human approval required'
    }
  };
}

function businessFingerprint(candidate) {
  const name = candidateName(candidate);
  const domain = sourceDomain(candidate);
  return hashValue(`${domain}|${name}`);
}

function buildDefaultBody(greetingName) {
  return normalizeEmailBody(`${greetingName} さま\n\n突然のご連絡失礼いたします。\nICHI Socialです。\n\n小規模店舗さま向けに、Instagramプロフィールや予約導線の見え方を整理するSNS運用サポートを行っています。\n\n今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\nICHI Social`);
}

function suppressionReasonFor(candidate, ledger) {
  if (ledger.recipientHashes.has(candidate.recipientHash)) return 'recipient';
  if (candidate.domainHash && ledger.domainHashes.has(candidate.domainHash)) return 'domain';
  if (candidate.businessFingerprint && ledger.businessFingerprints.has(candidate.businessFingerprint)) return 'business';
  return '';
}

function isInHistory(candidate, history) {
  return history.recipientHashes.has(candidate.recipientHash) ||
    history.domainHashes.has(candidate.domainHash) ||
    history.businessFingerprints.has(candidate.businessFingerprint);
}

function hasDuplicateWithinBatch(candidate, seen) {
  return seen.email.has(candidate.recipientHash) ||
    seen.business.has(candidate.businessFingerprint) ||
    seen.domain.has(candidate.domainHash) ||
    seen.sourceRow.has(candidate.sourceRowHash);
}

function markSeen(candidate, seen) {
  seen.email.add(candidate.recipientHash);
  seen.business.add(candidate.businessFingerprint);
  seen.domain.add(candidate.domainHash);
  seen.sourceRow.add(candidate.sourceRowHash);
}

function validatePersonalization(candidate) {
  const reasons = [];
  const body = normalizeEmailBody(candidate.body);
  const firstLine = body.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  if (!candidate.businessName) reasons.push('missing_business_name');
  if (!candidate.greetingName) reasons.push('missing_greeting_name');
  if (!firstLine || !firstLine.includes(candidate.greetingName) || !/(さま|様)$/.test(firstLine)) reasons.push('greeting_mismatch');
  if (candidate.businessName && !body.includes(candidate.businessName)) reasons.push('business_name_not_in_body');
  if (['{{', '}}', '${name}', '${storeName}', 'undefined', 'null'].some((token) => body.includes(token))) reasons.push('placeholder_remaining');
  if (!hasOptOutText(body)) reasons.push('missing_opt_out_text');
  return { ok: reasons.length === 0, reasons };
}

function buildSafePreviewRow(candidate, personalization) {
  const body = normalizeEmailBody(candidate.body);
  const firstLine = body.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  return {
    rowIndex: null,
    recipientHash: candidate.recipientHash,
    businessFingerprint: candidate.businessFingerprint,
    bodyHash: hashValue(body),
    greetingHash: hashValue(firstLine),
    templateVersion: candidate.templateVersion,
    personalizationMatch: personalization.ok,
    suppressed: false,
    sourceFresh: true,
    eligible: true,
    blockedReasons: personalization.reasons
  };
}

function writePrivatePreview(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const header = ['email', 'businessName', 'greeting', 'subject', 'bodyPreview', 'sourceRow'];
  const lines = rows.map((row) => [
    row.email,
    row.name,
    row.name,
    row.subject,
    normalizeEmailBody(row.body).slice(0, 120),
    row.prospectId
  ].map((value) => String(value || '').replace(/\r?\n/g, ' ').replace(/\t/g, ' ')).join('\t'));
  fs.writeFileSync(filePath, [header.join('\t'), ...lines].join('\n') + '\n', 'utf8');
}

function buildStatusTask({ taskId, targetDate, metrics, blockingReasons, privatePreview }) {
  const blocked = blockingReasons.length > 0;
  return {
    id: taskId,
    agent: 'Codex',
    avatar: 'ops-monitor',
    title: `Gmail安全通常営業準備 ${targetDate}`,
    category: 'gmail_send',
    status: blocked ? 'blocked' : 'needs_review',
    phase: blocked ? '安全条件未達・outbox未作成' : 'safe outbox準備済み・人間承認待ち',
    progress: blocked ? 55 : 85,
    priority: 'critical',
    createdAt: `${targetDate}T00:00:00.000+09:00`,
    updatedAt: new Date().toISOString(),
    summary: 'Gmail Sent suppression ledger、Sheet履歴、ローカル履歴、候補鮮度、パーソナライズを確認し、安全な通常営業再開用候補を準備する。',
    artifacts: [
      'scripts/gmail/prepare-daily-safe-sales-batch.mjs'
    ],
    metrics: Object.assign({}, metrics, {
      privatePreviewPath: privatePreview,
      safeToAct: false,
      blockedReasons: blockingReasons
    }),
    nextAction: blocked
      ? '不足している履歴/suppression ledger/候補鮮度を解消し、再度safe preparationを実行する。'
      : '人間がprivate previewを確認し、Apps Script診断と承認チェックサム確認へ進む。',
    safeToAct: false,
    notes: [
      'Gmail送信なし',
      'Google Sheets更新なし',
      'Apps Scriptトリガー操作なし',
      '人間承認なしでは送信可能にしない',
      'private previewはGit追加禁止'
    ]
  };
}
