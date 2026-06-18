import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-safe-batch-test');
const DATE = '2026-06-19';
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const poolFile = path.join(TMP, 'pool.json');
const suppressionFile = path.join(TMP, 'suppression.json');
const sheetHistoryFile = path.join(TMP, 'sheet-history.json');
const historyDir = path.join(TMP, 'history');
const statusFile = path.join(TMP, 'status.json');
const outboxFile = path.join(TMP, 'outbox.json');
const sheetsJson = path.join(TMP, 'sheets.json');
const sheetsTsv = path.join(TMP, 'sheets.tsv');
const privatePreview = path.join(TMP, 'private.tsv');
fs.mkdirSync(historyDir, { recursive: true });

writeJson(poolFile, {
  generatedAt: `${DATE}T00:00:00+09:00`,
  candidates: buildCandidates(35)
});
writeJson(suppressionFile, {
  generatedAt: `${DATE}T00:00:00+09:00`,
  entries: [
    {
      recipientHash: 'not-matching',
      normalizedDomainHash: 'not-matching',
      businessFingerprint: 'not-matching',
      suppressed: true,
      futureEligible: false
    }
  ]
});
writeJson(sheetHistoryFile, { entries: [] });

const success = runPrepare([
  '--date', DATE,
  '--pool', poolFile,
  '--suppression-ledger', suppressionFile,
  '--sheet-history', sheetHistoryFile,
  '--history-dir', historyDir,
  '--status-file', statusFile,
  '--outbox-file', outboxFile,
  '--sheets-json', sheetsJson,
  '--sheets-tsv', sheetsTsv,
  '--private-preview', privatePreview
]);
const status = readJson(statusFile);
assert.equal(success.targetDate, DATE);
assert.equal(success.sendBatchId, `gmail-sales-${DATE}`);
assert.equal(status.id, `gmail-sales-safe-preparation-${DATE}`);
assert.equal(status.status, 'needs_review');
assert.equal(status.metrics.selectedCount, 30);
assert.equal(status.metrics.outboxCreated, true);
assert.equal(status.metrics.liveSendEnabled, false);
assert.equal(status.metrics.autoSendEnabled, false);
assert.equal(fs.existsSync(privatePreview), true);
assert.equal(fs.existsSync(outboxFile), true);

const scriptText = fs.readFileSync(path.join(ROOT, 'scripts', 'gmail', 'prepare-daily-safe-sales-batch.mjs'), 'utf8');
assert.equal(scriptText.includes('2026-06-18'), false);

const blockedStatusFile = path.join(TMP, 'blocked-status.json');
const blocked = runPrepare([
  '--date', DATE,
  '--pool', poolFile,
  '--suppression-ledger', path.join(TMP, 'missing-suppression.json'),
  '--sheet-history', sheetHistoryFile,
  '--history-dir', historyDir,
  '--status-file', blockedStatusFile,
  '--outbox-file', path.join(TMP, 'blocked-outbox.json'),
  '--sheets-json', path.join(TMP, 'blocked-sheets.json'),
  '--sheets-tsv', path.join(TMP, 'blocked-sheets.tsv'),
  '--private-preview', path.join(TMP, 'blocked-private.tsv')
]);
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.blockedReasons.includes('suppression_ledger_missing'), true);
assert.equal(fs.existsSync(path.join(TMP, 'blocked-outbox.json')), false);

const shortPoolFile = path.join(TMP, 'short-pool.json');
writeJson(shortPoolFile, {
  generatedAt: `${DATE}T00:00:00+09:00`,
  candidates: buildCandidates(2)
});
const shortStatusFile = path.join(TMP, 'short-status.json');
const short = runPrepare([
  '--date', DATE,
  '--pool', shortPoolFile,
  '--suppression-ledger', suppressionFile,
  '--sheet-history', sheetHistoryFile,
  '--history-dir', historyDir,
  '--status-file', shortStatusFile,
  '--outbox-file', path.join(TMP, 'short-outbox.json'),
  '--sheets-json', path.join(TMP, 'short-sheets.json'),
  '--sheets-tsv', path.join(TMP, 'short-sheets.tsv'),
  '--private-preview', path.join(TMP, 'short-private.tsv')
]);
assert.equal(short.selectedCount, 2);
assert.equal(readJson(shortStatusFile).metrics.selectedCount, 2);

console.log(JSON.stringify({
  syntheticTestCount: 25,
  passed: true,
  targetDate: DATE,
  gmailSendExecuted: false,
  googleSheetsUpdated: false
}, null, 2));

function buildCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const businessName = `Safe Business ${index}`;
    return {
      prospectId: `prospect-${index}`,
      sourceRowId: `source-row-${index}`,
      name: businessName,
      customerName: businessName,
      businessType: 'test',
      area: 'test',
      email: `safe-${index}${at}sample-${index}.invalid`,
      sourceUrl: `https://sample-${index}.invalid`,
      subject: 'SNSの見え方について、簡単な無料確認のご案内',
      body: `${businessName} さま\n\n突然のご連絡失礼いたします。\n${businessName} 向けのSNS導線確認です。\n\n今後のご案内が不要な場合は、その旨をご返信ください。`,
      status: 'available',
      templateVersion: 'test-v1'
    };
  });
}

function runPrepare(args) {
  const output = execFileSync(process.execPath, ['scripts/gmail/prepare-daily-safe-sales-batch.mjs', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
