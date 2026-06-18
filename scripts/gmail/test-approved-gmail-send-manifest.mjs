import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-approved-send-manifest-test');
const DATE = '2026-06-19';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const base = createFixture('base');
const dryBefore = snapshotFiles(base.files);
const dry = runManifest(base, ['--dry-run']);
assert.equal(dry.status, 'pass');
assert.equal(dry.wouldCreateManifest, true);
assert.equal(dry.manifestCreated, false);
assert.equal(dry.candidateCount, 30);
assert.equal(dry.candidateDigestCount, 30);
assert.equal(dry.candidateDigestUnique, true);
assert.equal(dry.maxSendCount, 1);
assert.equal(dry.expiresInMinutes <= 30, true);
assert.deepEqual(snapshotFiles(base.files), dryBefore);

const createdFixture = createFixture('created');
const output = path.join(createdFixture.dir, 'manifest.json');
const created = runManifest(createdFixture, ['--output', output]);
assert.equal(created.status, 'pass');
assert.equal(created.manifestCreated, true);
const manifest = readJson(output);
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.targetDate, DATE);
assert.equal(manifest.batchId, `gmail-sales-${DATE}`);
assert.equal(manifest.candidateCount, 30);
assert.equal(manifest.candidateDigests.length, 30);
assert.equal(new Set(manifest.candidateDigests).size, 30);
assert.equal(manifest.maxSendCount, 1);
assert.equal(new Date(manifest.expiresAt).getTime() - new Date(manifest.manifestCreatedAt).getTime() <= 30 * 60 * 1000, true);
assert.equal(/[a-f0-9]{64}/.test(manifest.candidateDigests[0]), true);

const maxTwo = createFixture('max-two');
const maxTwoOutput = path.join(maxTwo.dir, 'manifest.json');
runManifest(maxTwo, ['--max-send-count', '2', '--output', maxTwoOutput]);
assert.equal(readJson(maxTwoOutput).maxSendCount, 2);

const unapproved = createFixture('unapproved', { approved: false });
const unapprovedBefore = snapshotFiles(unapproved.files);
const unapprovedResult = runManifest(unapproved, ['--dry-run'], { expectFailure: true });
assert.equal(unapprovedResult.blockedReasons.includes('status_not_approved'), true);
assert.deepEqual(snapshotFiles(unapproved.files), unapprovedBefore);

const hashMismatch = createFixture('hash-mismatch');
const hashOutbox = readJson(hashMismatch.outbox);
hashOutbox.approvedOutboxHash = 'mismatch';
writeJson(hashMismatch.outbox, hashOutbox);
const hashResult = runManifest(hashMismatch, ['--dry-run'], { expectFailure: true });
assert.equal(hashResult.blockedReasons.includes('approved_outbox_hash_mismatch'), true);

const countMismatch = createFixture('count-mismatch');
const countStatus = readJson(countMismatch.status);
countStatus.humanReviewedCount = 29;
countStatus.metrics.humanReviewedCount = 29;
writeJson(countMismatch.status, countStatus);
const countResult = runManifest(countMismatch, ['--dry-run'], { expectFailure: true });
assert.equal(countResult.blockedReasons.includes('human_review_count_mismatch'), true);

const suppression = createFixture('suppression');
writeJson(suppression.suppression, { entries: [{ recipientHash: shortHash(suppression.rows[0].email), suppressed: true }] });
const suppressionResult = runManifest(suppression, ['--dry-run'], { expectFailure: true });
assert.equal(suppressionResult.blockedReasons.includes('suppression_match'), true);

const sentHistory = createFixture('sent-history');
writeJson(sentHistory.suppression, { entries: [{ recipientHash: shortHash(sentHistory.rows[0].email), suppressed: true }] });
const sentHistoryResult = runManifest(sentHistory, ['--dry-run'], { expectFailure: true });
assert.equal(sentHistoryResult.gmailSentHistoryMatchCount, 1);

const sheetHistory = createFixture('sheet-history');
writeJson(sheetHistory.sheetHistory, { entries: [{ recipientHash: shortHash(sheetHistory.rows[0].email) }] });
const sheetHistoryResult = runManifest(sheetHistory, ['--dry-run'], { expectFailure: true });
assert.equal(sheetHistoryResult.blockedReasons.includes('sheet_history_match'), true);

const localHistory = createFixture('local-history');
writeJson(path.join(localHistory.historyDir, 'old.json'), { candidates: [localHistory.rows[0]] });
const localHistoryResult = runManifest(localHistory, ['--dry-run'], { expectFailure: true });
assert.equal(localHistoryResult.blockedReasons.includes('local_history_match'), true);

