#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, safeSummary } from './pool-utils.mjs';

const SCHEMA_VERSION = 1;
const CHUNK_SIZE = 7000;
const DEFAULT_INPUT = path.join('tmp', 'gmail-incident', 'suppression-ledger-safe.json');
const DEFAULT_OUTPUT = path.join('tmp', 'gmail-apps-script-suppression', 'gmail-suppression-properties-bundle.json');

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log('Usage: node scripts/gmail/create-apps-script-suppression-bundle.mjs --input tmp/gmail-incident/suppression-ledger-safe.json [--output tmp/gmail-apps-script-suppression/gmail-suppression-properties-bundle.json] [--dry-run]');
  process.exit(0);
}

const inputPath = args.input || DEFAULT_INPUT;
const outputPath = args.output || DEFAULT_OUTPUT;
const dryRun = Boolean(args['dry-run'] || args.dryRun);

try {
  const ledger = readJson(inputPath);
  const entries = extractEntries(ledger);
  const payload = buildPayload(entries, ledger, args['created-at']);
  const payloadJson = canonicalJson(payload);
  const bundleChecksum = sha256(payloadJson);
  const chunks = chunkString(payloadJson, CHUNK_SIZE);
  const properties = {
    GMAIL_SUPPRESSION_LEDGER_SCHEMA_VERSION: String(SCHEMA_VERSION),
    GMAIL_SUPPRESSION_LEDGER_CREATED_AT: payload.createdAt,
    GMAIL_SUPPRESSION_LEDGER_SOURCE_ENTRY_COUNT: String(payload.sourceEntryCount),
    GMAIL_SUPPRESSION_LEDGER_RECIPIENT_COUNT: String(payload.recipientHashes.length),
    GMAIL_SUPPRESSION_LEDGER_DOMAIN_COUNT: String(payload.domainHashes.length),
    GMAIL_SUPPRESSION_LEDGER_BUSINESS_COUNT: String(payload.businessFingerprints.length),
    GMAIL_SUPPRESSION_LEDGER_BUNDLE_CHECKSUM: bundleChecksum,
    GMAIL_SUPPRESSION_LEDGER_CHUNK_COUNT: String(chunks.length)
  };
  chunks.forEach((chunk, index) => {
    properties[`GMAIL_SUPPRESSION_LEDGER_${index}`] = chunk;
    properties[`GMAIL_SUPPRESSION_LEDGER_${index}_CHECKSUM`] = sha256(chunk);
  });

  if (!dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${canonicalJson({
      schemaVersion: SCHEMA_VERSION,
      createdAt: payload.createdAt,
      sourceEntryCount: payload.sourceEntryCount,
      recipientSuppressionCount: payload.recipientHashes.length,
      domainSuppressionCount: payload.domainHashes.length,
      businessSuppressionCount: payload.businessFingerprints.length,
      chunkCount: chunks.length,
      properties
    })}\n`);
  }

  console.log(safeSummary({
    status: 'pass',
    schemaVersion: SCHEMA_VERSION,
    sourceEntryCount: payload.sourceEntryCount,
    recipientSuppressionCount: payload.recipientHashes.length,
    domainSuppressionCount: payload.domainHashes.length,
    businessSuppressionCount: payload.businessFingerprints.length,
    chunkCount: chunks.length,
    bundleChecksumPresent: Boolean(bundleChecksum),
    wouldCreateBundle: true,
    bundleCreated: !dryRun
  }));
} catch (error) {
  console.log(safeSummary({
    status: 'blocked',
    schemaVersion: SCHEMA_VERSION,
    sourceEntryCount: 0,
    recipientSuppressionCount: 0,
    domainSuppressionCount: 0,
    businessSuppressionCount: 0,
    chunkCount: 0,
    bundleChecksumPresent: false,
    wouldCreateBundle: false,
    bundleCreated: false,
    blockedReason: safeErrorReason(error)
  }));
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('input_not_found');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractEntries(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.entries)) return value.entries;
  if (value?.ledger && typeof value.ledger === 'object') return Object.values(value.ledger);
  if (value && typeof value === 'object') {
    const values = Object.values(value).filter((entry) => entry && typeof entry === 'object');
    if (values.length > 0 && values.every(hasSuppressionHash)) return values;
  }
  throw new Error('ledger_entries_missing');
}

function buildPayload(entries, source, createdAtArg) {
  const recipientHashes = new Set();
  const domainHashes = new Set();
  const businessFingerprints = new Set();

  entries.forEach((entry) => {
    if (!entry || entry.suppressed === false || entry.futureEligible === true) return;
    assertHashOnlyEntry(entry);
    const recipientHash = cleanHash(entry.recipientHash);
    const domainHash = cleanHash(entry.normalizedDomainHash || entry.domainHash);
    const businessFingerprint = cleanHash(entry.businessFingerprint);
    if (recipientHash) recipientHashes.add(recipientHash);
    if (domainHash) domainHashes.add(domainHash);
    if (businessFingerprint) businessFingerprints.add(businessFingerprint);
  });

  if (recipientHashes.size + domainHashes.size + businessFingerprints.size < 1) {
    throw new Error('suppression_ledger_empty');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: resolveCreatedAt(source, createdAtArg),
    sourceEntryCount: entries.length,
    recipientHashes: Array.from(recipientHashes).sort(),
    domainHashes: Array.from(domainHashes).sort(),
    businessFingerprints: Array.from(businessFingerprints).sort()
  };
}

function assertHashOnlyEntry(entry) {
  const disallowedKeys = [
    'email',
    'contactEmail',
    'name',
    'businessName',
    'sourceUrl',
    'url',
    'subject',
    'body',
    'prospectId',
    'dedupeKey'
  ];
  if (disallowedKeys.some((key) => Object.prototype.hasOwnProperty.call(entry, key))) {
    throw new Error('ledger_contains_raw_identifier_fields');
  }
}

function resolveCreatedAt(source, explicit) {
  const value = explicit || source?.createdAt || source?.generatedAt || source?.ledgerVersion || source?.summary?.generatedAt;
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) {
    throw new Error('created_at_missing_or_invalid');
  }
  return date.toISOString();
}

function hasSuppressionHash(entry) {
  return Boolean(cleanHash(entry.recipientHash) || cleanHash(entry.normalizedDomainHash || entry.domainHash) || cleanHash(entry.businessFingerprint));
}

function cleanHash(value) {
  return String(value || '').trim();
}

function canonicalJson(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortObject(value[key]);
    return acc;
  }, {});
}

function chunkString(value, size) {
  const chunks = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [''];
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeErrorReason(error) {
  const reason = String(error?.message || 'unknown_error');
  return /^[a-z0-9_,:-]+$/i.test(reason) ? reason : 'bundle_generation_failed';
}
