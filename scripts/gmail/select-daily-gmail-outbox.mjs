import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from '../lib/load-local-env.mjs';
import { DEFAULT_POOL_FILE, OUTBOX_HEADERS, addDaysToDate, asCandidates, buildBatchId, candidateEmail, candidateName, dedupeKey, hashValue, hasOptOutText, isAvailable, isValidEmail, normalizeEmailBody, normalizeEmailSubject, parseArgs, readJson, resolveDateArg, safeSummary, sourceDomain, toTsv, writeJson } from './pool-utils.mjs';

loadLocalEnv();

function printHelp() {
  console.log(`Usage: node scripts/gmail/select-daily-gmail-outbox.mjs [--date YYYY-MM-DD|today|tomorrow] [--next-action-date YYYY-MM-DD] [--pool data/gmail/pool/gmail-ready-candidate-pool.json] [--history-dir data/gmail/outbox]

Selects exactly 30 available candidates and writes Git-ignored outbox JSON/TSV. Defaults to tomorrow in JST. Does not send email.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}
const poolFile = args.pool || DEFAULT_POOL_FILE;
const sendDate = resolveDateArg(args.date, 'tomorrow');
const nextActionDate = args['next-action-date'] || addDaysToDate(sendDate, 2);
const sendBatchId = buildBatchId(sendDate);
const historyDir = args['history-dir'] || 'data/gmail/outbox';
const agentStatusDir = args['agent-status-dir'] || 'data/agent-status/tasks';
const suppressionLedgerFile = args['suppression-ledger'] || 'data/gmail/suppression/gmail-sent-suppression-ledger.json';
const sentDates = parseSentDates(args['sent-dates']) || collectSentDatesFromAgentStatus(agentStatusDir, sendDate);
const pool = readJson(poolFile, { candidates: [] });
const candidates = asCandidates(pool);
const historicalExclusions = collectHistoricalExclusions(historyDir, sendDate, sentDates);
const suppressionExclusions = loadSuppressionExclusions(suppressionLedgerFile);
const usedEmail = new Set();
const usedDedupe = new Set();
const usedBusiness = new Set();
const usedDomain = new Set();
const selected = [];
const summary = {
  poolTotal: candidates.length,
  availableChecked: 0,
  excludedHistorical: 0,
  excludedSuppressed: 0,
  sentDateExclusionCount: sentDates.size,
  duplicateWithPreviousBatch: false,
  duplicateCount: 0,
  selected: 0,
  shortage: 30,
  outboxCreated: false,
  sheetsReadyTsvCreated: false
};

if (!sendDate || !nextActionDate) {
  printHelp();
  process.exit(1);
}

for (const candidate of candidates) {
  if (!isAvailable(candidate)) continue;
  summary.availableChecked += 1;
  const email = candidateEmail(candidate);
  const key = dedupeKey(candidate);
  const businessKey = businessDedupeKey(candidate);
  const domainKey = sourceDomain(candidate);
  const subject = sanitizeSalesCopy(normalizeEmailSubject(candidate.subject || 'SNSの見え方について、簡単な無料確認のご案内'));
  const body = sanitizeSalesCopy(normalizeEmailBody(candidate.body || buildDefaultBody(candidate)));
  if (!isValidEmail(email)) continue;
  if (isHistoricallyUsed(candidate, historicalExclusions)) {
    summary.excludedHistorical += 1;
    continue;
  }
  if (isSuppressed(candidate, suppressionExclusions)) {
    summary.excludedSuppressed += 1;
    continue;
  }
  if (usedEmail.has(email) || usedDedupe.has(key) || usedBusiness.has(businessKey) || usedDomain.has(domainKey)) continue;
  if (!hasOptOutText(body)) continue;
  const copyVariant = selected.length < 15 ? 'A' : 'B';
  selected.push({
    prospectId: candidate.prospectId || key,
    name: candidate.name || '',
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
    copyVariant,
    campaignVariant: copyVariant,
    status: 'ready',
    sendDate,
    nextActionDate,
    dedupeKey: key,
    sendBatchId,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: false,
    doNotContact: false,
    lastCheckedAt: '',
    notes: 'Gmail-ready poolから切り出し'
  });
  usedEmail.add(email);
  usedDedupe.add(key);
  usedBusiness.add(businessKey);
  if (domainKey) usedDomain.add(domainKey);
  if (selected.length === 30) break;
}

summary.selected = selected.length;
summary.shortage = Math.max(0, 30 - selected.length);
summary.duplicateCount = countHistoricalDuplicates(selected, historicalExclusions);
summary.duplicateWithPreviousBatch = summary.duplicateCount > 0;
summary.copyVariantMode = 'local_metadata_only';
summary.copyVariantA = selected.filter((row) => row.copyVariant === 'A').length;
summary.copyVariantB = selected.filter((row) => row.copyVariant === 'B').length;
summary.copyVariantC = 0;
summary.copyVariantSheetColumnAdded = false;

if (selected.length !== 30 || summary.duplicateWithPreviousBatch) {
  console.log(safeSummary(summary));
  process.exit(2);
}

const outboxDir = 'data/gmail/outbox';
fs.mkdirSync(outboxDir, { recursive: true });
const outboxJson = path.join(outboxDir, `${sendDate}-gmail-sales-outbox-30.json`);
const sheetsJson = path.join(outboxDir, `${sendDate}-gmail-sales-sheets-ready.json`);
const sheetsTsv = path.join(outboxDir, `${sendDate}-gmail-sales-sheets-ready.tsv`);

writeJson(outboxJson, { generatedAt: new Date().toISOString(), candidates: selected });
writeJson(sheetsJson, { generatedAt: new Date().toISOString(), headers: OUTBOX_HEADERS, rows: selected });
fs.writeFileSync(sheetsTsv, toTsv(selected), 'utf8');

summary.outboxCreated = true;
summary.sheetsReadyTsvCreated = true;
console.log(safeSummary(summary));

function buildDefaultBody(candidate) {
  const name = candidate.name || 'ご担当者';
  return normalizeEmailBody(`${name} さま\n\n突然のご連絡失礼いたします。\nICHI Socialです。\n\n小規模店舗さま向けに、Instagramプロフィールや予約導線の見え方を整理するSNS運用サポートを行っています。\n\nもし現在SNS運用や予約導線の整理でお困りでしたら、無料で簡単に確認できます。\n\n今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\nICHI Social`);
}

function sanitizeSalesCopy(value) {
  return String(value || '')
    .replace(/必ず売上/g, '売上面でも')
    .replace(/売上保証/g, '改善の可能性')
    .replace(/成果保証/g, '改善の可能性')
    .replace(/絶対/g, '可能な範囲で')
    .replace(/必ず/g, '必要に応じて');
}

function collectHistoricalExclusions(dir, currentDate, sentDates) {
  const exclusions = {
    emails: new Set(),
    dedupeKeys: new Set(),
    businessKeys: new Set()
  };
  if (!fs.existsSync(dir)) return exclusions;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2}).*gmail-sales-outbox-30\.json$/);
    if (!match || match[1] >= currentDate || !sentDates.has(match[1])) continue;
    const rows = asCandidates(readJson(path.join(dir, entry.name), { candidates: [] }));
    for (const row of rows) {
      addExclusion(row, exclusions);
    }
  }
  return exclusions;
}

function addExclusion(candidate, exclusions) {
  const email = candidateEmail(candidate);
  const key = dedupeKey(candidate);
  const businessKey = businessDedupeKey(candidate);
  if (email) exclusions.emails.add(email);
  if (key) exclusions.dedupeKeys.add(key);
  if (businessKey) exclusions.businessKeys.add(businessKey);
}

function isHistoricallyUsed(candidate, exclusions) {
  const email = candidateEmail(candidate);
  const key = dedupeKey(candidate);
  const businessKey = businessDedupeKey(candidate);
  return exclusions.emails.has(email) || exclusions.dedupeKeys.has(key) || exclusions.businessKeys.has(businessKey);
}

function countHistoricalDuplicates(rows, exclusions) {
  return rows.filter((row) => isHistoricallyUsed(row, exclusions)).length;
}

function businessDedupeKey(candidate) {
  const name = candidateName(candidate);
  const domain = sourceDomain(candidate);
  return name && domain ? `${domain}|${name}` : '';
}

function loadSuppressionExclusions(filePath) {
  const entries = asCandidates(readJson(filePath, { entries: [] }));
  const exclusions = {
    recipientHashes: new Set(),
    businessFingerprints: new Set(),
    domainHashes: new Set()
  };
  for (const entry of entries) {
    if (entry.suppressed === false || entry.futureEligible === true) continue;
    if (entry.recipientHash) exclusions.recipientHashes.add(String(entry.recipientHash));
    if (entry.businessFingerprint) exclusions.businessFingerprints.add(String(entry.businessFingerprint));
    if (entry.normalizedDomainHash) exclusions.domainHashes.add(String(entry.normalizedDomainHash));
  }
  return exclusions;
}

function isSuppressed(candidate, exclusions) {
  const email = candidateEmail(candidate);
  const domain = sourceDomain(candidate);
  const businessKey = businessDedupeKey(candidate);
  return exclusions.recipientHashes.has(hashValue(email)) ||
    (domain && exclusions.domainHashes.has(hashValue(domain))) ||
    (businessKey && exclusions.businessFingerprints.has(hashValue(businessKey)));
}

function parseSentDates(value) {
  if (!value) return null;
  return new Set(String(value)
    .split(',')
    .map((date) => date.trim())
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)));
}

function collectSentDatesFromAgentStatus(dir, currentDate) {
  const dates = new Set();
  if (!fs.existsSync(dir)) return dates;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^gmail-daily-sales-send-(\d{4}-\d{2}-\d{2})\.json$/);
    if (!match || match[1] >= currentDate) continue;
    const task = readJson(path.join(dir, entry.name), null);
    if (isSentSuccess(task)) dates.add(match[1]);
  }
  return dates;
}

function isSentSuccess(task) {
  if (!task || task.status !== 'success') return false;
  const metrics = task.metrics || {};
  return Number(metrics.sentCount || 0) >= 30 ||
    Number(metrics.processed || 0) >= 30 ||
    metrics.batchMarkedSent === true;
}
