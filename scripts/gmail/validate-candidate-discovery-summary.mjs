import fs from 'node:fs';
import { parseArgs } from './pool-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const summaryFile = String(args.summary || '').trim();
const outputFile = String(args.output || '').trim();
const minStrictEligible = Number(args['min-strict-eligible'] || 45);
const maxProviderRequests = Number(args['max-provider-requests'] || 30);
const maxWebsiteRequests = Number(args['max-website-requests'] || 320);

if (!summaryFile) {
  printSafe({ status: 'failed', blockedReason: 'discovery_summary_missing', sourceSyncExecuted: false });
  process.exit(1);
}

let summary = null;
try {
  summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
} catch {
  printSafe({ status: 'failed', blockedReason: 'discovery_summary_invalid_json', sourceSyncExecuted: false });
  process.exit(1);
}

const forbidden = findForbiddenKeys(summary);
const safe = sanitize(summary);
safe.sourceSyncExecuted = false;

let valid = true;
if (forbidden.length > 0) {
  valid = false;
  safe.status = 'failed';
  safe.blockedReason = 'discovery_summary_contains_candidate_data';
  safe.errorCode = 'discovery_summary_contains_candidate_data';
}
if (!['pass', 'blocked', 'failed'].includes(safe.status)) valid = false;
if (safe.status !== 'pass') valid = false;
if (safe.strictEligibleCandidateCount < minStrictEligible) valid = false;
if (safe.providerRequestCount > maxProviderRequests) valid = false;
if (safe.websiteRequestCount > maxWebsiteRequests) valid = false;
if (safe.outputCreated !== true) valid = false;
if (!outputFile || !fs.existsSync(outputFile)) valid = false;

printSafe(safe);
process.exit(valid ? 0 : 1);

function sanitize(value) {
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
  for (const field of stringFields) safe[field] = String(value && value[field] || '');
  for (const field of numberFields) safe[field] = Number(value && value[field] || 0);
  for (const field of booleanFields) safe[field] = Boolean(value && value[field]);
  return safe;
}

function findForbiddenKeys(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  const forbiddenKeys = new Set([
    'candidates',
    'prospects',
    'items',
    'email',
    'contactEmail',
    'name',
    'displayName',
    'formattedAddress',
    'websiteUri',
    'sourceUrl',
    'publicSource',
    'placeId',
    'subject',
    'body',
    'apiKey',
    'secret',
    'hash',
    'digest',
    'dedupeKey'
  ]);
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (forbiddenKeys.has(key)) found.push(childPath);
    if (child && typeof child === 'object') found.push(...findForbiddenKeys(child, childPath));
  }
  return found;
}

function printSafe(value) {
  console.log(JSON.stringify(value));
}
