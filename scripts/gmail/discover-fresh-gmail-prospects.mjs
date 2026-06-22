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
const maxWebsiteRequests = Number(args['max-website-requests'] || 320);
const websiteConcurrency = Number(args['website-concurrency'] || 4);
const maxVerificationDurationMs = Number(args['max-verification-duration-ms'] || 1500000);
const requestTimeoutMs = Number(args['request-timeout-ms'] || 8000);
const mockDelayMs = Number(args['mock-delay-ms'] || 0);
const dryRun = Boolean(args['dry-run']);
const write = Boolean(args.write);
const mock = Boolean(args.mock);
const summaryFile = args['summary-file'] || '';
const outputFile = args.output || `tmp/gmail-candidate-refresh/${targetDate}-verified-candidates.json`;
const poolFile = args.pool || DEFAULT_POOL_FILE;
const suppressionLedgerFile = args['suppression-ledger'] || 'tmp/gmail-incident/suppression-ledger-safe.json';
const sheetHistoryFile = args['sheet-history'] || 'tmp/gmail-incident/google-sheet-send-history-safe.json';
const localHistoryDir = args['history-dir'] || 'data/gmail/outbox';
const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
let placesSummary = { providerRequestCount: 0 };

await main();

async function main() {
  let finalSummary = null;
  let summaryWriteFailed = false;
  try {
    finalSummary = await runDiscovery();
  } catch (error) {
    finalSummary = buildSafeFailureSummary(error);
  }

  if (summaryFile) {
    try {
      writeSummaryAtomically(summaryFile, finalSummary);
    } catch {
      summaryWriteFailed = true;
      finalSummary = Object.assign(sanitizeSummary(finalSummary), {
        status: 'failed',
        errorCode: 'discovery_summary_write_failed',
        blockedReason: 'discovery_summary_write_failed',
        outputCreated: false
      });
    }
  }

  printSafeFinalSummary(finalSummary);
  process.exitCode = finalSummary.status === 'pass' && !summaryWriteFailed ? 0 : 1;
}

async function runDiscovery() {
  if (provider !== 'google_places') return blockedSummary('candidate_discovery_provider_unconfigured');
  if (dryRun === write) return blockedSummary('candidate_discovery_mode_invalid');

  const existingPool = asCandidates(readJson(poolFile, { candidates: [] }));
  const suppression = loadSuppressionLedger(suppressionLedgerFile);
  const sheetHistory = loadHistoryHashes(sheetHistoryFile);
  const localHistory = loadLocalHistoryHashes(localHistoryDir);
  placesSummary = await loadPlacesSummary();

  if (placesSummary.errorCode) {
    return Object.assign(baseSummary(), placesSummary, {
      status: 'blocked',
      blockedReason: normalizeReasonCode(placesSummary.errorCode),
      errorCode: normalizeReasonCode(placesSummary.errorCode)
    });
  }

  const verification = await verifyPlaces(placesSummary.places, { existingPool, suppression, sheetHistory, localHistory });
  const strictEligible = verification.eligible
    .slice()
    .sort((left, right) => String(left.prospectId || '').localeCompare(String(right.prospectId || '')))
    .slice(0, targetCount);
  const blockedReason = verification.deadlineExceeded
    ? 'website_verification_deadline_exceeded'
    : strictEligible.length >= requiredCount ? '' : 'strict_eligible_count_below_required';
  const summary = Object.assign(baseSummary(), {
    apiKeyConfigured: placesSummary.apiKeyConfigured,
    providerInvocationCount: 1,
    queryCount: placesSummary.queryCount,
    providerRequestCount: placesSummary.providerRequestCount,
    rawPlaceCount: placesSummary.rawPlaceCount,
    uniquePlaceCount: placesSummary.uniquePlaceCount,
    closedExcludedCount: placesSummary.closedExcludedCount,
    websiteMissingCount: placesSummary.websiteMissingCount,
    websitesChecked: verification.websitesChecked,
    websiteRequestCount: verification.websiteRequestCount,
    maxObservedWebsiteConcurrency: verification.maxObservedWebsiteConcurrency,
    maxObservedSameDomainConcurrency: verification.maxObservedSameDomainConcurrency,
    publicEmailFound: verification.publicEmailFound,
    salesProhibitedExcludedCount: verification.salesProhibitedExcludedCount,
    mxMissingCount: verification.mxMissingCount,
    suppressionExcludedCount: verification.suppressionExcludedCount,
    historyExcludedCount: verification.historyExcludedCount,
    duplicateExcludedCount: verification.duplicateExcludedCount + placesSummary.duplicatePlaceExcludedCount,
    unavailableCount: verification.unavailableCount,
    emailMismatchCount: verification.emailMismatchCount,
    workerExceptionCount: verification.workerExceptionCount,
    strictEligibleCandidateCount: strictEligible.length,
    sourceSyncCandidateCount: strictEligible.length,
    status: blockedReason ? 'blocked' : 'pass',
    blockedReason,
    errorCode: blockedReason,
    deadlineExceeded: verification.deadlineExceeded,
    outputCreated: false
  });

  if (write && strictEligible.length >= requiredCount && summary.status === 'pass') {
    writeJson(outputFile, {
      generatedAt: new Date().toISOString(),
      targetDate,
      provider,
      candidates: strictEligible
    });
    summary.outputCreated = true;
  }
  return summary;
}

