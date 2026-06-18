import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  asCandidates,
  candidateEmail,
  candidateName,
  dedupeKey,
  hashValue,
  hasOptOutText,
  isValidEmail,
  normalizeEmailBody,
  normalizeEmailSubject,
  parseArgs,
  readJson,
  sourceDomain,
  writeJson
} from './pool-utils.mjs';

class ManifestError extends Error {}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const dryRun = Boolean(args['dry-run']);
const targetDate = String(args.date || '').trim();
const maxSendCount = parseMaxSendCount(args['max-send-count']);
const expiresInMinutes = parseExpiresInMinutes(args['expires-in-minutes']);
const paths = resolvePaths(targetDate, args);

const result = {
  mode: dryRun ? 'dry_run' : 'create_manifest',
  targetDate,
  status: 'blocked',
  blockedReasons: [],
  wouldCreateManifest: false,
  manifestCreated: false,
  candidateCount: 0,
  candidateDigestCount: 0,
  candidateDigestUnique: false,
  maxSendCount,
  expiresInMinutes,
  approvalStatus: 'not_verified',
  humanReviewCompleted: false,
  approvedOutboxHashPresent: false,
  outboxHashVerified: false,
  suppressionLedgerLoaded: false,
  gmailSentHistoryLoaded: false,
  sheetHistoryLoaded: false,
  localHistoryLoaded: false,
  duplicateEmailCount: 0,
  duplicateDedupeKeyCount: 0,
  duplicateProspectIdCount: 0,
  invalidEmailCount: 0,
  suppressionMatchCount: 0,
  gmailSentHistoryMatchCount: 0,
  sheetHistoryMatchCount: 0,
  localHistoryMatchCount: 0,
  placeholderCount: 0,
  personalizationInvalidCount: 0,
  missingUnsubscribeCount: 0,
  emptySubjectCount: 0,
  emptyBodyCount: 0,
  outputFile: dryRun ? '' : paths.output,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  appsScriptExecuted: false,
  scriptPropertiesUpdated: false
};

try {
  validateArgs();
  const loaded = loadInputs(paths);
  const validation = validateInputs(loaded);
  Object.assign(result, validation.safe);

  if (validation.blockedReasons.length > 0) {
    result.blockedReasons = validation.blockedReasons;
    printAndExit(result, 1);
  }

  result.status = 'pass';
  result.wouldCreateManifest = true;

  if (dryRun) {
    printAndExit(result, 0);
  }

  writeJson(paths.output, validation.manifest);
  result.manifestCreated = true;
  printAndExit(result, 0);
} catch (error) {
  const reason = error instanceof ManifestError ? error.message : 'manifest_creation_failed';
  result.blockedReasons = unique([...result.blockedReasons, reason]);
  printAndExit(result, 1);
}

function printHelp() {
  console.log('Usage: node scripts/gmail/create-approved-gmail-send-manifest.mjs --date YYYY-MM-DD [--max-send-count 1] [--dry-run] [--output FILE] [--expires-in-minutes N]');
}

function validateArgs() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new ManifestError('date_required');
  }
  if (!Number.isInteger(maxSendCount) || maxSendCount < 1 || maxSendCount > 30) {
    throw new ManifestError('max_send_count_invalid');
  }
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 30) {
    throw new ManifestError('expires_in_minutes_invalid');
  }
}

function resolvePaths(dateText, cliArgs) {
  return {
    outbox: cliArgs['outbox-file'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${dateText}.json`),
    status: cliArgs['status-file'] || path.join('data', 'agent-status', 'tasks', `gmail-sales-safe-preparation-${dateText}.json`),
    preview: cliArgs['private-preview'] || path.join('tmp', 'gmail-sales-preview', `gmail-sales-${dateText}-private.tsv`),
    sheetsJson: cliArgs['sheets-json'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${dateText}-sheets-ready.json`),
    suppression: cliArgs['suppression-ledger'] || path.join('tmp', 'gmail-incident', 'suppression-ledger-safe.json'),
    sheetHistory: cliArgs['sheet-history'] || path.join('tmp', 'gmail-incident', 'google-sheet-send-history-safe.json'),
    historyDir: cliArgs['history-dir'] || path.join('data', 'gmail', 'outbox'),
    output: cliArgs.output || path.join('tmp', 'gmail-approved-send-manifest', `gmail-approved-send-manifest-${dateText}.json`)
  };
}

