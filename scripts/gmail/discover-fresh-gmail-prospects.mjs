import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_POOL_FILE,
  asCandidates,
  candidateEmail,
  candidateName,
  hashValue,
  parseArgs,
  readJson,
  safeSummary,
  sourceDomain,
  writeJson
} from './pool-utils.mjs';
import { discoverPlacesWithGooglePlaces } from './providers/google-places-discovery.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const provider = String(args.provider || '').trim();
const targetDate = requireDate(args.date);
const requiredCount = Number(args['required-count'] || 45);
const targetCount = Number(args['target-count'] || 90);
const maxProviderRequests = Number(args['max-provider-requests'] || 30);
const maxWebsiteRequests = Number(args['max-website-requests'] || 500);
const dryRun = Boolean(args['dry-run']);
const write = Boolean(args.write);
const mock = Boolean(args.mock);
const outputFile = args.output || `tmp/gmail-candidate-refresh/${targetDate}-verified-candidates.json`;
const poolFile = args.pool || DEFAULT_POOL_FILE;
const suppressionLedgerFile = args['suppression-ledger'] || 'tmp/gmail-incident/suppression-ledger-safe.json';
const sheetHistoryFile = args['sheet-history'] || 'tmp/gmail-incident/google-sheet-send-history-safe.json';
const localHistoryDir = args['history-dir'] || 'data/gmail/outbox';

if (provider !== 'google_places') {
  console.log(safeSummary(blockedSummary('candidate_discovery_provider_unconfigured')));
  process.exit(1);
}
if (dryRun === write) {
  console.error('Specify exactly one of --dry-run or --write.');
  process.exit(1);
}

const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
const existingPool = asCandidates(readJson(poolFile, { candidates: [] }));
const suppression = loadSuppressionLedger(suppressionLedgerFile);
const sheetHistory = loadHistoryHashes(sheetHistoryFile);
const localHistory = loadLocalHistoryHashes(localHistoryDir);
const placesSummary = await discoverPlacesWithGooglePlaces({
  apiKey,
  dateText: targetDate,
  maxProviderRequests,
  mock
});

if (placesSummary.errorCode) {
  console.log(safeSummary(Object.assign(baseSummary(), placesSummary, {
    status: 'blocked',
    blockedReason: placesSummary.errorCode
  })));
  process.exit(1);
}

const verification = await verifyPlaces(placesSummary.places);
const strictEligible = verification.eligible.slice(0, targetCount);
const summary = Object.assign(baseSummary(), {
  apiKeyConfigured: placesSummary.apiKeyConfigured,
  queryCount: placesSummary.queryCount,
  providerRequestCount: placesSummary.providerRequestCount,
  rawPlaceCount: placesSummary.rawPlaceCount,
  uniquePlaceCount: placesSummary.uniquePlaceCount,
  closedExcludedCount: placesSummary.closedExcludedCount,
  websiteMissingCount: placesSummary.websiteMissingCount,
  websitesChecked: verification.websitesChecked,
  websiteRequestCount: verification.websiteRequestCount,
  publicEmailFound: verification.publicEmailFound,
  salesProhibitedExcludedCount: verification.salesProhibitedExcludedCount,
  mxMissingCount: verification.mxMissingCount,
  suppressionExcludedCount: verification.suppressionExcludedCount,
  historyExcludedCount: verification.historyExcludedCount,
  duplicateExcludedCount: verification.duplicateExcludedCount + placesSummary.duplicatePlaceExcludedCount,
  unavailableCount: verification.unavailableCount,
  emailMismatchCount: verification.emailMismatchCount,
  strictEligibleCandidateCount: strictEligible.length,
  sourceSyncCandidateCount: strictEligible.length,
  status: strictEligible.length >= requiredCount ? 'pass' : 'blocked',
  blockedReason: strictEligible.length >= requiredCount ? '' : 'strict_eligible_count_below_required',
  outputCreated: false
});

if (write && strictEligible.length >= requiredCount) {
  writeJson(outputFile, {
    generatedAt: new Date().toISOString(),
    targetDate,
    provider,
    candidates: strictEligible
  });
  summary.outputCreated = true;
}

console.log(safeSummary(summary));
if (summary.status !== 'pass') process.exit(1);

function printHelp() {
  console.log('Usage: node scripts/gmail/discover-fresh-gmail-prospects.mjs --provider google_places --date YYYY-MM-DD --dry-run|--write');
}

function requireDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    console.error('--date YYYY-MM-DD is required.');
    process.exit(1);
  }
  return text;
}