async function loadPlacesSummary() {
  if (args['mock-provider-error']) {
    throw new Error(String(args['mock-provider-error']));
  }
  return await discoverPlacesWithGooglePlaces({
    apiKey,
    dateText: targetDate,
    maxProviderRequests,
    mock
  });
}

function buildSafeFailureSummary(error) {
  const errorCode = normalizeReasonCode(error && error.message);
  return Object.assign(baseSummary(), {
    status: errorCode === 'strict_eligible_count_below_required' ? 'blocked' : 'failed',
    blockedReason: errorCode,
    errorCode,
    providerInvocationCount: provider === 'google_places' ? 1 : 0,
    providerRequestCount: Number(placesSummary.providerRequestCount || 0),
    queryCount: Number(placesSummary.queryCount || 0),
    rawPlaceCount: Number(placesSummary.rawPlaceCount || 0),
    uniquePlaceCount: Number(placesSummary.uniquePlaceCount || 0),
    closedExcludedCount: Number(placesSummary.closedExcludedCount || 0),
    websiteMissingCount: Number(placesSummary.websiteMissingCount || 0),
    outputCreated: false
  });
}

function normalizeReasonCode(value) {
  const text = String(value || '').trim();
  const known = new Set([
    'candidate_discovery_provider_unconfigured',
    'candidate_discovery_mode_invalid',
    'strict_eligible_count_below_required',
    'website_verification_deadline_exceeded',
    'website_request_timeout',
    'website_request_budget_exhausted',
    'google_places_http_401',
    'google_places_http_403',
    'google_places_rate_limited',
    'discovery_summary_write_failed',
    'candidate_discovery_failed'
  ]);
  if (known.has(text)) return text;
  if (text === 'AbortError' || text.includes('AbortError')) return 'website_request_timeout';
  if (/google_places_http_401/.test(text)) return 'google_places_http_401';
  if (/google_places_http_403/.test(text)) return 'google_places_http_403';
  if (/google_places_rate_limited/.test(text)) return 'google_places_rate_limited';
  return 'candidate_discovery_failed';
}

