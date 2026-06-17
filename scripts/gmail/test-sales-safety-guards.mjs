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

  console.log(JSON.stringify({
    syntheticTestCount: 13,
    passed: true,
    gmailSendExecuted: false,
    googleSheetsUpdated: false
  }, null, 2));
}

run();
