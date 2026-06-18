import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-approve-outbox-test');
const DATE = '2026-06-19';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const base = createFixture('base');
const dryBefore = snapshotFiles(base.files);
const dry = runApproval(base, ['--dry-run']);
assert.equal(dry.status, 'pass');
assert.equal(dry.wouldApprove, true);
assert.equal(dry.approvalExecuted, false);
assert.equal(dry.outboxCandidateCount, 30);
assert.equal(dry.previewCandidateCount, 30);
assert.equal(dry.countsMatch, true);
assert.deepEqual(snapshotFiles(base.files), dryBefore);

const approveFixture = createFixture('approve');
const beforeApproveHash = candidateContentHash(readJson(approveFixture.outbox).candidates);
const approved = runApproval(approveFixture);
assert.equal(approved.status, 'pass');
assert.equal(approved.approvalExecuted, true);
assert.equal(approved.currentStatus, 'approved');
const approvedOutbox = readJson(approveFixture.outbox);
const approvedStatus = readJson(approveFixture.status);
assert.equal(approvedOutbox.approved, true);
assert.equal(approvedOutbox.approvalStatus, 'approved');
assert.equal(approvedOutbox.humanReviewCompleted, true);
assert.equal(approvedOutbox.humanReviewedCount, 30);
assert.equal(approvedStatus.status, 'approved');
assert.equal(approvedStatus.approvalStatus, 'approved');
assert.equal(candidateContentHash(approvedOutbox.candidates), beforeApproveHash);

const approvedBefore = snapshotFiles(approveFixture.files);
const idempotent = runApproval(approveFixture);
assert.equal(idempotent.alreadyApproved, true);
assert.equal(idempotent.approvalExecuted, false);
assert.deepEqual(snapshotFiles(approveFixture.files), approvedBefore);

const countMismatch = createFixture('count-mismatch');
const countBefore = snapshotFiles(countMismatch.files);
const countResult = runApproval(countMismatch, ['--confirm-review-count', '29'], { expectFailure: true });
assert.equal(countResult.status, 'blocked');
assert.equal(countResult.blockedReasons.includes('confirm_review_count_mismatch'), true);
assert.deepEqual(snapshotFiles(countMismatch.files), countBefore);

const previewMismatch = createFixture('preview-mismatch');
fs.writeFileSync(previewMismatch.preview, buildPreview(buildCandidates(29)), 'utf8');
const previewBefore = snapshotFiles(previewMismatch.files);
const previewResult = runApproval(previewMismatch, [], { expectFailure: true });
assert.equal(previewResult.blockedReasons.includes('preview_count_mismatch'), true);
assert.deepEqual(snapshotFiles(previewMismatch.files), previewBefore);

const hashMismatch = createFixture('hash-mismatch');
const hashBefore = snapshotFiles(hashMismatch.files);
const hashResult = runApproval(hashMismatch, ['--expected-outbox-hash', 'not-the-current-hash'], { expectFailure: true });
assert.equal(hashResult.blockedReasons.includes('expected_outbox_hash_mismatch'), true);
assert.deepEqual(snapshotFiles(hashMismatch.files), hashBefore);

const badStatus = createFixture('bad-status');
const badStatusJson = readJson(badStatus.status);
badStatusJson.status = 'blocked';
writeJson(badStatus.status, badStatusJson);
const badStatusBefore = snapshotFiles(badStatus.files);
const badStatusResult = runApproval(badStatus, [], { expectFailure: true });
assert.equal(badStatusResult.blockedReasons.includes('status_not_needs_review'), true);
assert.deepEqual(snapshotFiles(badStatus.files), badStatusBefore);

const sentState = createFixture('sent-state');
const sentOutbox = readJson(sentState.outbox);
sentOutbox.candidates[0].sentAt = `${DATE}T12:00:00+09:00`;
writeJson(sentState.outbox, sentOutbox);
const sentBefore = snapshotFiles(sentState.files);
const sentResult = runApproval(sentState, [], { expectFailure: true });
assert.equal(sentResult.blockedReasons.includes('sent_state_present'), true);
assert.deepEqual(snapshotFiles(sentState.files), sentBefore);

const suppression = createFixture('suppression');
writeJson(suppression.suppression, { entries: [{ recipientHash: hashValue(suppression.rows[0].email), suppressed: true }] });
const suppressionBefore = snapshotFiles(suppression.files);
const suppressionResult = runApproval(suppression, [], { expectFailure: true });
assert.equal(suppressionResult.blockedReasons.includes('suppression_match'), true);
assert.deepEqual(snapshotFiles(suppression.files), suppressionBefore);

const history = createFixture('history');
writeJson(history.sheetHistory, { entries: [{ recipientHash: hashValue(history.rows[0].email) }] });
const historyBefore = snapshotFiles(history.files);
const historyResult = runApproval(history, [], { expectFailure: true });
assert.equal(historyResult.blockedReasons.includes('sheet_history_match'), true);
assert.deepEqual(snapshotFiles(history.files), historyBefore);

const duplicate = createFixture('duplicate');
const duplicateOutbox = readJson(duplicate.outbox);
duplicateOutbox.candidates[1].email = duplicateOutbox.candidates[0].email;
writeJson(duplicate.outbox, duplicateOutbox);
const duplicateBefore = snapshotFiles(duplicate.files);
const duplicateResult = runApproval(duplicate, [], { expectFailure: true });
assert.equal(duplicateResult.blockedReasons.includes('duplicate_email'), true);
assert.deepEqual(snapshotFiles(duplicate.files), duplicateBefore);

