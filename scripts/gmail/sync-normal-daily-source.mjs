import crypto from 'node:crypto';
import {
  DEFAULT_POOL_FILE,
  OUTBOX_HEADERS,
  asCandidates,
  buildBatchId,
  candidateEmail,
  dedupeKey,
  isValidEmail,
  normalizeEmailBody,
  normalizeEmailSubject,
  parseArgs,
  readJson,
  safeSummary,
  sourceDomain
} from './pool-utils.mjs';

const AUTOMATION_VERSION = process.env.GMAIL_SALES_AUTOMATION_VERSION || 'normal-daily-v1';
const AUTO_APPROVAL_POLICY_VERSION = process.env.GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION || 'automatic-strict-gate-v1';
const SOURCE_TAB_NAME = 'Gmail営業候補プール';

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const targetDate = requireDate(args.date || process.env.GMAIL_SOURCE_SYNC_DATE);
const inputFile = args.input || args.pool || DEFAULT_POOL_FILE;
const dryRun = Boolean(args['dry-run']);
const write = Boolean(args.write);
const minRows = Number(args['min-rows'] || 30);

if (dryRun === write) {
  console.error('Specify exactly one of --dry-run or --write.');
  process.exit(1);
}

const source = readJson(inputFile, null);
const candidates = asCandidates(source);
const rows = buildSourceRows(candidates, targetDate);
const summary = {
  targetDate,
  mode: dryRun ? 'dry_run' : 'write',
  sourceTabName: SOURCE_TAB_NAME,
  inputCandidateCount: candidates.length,
  sourceRowsRequested: rows.length,
  sourceRowsWritten: 0,
  sourceRowsReadBack: 0,
  sourceDigestMatch: false,
  propertyConfigured: false,
  propertyWriteCount: 0,
  sourceTabCreated: false,
  gmailSendExecuted: false,
  sendTargetSheetUpdated: false,
  triggerChanged: false,
  webhookCalled: false,
  status: rows.length >= minRows ? 'pass' : 'blocked',
  blockedReason: rows.length >= minRows ? '' : 'source_rows_below_minimum'
};

if (rows.length < minRows) {
  console.log(safeSummary(summary));
  process.exit(1);
}

if (dryRun) {
  console.log(safeSummary(summary));
  process.exit(0);
}

const webhookUrl = String(process.env.GMAIL_APPS_SCRIPT_WEBHOOK_URL || process.env.GMAIL_SHEET_WEBHOOK_URL || '').trim();
const secret = String(process.env.GMAIL_AUTOMATION_SHARED_SECRET || '').trim();
if (!webhookUrl || !secret) {
  summary.status = 'blocked';
  summary.blockedReason = 'webhook_not_configured';
  console.log(safeSummary(summary));
  process.exit(1);
}

const payload = buildPayload(rows, secret);
summary.webhookCalled = true;
let responseBody;
if (webhookUrl.startsWith('mock://')) {
  responseBody = mockWebhookResponse(rows, webhookUrl);
} else {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  responseBody = await response.json();
}

Object.assign(summary, {
  status: responseBody.status || (responseBody.ok ? 'pass' : 'blocked'),
  blockedReason: responseBody.blockedReason || '',
  sourceTabCreated: Boolean(responseBody.sourceTabCreated),
  sourceRowsWritten: Number(responseBody.sourceRowsWritten || 0),
  sourceRowsReadBack: Number(responseBody.sourceRowsReadBack || 0),
  sourceDigestMatch: responseBody.sourceDigestMatch === true,
  propertyConfigured: responseBody.propertyConfigured === true,
  propertyWriteCount: Number(responseBody.propertyWriteCount || 0),
  gmailSendExecuted: false,
  sendTargetSheetUpdated: false,
  triggerChanged: false
});

console.log(safeSummary(summary));
if (summary.status !== 'pass' || summary.sourceRowsWritten !== rows.length || !summary.sourceDigestMatch || !summary.propertyConfigured) {
  process.exit(1);
}

function printHelp() {
  console.log('Usage: node scripts/gmail/sync-normal-daily-source.mjs --date YYYY-MM-DD --dry-run|--write [--input pool.json]');
}

function requireDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    console.error('--date YYYY-MM-DD is required.');
    process.exit(1);
  }
  return text;
}

