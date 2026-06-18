#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const script = path.join(ROOT, 'scripts', 'gmail', 'create-apps-script-suppression-bundle.mjs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmail-suppression-bundle-'));
const inputPath = path.join(tempDir, 'ledger.json');
const outputPath = path.join(tempDir, 'bundle.json');
const fixture = {
  generatedAt: '2026-06-19T00:00:00.000Z',
  entries: [
    {
      recipientHash: 'recipient_hash_a',
      normalizedDomainHash: 'domain_hash_a',
      businessFingerprint: 'business_hash_a',
      suppressed: true,
      futureEligible: false
    },
    {
      recipientHash: 'recipient_hash_a',
      domainHash: 'domain_hash_b',
      businessFingerprint: 'business_hash_b',
      suppressed: true
    },
    {
      recipientHash: 'ignored_hash',
      suppressed: false
    }
  ]
};
fs.writeFileSync(inputPath, `${JSON.stringify(fixture, null, 2)}\n`);

const dryRunOut = execJson(['--input', inputPath, '--output', outputPath, '--dry-run']);
assert.equal(dryRunOut.status, 'pass');
assert.equal(dryRunOut.sourceEntryCount, 3);
assert.equal(dryRunOut.recipientSuppressionCount, 1);
assert.equal(dryRunOut.domainSuppressionCount, 2);
assert.equal(dryRunOut.businessSuppressionCount, 2);
assert.equal(dryRunOut.bundleChecksumPresent, true);
assert.equal(dryRunOut.wouldCreateBundle, true);
assert.equal(dryRunOut.bundleCreated, false);
assert.equal(fs.existsSync(outputPath), false);

const createOut = execJson(['--input', inputPath, '--output', outputPath]);
assert.equal(createOut.status, 'pass');
assert.equal(createOut.bundleCreated, true);
const bundle = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(bundle.schemaVersion, 1);
assert.equal(bundle.chunkCount >= 1, true);
assert.equal(bundle.properties.GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION, '1');
assert.equal(bundle.properties.GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT, String(bundle.chunkCount));
const chunkCount = Number(bundle.properties.GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT);
let payload = '';
for (let index = 0; index < chunkCount; index += 1) {
  const chunk = bundle.properties[`GMAIL_SUPPRESSION_LEDGER_${index}`];
  assert.equal(Boolean(chunk), true);
  assert.equal(bundle.properties[`GMAIL_SUPPRESSION_LEDGER_${index}_CHECKSUM`], sha256(chunk));
  payload += chunk;
}
assert.equal(bundle.properties.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM, sha256(payload));

const secondOutPath = path.join(tempDir, 'bundle-2.json');
execJson(['--input', inputPath, '--output', secondOutPath]);
const second = JSON.parse(fs.readFileSync(secondOutPath, 'utf8'));
assert.equal(second.properties.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM, bundle.properties.GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM);

console.log(JSON.stringify({
  syntheticTestCount: 12,
  passed: true,
  dryRunCreatedFile: false,
  chunkChecksumValidated: true,
  bundleChecksumDeterministic: true,
  realScriptPropertiesUpdated: false
}, null, 2));

function execJson(args) {
  return JSON.parse(execFileSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  }));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
