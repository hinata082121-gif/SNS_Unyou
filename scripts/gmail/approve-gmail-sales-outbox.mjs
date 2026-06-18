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
  parseArgs,
  readJson,
  sourceDomain
} from './pool-utils.mjs';

class ApprovalError extends Error {}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const dryRun = Boolean(args['dry-run']);
const targetDate = String(args.date || '').trim();
const reviewer = String(args.reviewer || '').trim();
const confirmReviewCount = numberArg(args['confirm-review-count']);
const expectedCandidateCount = args['expected-candidate-count'] === undefined
  ? null
  : numberArg(args['expected-candidate-count']);
const expectedOutboxHash = String(args['expected-outbox-hash'] || '').trim();
const approvalVersion = 1;
const paths = resolvePaths(targetDate, args);

const result = {
  mode: dryRun ? 'dry_run' : 'approve',
  targetDate,
  status: 'blocked',
  blockedReasons: [],
  approvalMechanism: 'gmail_outbox_only',
  approvalSeparatedFromSending: true,
  wouldApprove: false,
  approvalExecuted: false,
  approvalExecutionCount: 0,
  alreadyApproved: false,
  previousStatus: 'unknown',
  currentStatus: 'unchanged',
  approvalStatus: 'not_recorded',
  humanReviewCompleted: false,
  humanReviewedCount: 0,
  outboxCandidateCount: 0,
  previewCandidateCount: 0,
  countsMatch: false,
  candidateContentUnchanged: true,
  outboxHashVerified: true,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  appsScriptExecuted: false,
  triggerChanged: false,
  scriptPropertiesChanged: false
};

try {
  validateArgs();
  const loaded = loadApprovalInputs(paths);
  const validation = validateApprovalInputs(loaded);
  Object.assign(result, validation.safe);

  if (validation.blockedReasons.length > 0) {
    result.blockedReasons = validation.blockedReasons;
    printAndExit(result, 1);
  }

  if (validation.alreadyApproved) {
    Object.assign(result, {
      status: 'pass',
      wouldApprove: false,
      approvalExecuted: false,
      approvalExecutionCount: 0,
      alreadyApproved: true,
      currentStatus: 'approved',
      approvalStatus: 'approved',
      humanReviewCompleted: true,
      humanReviewedCount: validation.safe.outboxCandidateCount
    });
    printAndExit(result, 0);
  }

  result.status = 'pass';
  result.wouldApprove = true;

  if (dryRun) {
    printAndExit(result, 0);
  }

  const approvedAt = new Date().toISOString();
  const updated = buildApprovedDocuments(loaded, validation.outboxHash, approvedAt);
  writeApprovalDocuments(paths, loaded, updated);
  const after = loadApprovalInputs(paths);
  const afterHash = candidateContentHash(asCandidates(after.outbox));
  if (afterHash !== validation.outboxHash) {
    throw new ApprovalError('candidate_content_changed_after_write');
  }

  Object.assign(result, {
    approvalExecuted: true,
    approvalExecutionCount: 1,
    currentStatus: 'approved',
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    humanReviewedCount: validation.safe.outboxCandidateCount
  });
  printAndExit(result, 0);
} catch (error) {
  const reason = error instanceof ApprovalError ? error.message : 'approval_failed';
  result.blockedReasons = unique([...result.blockedReasons, reason]);
  printAndExit(result, 1);
}

function printHelp() {
  console.log('Usage: node scripts/gmail/approve-gmail-sales-outbox.mjs --date YYYY-MM-DD --reviewer human --confirm-review-count 30 [--dry-run] [--expected-outbox-hash HASH] [--expected-candidate-count N]');
}

function validateArgs() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new ApprovalError('date_required');
  }
  if (!reviewer) {
    throw new ApprovalError('reviewer_required');
  }
  if (!Number.isInteger(confirmReviewCount) || confirmReviewCount <= 0) {
    throw new ApprovalError('confirm_review_count_required');
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
    historyDir: cliArgs['history-dir'] || path.join('data', 'gmail', 'outbox')
  };
}

function loadApprovalInputs(filePaths) {
  const outboxFiles = findOutboxFiles(filePaths.outbox);
  if (outboxFiles.length !== 1) {
    throw new ApprovalError(outboxFiles.length === 0 ? 'outbox_not_found' : 'multiple_outboxes_found');
  }
  const outboxPath = outboxFiles[0];
  if (!fs.existsSync(filePaths.status)) throw new ApprovalError('status_file_not_found');
  if (!fs.existsSync(filePaths.preview)) throw new ApprovalError('private_preview_not_found');
  const outbox = readJson(outboxPath, null);
  const status = readJson(filePaths.status, null);
  if (!outbox || !status) throw new ApprovalError('invalid_json');
  return {
    outboxPath,
    statusPath: filePaths.status,
    previewPath: filePaths.preview,
    outbox,
    status
  };
}