function loadInputs(filePaths) {
  if (!fs.existsSync(filePaths.outbox)) throw new ManifestError('outbox_not_found');
  if (!fs.existsSync(filePaths.status)) throw new ManifestError('status_file_not_found');
  if (!fs.existsSync(filePaths.preview)) throw new ManifestError('private_preview_not_found');
  const outbox = readJson(filePaths.outbox, null);
  const status = readJson(filePaths.status, null);
  if (!outbox || !status) throw new ManifestError('invalid_json');
  return {
    outboxPath: filePaths.outbox,
    statusPath: filePaths.status,
    previewPath: filePaths.preview,
    outbox,
    status
  };
}

function validateInputs(loaded) {
  const rows = asCandidates(loaded.outbox);
  const preview = readPrivatePreview(loaded.previewPath);
  const outboxHash = candidateContentHash(rows);
  const approvedOutboxHash = String(
    loaded.outbox.approvedOutboxHash ||
    loaded.status.approvedOutboxHash ||
    loaded.status.metrics?.approvedOutboxHash ||
    ''
  );
  const statusApproval = String(
    loaded.status.approvalStatus ||
    loaded.status.metrics?.approvalStatus ||
    loaded.outbox.approvalStatus ||
    ''
  );
  const humanReviewCompleted = loaded.outbox.humanReviewCompleted === true ||
    loaded.status.humanReviewCompleted === true ||
    loaded.status.metrics?.humanReviewCompleted === true;
  const outboxHumanReviewedCount = Number(loaded.outbox.humanReviewedCount || 0);
  const statusHumanReviewedCount = Number(loaded.status.humanReviewedCount || loaded.status.metrics?.humanReviewedCount || 0);
  const sendBatchId = String(loaded.outbox.sendBatchId || `gmail-sales-${targetDate}`);
  const suppression = loadSuppressionLedger(paths.suppression);
  const sheetHistory = loadHistoryHashes(paths.sheetHistory);
  const localHistory = loadLocalHistoryHashes(paths.historyDir, new Set([
    loaded.outboxPath,
    paths.sheetsJson
  ]), targetDate);
  const integrity = validateRows(rows);
  const digests = rows.map((row) => candidateDigest(row, targetDate, sendBatchId));
  const uniqueDigestCount = new Set(digests).size;
  const safe = {
    candidateCount: rows.length,
    candidateDigestCount: digests.length,
    candidateDigestUnique: uniqueDigestCount === digests.length,
    approvalStatus: statusApproval || 'not_verified',
    humanReviewCompleted,
    approvedOutboxHashPresent: Boolean(approvedOutboxHash),
    outboxHashVerified: Boolean(approvedOutboxHash && approvedOutboxHash === outboxHash),
    suppressionLedgerLoaded: suppression.loaded,
    gmailSentHistoryLoaded: suppression.loaded,
    sheetHistoryLoaded: sheetHistory.loaded,
    localHistoryLoaded: localHistory.loaded,
    duplicateEmailCount: integrity.duplicateEmailCount,
    duplicateDedupeKeyCount: integrity.duplicateDedupeKeyCount,
    duplicateProspectIdCount: integrity.duplicateProspectIdCount,
    invalidEmailCount: integrity.invalidEmailCount,
    suppressionMatchCount: countHistoryMatches(rows, suppression),
    gmailSentHistoryMatchCount: countHistoryMatches(rows, suppression),
    sheetHistoryMatchCount: countHistoryMatches(rows, sheetHistory),
    localHistoryMatchCount: countHistoryMatches(rows, localHistory),
    placeholderCount: integrity.placeholderCount,
    personalizationInvalidCount: integrity.personalizationInvalidCount,
    missingUnsubscribeCount: integrity.missingUnsubscribeCount,
    emptySubjectCount: integrity.emptySubjectCount,
    emptyBodyCount: integrity.emptyBodyCount
  };
  const blockedReasons = [];

  if (loaded.outbox.sendDate !== targetDate) blockedReasons.push('target_date_mismatch');
  if (loaded.status.status !== 'approved') blockedReasons.push('status_not_approved');
  if (statusApproval !== 'approved') blockedReasons.push('approval_status_not_approved');
  if (!humanReviewCompleted) blockedReasons.push('human_review_not_completed');
  if (outboxHumanReviewedCount !== rows.length || statusHumanReviewedCount !== rows.length) blockedReasons.push('human_review_count_mismatch');
  if (rows.length < 1) blockedReasons.push('candidate_count_empty');
  if (preview.rows.length !== rows.length) blockedReasons.push('preview_count_mismatch');
  if (!safe.approvedOutboxHashPresent) blockedReasons.push('approved_outbox_hash_missing');
  if (!safe.outboxHashVerified) blockedReasons.push('approved_outbox_hash_mismatch');
  if (!suppression.loaded) blockedReasons.push('suppression_ledger_missing');
  if (!sheetHistory.loaded) blockedReasons.push('sheet_history_missing');
  if (!localHistory.loaded) blockedReasons.push('local_history_missing');
  if (safe.duplicateEmailCount > 0) blockedReasons.push('duplicate_email');
  if (safe.duplicateDedupeKeyCount > 0) blockedReasons.push('duplicate_dedupe_key');
  if (safe.duplicateProspectIdCount > 0) blockedReasons.push('duplicate_prospect_id');
  if (safe.invalidEmailCount > 0) blockedReasons.push('invalid_email');
  if (safe.suppressionMatchCount > 0) blockedReasons.push('suppression_match');
  if (safe.sheetHistoryMatchCount > 0) blockedReasons.push('sheet_history_match');
  if (safe.localHistoryMatchCount > 0) blockedReasons.push('local_history_match');
  if (safe.placeholderCount > 0) blockedReasons.push('placeholder_detected');
  if (safe.personalizationInvalidCount > 0) blockedReasons.push('personalization_invalid');
  if (safe.missingUnsubscribeCount > 0) blockedReasons.push('missing_unsubscribe');
  if (safe.emptySubjectCount > 0) blockedReasons.push('empty_subject');
  if (safe.emptyBodyCount > 0) blockedReasons.push('empty_body');
  if (!safe.candidateDigestUnique) blockedReasons.push('candidate_digest_duplicate');

  return {
    safe,
    blockedReasons: unique(blockedReasons),
    manifest: buildManifest({
      loaded,
      rows,
      sendBatchId,
      approvedOutboxHash,
      outboxHash,
      digests
    })
  };
}

