#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { OUTBOX_HEADERS, buildBatchId } from './pool-utils.mjs';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-rollover-approved-outbox-test');
const SOURCE_DATE = '2026-06-19';
const TARGET_DATE = '2026-06-20';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const base = createFixture('base');
const beforeDryRun = snapshotFiles(base.sourceFiles);
const dryRun = runRollover(base, ['--dry-run']);
assert.equal(dryRun.status, 'pass');
assert.equal(dryRun.safeToExecute, true);
assert.equal(dryRun.sourceCandidateCount, 30);
assert.equal(dryRun.expectedTargetCandidateCount, 30);
assert.equal(dryRun.contentFieldsUnchangedCount, 30);
assert.equal(dryRun.identityFieldsUnchangedCount, 30);
assert.equal(dryRun.dateFieldsChangedCount, 30);
assert.equal(dryRun.candidateDigestChangedCount, 30);
assert.equal(dryRun.freshApprovalRequired, true);
assert.equal(dryRun.targetAutoApproved, false);
assert.equal(dryRun.targetFilesExistCount, 0);
assert.equal(dryRun.sourceMutationCount, 0);
assert.equal(fs.existsSync(base.targetOutbox), false);
assert.deepEqual(snapshotFiles(base.sourceFiles), beforeDryRun);

const writeFixture = createFixture('write');
const beforeWrite = snapshotFiles(writeFixture.sourceFiles);
const write = runRollover(writeFixture);
assert.equal(write.status, 'pass');
assert.equal(write.filesCreated, true);
assert.equal(write.sourceMutationCount, 0);
assert.deepEqual(snapshotFiles(writeFixture.sourceFiles), beforeWrite);
const targetOutbox = readJson(writeFixture.targetOutbox);
const targetStatus = readJson(writeFixture.targetStatus);
const targetSheets = readJson(writeFixture.targetSheetsJson);
assert.equal(targetOutbox.sendDate, TARGET_DATE);
assert.equal(targetOutbox.sendBatchId, buildBatchId(TARGET_DATE));
assert.equal(targetOutbox.approvalStatus, 'needs_review');
assert.equal(targetOutbox.approved, false);
assert.equal(targetOutbox.humanReviewCompleted, false);
assert.equal(targetOutbox.humanReviewedCount, 0);
assert.equal(targetOutbox.approvedOutboxHash, '');
assert.equal(Boolean(targetOutbox.outboxIdentityDigest), true);
assert.equal(targetStatus.status, 'needs_review');
assert.equal(targetStatus.humanReviewCompleted, false);
assert.equal(targetStatus.humanReviewedCount, 0);
assert.equal(targetStatus.rolloverRequiresFreshHumanReview, true);
assert.equal(targetSheets.rows.length, 30);
assert.deepEqual(targetSheets.headers, OUTBOX_HEADERS);
assert.equal(fs.existsSync(writeFixture.targetSheetsTsv), true);
assert.equal(fs.existsSync(writeFixture.targetPreview), true);
assert.equal(fs.existsSync(writeFixture.targetManifest), false);
assertTargetRows(writeFixture.rows, targetOutbox.candidates);

const sourceUnapproved = createFixture('source-unapproved', { approved: false });
assertBlocked(sourceUnapproved, 'source_status_not_approved');

const humanIncomplete = createFixture('human-incomplete');
const humanOutbox = readJson(humanIncomplete.sourceOutbox);
humanOutbox.humanReviewCompleted = false;
writeJson(humanIncomplete.sourceOutbox, humanOutbox);
const humanStatus = readJson(humanIncomplete.sourceStatus);
humanStatus.humanReviewCompleted = false;
humanStatus.metrics.humanReviewCompleted = false;
writeJson(humanIncomplete.sourceStatus, humanStatus);
assertBlocked(humanIncomplete, 'source_human_review_not_completed');