function baseSummary() {
  return {
    provider: 'google_places',
    targetDate,
    mode: dryRun ? 'dry_run' : 'write',
    apiKeyConfigured: Boolean(apiKey),
    queryCount: 0,
    providerRequestCount: 0,
    rawPlaceCount: 0,
    uniquePlaceCount: 0,
    closedExcludedCount: 0,
    websiteMissingCount: 0,
    websitesChecked: 0,
    websiteRequestCount: 0,
    publicEmailFound: 0,
    salesProhibitedExcludedCount: 0,
    mxMissingCount: 0,
    suppressionExcludedCount: 0,
    historyExcludedCount: 0,
    duplicateExcludedCount: 0,
    unavailableCount: 0,
    emailMismatchCount: 0,
    strictEligibleCandidateCount: 0,
    sourceSyncCandidateCount: 0,
    requiredCount,
    targetCount,
    maxProviderRequests,
    maxWebsiteRequests,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false,
    candidateDataLogged: false
  };
}

function blockedSummary(reason) {
  return Object.assign(baseSummary(), { status: 'blocked', blockedReason: reason });
}

async function verifyPlaces(places) {
  const summary = {
    websitesChecked: 0,
    websiteRequestCount: 0,
    publicEmailFound: 0,
    salesProhibitedExcludedCount: 0,
    mxMissingCount: 0,
    suppressionExcludedCount: 0,
    historyExcludedCount: 0,
    duplicateExcludedCount: 0,
    unavailableCount: 0,
    emailMismatchCount: 0,
    eligible: []
  };
  const seen = buildSeenSets();
  for (const place of places) {
    if (summary.websiteRequestCount >= maxWebsiteRequests || summary.eligible.length >= targetCount) break;
    if (isChainBusiness(place)) {
      summary.duplicateExcludedCount += 1;
      continue;
    }
    const website = await inspectWebsite(place);
    summary.websitesChecked += 1;
    summary.websiteRequestCount += website.requestCount;
    if (!website.ok) {
      if (website.reasonCode === 'sales_prohibited') summary.salesProhibitedExcludedCount += 1;
      else summary.unavailableCount += 1;
      continue;
    }
    if (!website.email) {
      summary.unavailableCount += 1;
      continue;
    }
    summary.publicEmailFound += 1;
    if (!domainsRelated(website.email.split('@')[1], sourceDomain({ sourceUrl: place.websiteUri })) && !website.pageContainedEmail) {
      summary.emailMismatchCount += 1;
      continue;
    }
    const mx = await checkMx(website.email.split('@')[1]);
    if (!mx) {
      summary.mxMissingCount += 1;
      continue;
    }
    const candidate = buildCandidate(place, website.email);
    const exclusion = exclusionReason(candidate, seen);
    if (exclusion === 'suppression') summary.suppressionExcludedCount += 1;
    if (exclusion === 'history') summary.historyExcludedCount += 1;
    if (exclusion === 'duplicate') summary.duplicateExcludedCount += 1;
    if (exclusion) continue;
    markSeen(candidate, seen);
    summary.eligible.push(candidate);
  }
  return summary;
}

async function inspectWebsite(place) {
  if (mock) return mockInspectWebsite(place);
  const urls = candidateWebsiteUrls(place.websiteUri);
  let requestCount = 0;
  for (const url of urls.slice(0, 4)) {
    requestCount += 1;
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'ICHI-Social-public-contact-verifier/1.0' } });
      if (!response.ok) continue;
      const text = (await response.text()).slice(0, 250000);
      if (salesProhibited(text)) return { ok: false, reasonCode: 'sales_prohibited', requestCount };
      const email = extractPublicEmail(text);
      if (email) return { ok: true, email, pageContainedEmail: true, requestCount };
    } catch {
      // Try the next public page candidate.
    }
  }
  return { ok: false, reasonCode: 'email_missing', requestCount };
}

function mockInspectWebsite(place) {
  const id = String(place.id || '');
  if (id.includes('http-failure')) return { ok: false, reasonCode: 'http_failure', requestCount: 1 };
  if (id.includes('sales-ng')) return { ok: false, reasonCode: 'sales_prohibited', requestCount: 1 };
  if (id.includes('email-missing')) return { ok: false, reasonCode: 'email_missing', requestCount: 1 };
  const domain = new URL(place.websiteUri).hostname;
  const local = id.includes('nomx') ? 'nomx' : 'contact';
  return { ok: true, email: `${local}@${domain}`, pageContainedEmail: true, requestCount: 1 };
}

function candidateWebsiteUrls(value) {
  const url = new URL(value);
  const base = `${url.protocol}//${url.hostname}`;
  return [value, `${base}/contact`, `${base}/company`, `${base}/about`, `${base}/access`];
}

function extractPublicEmail(text) {
  const mailto = String(text || '').match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailto) return mailto[1].toLowerCase();
  const visible = String(text || '').match(/[a-zA-Z0-9._%+-]+(?:@|\s*\[at\]\s*)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  if (!visible) return '';
  return visible[0].replace(/\s*\[at\]\s*/i, '@').toLowerCase();
}