function findOutboxFiles(defaultOutbox) {
  if (args['outbox-file']) return fs.existsSync(defaultOutbox) ? [defaultOutbox] : [];
  const dir = path.dirname(defaultOutbox);
  const base = path.basename(defaultOutbox);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name === base)
    .map((name) => path.join(dir, name));
}

function validateApprovalInputs(loaded) {
  const outboxRows = asCandidates(loaded.outbox);
  const preview = readPrivatePreview(loaded.previewPath);
  const outboxHash = candidateContentHash(outboxRows);
  const safe = {
    previousStatus: String(loaded.status.status || 'unknown'),
    outboxCandidateCount: outboxRows.length,
    previewCandidateCount: preview.rows.length,
    countsMatch: outboxRows.length === preview.rows.length,
    candidateContentUnchanged: true,
    outboxHashVerified: !expectedOutboxHash || expectedOutboxHash === outboxHash
  };
  const blockedReasons = [];

  if (loaded.outbox.sendDate !== targetDate) blockedReasons.push('target_date_mismatch');
  if (loaded.status.status !== 'needs_review') blockedReasons.push('status_not_needs_review');
  if (outboxRows.length !== confirmReviewCount) blockedReasons.push('confirm_review_count_mismatch');
  if (expectedCandidateCount !== null && outboxRows.length !== expectedCandidateCount) blockedReasons.push('expected_candidate_count_mismatch');
  if (outboxRows.length !== 30) blockedReasons.push('candidate_count_not_30');
  if (preview.rows.length !== outboxRows.length) blockedReasons.push('preview_count_mismatch');
  if (!previewMatchesOutbox(preview, outboxRows)) blockedReasons.push('preview_candidate_set_mismatch');
  if (isApproved(loaded.outbox)) {
    const approvedHash = String(loaded.outbox.approvedOutboxHash || '');
    const sameApproval = approvedHash === outboxHash &&
      Number(loaded.outbox.humanReviewedCount || 0) === outboxRows.length &&
      Number(loaded.outbox.approvalVersion || 0) === approvalVersion;
    if (sameApproval) {
      return { safe, blockedReasons: [], alreadyApproved: true, outboxHash };
    }
    blockedReasons.push('approval_conflict');
  }
  if (!safe.outboxHashVerified) blockedReasons.push('expected_outbox_hash_mismatch');
  if (hasSentState(loaded.outbox, outboxRows)) blockedReasons.push('sent_state_present');

  const integrity = validateRows(outboxRows);
  blockedReasons.push(...integrity.blockedReasons);
  const suppression = loadSuppressionLedger(paths.suppression);
  const sheetHistory = loadHistoryHashes(paths.sheetHistory);
  const localHistory = loadLocalHistoryHashes(paths.historyDir, new Set([loaded.outboxPath, paths.sheetsJson]));
  if (countHistoryMatches(outboxRows, suppression) > 0) blockedReasons.push('suppression_match');
  if (countHistoryMatches(outboxRows, sheetHistory) > 0) blockedReasons.push('sheet_history_match');
  if (countHistoryMatches(outboxRows, localHistory) > 0) blockedReasons.push('local_history_match');

  return {
    safe,
    blockedReasons: unique(blockedReasons),
    alreadyApproved: false,
    outboxHash
  };
}

function buildApprovedDocuments(loaded, outboxHash, approvedAt) {
  const outbox = {
    ...loaded.outbox,
    approvalStatus: 'approved',
    approved: true,
    humanReviewCompleted: true,
    humanReviewedCount: confirmReviewCount,
    approvedAt,
    approvedBy: reviewer,
    approvalVersion,
    approvedOutboxHash: outboxHash
  };
  const status = {
    ...loaded.status,
    status: 'approved',
    updatedAt: approvedAt,
    approvalStatus: 'approved',
    humanReviewCompleted: true,
    humanReviewedCount: confirmReviewCount,
    approvedAt,
    approvedBy: reviewer,
    approvedOutboxHash: outboxHash,
    metrics: {
      ...(loaded.status.metrics || {}),
      approvalStatus: 'approved',
      humanReviewCompleted: true,
      humanReviewedCount: confirmReviewCount,
      approvedAt,
      approvedBy: reviewer,
      approvedOutboxHash: outboxHash,
      gmailSendExecutedByThisRun: false,
      googleSheetsUpdatedByThisRun: false,
      appsScriptTriggerChangedByThisRun: false,
      liveSendEnabled: false,
      autoSendEnabled: false
    }
  };
  return { outbox, status };
}