const hashMismatch = createFixture('hash-mismatch');
const hashOutbox = readJson(hashMismatch.sourceOutbox);
hashOutbox.approvedOutboxHash = 'mismatch';
writeJson(hashMismatch.sourceOutbox, hashOutbox);
assertBlocked(hashMismatch, 'source_approved_outbox_hash_mismatch');

const duplicate = createFixture('duplicate');
const duplicateOutbox = readJson(duplicate.sourceOutbox);
duplicateOutbox.candidates[1].email = duplicateOutbox.candidates[0].email;
duplicateOutbox.approvedOutboxHash = candidateContentHash(duplicateOutbox.candidates);
writeJson(duplicate.sourceOutbox, duplicateOutbox);
const duplicateStatus = readJson(duplicate.sourceStatus);
duplicateStatus.approvedOutboxHash = duplicateOutbox.approvedOutboxHash;
duplicateStatus.metrics.approvedOutboxHash = duplicateOutbox.approvedOutboxHash;
writeJson(duplicate.sourceStatus, duplicateStatus);
assertBlocked(duplicate, 'duplicate_email');

const targetExists = createFixture('target-exists');
writeJson(targetExists.targetOutbox, { existing: true });
const targetExistsResult = runRollover(targetExists, ['--dry-run'], { expectFailure: true });
assert.equal(targetExistsResult.blockedReasons.includes('target_files_exist'), true);
assert.deepEqual(readJson(targetExists.targetOutbox), { existing: true });

const sameDate = createFixture('same-date');
const sameDateResult = runRollover(sameDate, ['--target-date', SOURCE_DATE, '--dry-run'], { expectFailure: true });
assert.equal(sameDateResult.blockedReasons.includes('source_target_date_same'), true);

const earlierDate = createFixture('earlier-date');
const earlierDateResult = runRollover(earlierDate, ['--target-date', '2026-06-18', '--dry-run'], { expectFailure: true });
assert.equal(earlierDateResult.blockedReasons.includes('target_date_not_after_source_date'), true);

const suppression = createFixture('suppression');
writeJson(suppression.suppression, { entries: [{ recipientHash: shortHash(suppression.rows[0].email), suppressed: true }] });
assertBlocked(suppression, 'suppression_match');

const gmailSent = createFixture('gmail-sent');
writeJson(gmailSent.suppression, { entries: [{ recipientHash: shortHash(gmailSent.rows[0].email), suppressed: true }] });
const gmailSentResult = runRollover(gmailSent, ['--dry-run'], { expectFailure: true });
assert.equal(gmailSentResult.gmailSentMatchCount, 1);

const sheetHistory = createFixture('sheet-history');
writeJson(sheetHistory.sheetHistory, { entries: [{ recipientHash: shortHash(sheetHistory.rows[0].email) }] });
assertBlocked(sheetHistory, 'sheet_history_match');

const localHistory = createFixture('local-history');
writeJson(path.join(localHistory.historyDir, 'old-history.json'), { candidates: [localHistory.rows[0]] });
assertBlocked(localHistory, 'local_history_match');

const atomic = createFixture('atomic');
const atomicResult = runRollover(atomic, ['--simulate-rename-failure-after', '1'], { expectFailure: true });
assert.equal(atomicResult.blockedReasons.includes('simulated_atomic_rename_failure'), true);
assert.equal(fs.existsSync(atomic.targetOutbox), false);
assert.equal(fs.existsSync(atomic.targetStatus), false);
assert.equal(fs.existsSync(atomic.targetSheetsJson), false);
assert.equal(fs.existsSync(atomic.targetSheetsTsv), false);
assert.equal(fs.existsSync(atomic.targetPreview), false);

const manifestGuard = runManifest(writeFixture, { expectFailure: true });
assert.equal(manifestGuard.blockedReasons.includes('status_not_approved'), true);
assert.equal(manifestGuard.manifestCreated, false);

