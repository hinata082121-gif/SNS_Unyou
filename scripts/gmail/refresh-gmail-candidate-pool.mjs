import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_POOL_FILE,
  asCandidates,
  candidateEmail,
  candidateName,
  dedupeKey,
  hashValue,
  isAvailable,
  isValidEmail,
  parseArgs,
  readJson,
  safeSummary,
  sourceDomain,
  writeJson
} from './pool-utils.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const targetDate = requireDate(args.date);
const poolFile = args.pool || DEFAULT_POOL_FILE;
const requiredFreshCount = Number(args['required-fresh-count'] || 45);
const maxCandidates = Number(args['max-candidates'] || 130);
const concurrency = Math.max(1, Number(args.concurrency || 5));
const requestTimeoutMs = Math.max(1000, Number(args['request-timeout-ms'] || 12000));
const dryRun = Boolean(args['dry-run']);
const write = Boolean(args.write);
const mockNetwork = Boolean(args['mock-network']);
const suppressionLedgerFile = args['suppression-ledger'] || 'tmp/gmail-incident/suppression-ledger-safe.json';
const sheetHistoryFile = args['sheet-history'] || 'tmp/gmail-incident/google-sheet-send-history-safe.json';
const localHistoryDir = args['history-dir'] || 'data/gmail/outbox';

if (dryRun === write) {
  console.error('Specify exactly one of --dry-run or --write.');
  process.exit(1);
}
if (!Number.isFinite(requiredFreshCount) || requiredFreshCount < 1) {
  console.error('required-fresh-count must be a positive number.');
  process.exit(1);
}
if (!Number.isFinite(maxCandidates) || maxCandidates < 1) {
  console.error('max-candidates must be a positive number.');
  process.exit(1);
}

const pool = readJson(poolFile, null);
const candidates = asCandidates(pool);
const suppression = loadSuppressionLedger(suppressionLedgerFile);
const sheetHistory = loadHistoryHashes(sheetHistoryFile);
const localHistory = loadLocalHistoryHashes(localHistoryDir);

const indexed = candidates
  .map((candidate, index) => ({ candidate, index }))
  .filter(({ candidate }) => isAvailable(candidate))
  .slice(0, maxCandidates);

const seen = {
  recipient: new Set(),
  domain: new Set(),
  business: new Set(),
  dedupe: new Set()
};
const results = await mapWithDomainLimit(indexed, concurrency, async (item) => verifyCandidate(item, seen));
const verified = results.filter((result) => result.verified);

const summary = buildSummary(results, verified.length);

if (write && summary.requiredFreshCountReached) {
  const now = new Date().toISOString();
  const updatedCandidates = candidates.map((candidate, index) => {
    const result = results.find((item) => item.index === index && item.verified);
    if (!result) return candidate;
    return {
      ...candidate,
      lastCheckedAt: now,
      verifiedAt: now,
      sourceCheckedAt: now,
      verificationStatus: 'verified',
      verificationReasonCode: result.reasonCode,
      verificationMethod: 'http_dns_source_consistency_v1',
      sourceHttpStatus: result.sourceHttpStatus,
      sourceDomainVerified: result.sourceDomainVerified,
      safetyChecks: {
        ...(candidate.safetyChecks || {}),
        refreshedAt: now,
        verificationMethod: 'http_dns_source_consistency_v1'
      }
    };
  });
  const nextPool = Array.isArray(pool)
    ? updatedCandidates
    : { ...(pool || {}), updatedAt: now, candidates: updatedCandidates };
  writeJson(poolFile, nextPool);
  summary.poolUpdated = true;
} else {
  summary.poolUpdated = false;
}

console.log(safeSummary(summary));

if (!summary.requiredFreshCountReached) {
  process.exitCode = 1;
}

function printHelp() {
  console.log(`Usage: node scripts/gmail/refresh-gmail-candidate-pool.mjs --date YYYY-MM-DD --dry-run|--write

Revalidates existing Gmail sales candidates without printing emails, names, URLs, bodies, IDs, or hashes.`);
}

function requireDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    console.error('--date YYYY-MM-DD is required.');
    process.exit(1);
  }
  return text;
}

