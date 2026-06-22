import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-source-sync-test');
const DATE = '2099-06-23';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const poolFile = path.join(TMP, 'pool.json');
writeJson(poolFile, { candidates: buildCandidates(60) });

const dryRun = runSync(['--date', DATE, '--input', poolFile, '--dry-run']);
assert.equal(dryRun.status, 'pass');
assert.equal(dryRun.sourceRowsRequested, 60);
assert.equal(dryRun.webhookCalled, false);
assert.equal(dryRun.sourceRowsWritten, 0);

const write = runSync(['--date', DATE, '--input', poolFile, '--write'], {
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://pass',
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret'
});
assert.equal(write.status, 'pass');
assert.equal(write.webhookCalled, true);
assert.equal(write.sourceRowsWritten, 60);
assert.equal(write.sourceRowsReadBack, 60);
assert.equal(write.sourceDigestMatch, true);
assert.equal(write.propertyConfigured, true);
assert.equal(write.requestCommitted, true);
assert.equal(write.webhookCallCount, 1);
assert.equal(write.statusCheckCount, 0);
assert.equal(write.gmailSendExecuted, false);
assert.equal(write.sendTargetSheetUpdated, false);
assert.equal(write.triggerChanged, false);

const timeoutRecovered = runSync(['--date', DATE, '--input', poolFile, '--write', '--post-timeout-ms', '10'], {
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://timeout-then-committed',
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret'
});
assert.equal(timeoutRecovered.status, 'pass');
assert.equal(timeoutRecovered.blockedReason, '');
assert.equal(timeoutRecovered.requestCommitted, true);
assert.equal(timeoutRecovered.sourceRowsWritten, 60);
assert.equal(timeoutRecovered.sourceDigestMatch, true);
assert.equal(timeoutRecovered.propertyConfigured, true);
assert.equal(timeoutRecovered.statusCheckCount, 1);
assert.equal(timeoutRecovered.retryCount, 0);
assert.equal(timeoutRecovered.webhookCallCount, 1);

const shortPoolFile = path.join(TMP, 'short-pool.json');
writeJson(shortPoolFile, { candidates: buildCandidates(29) });
const short = runSyncAllowFailure(['--date', DATE, '--input', shortPoolFile, '--dry-run']);
assert.equal(short.status, 1);
assert.equal(short.summary.status, 'blocked');
assert.equal(short.summary.blockedReason, 'source_rows_below_minimum');

const mixedPoolFile = path.join(TMP, 'mixed-pool.json');
writeJson(mixedPoolFile, { candidates: [
  ...buildCandidates(30),
  Object.assign(buildCandidate(100), { verificationStatus: 'rejected' }),
  Object.assign(buildCandidate(101), { verifiedAt: '2099-06-22T00:00:00+09:00' }),
  Object.assign(buildCandidate(102), { email: '', contactEmail: '' }),
  Object.assign(buildCandidate(103), { body: 'No opt out text' })
] });
const mixed = runSync(['--date', DATE, '--input', mixedPoolFile, '--dry-run']);
assert.equal(mixed.sourceRowsRequested, 30);

const raw = execFileSync(process.execPath, [
  'scripts/gmail/sync-normal-daily-source.mjs',
  '--date', DATE,
  '--input', poolFile,
  '--dry-run'
], { cwd: ROOT, encoding: 'utf8' });
assert.equal(raw.includes('Business '), false);
assert.equal(raw.includes('@example.invalid'), false);
assert.equal(raw.includes('https://'), false);
assert.equal(raw.includes('Subject '), false);
assert.equal(raw.includes('Body '), false);

console.log(JSON.stringify({
  sourceSyncTestCount: 28,
  passed: true,
  gmailSendExecuted: false,
  sendTargetSheetUpdated: false,
  triggerChanged: false,
  personalDataLogged: false
}, null, 2));

function runSync(args, env = {}) {
  const output = execFileSync(process.execPath, ['scripts/gmail/sync-normal-daily-source.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function runSyncAllowFailure(args) {
  try {
    return { status: 0, summary: runSync(args) };
  } catch (error) {
    return { status: error.status, summary: JSON.parse(error.stdout) };
  }
}

function buildCandidates(count) {
  return Array.from({ length: count }, (_, index) => buildCandidate(index + 1));
}

function buildCandidate(index) {
  return {
    prospectId: `prospect-${index}`,
    name: `Business ${index}`,
    businessType: 'service',
    area: 'test',
    email: `contact-${index}${at}example-${index}.invalid`,
    contactEmail: `contact-${index}${at}example-${index}.invalid`,
    publicSource: `https://example-${index}.invalid/`,
    sourceUrl: `https://example-${index}.invalid/`,
    issueHypothesis: 'issue',
    salesAngle: 'angle',
    subject: `Subject ${index}`,
    body: `Body ${index}\n今後のご案内が不要な場合はご返信ください。`,
    status: 'available',
    dedupeKey: `dedupe-${index}`,
    lastCheckedAt: `${DATE}T00:00:00+09:00`,
    verifiedAt: `${DATE}T00:00:00+09:00`,
    verificationStatus: 'verified',
    verificationMethod: 'test',
    doNotContact: false,
    notes: 'test'
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