const syncGuard = runSyncGuard(writeFixture);
assert.notEqual(syncGuard.status, 0);
const syncSummary = JSON.parse(syncGuard.stdout);
assert.equal(syncSummary.blockedReason, 'target_status_not_approved');
assert.equal(syncSummary.googleSheetsUpdated, false);

const leakOutput = runRollover(base, ['--dry-run'], { raw: true });
assert.equal(leakOutput.includes(at), false);
assert.equal(leakOutput.includes('Safe Business'), false);
assert.equal(leakOutput.includes('https://'), false);
assert.equal(leakOutput.includes('SNSの見え方について、簡単な無料確認のご案内'), false);
assert.equal(leakOutput.includes('prospect-'), false);
assert.equal(/[a-f0-9]{64}/i.test(leakOutput), false);

console.log(JSON.stringify({
  syntheticTestCount: 21,
  passed: true,
  sourceMutationCount: 0,
  externalWriteCount: 0,
  targetAutoApproved: false,
  freshApprovalRequired: true,
  manifestGenerated: false,
  personalDataLogged: false
}, null, 2));

function createFixture(name, options = {}) {
  const dir = path.join(TMP, name);
  const sourceOutbox = path.join(dir, 'source-outbox.json');
  const sourceStatus = path.join(dir, 'source-status.json');
  const sourcePreview = path.join(dir, 'source-preview.tsv');
  const sourceSheetsJson = path.join(dir, 'source-sheets.json');
  const sourceSheetsTsv = path.join(dir, 'source-sheets.tsv');
  const suppression = path.join(dir, 'suppression.json');
  const sheetHistory = path.join(dir, 'sheet-history.json');
  const historyDir = path.join(dir, 'history');
  const targetOutbox = path.join(dir, 'target-outbox.json');
  const targetStatus = path.join(dir, 'target-status.json');
  const targetSheetsJson = path.join(dir, 'target-sheets.json');
  const targetSheetsTsv = path.join(dir, 'target-sheets.tsv');
  const targetPreview = path.join(dir, 'target-preview.tsv');
  const targetManifest = path.join(dir, 'target-manifest.json');
  const targetLegacyOutbox = path.join(dir, 'legacy-target-outbox.json');
  const targetLegacySheetsJson = path.join(dir, 'legacy-target-sheets.json');
  const targetLegacySheetsTsv = path.join(dir, 'legacy-target-sheets.tsv');
  fs.mkdirSync(historyDir, { recursive: true });
  const rows = buildRows(30);
  const approved = options.approved !== false;
  const outboxHash = candidateContentHash(rows);
  writeJson(sourceOutbox, {
    generatedAt: `${SOURCE_DATE}T00:00:00+09:00`,
    sendDate: SOURCE_DATE,
    sendBatchId: buildBatchId(SOURCE_DATE),
    status: 'approved',
    approved,
    approvalStatus: approved ? 'approved' : 'needs_review',
    humanReviewCompleted: approved,
    humanReviewedCount: approved ? 30 : 0,
    approvedOutboxHash: approved ? outboxHash : '',
    salesCompletionStatus: 'not_sent',
    candidates: rows
  });
  writeJson(sourceStatus, {
    id: `gmail-sales-safe-preparation-${SOURCE_DATE}`,
    status: approved ? 'approved' : 'needs_review',
    approvalStatus: approved ? 'approved' : 'needs_review',
    humanReviewCompleted: approved,
    humanReviewedCount: approved ? 30 : 0,
    approvedOutboxHash: approved ? outboxHash : '',
    metrics: {
      targetDate: SOURCE_DATE,
      approvalStatus: approved ? 'approved' : 'needs_review',
      humanReviewCompleted: approved,
      humanReviewedCount: approved ? 30 : 0,
      approvedOutboxHash: approved ? outboxHash : ''
    }
  });
  fs.writeFileSync(sourcePreview, buildPreview(rows), 'utf8');
  writeJson(sourceSheetsJson, { generatedAt: `${SOURCE_DATE}T00:00:00+09:00`, sendDate: SOURCE_DATE, sendBatchId: buildBatchId(SOURCE_DATE), headers: OUTBOX_HEADERS, rows });
  fs.writeFileSync(sourceSheetsTsv, buildTsv(rows), 'utf8');
  writeJson(suppression, { entries: [] });
  writeJson(sheetHistory, { entries: [] });
  return {
    dir,
    rows,
    sourceOutbox,
    sourceStatus,
    sourcePreview,
    sourceSheetsJson,
    sourceSheetsTsv,
    suppression,
    sheetHistory,
    historyDir,
    targetOutbox,
    targetStatus,
    targetSheetsJson,
    targetSheetsTsv,
    targetPreview,
    targetManifest,
    targetLegacyOutbox,
    targetLegacySheetsJson,
    targetLegacySheetsTsv,
    sourceFiles: [sourceOutbox, sourceStatus, sourcePreview, sourceSheetsJson, sourceSheetsTsv, suppression, sheetHistory]
  };
}