async function verifyCandidate(item, seenArg) {
  const candidate = item.candidate;
  const base = {
    index: item.index,
    inspected: true,
    networkChecked: false,
    verified: false,
    reasonCode: '',
    sourceHttpStatus: 0,
    sourceDomainVerified: false
  };
  const email = candidateEmail(candidate);
  const source = String(candidate.sourceUrl || candidate.publicSource || '').trim();
  const domain = sourceDomain(candidate);
  const business = businessFingerprint(candidate);
  const recipientHash = hashValue(email);
  const domainHash = hashValue(domain);
  const key = dedupeKey(candidate);

  if (!isValidEmail(email)) return reject(base, 'invalid_email');
  if (!source) return reject(base, 'source_missing');
  if (!validSourceUrl(source)) return reject(base, 'source_url_invalid');
  if (String(candidate.doNotContact || '').toLowerCase() === 'true') return reject(base, 'do_not_contact');
  if (suppression.recipientHashes.has(recipientHash)) return reject(base, 'suppression_recipient');
  if (domainHash && suppression.domainHashes.has(domainHash)) return reject(base, 'suppression_domain');
  if (business && suppression.businessFingerprints.has(business)) return reject(base, 'suppression_business');
  if (isInHistory({ recipientHash, domainHash, businessFingerprint: business }, sheetHistory)) return reject(base, 'sheet_history');
  if (isInHistory({ recipientHash, domainHash, businessFingerprint: business }, localHistory)) return reject(base, 'local_history');
  if (seenArg.recipient.has(recipientHash) || seenArg.domain.has(domainHash) || seenArg.business.has(business) || seenArg.dedupe.has(key)) {
    return reject(base, 'duplicate');
  }
  seenArg.recipient.add(recipientHash);
  seenArg.domain.add(domainHash);
  seenArg.business.add(business);
  seenArg.dedupe.add(key);

  const http = await checkSource(source);
  base.networkChecked = true;
  base.sourceHttpStatus = http.status;
  if (!http.ok) return reject(base, http.reasonCode);
  if (looksParked(http.text)) return reject(base, 'parked_domain');

  const emailDomain = email.split('@')[1] || '';
  const sourceMatchesEmailDomain = domainsRelated(emailDomain, domain);
  const pageContainsEmail = http.text.toLowerCase().includes(email.toLowerCase());
  if (!sourceMatchesEmailDomain && !pageContainsEmail) return reject(base, 'email_source_mismatch');

  const mx = await checkMx(emailDomain);
  if (!mx.ok) return reject(base, mx.reasonCode);

  return {
    ...base,
    verified: true,
    reasonCode: 'verified',
    sourceDomainVerified: sourceMatchesEmailDomain || pageContainsEmail
  };
}

function reject(base, reasonCode) {
  return { ...base, reasonCode };
}

function validSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function checkSource(value) {
  if (mockNetwork) return mockCheckSource(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(value, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'ICHI-Social-candidate-verifier/1.0 (+read-only verification)'
      }
    });
    const status = response.status;
    if (status === 429) return { ok: false, status, text: '', reasonCode: 'rate_limited' };
    if (status === 404) return { ok: false, status, text: '', reasonCode: 'http_404' };
    if (status === 410) return { ok: false, status, text: '', reasonCode: 'http_410' };
    if (status < 200 || status >= 400) return { ok: false, status, text: '', reasonCode: status >= 500 ? 'http_5xx' : 'http_unavailable' };
    const text = await response.text();
    return { ok: true, status, text: text.slice(0, 250000), reasonCode: 'http_ok' };
  } catch (error) {
    return { ok: false, status: 0, text: '', reasonCode: error && error.name === 'AbortError' ? 'timeout' : 'http_error' };
  } finally {
    clearTimeout(timer);
  }
}

function mockCheckSource(value) {
  const host = new URL(value).hostname;
  if (host.includes('timeout')) return { ok: false, status: 0, text: '', reasonCode: 'timeout' };
  if (host.includes('status404')) return { ok: false, status: 404, text: '', reasonCode: 'http_404' };
  if (host.includes('status410')) return { ok: false, status: 410, text: '', reasonCode: 'http_410' };
  if (host.includes('status429')) return { ok: false, status: 429, text: '', reasonCode: 'rate_limited' };
  if (host.includes('parked')) return { ok: true, status: 200, text: 'this domain may be for sale parked domain', reasonCode: 'http_ok' };
  if (host.includes('mismatch')) return { ok: true, status: 200, text: 'official business page contact form', reasonCode: 'http_ok' };
  return { ok: true, status: 200, text: 'official business page contact form', reasonCode: 'http_ok' };
}

async function checkMx(domain) {
  if (!domain) return { ok: false, reasonCode: 'mx_missing' };
  if (mockNetwork) return domain.includes('nomx') ? { ok: false, reasonCode: 'mx_missing' } : { ok: true, reasonCode: 'mx_present' };
  try {
    const records = await dns.resolveMx(domain);
    if (records && records.length > 0) return { ok: true, reasonCode: 'mx_present' };
  } catch {
    // Fall through to a conservative A/AAAA fallback for domains that receive mail at root.
  }
  try {
    const addresses = await dns.lookup(domain, { all: true });
    return addresses.length > 0 ? { ok: true, reasonCode: 'mx_fallback_a_present' } : { ok: false, reasonCode: 'mx_missing' };
  } catch {
    return { ok: false, reasonCode: 'mx_missing' };
  }
}

