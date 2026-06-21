#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildBatchId,
  OUTBOX_HEADERS,
  parseArgs,
  resolveDateArg,
  toTsv
} from './pool-utils.mjs';

const AUTOMATION_VERSION = 'normal-daily-v1';
const AUTO_APPROVAL_POLICY_VERSION = 'automatic-strict-gate-v1';
const EXPECTED_COUNT = 30;
const DEFAULT_REQUESTED_SOURCE_COUNT = Math.max(EXPECTED_COUNT * 3, 90);
const envAutomationVersion = String(process.env.GMAIL_SALES_AUTOMATION_VERSION || '').trim();
const envApprovalPolicyVersion = String(process.env.GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION || '').trim();
const args = parseArgs(process.argv.slice(2));
const phase = String(args.phase || 'simulate').trim();
const targetDate = resolveDateArg(args['target-date'] || args.date, 'today');
const expectedCount = Number(args['expected-count'] || process.env.GMAIL_SALES_EXPECTED_DAILY_COUNT || EXPECTED_COUNT);
const requestedSourceCount = Number(args['requested-source-count'] || process.env.GMAIL_SALES_REQUESTED_SOURCE_COUNT || DEFAULT_REQUESTED_SOURCE_COUNT);
const dryRun = args['dry-run'] !== false && String(args['dry-run'] || '').toLowerCase() !== 'false';
const allowNetwork = args['allow-network'] === true || String(args['allow-network'] || process.env.GMAIL_DAILY_AUTOMATION_ALLOW_NETWORK || '').toLowerCase() === 'true';
const sourceMode = String(args['source-mode'] || (phase === 'simulate' ? 'synthetic' : 'apps-script')).trim();
const cleanup = args.cleanup === true || String(args.cleanup || '').toLowerCase() === 'true';
const outputDir = args['work-dir'] || args['output-dir'] || createDefaultWorkspacePath();
const sendBatchId = buildBatchId(targetDate);

const summary = {
  ok: false,
  phase,
  targetDate,
  mode: 'normal_daily',
  expectedCount,
  requestedSourceCount,
  sendBatchId,
  strictAutoApprovalPassed: false,
  manifestCreated: false,
  payloadCreated: false,
  webhookPrepared: false,
  webhookCalled: false,
  appsScriptPrepareAccepted: false,
  networkRequestCount: 0,
  sourceResolved: false,
  sourceMode,
  candidateCount: 0,
  sourceCount: 0,
  eligibleCandidateCount: 0,
  cleanupPassed: false,
  failedPhase: '',
  errorCode: '',
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdatedByNode: false,
  scriptPropertiesUpdatedByNode: false,
  triggerChanged: false,
  blockedReason: ''
};

