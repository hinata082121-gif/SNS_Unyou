import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-refresh-pool-test');
const DATE = '2099-06-22';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const suppressionFile = path.join(TMP, 'suppression.json');
const sheetHistoryFile = path.join(TMP, 'sheet-history.json');
const historyDir = path.join(TMP, 'history');
fs.mkdirSync(historyDir, { recursive: true });
writeJson(suppressionFile, { entries: [{ recipientHash: 'not-matching', suppressed: true }] });
writeJson(sheetHistoryFile, { entries: [] });

const dryRunPool = path.join(TMP, 'dry-run-pool.json');
writeJson(dryRunPool, { updatedAt: 'old', candidates: buildCandidates(2, 'ok') });
const beforeDryRun = fs.readFileSync(dryRunPool, 'utf8');
const dryRun = runRefresh(dryRunPool, ['--dry-run', '--required-fresh-count', '1']);
assert.equal(dryRun.requiredFreshCountReached, true);
assert.equal(dryRun.poolUpdated, false);
assert.equal(fs.readFileSync(dryRunPool, 'utf8'), beforeDryRun);

const writePool = path.join(TMP, 'write-pool.json');
writeJson(writePool, { updatedAt: 'old', candidates: [
  buildCandidate(1, 'ok'),
  buildCandidate(2, 'status404'),
  buildCandidate(3, 'status410'),
  buildCandidate(4, 'timeout'),
  buildCandidate(5, 'status429'),
  buildCandidate(6, 'parked'),
  buildCandidate(7, 'mismatch', { emailDomain: 'external.example' }),
  buildCandidate(8, 'nomx'),
  buildCandidate(9, 'ok'),
  buildCandidate(10, 'ok', { duplicateOf: 9 })
] });
const writeResult = runRefresh(writePool, ['--write', '--required-fresh-count', '2']);
assert.equal(writeResult.requiredFreshCountReached, true);
assert.equal(writeResult.poolUpdated, true);
assert.equal(writeResult.verifiedCount, 2);
assert.equal(writeResult.unavailableCount, 4);
assert.equal(writeResult.timeoutCount, 1);
assert.equal(writeResult.emailMismatchCount, 1);
assert.equal(writeResult.mxMissingCount, 1);
assert.equal(writeResult.duplicateExcludedCount, 1);
const written = readJson(writePool).candidates;
assert.equal(Boolean(written[0].lastCheckedAt), true);
assert.equal(Boolean(written[8].lastCheckedAt), true);
assert.equal(Boolean(written[1].lastCheckedAt), false);
assert.equal(Boolean(written[6].lastCheckedAt), false);
assert.equal(written[0].verificationStatus, 'verified');
assert.equal(written[0].verificationMethod, 'http_dns_source_consistency_v1');

const insufficientPool = path.join(TMP, 'insufficient-pool.json');
writeJson(insufficientPool, { updatedAt: 'old', candidates: [buildCandidate(1, 'ok'), buildCandidate(2, 'status404')] });
const insufficient = runRefreshAllowFailure(insufficientPool, ['--write', '--required-fresh-count', '2']);
assert.equal(insufficient.status, 1);
assert.equal(insufficient.summary.requiredFreshCountReached, false);
assert.equal(insufficient.summary.poolUpdated, false);
assert.equal(readJson(insufficientPool).updatedAt, 'old');

const excludedPool = path.join(TMP, 'excluded-pool.json');
const suppressedCandidate = buildCandidate(11, 'ok');
const historyCandidate = buildCandidate(12, 'ok');
writeJson(path.join(TMP, 'suppression-excluded.json'), { entries: [{ recipientHash: hashForTest(suppressedCandidate.email), suppressed: true }] });
writeJson(path.join(TMP, 'sheet-history-excluded.json'), { entries: [{ recipientHash: hashForTest(historyCandidate.email) }] });
writeJson(excludedPool, { updatedAt: 'old', candidates: [suppressedCandidate, historyCandidate, buildCandidate(13, 'ok')] });
const excluded = runRefresh(excludedPool, [
  '--dry-run',
  '--required-fresh-count', '1',
  '--suppression-ledger', path.join(TMP, 'suppression-excluded.json'),
  '--sheet-history', path.join(TMP, 'sheet-history-excluded.json')
]);
assert.equal(excluded.suppressionExcludedCount, 1);
assert.equal(excluded.historyExcludedCount, 1);
assert.equal(excluded.verifiedCount, 1);

const scriptText = fs.readFileSync(path.join(ROOT, 'scripts', 'gmail', 'refresh-gmail-candidate-pool.mjs'), 'utf8');
assert.equal(scriptText.includes('lastCheckedAt: now'), true);
assert.equal(scriptText.includes('timestampOnlyUpdate: false'), true);
assert.equal(scriptText.includes('MailApp.sendEmail'), false);
assert.equal(scriptText.includes('SpreadsheetApp'), false);
assert.equal(scriptText.includes('TriggerBuilder'), false);

console.log(JSON.stringify({
  refreshPoolTestCount: 23,
  passed: true,
  dryRunPoolModified: false,
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  triggerChanged: false
}, null, 2));

function runRefresh(poolFile, extraArgs) {
  const output = execFileSync(process.execPath, [
    'scripts/gmail/refresh-gmail-candidate-pool.mjs',
    '--date', DATE,
    '--pool', poolFile,
    '--max-candidates', '20',
    '--concurrency', '3',
    '--request-timeout-ms', '1000',
    '--mock-network',
    '--suppression-ledger', suppressionFile,
    '--sheet-history', sheetHistoryFile,
    '--history-dir', historyDir,
    ...extraArgs
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output);
}

function runRefreshAllowFailure(poolFile, extraArgs) {
  try {
    return { status: 0, summary: runRefresh(poolFile, extraArgs) };
  } catch (error) {
    return { status: error.status, summary: JSON.parse(error.stdout) };
  }
}

function buildCandidates(count, kind) {
  return Array.from({ length: count }, (_, index) => buildCandidate(index + 1, kind));
}

function buildCandidate(index, kind, options = {}) {
  const sourceDomain = options.duplicateOf
    ? `ok-${options.duplicateOf}.example`
    : `${kind}-${index}.example`;
  const emailDomain = options.emailDomain || sourceDomain;
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    email: `contact-${index}${at}${emailDomain}`,
    sourceUrl: `https://${sourceDomain}/`,
    publicSource: `https://${sourceDomain}/`,
    status: 'available',
    subject: 'Test subject',
    body: 'Test body'
  };
}

function hashForTest(value) {
  return crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex').slice(0, 12);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