function looksParked(text) {
  const normalized = String(text || '').toLowerCase();
  return [
    'domain may be for sale',
    'buy this domain',
    'parked domain',
    'sedo domain parking',
    'godaddy.com/forsale'
  ].some((needle) => normalized.includes(needle));
}

function domainsRelated(emailDomain, sourceHost) {
  const a = stripWww(emailDomain);
  const b = stripWww(sourceHost);
  return Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)));
}

function stripWww(value) {
  return String(value || '').toLowerCase().replace(/^www\./, '');
}

async function mapWithDomainLimit(items, maxActive, fn) {
  const results = new Array(items.length);
  const activeDomains = new Set();
  let cursor = 0;
  let active = 0;
  return await new Promise((resolve) => {
    const pump = () => {
      while (active < maxActive && cursor < items.length) {
        const nextIndex = findNextAvailableIndex(items, cursor, activeDomains);
        if (nextIndex === -1) break;
        const [item] = items.splice(nextIndex, 1);
        const domain = sourceDomain(item.candidate) || `idx-${item.index}`;
        activeDomains.add(domain);
        active += 1;
        fn(item).then((result) => {
          results[item.index] = result;
        }).catch(() => {
          results[item.index] = { index: item.index, inspected: true, networkChecked: false, verified: false, reasonCode: 'verification_exception' };
        }).finally(() => {
          active -= 1;
          activeDomains.delete(domain);
          pump();
        });
      }
      if (items.length === 0 && active === 0) {
        resolve(results.filter(Boolean));
      }
    };
    pump();
  });
}

function findNextAvailableIndex(items, start, activeDomains) {
  for (let index = start; index < items.length; index += 1) {
    const domain = sourceDomain(items[index].candidate) || `idx-${items[index].index}`;
    if (!activeDomains.has(domain)) return index;
  }
  for (let index = 0; index < start; index += 1) {
    const domain = sourceDomain(items[index].candidate) || `idx-${items[index].index}`;
    if (!activeDomains.has(domain)) return index;
  }
  return -1;
}

function loadSuppressionLedger(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value));
  return {
    loaded: Boolean(value && entries.length > 0),
    recipientHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.recipientHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.filter((entry) => entry.suppressed !== false && entry.futureEligible !== true).map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadHistoryHashes(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value.rows || value));
  return {
    loaded: Boolean(value),
    recipientHashes: new Set(entries.map((entry) => String(entry.recipientHash || entry.emailHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadLocalHistoryHashes(dir) {
  if (!fs.existsSync(dir)) return { loaded: false, recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  const history = { loaded: true, recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const rows = asCandidates(readJson(path.join(dir, entry.name), {}));
    rows.forEach((row) => {
      const email = candidateEmail(row);
      const domain = sourceDomain(row);
      const business = businessFingerprint(row);
      if (email) history.recipientHashes.add(hashValue(email));
      if (domain) history.domainHashes.add(hashValue(domain));
      if (business) history.businessFingerprints.add(business);
    });
  }
  return history;
}

function isInHistory(candidate, history) {
  return history.recipientHashes.has(candidate.recipientHash) ||
    history.domainHashes.has(candidate.domainHash) ||
    history.businessFingerprints.has(candidate.businessFingerprint);
}

function businessFingerprint(candidate) {
  const name = candidateName(candidate);
  const domain = sourceDomain(candidate);
  return hashValue(`${domain}|${name}`);
}

function buildSummary(results, verifiedCount) {
  const countReason = (reason) => results.filter((result) => result.reasonCode === reason).length;
  const suppressionExcludedCount = results.filter((result) => String(result.reasonCode || '').startsWith('suppression_')).length;
  const historyExcludedCount = countReason('sheet_history') + countReason('local_history');
  const unavailableCount = ['http_404', 'http_410', 'http_5xx', 'http_unavailable', 'http_error', 'rate_limited', 'parked_domain'].reduce((sum, reason) => sum + countReason(reason), 0);
  return {
    targetDate,
    mode: dryRun ? 'dry_run' : 'write',
    poolTotalCount: candidates.length,
    inspectedCount: results.length,
    networkCheckedCount: results.filter((result) => result.networkChecked).length,
    verifiedCount,
    rejectedCount: results.filter((result) => !result.verified).length,
    timeoutCount: countReason('timeout'),
    unavailableCount,
    emailMismatchCount: countReason('email_source_mismatch'),
    mxMissingCount: countReason('mx_missing'),
    suppressionExcludedCount,
    historyExcludedCount,
    duplicateExcludedCount: countReason('duplicate'),
    requiredFreshCount,
    requiredFreshCountReached: verifiedCount >= requiredFreshCount,
    dryRun,
    write,
    poolUpdated: false,
    timestampOnlyUpdate: false,
    lastCheckedAtUpdateCondition: 'network_http_success_and_source_email_or_domain_consistency_and_mx_and_safety_pass',
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false
  };
}
