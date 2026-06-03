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
const byEmail = new Set(existing.map(candidateEmail).filter(Boolean));
const byName = new Set(existing.map(candidateName).filter(Boolean));
const byDedupe = new Set(existing.map(dedupeKey).filter(Boolean));
const merged = existing.slice();
const summary = {
  existing: existing.length,
  incoming: incoming.length,
  added: 0,
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
  if (byEmail.has(email) || (name && byName.has(name)) || byDedupe.has(key)) {
    summary.excludedDuplicate += 1;
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
  byEmail.add(email);
  if (name) byName.add(name);
  byDedupe.add(key);
  summary.added += 1;
}

summary.outputTotal = merged.length;
fs.mkdirSync(path.dirname(poolFile), { recursive: true });
writeJson(poolFile, { updatedAt: new Date().toISOString(), candidates: merged });
console.log(safeSummary(summary));
