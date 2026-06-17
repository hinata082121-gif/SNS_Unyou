import assert from 'node:assert/strict';
import { normalizeBody, normalizeEmail, rowIdentity, safeHash } from './lib/gmail-safety-audit-utils.mjs';

function insideWindow(nowMinutes, startMinutes, endMinutes) {
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function exactThirty(rows) {
  return rows.length === 30;
}

function noDuplicates(rows) {
  const fingerprints = rows.map((row) => rowIdentity(row).fingerprint);
  return new Set(fingerprints).size === fingerprints.length;
}

function hasOptOut(body) {
  return normalizeBody(body).includes('不要');
}

function canApprove({ batchId, expectedBatchId, checksum, expectedChecksum }) {
  return batchId === expectedBatchId && checksum === expectedChecksum;
}

function missingGreeting(body) {
  const firstLine = normalizeBody(body).split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  return !firstLine || firstLine.startsWith('突然のご連絡失礼いたします') || !/(さま|様)$/.test(firstLine);
}

function buildSuppressionLedger(sentRows) {
  const ledger = new Map();
  for (const row of sentRows) {
    const fingerprint = rowIdentity(row).fingerprint;
    const current = ledger.get(fingerprint) || { fingerprint, sendCount: 0, suppressed: true, futureEligible: false };
    current.sendCount += 1;
    ledger.set(fingerprint, current);
  }
  return ledger;
}

function eligibleCandidates(candidates, ledger) {
  return candidates.filter((row) => !ledger.has(rowIdentity(row).fingerprint));
}

function selectWithoutPadding(candidates, targetCount) {
  return candidates.slice(0, Math.min(candidates.length, targetCount));
}

function run() {
  assert.equal(normalizeEmail(' TEST-RECIPIENT '), 'test-recipient');
  assert.equal(insideWindow(12 * 60, 11 * 60 + 55, 12 * 60 + 15), true);
  assert.equal(insideWindow(40, 11 * 60 + 55, 12 * 60 + 15), false);
  assert.equal(exactThirty(Array.from({ length: 30 }, (_, index) => ({ index }))), true);
  assert.equal(exactThirty(Array.from({ length: 29 }, (_, index) => ({ index }))), false);
  assert.equal(noDuplicates([{ email: 'recipient-a' }, { email: 'RECIPIENT-A' }]), false);
  assert.equal(noDuplicates([{ email: 'recipient-a' }, { email: 'recipient-b' }]), true);
  assert.equal(hasOptOut('今後のご案内が不要な場合はご返信ください。'), true);
  assert.equal(hasOptOut('よろしくお願いします。'), false);
  assert.equal(canApprove({
    batchId: 'gmail-sales-2026-06-18',
    expectedBatchId: 'gmail-sales-2026-06-18',
    checksum: safeHash('batch'),
    expectedChecksum: safeHash('batch')
  }), true);
  assert.equal(canApprove({
    batchId: 'gmail-sales-2026-06-18',
    expectedBatchId: 'gmail-sales-2026-06-18',
    checksum: safeHash('old'),
    expectedChecksum: safeHash('new')
  }), false);

  const syntheticRows = Array.from({ length: 30 }, (_, index) => ({
    email: `safe-recipient-${index}`,
    name: `business-${index}`,
    body: '今後のご案内が不要な場合はご返信ください。'
  }));
  assert.equal(noDuplicates(syntheticRows), true);
  assert.equal(syntheticRows.every((row) => hasOptOut(row.body)), true);
  assert.equal(noDuplicates([...syntheticRows, syntheticRows[0]]), false);
  const repeatedSent = Array.from({ length: 5 }, () => ({ email: 'repeat-recipient', name: 'repeat-business' }));
  const ledger = buildSuppressionLedger(repeatedSent);
  const repeatedEntry = [...ledger.values()][0];
  assert.equal(repeatedEntry.sendCount, 5);
  assert.equal(repeatedEntry.suppressed, true);
  assert.equal(repeatedEntry.futureEligible, false);
  assert.equal(missingGreeting('突然のご連絡失礼いたします。\nICHI Socialです。'), true);
  assert.equal(missingGreeting('店舗A さま\n\n突然のご連絡失礼いたします。'), false);
  assert.equal(eligibleCandidates([{ email: 'repeat-recipient', name: 'repeat-business' }], ledger).length, 0);
  assert.equal(selectWithoutPadding([{ id: 1 }, { id: 2 }], 30).length, 2);
  assert.equal(selectWithoutPadding([], 30).length, 0);

  console.log(JSON.stringify({
    syntheticTestCount: 21,
    passed: true,
    gmailSendExecuted: false,
    googleSheetsUpdated: false
  }, null, 2));
}

run();
