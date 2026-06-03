import { DEFAULT_POOL_FILE, asCandidates, candidateEmail, dedupeKey, isValidEmail, parseArgs, readJson, safeSummary } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/validate-gmail-pool.mjs [--pool data/gmail/pool/gmail-ready-candidate-pool.json]

Validates counts and duplicate status without printing names, emails, URLs, or message bodies.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const poolFile = args.pool || DEFAULT_POOL_FILE;
const candidates = asCandidates(readJson(poolFile, { candidates: [] }));
const seenEmails = new Set();
const seenDedupe = new Set();
const summary = {
  poolFileExists: candidates.length > 0,
  total: candidates.length,
  available: 0,
  reserved: 0,
  sent: 0,
  replied: 0,
  unsubscribed: 0,
  doNotContact: 0,
  invalidEmail: 0,
  duplicateEmail: 0,
  duplicateDedupeKey: 0
};

for (const candidate of candidates) {
  const status = String(candidate.status || 'available');
  if (summary[status] !== undefined) {
    summary[status] += 1;
  }
  const email = candidateEmail(candidate);
  const key = dedupeKey(candidate);
  if (!isValidEmail(email)) summary.invalidEmail += 1;
  if (email && seenEmails.has(email)) summary.duplicateEmail += 1;
  if (key && seenDedupe.has(key)) summary.duplicateDedupeKey += 1;
  if (email) seenEmails.add(email);
  if (key) seenDedupe.add(key);
}

console.log(safeSummary(summary));

if (summary.invalidEmail || summary.duplicateEmail || summary.duplicateDedupeKey) {
  process.exit(1);
}
