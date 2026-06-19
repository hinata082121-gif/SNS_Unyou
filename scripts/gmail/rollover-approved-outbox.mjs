#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  OUTBOX_HEADERS,
  addDaysToDate,
  asCandidates,
  buildBatchId,
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
  toTsv
} from './pool-utils.mjs';

class RolloverError extends Error {}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const dryRun = Boolean(args['dry-run']);
const sourceDate = String(args['source-date'] || '').trim();
const targetDate = String(args['target-date'] || '').trim();
const paths = resolvePaths(args);

const result = {
  mode: dryRun ? 'dry_run' : 'rollover',
  sourceDate,
  targetDate,
  status: 'blocked',
  blockedReasons: [],
  sourceCandidateCount: 0,
  expectedTargetCandidateCount: 0,
  contentFieldsUnchangedCount: 0,
  identityFieldsUnchangedCount: 0,
  dateFieldsChangedCount: 0,
  candidateDigestChangedCount: 0,
  suppressionLedgerLoaded: false,
  gmailSentHistoryLoaded: false,
  sheetHistoryLoaded: false,
  localHistoryLoaded: false,
  suppressionMatchCount: 0,
  gmailSentMatchCount: 0,
  sheetHistoryMatchCount: 0,
  localHistoryMatchCount: 0,
  targetFilesExistCount: 0,
  wouldCreateFiles: [],
  safeToExecute: false,
  freshApprovalRequired: true,
  targetAutoApproved: false,
  targetOutboxStatus: 'needs_review',
  targetHumanReviewCompleted: false,
  targetHumanReviewedCount: 0,
  targetManifestGenerated: false,
  targetSheetsReadyGenerated: false,
  targetPrivatePreviewGenerated: false,
  outboxIdentityDigestPresent: false,
  sourceMutationCount: 0,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  webhookRequested: false,
  appsScriptExecuted: false,
  scriptPropertiesUpdated: false,
  externalWriteCount: 0,
  filesCreated: false
};

try {
  validateDateArgs();
  const loaded = loadSource();
  const sourceSnapshot = snapshotSourceFiles(loaded);
  const validation = validateSource(loaded);
  const targetRows = buildTargetRows(validation.rows);
  const targetDocuments = buildTargetDocuments(loaded, validation, targetRows);
  const targetValidation = validateTargetDocuments(targetDocuments, validation.rows);
  const existingTargets = existingTargetFiles();

  Object.assign(result, validation.safe, targetValidation.safe, {
    expectedTargetCandidateCount: targetRows.length,
    targetFilesExistCount: existingTargets.length,
    wouldCreateFiles: Object.keys(writeTargets()),
    outboxIdentityDigestPresent: Boolean(targetDocuments.outbox.outboxIdentityDigest)
  });

  const blockedReasons = unique([
    ...validation.blockedReasons,
    ...targetValidation.blockedReasons,
    ...(existingTargets.length > 0 ? ['target_files_exist'] : [])
  ]);

  if (blockedReasons.length > 0) {
    result.blockedReasons = blockedReasons;
    result.sourceMutationCount = countSourceMutations(sourceSnapshot);
    printAndExit(result, 1);
  }

  result.status = 'pass';
  result.safeToExecute = true;

  if (dryRun) {
    result.sourceMutationCount = countSourceMutations(sourceSnapshot);
    printAndExit(result, 0);
  }

  atomicWriteTargetDocuments(targetDocuments, sourceSnapshot);
  result.filesCreated = true;
  result.targetSheetsReadyGenerated = true;
  result.targetPrivatePreviewGenerated = true;
  result.sourceMutationCount = countSourceMutations(sourceSnapshot);
  printAndExit(result, 0);
} catch (error) {
  const reason = error instanceof RolloverError ? error.message : 'rollover_failed';
  result.blockedReasons = unique([...result.blockedReasons, reason]);
  printAndExit(result, 1);
}

function printHelp() {
  console.log('Usage: node scripts/gmail/rollover-approved-outbox.mjs --source-date YYYY-MM-DD --target-date YYYY-MM-DD [--dry-run]');
}