function buildRows(count) {
  return Array.from({ length: count }, (_, index) => {
    const businessName = `Safe Business ${index}`;
    const email = `safe-${index}${at}sample-${index}.invalid`;
    return {
      prospectId: `prospect-${index}`,
      name: businessName,
      businessType: 'test',
      area: 'test',
      email,
      contactEmail: email,
      publicSource: 'public',
      sourceUrl: `https://sample-${index}.invalid`,
      issueHypothesis: 'issue',
      salesAngle: 'angle',
      subject: 'SNSの見え方について、簡単な無料確認のご案内',
      body: `${businessName}様\n\n${businessName}のSNS導線確認です。\n\n今後このようなご案内が不要でしたら、その旨をご返信いただければ以後のご連絡を停止いたします。`,
      status: 'ready',
      sendDate: SOURCE_DATE,
      nextActionDate: '2026-06-21',
      dedupeKey: `${email}|${businessName.toLowerCase()}|sample-${index}.invalid`,
      sendBatchId: buildBatchId(SOURCE_DATE),
      sentAt: '',
      sentBy: '',
      sentStatus: '',
      errorMessage: '',
      replyStatus: '',
      unsubscribe: '',
      doNotContact: '',
      lastCheckedAt: '',
      notes: ''
    };
  });
}

function assertBlocked(fixture, reason) {
  const before = snapshotFiles(fixture.sourceFiles);
  const result = runRollover(fixture, ['--dry-run'], { expectFailure: true });
  assert.equal(result.blockedReasons.includes(reason), true);
  assert.equal(fs.existsSync(fixture.targetOutbox), false);
  assert.deepEqual(snapshotFiles(fixture.sourceFiles), before);
}

function assertTargetRows(sourceRows, targetRows) {
  assert.equal(targetRows.length, sourceRows.length);
  targetRows.forEach((row, index) => {
    const source = sourceRows[index];
    for (const key of ['prospectId', 'dedupeKey', 'email', 'contactEmail', 'name', 'businessType', 'area', 'publicSource', 'sourceUrl', 'issueHypothesis', 'salesAngle', 'subject', 'body']) {
      assert.equal(row[key], source[key]);
    }
    assert.equal(row.sendDate, TARGET_DATE);
    assert.equal(row.sendBatchId, buildBatchId(TARGET_DATE));
    assert.equal(row.nextActionDate, '2026-06-22');
  });
}