function buildManifest({ loaded, rows, sendBatchId, approvedOutboxHash, outboxHash, digests }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
  return {
    schemaVersion: 1,
    batchId: sendBatchId,
    targetDate,
    candidateCount: rows.length,
    approvedOutboxHash,
    manifestCreatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    candidateDigests: digests.slice().sort(),
    candidateDigestAlgorithm: 'sha256:normalizedEmail|normalizedSubject|normalizedBody|candidateId|targetDate|batchId',
    maxSendCount,
    sourceOutboxIdentity: {
      source: 'local_approved_outbox',
      candidateContentHash: outboxHash,
      approvalVersion: Number(loaded.outbox.approvalVersion || 0),
      statusDocument: 'approved'
    }
  };
}

function readPrivatePreview(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw ? raw.split(/\r?\n/) : [];
  const headers = lines[0] ? lines[0].split('\t') : [];
  const rows = lines.slice(1).filter(Boolean).map((line) => line.split('\t'));
  return { headers, rows };
}

function validateRows(rows) {
  return {
    duplicateEmailCount: duplicateCount(rows.map(candidateEmail)),
    duplicateDedupeKeyCount: duplicateCount(rows.map(dedupeKey)),
    duplicateProspectIdCount: duplicateCount(rows.map((row) => row.prospectId)),
    placeholderCount: rows.filter((row) => hasPlaceholder(row.subject) || hasPlaceholder(row.body)).length,
    personalizationInvalidCount: rows.filter((row) => !validatePersonalization(row)).length,
    missingUnsubscribeCount: rows.filter((row) => !hasOptOutText(row.body)).length,
    emptySubjectCount: rows.filter((row) => !String(row.subject || '').trim()).length,
    emptyBodyCount: rows.filter((row) => !String(row.body || '').trim()).length,
    invalidEmailCount: rows.filter((row) => !isValidEmail(candidateEmail(row))).length
  };
}

