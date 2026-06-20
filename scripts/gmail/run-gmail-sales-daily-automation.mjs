#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildBatchId,
  parseArgs,
  readJson,
  resolveDateArg
} from './pool-utils.mjs';

const AUTOMATION_VERSION = 'normal-daily-v1';
const AUTO_APPROVAL_POLICY_VERSION = 'automatic-strict-gate-v1';
const EXPECTED_COUNT = 30;
const args = parseArgs(process.argv.slice(2));
const phase = String(args.phase || 'simulate').trim();
const targetDate = resolveDateArg(args['target-date'] || args.date, 'today');
const expectedCount = Number(args['expected-count'] || process.env.GMAIL_SALES_EXPECTED_DAILY_COUNT || EXPECTED_COUNT);
const dryRun = args['dry-run'] !== false && String(args['dry-run'] || '').toLowerCase() !== 'false';
const allowNetwork = args['allow-network'] === true || String(args['allow-network'] || process.env.GMAIL_DAILY_AUTOMATION_ALLOW_NETWORK || '').toLowerCase() === 'true';
const outputDir = args['output-dir'] || path.join('tmp', 'gmail-daily-automation', targetDate);
const sendBatchId = buildBatchId(targetDate);

const summary = {
  ok: false,
  phase,
  targetDate,
  mode: 'normal_daily',
  expectedCount,
  sendBatchId,
  strictAutoApprovalPassed: false,
  manifestCreated: false,
  payloadCreated: false,
  webhookPrepared: false,
  webhookCalled: false,
  appsScriptPrepareAccepted: false,
  networkRequestCount: 0,
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
  const prepared = phase === 'simulate'
    ? buildSyntheticPreparedBatch()
    : runLocalPreparePipeline();
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
    print(summary, 0);
  }
  const response = await postPreparePayload(payload);
  summary.webhookCalled = true;
  summary.networkRequestCount = 1;
  summary.appsScriptPrepareAccepted = response.ok === true && response.status === 'pass';
  summary.ok = summary.appsScriptPrepareAccepted;
  summary.blockedReason = summary.ok ? '' : String(response.blockedReason || 'apps_script_prepare_rejected');
  print(summary, summary.ok ? 0 : 1);
} catch (error) {
  summary.blockedReason = safeErrorCode(error);
  print(summary, 1);
}

function validateArgs() {
  if (!['prepare', 'simulate', 'health-check'].includes(phase)) {
    throw new Error('phase_invalid');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error('target_date_invalid');
  }
  if (expectedCount !== EXPECTED_COUNT) {
    throw new Error('expected_count_must_be_30');
  }
}

function runLocalPreparePipeline() {
  runNodeScript('scripts/gmail/prepare-daily-safe-sales-batch.mjs', ['--date', targetDate]);
  const outboxPath = path.join('data', 'gmail', 'outbox', `gmail-sales-${targetDate}.json`);
  const sheetsTsvPath = path.join('data', 'gmail', 'outbox', `gmail-sales-${targetDate}-sheets-ready.tsv`);
  const outbox = readJson(outboxPath, null);
  const tsv = readTsv(sheetsTsvPath);
  if (!outbox || !Array.isArray(tsv.rows)) throw new Error('prepared_outputs_missing');
  const rows = asRowsFromTsv(tsv.headers, tsv.rows);
  return { rows, headers: tsv.headers, rowCells: tsv.rows, outboxPath, sheetsTsvPath };
}

function runNodeScript(script, scriptArgs) {
  execFileSync(process.execPath, [script, ...scriptArgs], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
}

function buildSyntheticPreparedBatch() {
  const headers = [
    'prospectId', 'name', 'businessType', 'area', 'email', 'contactEmail',
    'publicSource', 'sourceUrl', 'issueHypothesis', 'salesAngle', 'subject',
    'body', 'status', 'sendDate', 'nextActionDate', 'dedupeKey', 'sendBatchId',
    'sentAt', 'sentBy', 'sentStatus', 'errorMessage', 'replyStatus',
    'unsubscribe', 'doNotContact', 'lastCheckedAt', 'notes'
  ];
  const rows = Array.from({ length: EXPECTED_COUNT }, (_, index) => ({
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
    lastCheckedAt: '',
    notes: ''
  }));
  return { headers, rows, rowCells: rows.map((row) => headers.map((header) => row[header] ?? '')) };
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
  if (!webhookUrl) throw new Error('apps_script_webhook_url_missing');
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

function readTsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw ? raw.split(/\r?\n/) : [];
  return {
    headers: lines[0] ? lines[0].split('\t') : [],
    rows: lines.slice(1).filter(Boolean).map((line) => line.split('\t'))
  };
}

function asRowsFromTsv(headers, rows) {
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeErrorCode(error) {
  const raw = error && error.message ? error.message : 'daily_automation_failed';
  return String(raw).replace(/[^a-zA-Z0-9_,:-]/g, '_').slice(0, 120);
}

function print(value, code) {
  const safe = { ...value };
  delete safe.payload;
  delete safe.manifest;
  console.log(JSON.stringify(safe, null, 2));
  process.exit(code);
}