function runRollover(fixture, extraArgs = [], options = {}) {
  const targetDateArgIndex = extraArgs.indexOf('--target-date');
  const args = [
    'scripts/gmail/rollover-approved-outbox.mjs',
    '--source-date', SOURCE_DATE,
    '--target-date', targetDateArgIndex === -1 ? TARGET_DATE : extraArgs[targetDateArgIndex + 1],
    '--source-outbox-file', fixture.sourceOutbox,
    '--source-status-file', fixture.sourceStatus,
    '--source-private-preview', fixture.sourcePreview,
    '--source-sheets-json', fixture.sourceSheetsJson,
    '--source-sheets-tsv', fixture.sourceSheetsTsv,
    '--suppression-ledger', fixture.suppression,
    '--sheet-history', fixture.sheetHistory,
    '--history-dir', fixture.historyDir,
    '--target-outbox-file', fixture.targetOutbox,
    '--target-status-file', fixture.targetStatus,
    '--target-sheets-json', fixture.targetSheetsJson,
    '--target-sheets-tsv', fixture.targetSheetsTsv,
    '--target-private-preview', fixture.targetPreview,
    '--target-manifest', fixture.targetManifest,
    '--target-legacy-outbox', fixture.targetLegacyOutbox,
    '--target-legacy-sheets-json', fixture.targetLegacySheetsJson,
    '--target-legacy-sheets-tsv', fixture.targetLegacySheetsTsv,
    ...extraArgs.filter((_, index) => targetDateArgIndex === -1 || (index !== targetDateArgIndex && index !== targetDateArgIndex + 1))
  ];
  try {
    const output = execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return options.raw ? output : JSON.parse(output);
  } catch (error) {
    if (!options.expectFailure) throw error;
    const output = String(error.stdout || '');
    return options.raw ? output : JSON.parse(output);
  }
}

function runManifest(fixture, options = {}) {
  const args = [
    'scripts/gmail/create-approved-gmail-send-manifest.mjs',
    '--date', TARGET_DATE,
    '--dry-run',
    '--outbox-file', fixture.targetOutbox,
    '--status-file', fixture.targetStatus,
    '--private-preview', fixture.targetPreview,
    '--sheets-json', fixture.targetSheetsJson,
    '--suppression-ledger', fixture.suppression,
    '--sheet-history', fixture.sheetHistory,
    '--history-dir', fixture.historyDir,
    '--output', fixture.targetManifest
  ];
  try {
    return JSON.parse(execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    if (!options.expectFailure) throw error;
    return JSON.parse(String(error.stdout || ''));
  }
}

function runSyncGuard(fixture) {
  const source = 'globalThis.fetch = async () => { throw new Error("fetch_should_not_run"); };';
  return spawnSync(process.execPath, [
    'scripts/gmail/sync-outbox-to-sheet.mjs',
    '--date', TARGET_DATE,
    '--tsv', fixture.targetSheetsTsv,
    '--status-file', fixture.targetStatus,
    '--write'
  ], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      GMAIL_SHEET_SYNC_ENABLED: 'true',
      GMAIL_SHEET_SYNC_DRY_RUN: 'false',
      GMAIL_SHEET_WEBHOOK_URL: 'https://example.invalid/webhook',
      GMAIL_SHEET_SYNC_TOKEN: 'token',
      NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(source)}`
    }),
    encoding: 'utf8'
  });
}

function buildPreview(rows) {
  return [
    'email\tbusinessName\tgreeting\tsubject\tbodyPreview\tsourceRow',
    ...rows.map((row) => [row.email, row.name, row.name, row.subject, 'preview', row.prospectId].join('\t'))
  ].join('\n') + '\n';
}

function buildTsv(rows) {
  return [
    OUTBOX_HEADERS.join('\t'),
    ...rows.map((row) => OUTBOX_HEADERS.map((key) => String(row[key] ?? '').replace(/\r?\n/g, '\\n').replace(/\t/g, ' ')).join('\t'))
  ].join('\n') + '\n';
}

function snapshotFiles(files) {
  return Object.fromEntries(files.map((file) => {
    const stat = fs.statSync(file);
    return [file, {
      content: fs.readFileSync(file, 'utf8'),
      mtimeMs: stat.mtimeMs,
      size: stat.size
    }];
  }));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function shortHash(value, length = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}