function validatePersonalization(row) {
  const body = normalizeEmailBody(row.body);
  const firstLine = body.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  const name = String(row.name || '').trim();
  return Boolean(name) &&
    firstLine.includes(name) &&
    /(さま|様)$/.test(firstLine) &&
    body.includes(name) &&
    !hasPlaceholder(body) &&
    !hasPlaceholder(row.subject) &&
    hasOptOutText(body);
}

function hasPlaceholder(value) {
  const text = String(value || '');
  return /undefined|null|\{\{|\}\}|\$\{/.test(text) || text.includes('\\n');
}

function loadSuppressionLedger(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value));
  return {
    loaded: Boolean(value),
    recipientHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.recipientHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
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

function loadLocalHistoryHashes(dir, excludedFiles, dateText) {
  const history = { loaded: fs.existsSync(dir), recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  if (!history.loaded) return history;
  const excluded = new Set([...excludedFiles].map((filePath) => path.resolve(filePath)));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    if (excluded.has(path.resolve(filePath))) continue;
    if (entry.name.includes(dateText)) continue;
    const rows = asCandidates(readJson(filePath, {}));
    rows.forEach((row) => addHistoryRow(row, history));
  }
  return history;
}

function addHistoryRow(row, history) {
  const email = candidateEmail(row);
  const domain = sourceDomain(row);
  const business = businessFingerprint(row);
  if (email) history.recipientHashes.add(hashValue(email));
  if (domain) history.domainHashes.add(hashValue(domain));
  if (business) history.businessFingerprints.add(business);
}

function countHistoryMatches(rows, history) {
  return rows.filter((row) => {
    const email = candidateEmail(row);
    const domain = sourceDomain(row);
    const business = businessFingerprint(row);
    return history.recipientHashes.has(hashValue(email)) ||
      history.domainHashes.has(hashValue(domain)) ||
      history.businessFingerprints.has(business);
  }).length;
}

function candidateDigest(row, dateText, batchId) {
  const candidateId = String(row.prospectId || dedupeKey(row) || '').trim().toLowerCase();
  const value = [
    candidateEmail(row),
    normalizeEmailSubject(row.subject),
    normalizeEmailBody(row.body),
    candidateId,
    dateText,
    String(batchId || '').trim()
  ].join('\n');
  return crypto.createHash('sha256').update(value).digest('hex');
}

function candidateContentHash(rows) {
  const projected = rows.map((row) => ({
    email: row.email || '',
    name: row.name || '',
    subject: row.subject || '',
    body: row.body || '',
    sourceUrl: row.sourceUrl || '',
    prospectId: row.prospectId || '',
    dedupeKey: row.dedupeKey || ''
  }));
  return crypto.createHash('sha256').update(JSON.stringify(projected)).digest('hex');
}

function businessFingerprint(candidate) {
  const name = candidateName(candidate);
  const domain = sourceDomain(candidate);
  return hashValue(`${domain}|${name}`);
}

function duplicateCount(values) {
  const seen = new Set();
  let count = 0;
  for (const value of values.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)) {
    if (seen.has(value)) count += 1;
    else seen.add(value);
  }
  return count;
}

function parseMaxSendCount(value) {
  if (value === undefined || value === true) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function parseExpiresInMinutes(value) {
  if (value === undefined || value === true) return 30;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function printAndExit(summary, code) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
}