const duplicate = createFixture('duplicate');
const duplicateOutbox = readJson(duplicate.outbox);
duplicateOutbox.candidates[1].email = duplicateOutbox.candidates[0].email;
duplicateOutbox.approvedOutboxHash = candidateContentHash(duplicateOutbox.candidates);
writeJson(duplicate.outbox, duplicateOutbox);
const duplicateStatus = readJson(duplicate.status);
duplicateStatus.approvedOutboxHash = duplicateOutbox.approvedOutboxHash;
duplicateStatus.metrics.approvedOutboxHash = duplicateOutbox.approvedOutboxHash;
writeJson(duplicate.status, duplicateStatus);
const duplicateResult = runManifest(duplicate, ['--dry-run'], { expectFailure: true });
assert.equal(duplicateResult.blockedReasons.includes('duplicate_email'), true);

const digestChange = createFixture('digest-change');
const firstManifest = path.join(digestChange.dir, 'first.json');
runManifest(digestChange, ['--output', firstManifest]);
const changedOutbox = readJson(digestChange.outbox);
changedOutbox.candidates[0].body = `${changedOutbox.candidates[0].body}\n\n追加確認です。`;
changedOutbox.approvedOutboxHash = candidateContentHash(changedOutbox.candidates);
writeJson(digestChange.outbox, changedOutbox);
const changedStatus = readJson(digestChange.status);
changedStatus.approvedOutboxHash = changedOutbox.approvedOutboxHash;
changedStatus.metrics.approvedOutboxHash = changedOutbox.approvedOutboxHash;
writeJson(digestChange.status, changedStatus);
const secondManifest = path.join(digestChange.dir, 'second.json');
runManifest(digestChange, ['--output', secondManifest]);
assert.notDeepEqual(readJson(firstManifest).candidateDigests, readJson(secondManifest).candidateDigests);

const leakOutput = runManifest(base, ['--dry-run'], { raw: true });
assert.equal(leakOutput.includes(at), false);
assert.equal(leakOutput.includes('Safe Business'), false);
assert.equal(leakOutput.includes('https://'), false);
assert.equal(leakOutput.includes('SNSの見え方について、簡単な無料確認のご案内'), false);
assert.equal(leakOutput.includes('prospect-'), false);
assert.equal(/[a-f0-9]{64}/i.test(leakOutput), false);

console.log(JSON.stringify({
  syntheticTestCount: 14,
  passed: true,
  gmailSendExecuted: false,
  gmailDraftCreated: false,
  googleSheetsUpdated: false,
  appsScriptExecuted: false
}, null, 2));

function createFixture(name, options = {}) {
  const dir = path.join(TMP, name);
  const outbox = path.join(dir, 'outbox.json');
  const status = path.join(dir, 'status.json');
  const preview = path.join(dir, 'private.tsv');
  const suppression = path.join(dir, 'suppression.json');
  const sheetHistory = path.join(dir, 'sheet-history.json');
  const historyDir = path.join(dir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  const rows = buildCandidates(30);
  const approved = options.approved !== false;
  const outboxHash = candidateContentHash(rows);
  writeJson(outbox, {
    generatedAt: `${DATE}T00:00:00+09:00`,
    sendDate: DATE,
    sendBatchId: `gmail-sales-${DATE}`,
    status: approved ? 'needs_human_review' : 'needs_human_review',
    approved,
    approvalStatus: approved ? 'approved' : 'not_recorded',
    humanReviewCompleted: approved,
    humanReviewedCount: approved ? 30 : 0,
    approvedOutboxHash: approved ? outboxHash : '',
    liveSendEnabled: false,
    autoSendEnabled: false,
    salesCompletionStatus: 'not_sent',
    candidates: rows
  });
  writeJson(status, {
    id: `gmail-sales-safe-preparation-${DATE}`,
    status: approved ? 'approved' : 'needs_review',
    approvalStatus: approved ? 'approved' : 'not_recorded',
    humanReviewCompleted: approved,
    humanReviewedCount: approved ? 30 : 0,
    approvedOutboxHash: approved ? outboxHash : '',
    metrics: {
      targetDate: DATE,
      selectedCount: 30,
      safeCandidateCount: 30,
      approvalStatus: approved ? 'approved' : 'not_recorded',
      humanReviewCompleted: approved,
      humanReviewedCount: approved ? 30 : 0,
      approvedOutboxHash: approved ? outboxHash : '',
      liveSendEnabled: false,
      autoSendEnabled: false
    }
  });
  fs.writeFileSync(preview, buildPreview(rows), 'utf8');
  writeJson(suppression, { entries: [] });
  writeJson(sheetHistory, { entries: [] });
  return {
    dir,
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

function runManifest(fixture, extraArgs = [], options = {}) {
  const args = [
    'scripts/gmail/create-approved-gmail-send-manifest.mjs',
    '--date', DATE,
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
