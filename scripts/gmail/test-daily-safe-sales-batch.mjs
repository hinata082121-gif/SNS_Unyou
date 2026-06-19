import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-safe-batch-test');
const DATE = '2099-06-19';
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
  updatedAt: `${DATE}T00:00:00+09:00`,
  candidates: buildCandidates(35, { lastCheckedAt: `${DATE}T00:00:00+09:00` })
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
assert.equal(status.metrics.sourceFresh, true);
assert.equal(status.metrics.sourceFreshnessReason, 'enough_fresh_candidates');
assert.equal(status.metrics.freshCandidateCount, 35);
assert.equal(status.metrics.staleSourceCount, 0);
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
  updatedAt: `${DATE}T00:00:00+09:00`,
  candidates: buildCandidates(2, { lastCheckedAt: `${DATE}T00:00:00+09:00` })
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
assert.equal(short.selectedCount, 0);
assert.equal(short.blockedReasons.includes('insufficient_fresh_candidates'), true);
assert.equal(readJson(shortStatusFile).metrics.selectedCount, 0);
assert.equal(fs.existsSync(path.join(TMP, 'short-outbox.json')), false);

const staleCandidateStatus = runScenario('pool-updated-fresh-candidate-stale', {
  poolUpdatedAt: `${DATE}T00:00:00+09:00`,
  candidates: buildCandidates(30, { lastCheckedAt: '2026-06-10T00:00:00+09:00' })
});
assert.equal(staleCandidateStatus.metrics.sourceFresh, false);
assert.equal(staleCandidateStatus.metrics.freshCandidateCount, 0);
assert.equal(staleCandidateStatus.metrics.staleSourceCount, 30);
assert.equal(staleCandidateStatus.metrics.selectedCount, 0);
assert.equal(staleCandidateStatus.metrics.outboxCreated, false);

const freshCandidateStatus = runScenario('pool-updated-stale-candidate-fresh', {
  poolUpdatedAt: '2026-06-10T00:00:00+09:00',
  candidates: buildCandidates(30, { lastCheckedAt: `${DATE}T00:00:00+09:00` })
});
assert.equal(freshCandidateStatus.metrics.sourceFresh, true);
assert.equal(freshCandidateStatus.metrics.freshCandidateCount, 30);
assert.equal(freshCandidateStatus.metrics.selectedCount, 30);
assert.equal(freshCandidateStatus.metrics.outboxCreated, true);

const mixedFreshStatus = runScenario('fresh-30-stale-70', {
  candidates: [
    ...buildCandidates(70, { startIndex: 100, lastCheckedAt: '2026-06-10T00:00:00+09:00' }),
    ...buildCandidates(30, { startIndex: 1000, lastCheckedAt: `${DATE}T00:00:00+09:00` })
  ]
});
assert.equal(mixedFreshStatus.metrics.sourceFresh, true);
assert.equal(mixedFreshStatus.metrics.freshCandidateCount, 30);
assert.equal(mixedFreshStatus.metrics.staleSourceCount, 70);
assert.equal(mixedFreshStatus.metrics.selectedCount, 30);
assert.equal(mixedFreshStatus.metrics.outboxCreated, true);

const insufficientFreshStatus = runScenario('fresh-29-stale-71', {
  candidates: [
    ...buildCandidates(71, { startIndex: 2000, lastCheckedAt: '2026-06-10T00:00:00+09:00' }),
    ...buildCandidates(29, { startIndex: 3000, lastCheckedAt: `${DATE}T00:00:00+09:00` })
  ]
});
assert.equal(insufficientFreshStatus.metrics.sourceFresh, false);
assert.equal(insufficientFreshStatus.metrics.freshCandidateCount, 29);
assert.equal(insufficientFreshStatus.metrics.staleSourceCount, 71);
assert.equal(insufficientFreshStatus.metrics.outboxCreated, false);
assert.equal(insufficientFreshStatus.metrics.blockedReasons.includes('insufficient_fresh_candidates'), true);

const missingTimestampStatus = runScenario('missing-timestamp', {
  candidates: buildCandidates(1, { omitTimestamp: true })
});
assert.equal(missingTimestampStatus.metrics.missingCandidateTimestampCount, 1);
assert.equal(missingTimestampStatus.metrics.staleSourceCount, 1);

const invalidTimestampStatus = runScenario('invalid-timestamp', {
  candidates: buildCandidates(1, { lastCheckedAt: 'not-a-date' })
});
assert.equal(invalidTimestampStatus.metrics.invalidCandidateTimestampCount, 1);
assert.equal(invalidTimestampStatus.metrics.staleSourceCount, 1);

const futureTimestampStatus = runScenario('future-timestamp', {
  candidates: buildCandidates(1, { lastCheckedAt: '2099-06-20T00:00:00+09:00' })
});
assert.equal(futureTimestampStatus.metrics.futureCandidateTimestampCount, 1);
assert.equal(futureTimestampStatus.metrics.staleSourceCount, 1);