function buildSourceRows(candidates, dateText) {
  const seen = { email: new Set(), domain: new Set(), business: new Set(), dedupe: new Set() };
  const eligible = [];
  for (const candidate of candidates) {
    if (!isVerifiedCandidate(candidate, dateText)) continue;
    const email = candidateEmail(candidate);
    const domain = sourceDomain(candidate);
    const business = String(candidate.name || candidate.businessName || '').trim().toLowerCase();
    const key = dedupeKey(candidate);
    if (seen.email.has(email) || seen.domain.has(domain) || seen.business.has(business) || seen.dedupe.has(key)) continue;
    seen.email.add(email);
    seen.domain.add(domain);
    seen.business.add(business);
    seen.dedupe.add(key);
    eligible.push(toOutboxRow(candidate, dateText));
  }
  return eligible.map((row) => OUTBOX_HEADERS.map((header) => row[header] ?? ''));
}

function isVerifiedCandidate(candidate, dateText) {
  const email = candidateEmail(candidate);
  const status = String(candidate.status || '').trim().toLowerCase();
  const verifiedDate = String(candidate.verifiedAt || candidate.lastCheckedAt || '').slice(0, 10);
  if (status !== 'available' && status !== 'ready') return false;
  if (String(candidate.verificationStatus || '').toLowerCase() !== 'verified') return false;
  if (verifiedDate !== dateText) return false;
  if (!isValidEmail(email)) return false;
  if (!candidate.sourceUrl && !candidate.publicSource) return false;
  if (String(candidate.doNotContact || '').toLowerCase() === 'true') return false;
  if (!normalizeEmailSubject(candidate.subject) || !normalizeEmailBody(candidate.body)) return false;
  if (!normalizeEmailBody(candidate.body).includes('不要')) return false;
  return true;
}

function toOutboxRow(candidate, dateText) {
  return {
    prospectId: candidate.prospectId || dedupeKey(candidate),
    name: candidate.name || candidate.businessName || '',
    businessType: candidate.businessType || '',
    area: candidate.area || '',
    email: candidateEmail(candidate),
    contactEmail: candidate.contactEmail || candidate.email || '',
    publicSource: candidate.publicSource || candidate.sourceUrl || '',
    sourceUrl: candidate.sourceUrl || candidate.publicSource || '',
    issueHypothesis: candidate.issueHypothesis || '',
    salesAngle: candidate.salesAngle || '',
    subject: normalizeEmailSubject(candidate.subject),
    body: normalizeEmailBody(candidate.body),
    status: 'ready',
    sendDate: '',
    nextActionDate: '',
    dedupeKey: candidate.dedupeKey || dedupeKey(candidate),
    sendBatchId: '',
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: false,
    doNotContact: false,
    lastCheckedAt: candidate.lastCheckedAt || `${dateText}T00:00:00+09:00`,
    notes: candidate.notes || 'verified normal daily source'
  };
}

function buildPayload(rows, secret) {
  const payload = {
    action: 'sync_normal_daily_source',
    mode: 'normal_daily',
    sourceType: 'normal_daily_source',
    dryRun: false,
    automationVersion: AUTOMATION_VERSION,
    autoApprovalPolicyVersion: AUTO_APPROVAL_POLICY_VERSION,
    targetDate,
    sendDate: targetDate,
    sendBatchId: buildBatchId(targetDate),
    sourceTabName: SOURCE_TAB_NAME,
    candidateCount: rows.length,
    verifiedCandidateCount: rows.length,
    sourceVerificationStatus: 'verified_only',
    headers: OUTBOX_HEADERS,
    rows,
    requestId: `gmail-source-sync-${targetDate}-${Date.now()}-${process.pid}`,
    timestamp: new Date().toISOString(),
    nonce: crypto.randomUUID()
  };
  payload.bodyDigest = sha256(bodyMaterial(payload));
  payload.signature = signPayload(payload, secret);
  return payload;
}

function bodyMaterial(payload) {
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

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update([
    payload.timestamp,
    payload.nonce,
    payload.requestId,
    payload.action,
    payload.targetDate,
    payload.bodyDigest
  ].join('\n')).digest('hex');
}

function mockWebhookResponse(rows, url) {
  if (url === 'mock://reject') return { ok: false, status: 'blocked', blockedReason: 'mock_reject' };
  return {
    ok: true,
    status: 'pass',
    sourceTabCreated: true,
    sourceRowsWritten: rows.length,
    sourceRowsReadBack: rows.length,
    sourceDigestMatch: true,
    propertyConfigured: true,
    propertyWriteCount: 1
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