function validateDateArgs() {
  if (!isDate(sourceDate)) throw new RolloverError('source_date_required');
  if (!isDate(targetDate)) throw new RolloverError('target_date_required');
  if (sourceDate === targetDate) throw new RolloverError('source_target_date_same');
  if (targetDate <= sourceDate) throw new RolloverError('target_date_not_after_source_date');
}

function resolvePaths(cliArgs) {
  const targetOutbox = cliArgs['target-outbox-file'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${targetDate}.json`);
  const targetStatus = cliArgs['target-status-file'] || path.join('data', 'agent-status', 'tasks', `gmail-sales-safe-preparation-${targetDate}.json`);
  const targetSheetsJson = cliArgs['target-sheets-json'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${targetDate}-sheets-ready.json`);
  const targetSheetsTsv = cliArgs['target-sheets-tsv'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${targetDate}-sheets-ready.tsv`);
  const targetPreview = cliArgs['target-private-preview'] || path.join('tmp', 'gmail-sales-preview', `gmail-sales-${targetDate}-private.tsv`);
  const targetManifest = cliArgs['target-manifest'] || path.join('tmp', 'gmail-approved-send-manifest', `gmail-approved-send-manifest-${targetDate}.json`);
  const legacyOutboxDir = cliArgs['target-legacy-outbox-dir'] || path.join('data', 'gmail', 'outbox');
  return {
    sourceOutbox: cliArgs['source-outbox-file'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${sourceDate}.json`),
    sourceStatus: cliArgs['source-status-file'] || path.join('data', 'agent-status', 'tasks', `gmail-sales-safe-preparation-${sourceDate}.json`),
    sourcePreview: cliArgs['source-private-preview'] || path.join('tmp', 'gmail-sales-preview', `gmail-sales-${sourceDate}-private.tsv`),
    sourceSheetsJson: cliArgs['source-sheets-json'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${sourceDate}-sheets-ready.json`),
    sourceSheetsTsv: cliArgs['source-sheets-tsv'] || path.join('data', 'gmail', 'outbox', `gmail-sales-${sourceDate}-sheets-ready.tsv`),
    suppression: cliArgs['suppression-ledger'] || path.join('tmp', 'gmail-incident', 'suppression-ledger-safe.json'),
    sheetHistory: cliArgs['sheet-history'] || path.join('tmp', 'gmail-incident', 'google-sheet-send-history-safe.json'),
    historyDir: cliArgs['history-dir'] || path.join('data', 'gmail', 'outbox'),
    targetOutbox,
    targetStatus,
    targetSheetsJson,
    targetSheetsTsv,
    targetPreview,
    targetManifest,
    targetLegacyOutbox: cliArgs['target-legacy-outbox'] || path.join(legacyOutboxDir, `${targetDate}-gmail-sales-outbox-30.json`),
    targetLegacySheetsJson: cliArgs['target-legacy-sheets-json'] || path.join(legacyOutboxDir, `${targetDate}-gmail-sales-sheets-ready.json`),
    targetLegacySheetsTsv: cliArgs['target-legacy-sheets-tsv'] || path.join(legacyOutboxDir, `${targetDate}-gmail-sales-sheets-ready.tsv`)
  };
}

function loadSource() {
  if (!fs.existsSync(paths.sourceOutbox)) throw new RolloverError('source_outbox_not_found');
  if (!fs.existsSync(paths.sourceStatus)) throw new RolloverError('source_status_not_found');
  if (!fs.existsSync(paths.sourcePreview)) throw new RolloverError('source_private_preview_not_found');
  if (!fs.existsSync(paths.sourceSheetsJson)) throw new RolloverError('source_sheets_json_not_found');
  if (!fs.existsSync(paths.sourceSheetsTsv)) throw new RolloverError('source_sheets_tsv_not_found');
  const outbox = readJson(paths.sourceOutbox, null);
  const status = readJson(paths.sourceStatus, null);
  const sheetsJson = readJson(paths.sourceSheetsJson, null);
  if (!outbox || !status || !sheetsJson) throw new RolloverError('source_invalid_json');
  return { outbox, status, sheetsJson };
}

function validateSource(loaded) {
  const rows = asCandidates(loaded.outbox);
  const sourceBatchId = String(loaded.outbox.sendBatchId || buildBatchId(sourceDate));
  const sourceDigests = rows.map((row) => candidateDigest(row, sourceDate, sourceBatchId));
  const targetBatchId = buildBatchId(targetDate);
  const targetDigests = rows.map((row) => candidateDigest(row, targetDate, targetBatchId));
  const outboxHash = candidateContentHash(rows);
  const approvedOutboxHash = String(
    loaded.outbox.approvedOutboxHash ||
    loaded.status.approvedOutboxHash ||
    loaded.status.metrics?.approvedOutboxHash ||
    ''
  );
  const approvalStatus = String(
    loaded.outbox.approvalStatus ||
    loaded.status.approvalStatus ||
    loaded.status.metrics?.approvalStatus ||
    ''
  );
  const humanReviewCompleted = loaded.outbox.humanReviewCompleted === true ||
    loaded.status.humanReviewCompleted === true ||
    loaded.status.metrics?.humanReviewCompleted === true;
  const humanReviewedCount = Number(loaded.outbox.humanReviewedCount || loaded.status.humanReviewedCount || loaded.status.metrics?.humanReviewedCount || 0);
  const integrity = validateRows(rows);
  const suppression = loadSuppressionLedger(paths.suppression);
  const sheetHistory = loadHistoryHashes(paths.sheetHistory);
  const localHistory = loadLocalHistoryHashes(paths.historyDir, new Set([
    paths.sourceOutbox,
    paths.sourceSheetsJson,
    paths.targetOutbox,
    paths.targetSheetsJson
  ]), sourceDate, targetDate);
  const safe = {
    sourceCandidateCount: rows.length,
    contentFieldsUnchangedCount: rows.length,
    identityFieldsUnchangedCount: rows.length,
    dateFieldsChangedCount: rows.length,
    candidateDigestChangedCount: sourceDigests.filter((digest, index) => digest !== targetDigests[index]).length,
    suppressionLedgerLoaded: suppression.loaded,
    gmailSentHistoryLoaded: suppression.loaded,
    sheetHistoryLoaded: sheetHistory.loaded,
    localHistoryLoaded: localHistory.loaded,
    suppressionMatchCount: countHistoryMatches(rows, suppression),
    gmailSentMatchCount: countHistoryMatches(rows, suppression),
    sheetHistoryMatchCount: countHistoryMatches(rows, sheetHistory),
    localHistoryMatchCount: countHistoryMatches(rows, localHistory)
  };
  const blockedReasons = [];
  if (loaded.outbox.sendDate !== sourceDate) blockedReasons.push('source_date_mismatch');
  if (loaded.status.status !== 'approved') blockedReasons.push('source_status_not_approved');
  if (approvalStatus !== 'approved') blockedReasons.push('source_approval_status_not_approved');
  if (!humanReviewCompleted) blockedReasons.push('source_human_review_not_completed');
  if (humanReviewedCount !== rows.length) blockedReasons.push('source_human_review_count_mismatch');
  if (rows.length < 1) blockedReasons.push('source_candidate_count_empty');
  if (rows.length > 30) blockedReasons.push('source_candidate_count_exceeds_limit');
  if (!approvedOutboxHash) blockedReasons.push('source_approved_outbox_hash_missing');
  if (approvedOutboxHash && approvedOutboxHash !== outboxHash) blockedReasons.push('source_approved_outbox_hash_mismatch');
  if (new Set(sourceDigests).size !== sourceDigests.length) blockedReasons.push('source_candidate_digest_duplicate');
  blockedReasons.push(...integrity.blockedReasons);
  if (!suppression.loaded) blockedReasons.push('suppression_ledger_missing');
  if (!sheetHistory.loaded) blockedReasons.push('sheet_history_missing');
  if (!localHistory.loaded) blockedReasons.push('local_history_missing');
  if (safe.suppressionMatchCount > 0) blockedReasons.push('suppression_match');
  if (safe.gmailSentMatchCount > 0) blockedReasons.push('gmail_sent_history_match');
  if (safe.sheetHistoryMatchCount > 0) blockedReasons.push('sheet_history_match');
  if (safe.localHistoryMatchCount > 0) blockedReasons.push('local_history_match');
  return {
    rows,
    sourceBatchId,
    targetBatchId,
    outboxHash,
    targetDigests,
    safe,
    blockedReasons: unique(blockedReasons)
  };
}

function buildTargetRows(rows) {
  const targetBatchId = buildBatchId(targetDate);
  return rows.map((row) => ({
    ...row,
    status: 'ready',
    sendDate: targetDate,
    nextActionDate: addDaysToDate(targetDate, 2),
    sendBatchId: targetBatchId,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    sendState: '',
    sendRunId: '',
    sendReservedAt: '',
    sendAttemptCount: ''
  }));
}

function buildTargetDocuments(loaded, validation, targetRows) {
  const now = new Date().toISOString();
  const outboxIdentityDigest = buildOutboxIdentityDigest(targetRows, targetDate, validation.targetBatchId);
  const outbox = {
    ...loaded.outbox,
    generatedAt: now,
    sendDate: targetDate,
    sendBatchId: validation.targetBatchId,
    status: 'needs_review',
    approvalStatus: 'needs_review',
    approved: false,
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    approvedAt: null,
    approvedBy: null,
    approvalVersion: 0,
    approvedOutboxHash: '',
    outboxIdentityDigest,
    rolloverSourceDate: sourceDate,
    rolloverTargetDate: targetDate,
    rolloverRequiresFreshHumanReview: true,
    candidates: targetRows
  };
  const status = {
    id: `gmail-sales-safe-preparation-${targetDate}`,
    status: 'needs_review',
    category: 'gmail_sales_safe_preparation',
    updatedAt: now,
    targetDate,
    sendBatchId: validation.targetBatchId,
    approvalStatus: 'needs_review',
    humanReviewCompleted: false,
    humanReviewedCount: 0,
    rolloverSourceDate: sourceDate,
    rolloverTargetDate: targetDate,
    rolloverSourceCandidateCount: targetRows.length,
    rolloverCreatedAt: now,
    rolloverRequiresFreshHumanReview: true,
    sourceApprovalWasValidAtRollover: true,
    metrics: {
      targetDate,
      sendBatchId: validation.targetBatchId,
      selectedCount: targetRows.length,
      outboxCandidateCount: targetRows.length,
      previewCandidateCount: targetRows.length,
      sheetsReadyCandidateCount: targetRows.length,
      approvalStatus: 'needs_review',
      humanReviewCompleted: false,
      humanReviewedCount: 0,
      freshApprovalRequired: true,
      outboxIdentityDigestPresent: true,
      gmailSendExecutedByThisRun: false,
      googleSheetsUpdatedByThisRun: false,
      appsScriptTriggerChangedByThisRun: false,
      liveSendEnabled: false,
      autoSendEnabled: false
    }
  };
  const sheetsJson = {
    generatedAt: now,
    sendDate: targetDate,
    sendBatchId: validation.targetBatchId,
    headers: OUTBOX_HEADERS,
    rows: targetRows
  };
  return {
    outbox,
    status,
    sheetsJson,
    sheetsTsv: toTsv(targetRows),
    privatePreview: buildPrivatePreview(targetRows)
  };
}

function validateTargetDocuments(targetDocuments, sourceRows) {
  const rows = asCandidates(targetDocuments.outbox);
  const blockedReasons = [];
  const targetDigests = rows.map((row) => candidateDigest(row, targetDate, targetDocuments.outbox.sendBatchId));
  if (rows.length !== sourceRows.length) blockedReasons.push('target_candidate_count_mismatch');
  if (targetDocuments.outbox.approvalStatus !== 'needs_review') blockedReasons.push('target_not_needs_review');
  if (targetDocuments.outbox.humanReviewCompleted !== false) blockedReasons.push('target_human_review_not_reset');
  if (Number(targetDocuments.outbox.humanReviewedCount || 0) !== 0) blockedReasons.push('target_human_review_count_not_reset');
  if (targetDocuments.outbox.approvedOutboxHash) blockedReasons.push('target_approved_hash_present');
  if (!targetDocuments.outbox.outboxIdentityDigest) blockedReasons.push('target_identity_digest_missing');
  if (new Set(targetDigests).size !== targetDigests.length) blockedReasons.push('target_candidate_digest_duplicate');
  rows.forEach((row, index) => {
    if (!contentFieldsEqual(row, sourceRows[index])) blockedReasons.push('target_content_changed');
    if (!identityFieldsEqual(row, sourceRows[index])) blockedReasons.push('target_identity_changed');
    if (row.sendDate !== targetDate) blockedReasons.push('target_send_date_mismatch');
    if (row.sendBatchId !== buildBatchId(targetDate)) blockedReasons.push('target_batch_id_mismatch');
    if (row.nextActionDate !== addDaysToDate(targetDate, 2)) blockedReasons.push('target_next_action_date_mismatch');
  });
  return {
    safe: {
      targetSheetsReadyGenerated: true,
      targetPrivatePreviewGenerated: true
    },
    blockedReasons: unique(blockedReasons)
  };
}

function existingTargetFiles() {
  return Object.values(writeTargets())
    .concat([
      paths.targetManifest,
      paths.targetLegacyOutbox,
      paths.targetLegacySheetsJson,
      paths.targetLegacySheetsTsv
    ])
    .filter((filePath) => fs.existsSync(filePath));
}

function writeTargets() {
  return {
    outbox: paths.targetOutbox,
    status: paths.targetStatus,
    sheetsJson: paths.targetSheetsJson,
    sheetsTsv: paths.targetSheetsTsv,
    privatePreview: paths.targetPreview
  };
}

function atomicWriteTargetDocuments(targetDocuments, sourceSnapshot) {
  const targets = writeTargets();
  const tempDir = path.join(path.dirname(paths.targetOutbox), `.rollover-${process.pid}-${Date.now()}`);
  const createdFinals = [];
  const tempFiles = {
    outbox: path.join(tempDir, path.basename(targets.outbox)),
    status: path.join(tempDir, path.basename(targets.status)),
    sheetsJson: path.join(tempDir, path.basename(targets.sheetsJson)),
    sheetsTsv: path.join(tempDir, path.basename(targets.sheetsTsv)),
    privatePreview: path.join(tempDir, path.basename(targets.privatePreview))
  };
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    writeJsonTemp(tempFiles.outbox, targetDocuments.outbox);
    writeJsonTemp(tempFiles.status, targetDocuments.status);
    writeJsonTemp(tempFiles.sheetsJson, targetDocuments.sheetsJson);
    fs.writeFileSync(tempFiles.sheetsTsv, targetDocuments.sheetsTsv, 'utf8');
    fs.writeFileSync(tempFiles.privatePreview, targetDocuments.privatePreview, 'utf8');
    validateTempFiles(tempFiles);
    if (countSourceMutations(sourceSnapshot) > 0) throw new RolloverError('source_mutated_before_commit');
    let renameCount = 0;
    for (const [key, finalPath] of Object.entries(targets)) {
      fs.mkdirSync(path.dirname(finalPath), { recursive: true });
      fs.renameSync(tempFiles[key], finalPath);
      createdFinals.push(finalPath);
      renameCount += 1;
      if (Number(args['simulate-rename-failure-after'] || -1) === renameCount) {
        throw new RolloverError('simulated_atomic_rename_failure');
      }
    }
    if (countSourceMutations(sourceSnapshot) > 0) throw new RolloverError('source_mutated_after_commit');
  } catch (error) {
    createdFinals.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Best-effort rollback for target artifacts.
      }
    });
    throw error;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Temporary cleanup is best-effort.
    }
  }
}

function validateTempFiles(tempFiles) {
  JSON.parse(fs.readFileSync(tempFiles.outbox, 'utf8'));
  JSON.parse(fs.readFileSync(tempFiles.status, 'utf8'));
  JSON.parse(fs.readFileSync(tempFiles.sheetsJson, 'utf8'));
  const tsvLineCount = fs.readFileSync(tempFiles.sheetsTsv, 'utf8').trimEnd().split(/\r?\n/).length;
  const previewLineCount = fs.readFileSync(tempFiles.privatePreview, 'utf8').trimEnd().split(/\r?\n/).length;
  if (tsvLineCount < 2 || previewLineCount < 2) throw new RolloverError('target_file_validation_failed');
}

function writeJsonTemp(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function snapshotSourceFiles() {
  const files = [
    paths.sourceOutbox,
    paths.sourceStatus,
    paths.sourcePreview,
    paths.sourceSheetsJson,
    paths.sourceSheetsTsv,
    paths.suppression,
    paths.sheetHistory
  ].filter((filePath) => fs.existsSync(filePath));
  return Object.fromEntries(files.map((filePath) => {
    const stat = fs.statSync(filePath);
    return [filePath, {
      hash: fileHash(filePath),
      mtimeMs: stat.mtimeMs,
      size: stat.size
    }];
  }));
}

function countSourceMutations(snapshot) {
  return Object.entries(snapshot).filter(([filePath, before]) => {
    if (!fs.existsSync(filePath)) return true;
    const stat = fs.statSync(filePath);
    return before.hash !== fileHash(filePath) ||
      before.mtimeMs !== stat.mtimeMs ||
      before.size !== stat.size;
  }).length;
}

function validateRows(rows) {
  const blockedReasons = [];
  if (duplicateCount(rows.map(candidateEmail)) > 0) blockedReasons.push('duplicate_email');
  if (duplicateCount(rows.map(dedupeKey)) > 0) blockedReasons.push('duplicate_dedupe_key');
  if (duplicateCount(rows.map((row) => String(row.prospectId || '').trim().toLowerCase())) > 0) blockedReasons.push('duplicate_prospect_id');
  if (rows.some((row) => !String(row.prospectId || '').trim())) blockedReasons.push('missing_prospect_id');
  if (rows.some((row) => !String(row.dedupeKey || '').trim())) blockedReasons.push('missing_dedupe_key');
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

function loadLocalHistoryHashes(dir, excludedFiles, ...dateTexts) {
  const history = { loaded: fs.existsSync(dir), recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  if (!history.loaded) return history;
  const excluded = new Set([...excludedFiles].map((filePath) => path.resolve(filePath)));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (dateTexts.some((dateText) => entry.name.includes(dateText))) continue;
    const filePath = path.join(dir, entry.name);
    if (excluded.has(path.resolve(filePath))) continue;
    asCandidates(readJson(filePath, {})).forEach((row) => addHistoryRow(row, history));
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

function buildPrivatePreview(rows) {
  const header = ['email', 'businessName', 'greeting', 'subject', 'bodyPreview', 'sourceRow'];
  const lines = rows.map((row) => [
    row.email,
    row.name,
    row.name,
    row.subject,
    normalizeEmailBody(row.body).slice(0, 120),
    row.prospectId
  ].map((value) => String(value || '').replace(/\r?\n/g, ' ').replace(/\t/g, ' ')).join('\t'));
  return [header.join('\t'), ...lines].join('\n') + '\n';
}

function candidateDigest(row, dateText, batchId) {
  const candidateId = String(row.prospectId || dedupeKey(row) || '').trim().toLowerCase();
  return sha256([
    candidateEmail(row),
    normalizeEmailSubject(row.subject),
    normalizeEmailBody(row.body),
    candidateId,
    dateText,
    String(batchId || '').trim()
  ].join('\n'));
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
  return sha256(JSON.stringify(projected));
}

function buildOutboxIdentityDigest(rows, dateText, batchId) {
  const digests = rows.map((row) => candidateDigest(row, dateText, batchId)).sort();
  return sha256(JSON.stringify({
    targetDate: dateText,
    sendBatchId: batchId,
    candidateCount: rows.length,
    candidateDigests: digests
  }));
}

function contentFieldsEqual(left, right) {
  return ['email', 'contactEmail', 'name', 'businessType', 'area', 'publicSource', 'sourceUrl', 'issueHypothesis', 'salesAngle', 'subject', 'body']
    .every((key) => String(left[key] || '') === String(right[key] || ''));
}

function identityFieldsEqual(left, right) {
  return ['prospectId', 'dedupeKey'].every((key) => String(left[key] || '') === String(right[key] || ''));
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

function businessFingerprint(candidate) {
  return hashValue(`${sourceDomain(candidate)}|${candidateName(candidate)}`);
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

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function printAndExit(summary, code) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
}