const personalization = createFixture('personalization');
const personalizationOutbox = readJson(personalization.outbox);
personalizationOutbox.candidates[0].body = 'template {{name}}';
writeJson(personalization.outbox, personalizationOutbox);
const personalizationBefore = snapshotFiles(personalization.files);
const personalizationResult = runApproval(personalization, [], { expectFailure: true });
assert.equal(personalizationResult.blockedReasons.includes('placeholder_detected'), true);
assert.deepEqual(snapshotFiles(personalization.files), personalizationBefore);

const partial = createFixture('partial');
const partialBefore = snapshotFiles(partial.files);
const partialResult = runApproval(partial, ['--simulate-status-write-failure', 'true'], { expectFailure: true });
assert.equal(partialResult.blockedReasons.includes('simulated_status_write_failure'), true);
assert.deepEqual(snapshotFileContents(partial.files), snapshotContentsFrom(partialBefore));

const leakOutput = runApproval(base, ['--dry-run'], { raw: true });
assert.equal(leakOutput.includes(at), false);
assert.equal(leakOutput.includes('Safe Business'), false);
assert.equal(leakOutput.includes('https://'), false);
assert.equal(leakOutput.includes('SNSの見え方について、簡単な無料確認のご案内'), false);
assert.equal(leakOutput.includes('prospect-'), false);
assert.equal(leakOutput.includes('dedupeKey'), false);
assert.equal(leakOutput.includes('recipientHash'), false);
assert.equal(leakOutput.includes('domainHash'), false);
assert.equal(leakOutput.includes('businessFingerprint'), false);
assert.equal(/[a-f0-9]{64}/i.test(leakOutput), false);

const scriptText = fs.readFileSync(path.join(ROOT, 'scripts', 'gmail', 'approve-gmail-sales-outbox.mjs'), 'utf8');
assert.equal(/from ['"]node:child_process['"]/.test(scriptText), false);
assert.equal(/gmail api|nodemailer|googleapis|UrlFetch|fetch\(|runScheduledDailySend|runDailyGmailSalesSend|dailySalesEmailJob/i.test(scriptText), false);

console.log(JSON.stringify({
  syntheticTestCount: 15,
  passed: true,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  appsScriptExecuted: false
}, null, 2));

function createFixture(name) {
  const dir = path.join(TMP, name);
  const outbox = path.join(dir, 'outbox.json');
  const status = path.join(dir, 'status.json');
  const preview = path.join(dir, 'private.tsv');
  const suppression = path.join(dir, 'suppression.json');
  const sheetHistory = path.join(dir, 'sheet-history.json');
  const historyDir = path.join(dir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  const rows = buildCandidates(30);
  writeJson(outbox, {
    generatedAt: `${DATE}T00:00:00+09:00`,
    sendDate: DATE,
    sendBatchId: `gmail-sales-${DATE}`,
    status: 'needs_human_review',
    approved: false,
    liveSendEnabled: false,
    autoSendEnabled: false,
    salesCompletionStatus: 'not_sent',
    candidates: rows
  });
  writeJson(status, {
    id: `gmail-sales-safe-preparation-${DATE}`,
    status: 'needs_review',
    metrics: {
      targetDate: DATE,
      selectedCount: 30,
      safeCandidateCount: 30,
      liveSendEnabled: false,
      autoSendEnabled: false,
      gmailSendExecutedByThisRun: false,
      googleSheetsUpdatedByThisRun: false
    }
  });
  fs.writeFileSync(preview, buildPreview(rows), 'utf8');
  writeJson(suppression, { entries: [] });
  writeJson(sheetHistory, { entries: [] });
  return {
    rows,
    outbox,
    status,
    preview,
    suppression,
    sheetHistory,
    historyDir,
    files: [outbox, status, preview, suppression, sheetHistory]
  };
}

function buildCandidates(count) {
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
      sourceUrl: `https://sample-${index}.invalid`,
      subject: 'SNSの見え方について、簡単な無料確認のご案内',
      body: `${businessName}様\n\n${businessName}のSNS導線確認です。\n\n今後このようなご案内が不要でしたら、その旨をご返信いただければ以後のご連絡を停止いたします。`,
      status: 'ready',
      sendDate: DATE,
      sendBatchId: `gmail-sales-${DATE}`,
      dedupeKey: `${email}|${businessName.toLowerCase()}|sample-${index}.invalid`,
      sentAt: '',
      sentStatus: ''
    };
  });
}

function buildPreview(rows) {
  return [
    'email\tbusinessName\tgreeting\tsubject\tbodyPreview\tsourceRow',
    ...rows.map((row) => [row.email, row.name, row.name, row.subject, 'preview', row.prospectId].join('\t'))
  ].join('\n') + '\n';
}

function runApproval(fixture, extraArgs = [], options = {}) {
  const confirmIndex = extraArgs.indexOf('--confirm-review-count');
  const defaultCountArgs = confirmIndex === -1 ? ['--confirm-review-count', '30'] : [];
  const args = [
    'scripts/gmail/approve-gmail-sales-outbox.mjs',
    '--date', DATE,
    '--reviewer', 'human',
    ...defaultCountArgs,
    '--outbox-file', fixture.outbox,
    '--status-file', fixture.status,
    '--private-preview', fixture.preview,
    '--suppression-ledger', fixture.suppression,
    '--sheet-history', fixture.sheetHistory,
    '--history-dir', fixture.historyDir,
    ...extraArgs
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function snapshotFileContents(files) {
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
}

function snapshotContentsFrom(snapshot) {
  return Object.fromEntries(Object.entries(snapshot).map(([file, value]) => [file, value.content]));
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

function hashValue(value, length = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}