function salesProhibited(text) {
  return ['営業メールお断り', 'セールスお断り', '広告掲載', '営業提案禁止', '営業目的の問い合わせ禁止']
    .some((needle) => String(text || '').includes(needle));
}

async function checkMx(domain) {
  if (mock) return !String(domain || '').includes('nomx');
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

function buildCandidate(place, email) {
  const name = place.name || '店舗';
  const now = `${targetDate}T00:00:00+09:00`;
  return {
    prospectId: `places-${hashValue(place.id, 16)}`,
    placeId: place.id,
    name,
    businessType: place.category || place.primaryType || '',
    area: place.area || '',
    email,
    contactEmail: email,
    publicSource: place.websiteUri,
    sourceUrl: place.websiteUri,
    issueHypothesis: 'Instagramプロフィールと予約導線の見え方を確認できる可能性があります。',
    salesAngle: 'SNSプロフィールと問い合わせ導線の無料確認',
    subject: `${name}さま SNS導線の見え方について`,
    body: `${name} さま\n\n突然のご連絡失礼いたします。ICHI Socialです。\nInstagramプロフィールや予約・問い合わせ導線の見え方を、無料で簡単に確認しています。\n\n今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\nICHI Social`,
    status: 'available',
    dedupeKey: `${email}|${sourceDomain({ sourceUrl: place.websiteUri })}|${name}`.toLowerCase(),
    lastCheckedAt: now,
    verifiedAt: now,
    verificationStatus: 'verified',
    verificationMethod: 'google_places_and_official_website',
    doNotContact: false,
    notes: 'verified by google places and official website'
  };
}

function buildSeenSets() {
  const seen = { email: new Set(), domain: new Set(), business: new Set(), place: new Set() };
  for (const candidate of existingPool) markSeen(candidate, seen);
  return seen;
}

function exclusionReason(candidate, seen) {
  const email = candidateEmail(candidate);
  const domain = sourceDomain(candidate);
  const business = hashValue(`${domain}|${candidateName(candidate)}`);
  if (suppression.recipientHashes.has(hashValue(email)) || suppression.domainHashes.has(hashValue(domain)) || suppression.businessFingerprints.has(business)) return 'suppression';
  if (isInHistory({ email, domain, business }, sheetHistory) || isInHistory({ email, domain, business }, localHistory)) return 'history';
  if (seen.email.has(email) || seen.domain.has(domain) || seen.business.has(candidateName(candidate)) || seen.place.has(candidate.placeId)) return 'duplicate';
  return '';
}

function markSeen(candidate, seen) {
  seen.email.add(candidateEmail(candidate));
  seen.domain.add(sourceDomain(candidate));
  seen.business.add(candidateName(candidate));
  if (candidate.placeId) seen.place.add(candidate.placeId);
}

function isInHistory(candidate, history) {
  return history.recipientHashes.has(hashValue(candidate.email)) ||
    history.domainHashes.has(hashValue(candidate.domain)) ||
    history.businessFingerprints.has(candidate.business);
}

function domainsRelated(left, right) {
  const a = stripWww(left);
  const b = stripWww(right);
  return Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)));
}

function stripWww(value) {
  return String(value || '').toLowerCase().replace(/^www\./, '');
}

function isChainBusiness(place) {
  const text = `${place.name || ''} ${place.formattedAddress || ''}`;
  return ['イオン', 'スターバックス', 'マクドナルド', 'ドトール', 'コメダ珈琲', 'ホットヨガlava', 'anytime fitness']
    .some((needle) => text.toLowerCase().includes(needle.toLowerCase()));
}

function loadSuppressionLedger(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value));
  return {
    recipientHashes: new Set(entries.map((entry) => String(entry.recipientHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadHistoryHashes(filePath) {
  const value = readJson(filePath, null);
  const entries = asCandidates(value && (value.entries || value.rows || value));
  return {
    recipientHashes: new Set(entries.map((entry) => String(entry.recipientHash || entry.emailHash || '')).filter(Boolean)),
    domainHashes: new Set(entries.map((entry) => String(entry.normalizedDomainHash || entry.domainHash || '')).filter(Boolean)),
    businessFingerprints: new Set(entries.map((entry) => String(entry.businessFingerprint || '')).filter(Boolean))
  };
}

function loadLocalHistoryHashes(dir) {
  if (!fs.existsSync(dir)) return { recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  const history = { recipientHashes: new Set(), domainHashes: new Set(), businessFingerprints: new Set() };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const rows = asCandidates(readJson(path.join(dir, entry.name), {}));
    rows.forEach((row) => {
      const email = candidateEmail(row);
      const domain = sourceDomain(row);
      if (email) history.recipientHashes.add(hashValue(email));
      if (domain) history.domainHashes.add(hashValue(domain));
      if (domain || candidateName(row)) history.businessFingerprints.add(hashValue(`${domain}|${candidateName(row)}`));
    });
  }
  return history;
}