function writeSummaryAtomically(filePath, summary) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(sanitizeSummary(summary), null, 2)}\n`, 'utf8');
  fs.renameSync(tempFile, filePath);
}

function printSafeFinalSummary(summary) {
  const safe = sanitizeSummary(summary);
  console.log(summaryFile ? JSON.stringify(safe) : safeSummary(safe));
}

function sanitizeSummary(summary) {
  const value = summary || {};
  const safe = {};
  const stringFields = ['status', 'blockedReason', 'errorCode', 'provider', 'targetDate', 'mode'];
  const numberFields = [
    'providerInvocationCount',
    'providerRequestCount',
    'queryCount',
    'rawPlaceCount',
    'uniquePlaceCount',
    'closedExcludedCount',
    'websiteMissingCount',
    'websitesChecked',
    'websiteRequestCount',
    'publicEmailFound',
    'salesProhibitedExcludedCount',
    'mxMissingCount',
    'suppressionExcludedCount',
    'historyExcludedCount',
    'duplicateExcludedCount',
    'unavailableCount',
    'emailMismatchCount',
    'strictEligibleCandidateCount',
    'sourceSyncCandidateCount',
    'requiredCount',
    'targetCount',
    'maxProviderRequests',
    'maxWebsiteRequests',
    'websiteConcurrency',
    'maxVerificationDurationMs',
    'requestTimeoutMs',
    'maxObservedWebsiteConcurrency',
    'maxObservedSameDomainConcurrency',
    'workerExceptionCount'
  ];
  const booleanFields = [
    'apiKeyConfigured',
    'outputCreated',
    'deadlineExceeded',
    'gmailSendExecuted',
    'googleSheetsUpdated',
    'triggerChanged',
    'candidateDataLogged'
  ];
  for (const field of stringFields) {
    if (field === 'blockedReason' || field === 'errorCode') safe[field] = value[field] ? normalizeReasonCode(value[field]) : '';
    else safe[field] = String(value[field] || '');
  }
  if (!safe.status) safe.status = 'failed';
  if (!['pass', 'blocked', 'failed'].includes(safe.status)) safe.status = 'failed';
  if (!safe.provider) safe.provider = 'google_places';
  if (!safe.targetDate) safe.targetDate = targetDate;
  for (const field of numberFields) safe[field] = Number(value[field] || 0);
  for (const field of booleanFields) safe[field] = Boolean(value[field]);
  return safe;
}

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
    websiteConcurrency,
    maxVerificationDurationMs,
    requestTimeoutMs,
    gmailSendExecuted: false,
    googleSheetsUpdated: false,
    triggerChanged: false,
    candidateDataLogged: false
  };
}

function blockedSummary(reason) {
  const safeReason = normalizeReasonCode(reason);
  return Object.assign(baseSummary(), { status: 'blocked', blockedReason: safeReason, errorCode: safeReason });
}

async function verifyPlaces(places, context) {
  const orderedPlaces = places
    .slice()
    .sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
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
    workerExceptionCount: 0,
    deadlineExceeded: false,
    maxObservedWebsiteConcurrency: 0,
    maxObservedSameDomainConcurrency: 0,
    eligible: []
  };
  const seen = buildSeenSets(context.existingPool);
  const started = new Set();
  const activeDomains = new Map();
  const deadlineAt = Date.now() + maxVerificationDurationMs;
  let activeWorkers = 0;
  let completedSinceProgress = 0;
  let lastProgressAt = Date.now();

  async function worker() {
    while (true) {
      const place = nextPlace();
      if (!place) return;
      const domain = sourceDomain({ sourceUrl: place.websiteUri }) || String(place.id || '');
      activeWorkers += 1;
      activeDomains.set(domain, Number(activeDomains.get(domain) || 0) + 1);
      summary.maxObservedWebsiteConcurrency = Math.max(summary.maxObservedWebsiteConcurrency, activeWorkers);
      summary.maxObservedSameDomainConcurrency = Math.max(summary.maxObservedSameDomainConcurrency, Number(activeDomains.get(domain) || 0));
      try {
        await verifyOnePlace(place);
      } catch {
        summary.workerExceptionCount += 1;
        summary.unavailableCount += 1;
      } finally {
        activeWorkers -= 1;
        activeDomains.set(domain, Number(activeDomains.get(domain) || 1) - 1);
        if (Number(activeDomains.get(domain) || 0) <= 0) activeDomains.delete(domain);
        completedSinceProgress += 1;
        maybeLogProgress(activeWorkers);
      }
    }
  }

  function nextPlace() {
    if (summary.eligible.length >= targetCount) return null;
    if (summary.websiteRequestCount >= maxWebsiteRequests) return null;
    if (Date.now() >= deadlineAt) {
      summary.deadlineExceeded = true;
      return null;
    }
    for (const place of orderedPlaces) {
      if (started.has(place.id)) continue;
      const domain = sourceDomain({ sourceUrl: place.websiteUri }) || String(place.id || '');
      if (activeDomains.has(domain)) continue;
      started.add(place.id);
      return place;
    }
    return null;
  }

  async function verifyOnePlace(place) {
    if (isChainBusiness(place)) {
      summary.duplicateExcludedCount += 1;
      return;
    }
    const website = await inspectWebsite(place, {
      deadlineAt,
      takeRequest: () => {
        if (summary.websiteRequestCount >= maxWebsiteRequests) return false;
        if (Date.now() >= deadlineAt) {
          summary.deadlineExceeded = true;
          return false;
        }
        summary.websiteRequestCount += 1;
        return true;
      }
    });
    summary.websitesChecked += 1;
    if (website.deadlineExceeded) summary.deadlineExceeded = true;
    if (!website.ok) {
      if (website.reasonCode === 'sales_prohibited') summary.salesProhibitedExcludedCount += 1;
      else summary.unavailableCount += 1;
      return;
    }
    if (!website.email) {
      summary.unavailableCount += 1;
      return;
    }
    summary.publicEmailFound += 1;
    if (!domainsRelated(website.email.split('@')[1], sourceDomain({ sourceUrl: place.websiteUri })) && !website.pageContainedEmail) {
      summary.emailMismatchCount += 1;
      return;
    }
    const mx = await checkMx(website.email.split('@')[1]);
    if (!mx) {
      summary.mxMissingCount += 1;
      return;
    }
    const candidate = buildCandidate(place, website.email);
    const exclusion = exclusionReason(candidate, seen, context);
    if (exclusion === 'suppression') summary.suppressionExcludedCount += 1;
    if (exclusion === 'history') summary.historyExcludedCount += 1;
    if (exclusion === 'duplicate') summary.duplicateExcludedCount += 1;
    if (exclusion) return;
    markSeen(candidate, seen);
    summary.eligible.push(candidate);
  }

  function maybeLogProgress(currentActiveWorkers) {
    const now = Date.now();
    if (completedSinceProgress < 20 && now - lastProgressAt < 60000) return;
    completedSinceProgress = 0;
    lastProgressAt = now;
    const stream = summaryFile ? process.stdout : process.stderr;
    stream.write(JSON.stringify({
      event: 'gmail_prospect_verification_progress',
      elapsedSeconds: Math.round((now - (deadlineAt - maxVerificationDurationMs)) / 1000),
      websitesChecked: summary.websitesChecked,
      websiteRequestCount: summary.websiteRequestCount,
      publicEmailFound: summary.publicEmailFound,
      strictEligibleCandidateCount: summary.eligible.length,
      unavailableCount: summary.unavailableCount,
      activeWorkers: currentActiveWorkers,
      queuedRemaining: Math.max(0, orderedPlaces.length - started.size),
      providerRequestCount: placesSummary.providerRequestCount
    }) + '\n');
  }

  await Promise.all(Array.from({ length: Math.max(1, websiteConcurrency) }, () => worker()));
  return summary;
}

async function inspectWebsite(place, controls = {}) {
  if (mock) {
    if (!controls.takeRequest || !controls.takeRequest()) {
      return { ok: false, reasonCode: 'website_request_budget_exhausted', deadlineExceeded: Date.now() >= Number(controls.deadlineAt || 0) };
    }
    return mockInspectWebsite(place);
  }
  const urls = candidateWebsiteUrls(place.websiteUri);
  for (const url of urls.slice(0, 4)) {
    if (!controls.takeRequest || !controls.takeRequest()) {
      return { ok: false, reasonCode: 'website_request_budget_exhausted', deadlineExceeded: Date.now() >= Number(controls.deadlineAt || 0) };
    }
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(requestTimeoutMs), headers: { 'user-agent': 'ICHI-Social-public-contact-verifier/1.0' } });
      if (!response.ok) continue;
      const text = (await response.text()).slice(0, 250000);
      if (salesProhibited(text)) return { ok: false, reasonCode: 'sales_prohibited' };
      const email = extractPublicEmail(text);
      if (email) return { ok: true, email, pageContainedEmail: true };
    } catch {
      // Try the next public page candidate.
    }
  }
  return { ok: false, reasonCode: 'email_missing' };
}

async function mockInspectWebsite(place) {
  if (mockDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, mockDelayMs));
  const id = String(place.id || '');
  if (id.includes('deadline')) return { ok: false, reasonCode: 'website_verification_deadline_exceeded', deadlineExceeded: true };
  if (id.includes('http-failure')) return { ok: false, reasonCode: 'http_failure' };
  if (id.includes('sales-ng')) return { ok: false, reasonCode: 'sales_prohibited' };
  if (id.includes('email-missing')) return { ok: false, reasonCode: 'email_missing' };
  const domain = new URL(place.websiteUri).hostname;
  const local = id.includes('nomx') ? 'nomx' : 'contact';
  return { ok: true, email: `${local}@${domain}`, pageContainedEmail: true };
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

function buildSeenSets(existingPool) {
  const seen = { email: new Set(), domain: new Set(), business: new Set(), place: new Set() };
  for (const candidate of existingPool) markSeen(candidate, seen);
  return seen;
}

function exclusionReason(candidate, seen, context) {
  const email = candidateEmail(candidate);
  const domain = sourceDomain(candidate);
  const business = hashValue(`${domain}|${candidateName(candidate)}`);
  if (context.suppression.recipientHashes.has(hashValue(email)) || context.suppression.domainHashes.has(hashValue(domain)) || context.suppression.businessFingerprints.has(business)) return 'suppression';
  if (isInHistory({ email, domain, business }, context.sheetHistory) || isInHistory({ email, domain, business }, context.localHistory)) return 'history';
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