try {
  validateArgs();
  fs.mkdirSync(outputDir, { recursive: true });
  if (phase === 'health-check') {
    summary.ok = true;
    print(summary, 0);
  }
  const prepared = await runFullPreparePipeline();
  summary.sourceResolved = true;
  summary.candidateCount = prepared.rows.length;
  const validation = validateStrictAutomaticApproval(prepared);
  summary.strictAutoApprovalPassed = validation.ok;
  if (!validation.ok) {
    summary.blockedReason = validation.blockedReasons.join(',');
    print(summary, 1);
  }
  const manifest = buildAutomaticManifest(prepared);
  const payload = buildPreparePayload(prepared, manifest);
  const payloadPath = path.join(outputDir, 'prepare-normal-daily-payload-private.json');
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`, 'utf8');
  summary.manifestCreated = true;
  summary.payloadCreated = true;
  summary.webhookPrepared = true;
  if (phase === 'simulate' || dryRun || !allowNetwork) {
    summary.ok = true;
    cleanupWorkspace();
    print(summary, 0);
  }
  const response = await postPreparePayload(payload);
  summary.webhookCalled = true;
  summary.networkRequestCount += response.mocked ? 0 : 1;
  summary.appsScriptPrepareAccepted = response.ok === true && response.status === 'pass';
  summary.ok = summary.appsScriptPrepareAccepted;
  summary.blockedReason = summary.ok ? '' : String(response.blockedReason || 'apps_script_prepare_rejected');
  cleanupWorkspace();
  print(summary, summary.ok ? 0 : 1);
} catch (error) {
  summary.errorCode = safeErrorCode(error);
  summary.blockedReason = summary.errorCode;
  if (error && error.failedPhase) summary.failedPhase = error.failedPhase;
  cleanupWorkspace();
  print(summary, 1);
}

function validateArgs() {
  if (!['prepare', 'simulate', 'health-check'].includes(phase)) {
    throw dailyError('phase_invalid', 'argument_validation');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw dailyError('target_date_invalid', 'argument_validation');
  }
  if (expectedCount !== EXPECTED_COUNT) {
    throw dailyError('expected_count_must_be_30', 'argument_validation');
  }
  if (!Number.isFinite(requestedSourceCount) || requestedSourceCount < expectedCount) {
    throw dailyError('requested_source_count_invalid', 'argument_validation');
  }
  const versionErrors = validateConfiguredVersions();
  if (versionErrors.length > 0) {
    throw dailyError(versionErrors.join(','), 'argument_validation');
  }
}

function validateConfiguredVersions() {
  const errors = [];
  if (!isConfiguredVersion(envAutomationVersion) || !isConfiguredVersion(envApprovalPolicyVersion)) {
    errors.push('version_not_configured');
  }
  if (isConfiguredVersion(envAutomationVersion) && envAutomationVersion !== AUTOMATION_VERSION) {
    errors.push('automation_version_mismatch');
  }
  if (isConfiguredVersion(envApprovalPolicyVersion) && envApprovalPolicyVersion !== AUTO_APPROVAL_POLICY_VERSION) {
    errors.push('approval_policy_version_mismatch');
  }
  return errors;
}

function isConfiguredVersion(value) {
  const text = String(value || '').trim();
  return Boolean(text) && text.toLowerCase() !== 'unset' && !text.startsWith('PASTE_');
}

async function runFullPreparePipeline() {
  const source = await resolveDailySource();
  const prepared = buildPreparedBatchFromSource(source);
  writeEphemeralArtifacts(prepared);
  return prepared;
}

async function resolveDailySource() {
  if (sourceMode === 'synthetic') {
    return {
      sourceResolved: true,
      sourceMode,
      headers: OUTBOX_HEADERS,
      rows: buildSyntheticPreparedBatch(requestedSourceCount).rows,
      sourceCount: requestedSourceCount,
      sourceSchemaVersion: 1,
      sourceSnapshotIdentity: 'synthetic'
    };
  }
  if (sourceMode !== 'apps-script') {
    throw dailyError('source_mode_unsupported', 'source_resolution');
  }
  if (!allowNetwork) {
    throw dailyError('source_input_unavailable', 'source_resolution');
  }
  const response = await postReadSourcePayload();
  summary.networkRequestCount += response.mocked ? 0 : 1;
  if (!response.ok || response.status !== 'pass') {
    throw dailyError(String(response.blockedReason || 'source_input_unavailable'), 'source_resolution');
  }
  return {
    sourceResolved: true,
    sourceMode,
    headers: Array.isArray(response.headers) ? response.headers : OUTBOX_HEADERS,
    rows: Array.isArray(response.rows) ? response.rows : [],
    sourceCount: Number(response.sourceCount || response.rows?.length || 0),
    sourceSchemaVersion: Number(response.sourceSchemaVersion || 1),
    sourceSnapshotIdentity: String(response.sourceSnapshotIdentity || '')
  };
}

function buildPreparedBatchFromSource(source) {
  if (!source || !Array.isArray(source.rows)) {
    throw dailyError('source_schema_invalid', 'source_validation');
  }
  summary.sourceCount = Number(source.sourceCount || source.rows.length || 0);
  if (source.rows.length < EXPECTED_COUNT) {
    throw dailyError('source_count_insufficient', 'source_validation');
  }
  const candidates = source.rows.map((row, index) => normalizeSourceRow(row, index));
  const eligibility = selectEligibleRows(candidates);
  summary.eligibleCandidateCount = eligibility.eligibleRows.length;
  if (eligibility.eligibleRows.length < EXPECTED_COUNT) {
    throw dailyError('eligible_candidate_count_insufficient', 'candidate_selection');
  }
  const rows = eligibility.eligibleRows.slice(0, EXPECTED_COUNT);
  return {
    headers: OUTBOX_HEADERS,
    rows,
    rowCells: rows.map((row) => OUTBOX_HEADERS.map((header) => row[header] ?? '')),
    sourceMode: source.sourceMode,
    sourceSchemaVersion: source.sourceSchemaVersion,
    sourceSnapshotIdentity: source.sourceSnapshotIdentity
  };
}

function selectEligibleRows(rows) {
  const seen = {
    email: new Set(),
    dedupeKey: new Set(),
    domain: new Set(),
    business: new Set()
  };
  const eligibleRows = [];
  const sorted = rows.slice().sort((a, b) => deterministicRank(a).localeCompare(deterministicRank(b)));
  for (const row of sorted) {
    const email = String(row.email || row.contactEmail || '').trim().toLowerCase();
    const dedupeKey = String(row.dedupeKey || '').trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    const business = String(row.name || '').trim().toLowerCase();
    const body = String(row.body || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (!String(row.subject || '').trim() || !body || !body.includes('不要')) continue;
    if (String(row.doNotContact || '').toLowerCase() === 'true') continue;
    if (String(row.status || '').toLowerCase() !== 'ready') continue;
    if (String(row.sendDate || '') !== targetDate) continue;
    if (String(row.sendBatchId || '') !== sendBatchId) continue;
    if (seen.email.has(email) || seen.dedupeKey.has(dedupeKey) || seen.domain.has(domain) || seen.business.has(business)) continue;
    seen.email.add(email);
    if (dedupeKey) seen.dedupeKey.add(dedupeKey);
    if (domain) seen.domain.add(domain);
    if (business) seen.business.add(business);
    eligibleRows.push(row);
  }
  return { eligibleRows };
}

function deterministicRank(row) {
  return [
    String(row.lastCheckedAt || ''),
    String(row.prospectId || ''),
    String(row.dedupeKey || ''),
    String(row.email || row.contactEmail || '')
  ].join('|');
}

function normalizeSourceRow(row, index) {
  const normalized = {};
  OUTBOX_HEADERS.forEach((header) => {
    normalized[header] = row?.[header] ?? '';
  });
  normalized.prospectId = String(normalized.prospectId || `normal-daily-${index + 1}`).trim();
  normalized.email = String(normalized.email || normalized.contactEmail || '').trim().toLowerCase();
  normalized.contactEmail = String(normalized.contactEmail || normalized.email || '').trim().toLowerCase();
  normalized.name = String(normalized.name || '').trim();
  normalized.subject = String(normalized.subject || '').trim();
  normalized.body = String(normalized.body || '').trim();
  normalized.status = 'ready';
  normalized.sendDate = targetDate;
  normalized.nextActionDate = normalized.nextActionDate || targetDate;
  normalized.dedupeKey = String(normalized.dedupeKey || `${normalized.email}|${normalized.name}`).trim().toLowerCase();
  normalized.sendBatchId = sendBatchId;
  return normalized;
}

function writeEphemeralArtifacts(prepared) {
  const artifactDir = path.join(outputDir, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const outboxPath = path.join(artifactDir, `gmail-sales-${targetDate}.json`);
  const sheetsJsonPath = path.join(artifactDir, `gmail-sales-${targetDate}-sheets-ready.json`);
  const sheetsTsvPath = path.join(artifactDir, `gmail-sales-${targetDate}-sheets-ready.tsv`);
  fs.writeFileSync(outboxPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sendDate: targetDate,
    sendBatchId,
    status: 'automatic_strict_gate_pending',
    candidates: prepared.rows
  })}\n`, 'utf8');
  fs.writeFileSync(sheetsJsonPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sendDate: targetDate,
    sendBatchId,
    rows: prepared.rows
  })}\n`, 'utf8');
  fs.writeFileSync(sheetsTsvPath, toTsv(prepared.rows), 'utf8');
  prepared.outboxPath = outboxPath;
  prepared.sheetsJsonPath = sheetsJsonPath;
  prepared.sheetsTsvPath = sheetsTsvPath;
}

function buildSyntheticPreparedBatch(count = EXPECTED_COUNT) {
  const rows = Array.from({ length: count }, (_, index) => ({
    prospectId: `synthetic-prospect-${index + 1}`,
    name: `Synthetic Business ${index + 1}`,
    businessType: 'service',
    area: 'Tokyo',
    email: `synthetic${index + 1}@example-${index + 1}.invalid`,
    contactEmail: `synthetic${index + 1}@example-${index + 1}.invalid`,
    publicSource: 'synthetic',
    sourceUrl: `https://example.invalid/synthetic/${index + 1}`,
    issueHypothesis: 'synthetic issue',
    salesAngle: 'synthetic angle',
    subject: `Synthetic subject ${index + 1}`,
    body: `Synthetic Business ${index + 1} 様\n安全確認用の本文です。\n今後のご案内が不要な場合はご返信不要です。`,
    status: 'ready',
    sendDate: targetDate,
    nextActionDate: targetDate,
    dedupeKey: `synthetic-dedupe-${index + 1}`,
    sendBatchId,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: '',
    doNotContact: '',
    lastCheckedAt: `2099-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    notes: ''
  }));
  return { headers: OUTBOX_HEADERS, rows, rowCells: rows.map((row) => OUTBOX_HEADERS.map((header) => row[header] ?? '')) };
}

function validateStrictAutomaticApproval(batch) {
  const blockedReasons = [];
  const rows = batch.rows || [];
  if (rows.length !== EXPECTED_COUNT) blockedReasons.push('candidate_count_not_30');
  const emails = new Set();
  const dedupeKeys = new Set();
  const domains = new Set();
  rows.forEach((row) => {
    const email = String(row.email || row.contactEmail || '').trim().toLowerCase();
    const dedupeKey = String(row.dedupeKey || '').trim().toLowerCase();
    const subject = String(row.subject || '').trim();
    const body = String(row.body || '').trim();
    const domain = email.split('@')[1] || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) blockedReasons.push('invalid_email');
    if (!subject) blockedReasons.push('empty_subject');
    if (!body) blockedReasons.push('empty_body');
    if (!body.includes('不要')) blockedReasons.push('missing_unsubscribe');
    if (String(row.status || '').toLowerCase() !== 'ready') blockedReasons.push('status_not_ready');
    if (String(row.sendDate || '') !== targetDate) blockedReasons.push('target_date_mismatch');
    if (String(row.sendBatchId || '') !== sendBatchId) blockedReasons.push('send_batch_id_mismatch');
    if (emails.has(email)) blockedReasons.push('duplicate_email');
    emails.add(email);
    if (dedupeKey) {
      if (dedupeKeys.has(dedupeKey)) blockedReasons.push('duplicate_dedupe_key');
      dedupeKeys.add(dedupeKey);
    }
    if (domain) {
      if (domains.has(domain)) blockedReasons.push('duplicate_domain');
      domains.add(domain);
    }
  });
  return { ok: blockedReasons.length === 0, blockedReasons: [...new Set(blockedReasons)] };
}

function buildAutomaticManifest(batch) {
  const rows = batch.rows;
  const candidateDigests = rows.map((row) => candidateDigest(row));
  const candidateContentHash = sha256(JSON.stringify(rows.map((row) => ({
    prospectId: row.prospectId || '',
    dedupeKey: row.dedupeKey || '',
    email: row.email || row.contactEmail || '',
    subject: row.subject || '',
    body: row.body || '',
    sendDate: row.sendDate || '',
    sendBatchId: row.sendBatchId || ''
  }))));
  const manifest = {
    schemaVersion: 1,
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    targetDate,
    batchId: sendBatchId,
    candidateCount: rows.length,
    expectedCandidateCount: EXPECTED_COUNT,
    approvedOutboxHash: candidateContentHash,
    approvalStatus: 'approved',
    approvalType: 'automatic_strict_gate',
    targetAutoApproved: true,
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    autoApprovalPolicyVersion: AUTO_APPROVAL_POLICY_VERSION,
    automationVersion: AUTOMATION_VERSION,
    autoApprovalPassedAt: new Date().toISOString(),
    maxSendCount: EXPECTED_COUNT,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    candidateDigests,
    sourceOutboxIdentity: {
      source: 'github_actions_normal_daily_prepare',
      sourceMode: batch.sourceMode || '',
      sourceSchemaVersion: batch.sourceSchemaVersion || 1,
      sourceSnapshotIdentity: batch.sourceSnapshotIdentity || '',
      candidateContentHash,
      outboxIdentityDigest: sha256(candidateDigests.slice().sort().join('\n')),
      statusDocument: 'automatic_strict_gate'
    }
  };
  manifest.manifestDigest = sha256(JSON.stringify(manifest));
  return manifest;
}

function buildPreparePayload(batch, manifest) {
  const payload = {
    action: 'prepare_normal_daily',
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    automationVersion: AUTOMATION_VERSION,
    autoApprovalPolicyVersion: AUTO_APPROVAL_POLICY_VERSION,
    targetDate,
    sendDate: targetDate,
    sendBatchId,
    candidateCount: batch.rows.length,
    schemaVersion: 1,
    requestId: `gmail-daily-${targetDate}-${Date.now()}-${process.pid}`,
    timestamp: new Date().toISOString(),
    nonce: crypto.randomUUID(),
    manifest,
    headers: batch.headers,
    rows: batch.rowCells,
    dryRun: false
  };
  payload.bodyDigest = sha256(webhookBodyMaterial(payload));
  payload.signature = signPayload(payload);
  return payload;
}

function signPayload(payload) {
  const secret = process.env.GMAIL_AUTOMATION_SHARED_SECRET || '';
  if (!secret && phase !== 'simulate') throw new Error('automation_shared_secret_missing');
  const material = [
    payload.timestamp,
    payload.nonce,
    payload.requestId,
    payload.action,
    payload.targetDate,
    payload.bodyDigest
  ].join('\n');
  return crypto.createHmac('sha256', secret || 'synthetic-secret').update(material).digest('hex');
}

async function postPreparePayload(payload) {
  const webhookUrl = process.env.GMAIL_APPS_SCRIPT_WEBHOOK_URL || '';
  if (!webhookUrl) throw dailyError('apps_script_webhook_url_missing', 'webhook_prepare');
  if (webhookUrl.startsWith('mock://')) {
    if (webhookUrl === 'mock://reject') return { ok: false, status: 'blocked', blockedReason: 'apps_script_prepare_rejected', mocked: true };
    if (webhookUrl === 'mock://timeout') throw dailyError('webhook_timeout', 'webhook_prepare');
    return { ok: true, status: 'pass', mocked: true };
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, status: 'blocked', blockedReason: 'apps_script_response_invalid_json' };
  }
}

async function postReadSourcePayload() {
  const webhookUrl = process.env.GMAIL_APPS_SCRIPT_WEBHOOK_URL || '';
  if (!webhookUrl) throw dailyError('source_input_unavailable', 'source_resolution');
  if (webhookUrl.startsWith('mock://')) {
    if (webhookUrl === 'mock://source-unavailable') return { ok: false, status: 'blocked', blockedReason: 'source_input_unavailable', mocked: true };
    if (webhookUrl === 'mock://source-29') {
      const source = buildSyntheticPreparedBatch(29);
      return { ok: true, status: 'pass', rows: source.rows.slice(0, 29), headers: source.headers, sourceCount: 29, sourceSchemaVersion: 1, mocked: true };
    }
    if (webhookUrl === 'mock://eligible-29') {
      const source = buildSyntheticPreparedBatch(90);
      source.rows.slice(29).forEach((row) => { row.doNotContact = 'true'; });
      return { ok: true, status: 'pass', rows: source.rows, headers: source.headers, sourceCount: 90, sourceSchemaVersion: 1, mocked: true };
    }
    if (webhookUrl === 'mock://source-duplicate') {
      const source = buildSyntheticPreparedBatch(90);
      source.rows[1].email = source.rows[0].email;
      source.rows[1].contactEmail = source.rows[0].contactEmail;
      return { ok: true, status: 'pass', rows: source.rows.slice(0, 30), headers: source.headers, sourceCount: 30, sourceSchemaVersion: 1, mocked: true };
    }
    return { ok: true, status: 'pass', ...buildSyntheticPreparedBatch(requestedSourceCount), sourceCount: requestedSourceCount, sourceSchemaVersion: 1, sourceSnapshotIdentity: 'mock', mocked: true };
  }
  const payload = buildSignedActionPayload('read_normal_daily_source');
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, status: 'blocked', blockedReason: 'source_response_invalid_json' };
  }
}

function buildSignedActionPayload(action) {
  const payload = {
    action,
    mode: 'normal_daily',
    sourceType: 'normal_daily',
    automationVersion: AUTOMATION_VERSION,
    autoApprovalPolicyVersion: AUTO_APPROVAL_POLICY_VERSION,
    targetDate,
    sendDate: targetDate,
    sendBatchId,
    expectedCount,
    requestedSourceCount,
    requestId: `gmail-daily-${action}-${targetDate}-${Date.now()}-${process.pid}`,
    timestamp: new Date().toISOString(),
    nonce: crypto.randomUUID()
  };
  payload.bodyDigest = sha256(gmailDailyActionBodyMaterial(payload));
  payload.signature = signPayload(payload);
  return payload;
}

function webhookBodyMaterial(payload) {
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

function gmailDailyActionBodyMaterial(payload) {
  return JSON.stringify({
    action: payload.action,
    targetDate: payload.targetDate,
    sendBatchId: payload.sendBatchId,
    expectedCount: payload.expectedCount,
    requestedSourceCount: payload.requestedSourceCount,
    mode: payload.mode,
    sourceType: payload.sourceType,
    automationVersion: payload.automationVersion,
    autoApprovalPolicyVersion: payload.autoApprovalPolicyVersion
  });
}

function candidateDigest(row) {
  return sha256([
    targetDate,
    sendBatchId,
    String(row.prospectId || row.dedupeKey || '').trim().toLowerCase(),
    String(row.email || row.contactEmail || '').trim().toLowerCase(),
    String(row.subject || '').trim(),
    String(row.body || '').replace(/\r\n/g, '\n').trim()
  ].join('\n'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeErrorCode(error) {
  const raw = error && error.message ? error.message : 'daily_automation_failed';
  if (/ENOENT/.test(raw)) return 'source_input_unavailable';
  return String(raw).replace(/[^a-zA-Z0-9_,:-]/g, '_').slice(0, 120);
}

function dailyError(code, failedPhase) {
  const error = new Error(code);
  error.failedPhase = failedPhase;
  return error;
}

function createDefaultWorkspacePath() {
  const root = process.env.RUNNER_TEMP || os.tmpdir();
  return path.join(root, 'ichi-gmail-sales', targetDate, `${Date.now()}-${process.pid}`);
}

function cleanupWorkspace() {
  if (!cleanup) {
    summary.cleanupPassed = true;
    return;
  }
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
    summary.cleanupPassed = true;
  } catch {
    summary.cleanupPassed = false;
    if (!summary.errorCode) summary.errorCode = 'workspace_cleanup_failed';
  }
}

function print(value, code) {
  const safe = { ...value };
  delete safe.payload;
  delete safe.manifest;
  console.log(JSON.stringify(safe, null, 2));
  process.exit(code);
}
