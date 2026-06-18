import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_POOL_FILE, asCandidates, candidateEmail, candidateName, dedupeKey, isValidEmail, parseArgs, readJson, safeSummary, sourceDomain, writeJson } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/merge-gmail-candidate-pool.mjs --input data/gmail/pool/batch.json [--pool data/gmail/pool/gmail-ready-candidate-pool.json]

Merges a local candidate batch into the Gmail-ready pool. Does not print names, emails, URLs, or message bodies.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}
if (!args.input) {
  printHelp();
  process.exit(1);
}

const poolFile = args.pool || DEFAULT_POOL_FILE;
const existing = asCandidates(readJson(poolFile, { candidates: [] }));
const incoming = asCandidates(readJson(args.input, { candidates: [] }));
const merged = existing.slice();
const byEmail = new Map();
const byName = new Map();
const byDedupe = new Map();
merged.forEach((candidate, index) => {
  const email = candidateEmail(candidate);
  const name = candidateName(candidate);
  const key = dedupeKey(candidate);
  if (email && !byEmail.has(email)) byEmail.set(email, index);
  if (name && !byName.has(name)) byName.set(name, index);
  if (key && !byDedupe.has(key)) byDedupe.set(key, index);
});
const summary = {
  existing: existing.length,
  incoming: incoming.length,
  added: 0,
  refreshed: 0,
  excludedInvalidEmail: 0,
  excludedDuplicate: 0,
  outputTotal: 0
};

for (const candidate of incoming) {
  const email = candidateEmail(candidate);
  const name = candidateName(candidate);
  const key = dedupeKey(candidate);
  if (!isValidEmail(email)) {
    summary.excludedInvalidEmail += 1;
    continue;
  }
  const duplicateIndex = duplicateIndexFor({ email, name, key });
  if (duplicateIndex !== -1) {
    if (refreshExistingCandidate(merged[duplicateIndex], candidate)) {
      summary.refreshed += 1;
    } else {
      summary.excludedDuplicate += 1;
    }
    continue;
  }
  merged.push({
    ...candidate,
    email,
    status: candidate.status || 'available',
    firstSeenAt: candidate.firstSeenAt || new Date().toISOString(),
    lastCheckedAt: candidate.lastCheckedAt || new Date().toISOString(),
    dedupeKey: key,
    sourceDomain: candidate.sourceDomain || sourceDomain(candidate),
    sendHistory: Array.isArray(candidate.sendHistory) ? candidate.sendHistory : []
  });
  byEmail.set(email, merged.length - 1);
  if (name) byName.set(name, merged.length - 1);
  byDedupe.set(key, merged.length - 1);
  summary.added += 1;
}

summary.outputTotal = merged.length;
fs.mkdirSync(path.dirname(poolFile), { recursive: true });
writeJson(poolFile, { updatedAt: new Date().toISOString(), candidates: merged });
console.log(safeSummary(summary));

function duplicateIndexFor({ email, name, key }) {
  if (email && byEmail.has(email)) return byEmail.get(email);
  if (key && byDedupe.has(key)) return byDedupe.get(key);
  if (name && byName.has(name)) return byName.get(name);
  return -1;
}

function refreshExistingCandidate(existingCandidate, incomingCandidate) {
  const checkedAt = safeTimestamp(incomingCandidate.lastCheckedAt);
  if (!checkedAt) {
    return false;
  }
  existingCandidate.lastCheckedAt = checkedAt;
  if (safeTimestamp(incomingCandidate.sourceCheckedAt)) {
    existingCandidate.sourceCheckedAt = safeTimestamp(incomingCandidate.sourceCheckedAt);
  }
  if (safeTimestamp(incomingCandidate.verifiedAt)) {
    existingCandidate.verifiedAt = safeTimestamp(incomingCandidate.verifiedAt);
  }
  existingCandidate.refreshBatchId = incomingCandidate.refreshBatchId || incomingCandidate.batchId || existingCandidate.refreshBatchId || '';
  existingCandidate.lastRefreshMergedAt = new Date().toISOString();
  return true;
}

function safeTimestamp(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}