const auditDomainDuplicate30 = runAuditScenario('audit-domain-duplicate-30', {
  candidates: withDuplicateDomain(buildCandidates(30, { startIndex: 4000, lastCheckedAt: `${DATE}T00:00:00+09:00` }))
});
assert.equal(auditDomainDuplicate30.mode, 'audit_only');
assert.equal(auditDomainDuplicate30.duplicateDomainWithinCandidateCount, 1);
assert.equal(auditDomainDuplicate30.duplicateWithinCandidateCount, 1);
assert.equal(auditDomainDuplicate30.safeCandidateCount, 29);
assert.equal(auditDomainDuplicate30.wouldSelectCount, 0);
assert.equal(auditDomainDuplicate30.wouldCreateOutbox, false);
assert.equal(auditDomainDuplicate30.blockedReasons.includes('insufficient_safe_candidates'), true);
assert.equal(auditDomainDuplicate30.outboxCreated, false);
assert.equal(auditDomainDuplicate30.privatePreviewCreated, false);
assert.equal(auditDomainDuplicate30.statusFileUpdated, false);

const auditDomainDuplicate31 = runAuditScenario('audit-domain-duplicate-31', {
  candidates: withDuplicateDomain(buildCandidates(31, { startIndex: 5000, lastCheckedAt: `${DATE}T00:00:00+09:00` }))
});
assert.equal(auditDomainDuplicate31.duplicateDomainWithinCandidateCount, 1);
assert.equal(auditDomainDuplicate31.safeCandidateCount, 30);
assert.equal(auditDomainDuplicate31.wouldSelectCount, 30);
assert.equal(auditDomainDuplicate31.wouldCreateOutbox, true);
assert.equal(auditDomainDuplicate31.outboxCreated, false);
assert.equal(auditDomainDuplicate31.privatePreviewCreated, false);
assert.equal(auditDomainDuplicate31.statusFileUpdated, false);

const auditPreserveDir = path.join(TMP, 'audit-preserve');
fs.mkdirSync(auditPreserveDir, { recursive: true });
const preservedOutbox = path.join(auditPreserveDir, 'outbox.json');
const preservedPreview = path.join(auditPreserveDir, 'private.tsv');
const preservedStatus = path.join(auditPreserveDir, 'status.json');
writeJson(preservedOutbox, { preserved: 'outbox' });
fs.writeFileSync(preservedPreview, 'preserved-preview\n', 'utf8');
writeJson(preservedStatus, { preserved: 'status' });
const beforePreserved = snapshotFiles([preservedOutbox, preservedPreview, preservedStatus]);
runAuditScenario('audit-preserve-files', {
  candidates: buildCandidates(31, { startIndex: 6000, lastCheckedAt: `${DATE}T00:00:00+09:00` }),
  statusFile: preservedStatus,
  outboxFile: preservedOutbox,
  privatePreview: preservedPreview,
  sheetsJson: path.join(auditPreserveDir, 'sheets.json'),
  sheetsTsv: path.join(auditPreserveDir, 'sheets.tsv')
});
assert.deepEqual(snapshotFiles([preservedOutbox, preservedPreview, preservedStatus]), beforePreserved);

const noMkdirDir = path.join(TMP, 'audit-no-mkdir', 'missing-output-dir');
assert.equal(fs.existsSync(noMkdirDir), false);
runAuditScenario('audit-no-mkdir', {
  candidates: buildCandidates(31, { startIndex: 7000, lastCheckedAt: `${DATE}T00:00:00+09:00` }),
  statusFile: path.join(noMkdirDir, 'status.json'),
  outboxFile: path.join(noMkdirDir, 'outbox.json'),
  privatePreview: path.join(noMkdirDir, 'private.tsv'),
  sheetsJson: path.join(noMkdirDir, 'sheets.json'),
  sheetsTsv: path.join(noMkdirDir, 'sheets.tsv')
});
assert.equal(fs.existsSync(noMkdirDir), false);

const parityCandidates = withDuplicateDomain(buildCandidates(31, { startIndex: 8000, lastCheckedAt: `${DATE}T00:00:00+09:00` }));
const auditParity = runAuditScenario('audit-parity', { candidates: parityCandidates });
const normalParity = runScenario('normal-parity', { candidates: parityCandidates });
assert.equal(auditParity.safeCandidateCount, normalParity.metrics.safeCandidateCount);
assert.equal(auditParity.duplicateWithinCandidateCount, normalParity.metrics.duplicateWithinCandidateCount);
assert.equal(auditParity.invalidPersonalizationCount, normalParity.metrics.invalidPersonalizationCount);