function writeApprovalDocuments(filePaths, loaded, updated) {
  const outboxBefore = fs.readFileSync(loaded.outboxPath, 'utf8');
  const statusBefore = fs.readFileSync(loaded.statusPath, 'utf8');
  const outboxStatBefore = fs.statSync(loaded.outboxPath);
  const statusStatBefore = fs.statSync(loaded.statusPath);
  const outboxTmp = `${loaded.outboxPath}.tmp-${process.pid}`;
  const statusTmp = `${loaded.statusPath}.tmp-${process.pid}`;
  try {
    atomicJsonPrepare(outboxTmp, updated.outbox);
    atomicJsonPrepare(statusTmp, updated.status);
    fs.renameSync(outboxTmp, loaded.outboxPath);
    if (args['simulate-status-write-failure']) {
      throw new ApprovalError('simulated_status_write_failure');
    }
    fs.renameSync(statusTmp, loaded.statusPath);
  } catch (error) {
    cleanupTmp(outboxTmp);
    cleanupTmp(statusTmp);
    fs.writeFileSync(loaded.outboxPath, outboxBefore, 'utf8');
    fs.writeFileSync(loaded.statusPath, statusBefore, 'utf8');
    fs.utimesSync(loaded.outboxPath, outboxStatBefore.atime, outboxStatBefore.mtime);
    fs.utimesSync(loaded.statusPath, statusStatBefore.atime, statusStatBefore.mtime);
    throw error;
  }
}

function atomicJsonPrepare(tmpPath, value) {
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
}

function cleanupTmp(tmpPath) {
  try {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch {
    // Best-effort cleanup only; source files are restored separately.
  }
}

function readPrivatePreview(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw ? raw.split(/\r?\n/) : [];
  const headers = lines[0] ? lines[0].split('\t') : [];
  const rows = lines.slice(1).filter(Boolean).map((line) => line.split('\t'));
  return { headers, rows };
}

function previewMatchesOutbox(preview, outboxRows) {
  const emailIndex = preview.headers.indexOf('email');
  const sourceIndex = preview.headers.indexOf('sourceRow');
  if (emailIndex === -1 || sourceIndex === -1) return false;
  const previewKeys = new Set(preview.rows.map((cells) => safeIdentityKey(cells[emailIndex], cells[sourceIndex])));
  const outboxKeys = new Set(outboxRows.map((row) => safeIdentityKey(candidateEmail(row), row.prospectId)));
  if (previewKeys.size !== outboxKeys.size) return false;
  for (const key of outboxKeys) {
    if (!previewKeys.has(key)) return false;
  }
  return true;
}

function validateRows(rows) {
  const blockedReasons = [];
  if (duplicateCount(rows.map(candidateEmail)) > 0) blockedReasons.push('duplicate_email');
  if (duplicateCount(rows.map(dedupeKey)) > 0) blockedReasons.push('duplicate_dedupe_key');
  if (duplicateCount(rows.map((row) => String(row.prospectId || '').trim().toLowerCase())) > 0) blockedReasons.push('duplicate_prospect_id');
  if (rows.some((row) => !isValidEmail(candidateEmail(row)))) blockedReasons.push('invalid_email');
  if (rows.some((row) => hasPlaceholder(row.subject) || hasPlaceholder(row.body))) blockedReasons.push('placeholder_detected');
  if (rows.some((row) => !validatePersonalization(row))) blockedReasons.push('personalization_invalid');
  if (rows.some((row) => !hasOptOutText(row.body))) blockedReasons.push('missing_unsubscribe');
  if (rows.some((row) => !String(row.subject || '').trim())) blockedReasons.push('empty_subject');
  if (rows.some((row) => !String(row.body || '').trim())) blockedReasons.push('empty_body');
  return { blockedReasons };
}

function loadSuppressionLedger(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value));
  return {
    recipientHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.recipientHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.normalizedDomainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadHistoryHashes(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value.rows || value));
  return {
    recipientHashes: new Set(entries.map((entry) => String(entry.recipientHash || entry.emailHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadLocalHistoryHashes(dir, excludedFiles) {
  const history = { recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  if (!fs.existsSync(dir)) return history;
  const excluded = new Set([...excludedFiles].map((filePath) => path.resolve(filePath)));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    if (excluded.has(path.resolve(filePath))) continue;
    const rows = asCandidates(readJson(filePath, {}));
    for (const row of rows) addHistoryRow(row, history);
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

function safeIdentityKey(email, sourceRow) {
  return crypto.createHash('sha256').update(`${String(email || '').trim().toLowerCase()}|${String(sourceRow || '').trim().toLowerCase()}`).digest('hex');
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

function validatePersonalization(row) {
  const body = String(row.body || '');
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

function isApproved(outbox) {
  return outbox.approved === true || outbox.approvalStatus === 'approved';
}

function hasSentState(outbox, rows) {
  if (String(outbox.salesCompletionStatus || '').toLowerCase() === 'sent') return true;
  return rows.some((row) => Boolean(String(row.sentAt || '').trim()) ||
    ['sent', 'success', 'delivered'].includes(String(row.sentStatus || '').trim().toLowerCase()));
}

function numberArg(value) {
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
