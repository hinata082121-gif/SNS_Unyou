import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-merge-test');
const at = String.fromCharCode(64);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const poolFile = path.join(TMP, 'pool.json');
const inputFile = path.join(TMP, 'refresh-batch.json');

writeJson(poolFile, {
  updatedAt: '2026-06-01T00:00:00.000Z',
  candidates: [
    {
      prospectId: 'existing-1',
      name: 'Synthetic Business One',
      email: `synthetic-one${at}example.invalid`,
      dedupeKey: `synthetic-one${at}example.invalid|synthetic business one|example.invalid`,
      firstSeenAt: '2026-06-01T00:00:00.000Z',
      lastCheckedAt: '2026-06-01T00:00:00.000Z',
      sourceUrl: 'https://example.invalid/one',
      status: 'available'
    },
    {
      prospectId: 'existing-2',
      name: 'Synthetic Business Two',
      email: `synthetic-two${at}example.invalid`,
      dedupeKey: `synthetic-two${at}example.invalid|synthetic business two|example.invalid`,
      firstSeenAt: '2026-06-01T00:00:00.000Z',
      lastCheckedAt: '2026-06-01T00:00:00.000Z',
      sourceUrl: 'https://example.invalid/two',
      status: 'available'
    }
  ]
});

writeJson(inputFile, {
  generatedAt: '2026-06-18T00:00:00.000Z',
  batchId: 'synthetic-refresh',
  candidates: [
    {
      prospectId: 'refresh-existing-1',
      name: 'Synthetic Business One',
      email: `synthetic-one${at}example.invalid`,
      dedupeKey: `synthetic-one${at}example.invalid|synthetic business one|example.invalid`,
      firstSeenAt: '2026-06-01T00:00:00.000Z',
      lastCheckedAt: '2026-06-18T03:00:00.000Z',
      sourceCheckedAt: '2026-06-18T03:00:00.000Z',
      verifiedAt: '2026-06-18T03:00:00.000Z',
      sourceUrl: 'https://example.invalid/one',
      status: 'available'
    },
    {
      prospectId: 'refresh-existing-2-no-date',
      name: 'Synthetic Business Two',
      email: `synthetic-two${at}example.invalid`,
      dedupeKey: `synthetic-two${at}example.invalid|synthetic business two|example.invalid`,
      firstSeenAt: '2026-06-01T00:00:00.000Z',
      sourceUrl: 'https://example.invalid/two',
      status: 'available'
    },
    {
      prospectId: 'new-1',
      name: 'Synthetic Business Three',
      email: `synthetic-three${at}example.invalid`,
      firstSeenAt: '2026-06-18T00:00:00.000Z',
      lastCheckedAt: '2026-06-18T04:00:00.000Z',
      sourceUrl: 'https://example.invalid/three',
      status: 'available'
    }
  ]
});

const output = execFileSync(process.execPath, [
  'scripts/gmail/merge-gmail-candidate-pool.mjs',
  '--input',
  inputFile,
  '--pool',
  poolFile
], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
const summary = JSON.parse(output);
const merged = readJson(poolFile).candidates;
const refreshed = merged.find((candidate) => candidate.prospectId === 'existing-1');
const unchanged = merged.find((candidate) => candidate.prospectId === 'existing-2');

assert.equal(summary.existing, 2);
assert.equal(summary.incoming, 3);
assert.equal(summary.added, 1);
assert.equal(summary.refreshed, 1);
assert.equal(summary.excludedDuplicate, 1);
assert.equal(merged.length, 3);
assert.equal(refreshed.firstSeenAt, '2026-06-01T00:00:00.000Z');
assert.equal(refreshed.lastCheckedAt, '2026-06-18T03:00:00.000Z');
assert.equal(refreshed.sourceCheckedAt, '2026-06-18T03:00:00.000Z');
assert.equal(refreshed.verifiedAt, '2026-06-18T03:00:00.000Z');
assert.equal(unchanged.lastCheckedAt, '2026-06-01T00:00:00.000Z');

console.log(JSON.stringify({
  syntheticTestCount: 13,
  passed: true,
  refreshed: summary.refreshed,
  added: summary.added,
  gmailSendExecuted: false,
  googleSheetsUpdated: false
}, null, 2));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