const auditRaw = runAuditRaw([
  '--date', DATE,
  '--pool', poolFile,
  '--suppression-ledger', suppressionFile,
  '--sheet-history', sheetHistoryFile,
  '--history-dir', historyDir,
  '--status-file', path.join(TMP, 'audit-redaction-status.json'),
  '--outbox-file', path.join(TMP, 'audit-redaction-outbox.json'),
  '--sheets-json', path.join(TMP, 'audit-redaction-sheets.json'),
  '--sheets-tsv', path.join(TMP, 'audit-redaction-sheets.tsv'),
  '--private-preview', path.join(TMP, 'audit-redaction-private.tsv')
]);
assert.equal(/safe-\d+@sample-\d+\.invalid/i.test(auditRaw), false);
assert.equal(auditRaw.includes('Safe Business'), false);
assert.equal(auditRaw.includes('https://'), false);
assert.equal(auditRaw.includes('SNSの見え方について、簡単な無料確認のご案内'), false);
assert.equal(auditRaw.includes('prospect-'), false);
assert.equal(auditRaw.includes('|safe business'), false);
assert.equal(auditRaw.includes('recipientHash'), false);
assert.equal(auditRaw.includes('domainHash'), false);
assert.equal(auditRaw.includes('businessFingerprint'), false);

console.log(JSON.stringify({
  syntheticTestCount: 51,
  passed: true,
  targetDate: DATE,
  gmailSendExecuted: false,
  googleSheetsUpdated: false
}, null, 2));

function runScenario(name, { candidates, poolUpdatedAt = `${DATE}T00:00:00+09:00` }) {
  const scenarioDir = path.join(TMP, name);
  fs.mkdirSync(scenarioDir, { recursive: true });
  const scenarioPool = path.join(scenarioDir, 'pool.json');
  const scenarioStatus = path.join(scenarioDir, 'status.json');
  const scenarioOutbox = path.join(scenarioDir, 'outbox.json');
  writeJson(scenarioPool, {
    updatedAt: poolUpdatedAt,
    candidates
  });
  runPrepare([
    '--date', DATE,
    '--pool', scenarioPool,
    '--suppression-ledger', suppressionFile,
    '--sheet-history', sheetHistoryFile,
    '--history-dir', historyDir,
    '--status-file', scenarioStatus,
    '--outbox-file', scenarioOutbox,
    '--sheets-json', path.join(scenarioDir, 'sheets.json'),
    '--sheets-tsv', path.join(scenarioDir, 'sheets.tsv'),
    '--private-preview', path.join(scenarioDir, 'private.tsv')
  ]);
  return readJson(scenarioStatus);
}

function runAuditScenario(name, {
  candidates,
  poolUpdatedAt = `${DATE}T00:00:00+09:00`,
  statusFile: statusFileArg,
  outboxFile: outboxFileArg,
  sheetsJson: sheetsJsonArg,
  sheetsTsv: sheetsTsvArg,
  privatePreview: privatePreviewArg
}) {
  const scenarioDir = path.join(TMP, name);
  fs.mkdirSync(scenarioDir, { recursive: true });
  const scenarioPool = path.join(scenarioDir, 'pool.json');
  writeJson(scenarioPool, {
    updatedAt: poolUpdatedAt,
    candidates
  });
  return runAudit([
    '--date', DATE,
    '--pool', scenarioPool,
    '--suppression-ledger', suppressionFile,
    '--sheet-history', sheetHistoryFile,
    '--history-dir', historyDir,
    '--status-file', statusFileArg || path.join(scenarioDir, 'status.json'),
    '--outbox-file', outboxFileArg || path.join(scenarioDir, 'outbox.json'),
    '--sheets-json', sheetsJsonArg || path.join(scenarioDir, 'sheets.json'),
    '--sheets-tsv', sheetsTsvArg || path.join(scenarioDir, 'sheets.tsv'),
    '--private-preview', privatePreviewArg || path.join(scenarioDir, 'private.tsv')
  ]);
}

function buildCandidates(count, options = {}) {
  const startIndex = options.startIndex || 0;
  return Array.from({ length: count }, (_, index) => {
    const candidateIndex = startIndex + index;
    const businessName = `Safe Business ${candidateIndex}`;
    const candidate = {
      prospectId: `prospect-${candidateIndex}`,
      sourceRowId: `source-row-${candidateIndex}`,
      name: businessName,
      customerName: businessName,
      businessType: 'test',
      area: 'test',
      email: `safe-${candidateIndex}${at}sample-${candidateIndex}.invalid`,
      sourceUrl: `https://sample-${candidateIndex}.invalid`,
      subject: 'SNSの見え方について、簡単な無料確認のご案内',
      body: `${businessName} さま\n\n突然のご連絡失礼いたします。\n${businessName} 向けのSNS導線確認です。\n\n今後のご案内が不要な場合は、その旨をご返信ください。`,
      status: 'available',
      templateVersion: 'test-v1'
    };
    if (!options.omitTimestamp) {
      candidate.lastCheckedAt = options.lastCheckedAt || `${DATE}T00:00:00+09:00`;
    }
    return candidate;
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

function runAudit(args) {
  return JSON.parse(runAuditRaw(args));
}

function runAuditRaw(args) {
  return execFileSync(process.execPath, ['scripts/gmail/prepare-daily-safe-sales-batch.mjs', '--audit-only', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function withDuplicateDomain(candidates) {
  const copy = candidates.map((candidate) => ({ ...candidate }));
  copy[1].sourceUrl = copy[0].sourceUrl;
  return copy;
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
