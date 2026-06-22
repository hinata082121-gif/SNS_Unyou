import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK, buildDailyQueryPlan } from './providers/google-places-discovery.mjs';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-google-places-discovery-test');
const DATE = '2099-06-23';
const workflowText = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'gmail-sales-candidate-refresh.yml'), 'utf8');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('*'), false);
assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('reviews'), false);
assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('photos'), false);
assert.equal(buildDailyQueryPlan({ dateText: DATE }).length, 15);
assert.equal((workflowText.match(/gmail:prospects:discover --/g) || []).length, 1);
assert.equal(workflowText.includes('--dry-run'), false);
assert.equal(workflowText.includes('--write --output "$OUTPUT"'), true);
assert.equal(workflowText.includes('--max-website-requests 320'), true);
assert.equal(workflowText.includes('--website-concurrency 4'), true);
assert.equal(workflowText.includes('--max-verification-duration-ms 1500000'), true);
assert.equal(workflowText.includes('providerRequestCount'), true);
assert.equal(workflowText.includes('websiteRequestCount'), true);
assert.equal(workflowText.includes('strictEligibleCandidateCount'), true);
assert.equal(workflowText.includes('fs.existsSync(process.argv[2])'), true);
assert.equal(workflowText.includes('summary.outputCreated !== true'), true);
assert.equal(workflowText.includes('Number(summary.websiteRequestCount || 0) > 320'), true);
assert.equal(workflowText.includes('npm run gmail:source:sync -- --date "$TARGET_DATE" --input "$OUTPUT" --write'), true);
assert.equal(workflowText.indexOf('node -e') < workflowText.indexOf('npm run gmail:source:sync -- --date "$TARGET_DATE" --input "$OUTPUT" --write'), true);
assert.equal(workflowText.includes("trap 'rm -rf"), true);

const unconfigured = runDiscoverAllowFailure(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--dry-run']);
assert.equal(unconfigured.status, 1);
assert.equal(unconfigured.summary.blockedReason, 'candidate_discovery_provider_unconfigured');
assert.equal(unconfigured.summary.providerRequestCount, 0);
assert.equal(unconfigured.summary.sourceSyncCandidateCount, 0);

const dryRun = runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--max-provider-requests', '30', '--mock', '--dry-run']);
assert.equal(dryRun.status, 'pass');
assert.equal(dryRun.apiKeyConfigured, false);
assert.equal(dryRun.queryCount, 15);
assert.equal(dryRun.providerRequestCount <= 30, true);
assert.equal(dryRun.rawPlaceCount > 0, true);
assert.equal(dryRun.uniquePlaceCount > 0, true);
assert.equal(dryRun.strictEligibleCandidateCount, 90);
assert.equal(dryRun.sourceSyncCandidateCount, 90);
assert.equal(dryRun.websiteConcurrency, 4);
assert.equal(dryRun.maxWebsiteRequests, 320);
assert.equal(dryRun.maxVerificationDurationMs, 1500000);
assert.equal(dryRun.requestTimeoutMs, 8000);
assert.equal(dryRun.websiteRequestCount <= 320, true);
assert.equal(dryRun.maxObservedWebsiteConcurrency <= 4, true);
assert.equal(dryRun.maxObservedWebsiteConcurrency > 1, true);
assert.equal(dryRun.maxObservedSameDomainConcurrency, 1);
assert.equal(dryRun.gmailSendExecuted, false);
assert.equal(dryRun.googleSheetsUpdated, false);
assert.equal(dryRun.triggerChanged, false);

const short = runDiscoverAllowFailure(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '20', '--max-provider-requests', '4', '--mock', '--dry-run']);
assert.equal(short.status, 1);
assert.equal(short.summary.blockedReason, 'strict_eligible_count_below_required');
assert.equal(short.summary.strictEligibleCandidateCount < 45, true);

const requestBudget = runDiscoverAllowFailure(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--max-provider-requests', '30', '--max-website-requests', '12', '--mock', '--dry-run']);
assert.equal(requestBudget.status, 1);
assert.equal(requestBudget.summary.websiteRequestCount <= 12, true);
assert.equal(requestBudget.summary.strictEligibleCandidateCount < 45, true);
assert.equal(requestBudget.summary.blockedReason, 'strict_eligible_count_below_required');

const deadline = runDiscoverAllowFailure(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--max-provider-requests', '30', '--max-verification-duration-ms', '1', '--website-concurrency', '4', '--mock-delay-ms', '20', '--mock', '--dry-run']);
assert.equal(deadline.status, 1);
assert.equal(deadline.summary.blockedReason, 'website_verification_deadline_exceeded');
assert.equal(deadline.summary.deadlineExceeded, true);
assert.equal(deadline.summary.websiteRequestCount <= 4, true);

const earlyStop = runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--website-concurrency', '4', '--mock-delay-ms', '1', '--mock', '--dry-run']);
assert.equal(earlyStop.status, 'pass');
assert.equal(earlyStop.strictEligibleCandidateCount, 45);
assert.equal(earlyStop.sourceSyncCandidateCount, 45);
assert.equal(earlyStop.websiteRequestCount < earlyStop.uniquePlaceCount, true);
assert.equal(earlyStop.websiteRequestCount <= 48, true);

const output = path.join(TMP, 'verified.json');
const write = runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '60', '--max-provider-requests', '30', '--mock', '--write', '--output', output]);
assert.equal(write.status, 'pass');
assert.equal(write.outputCreated, true);
assert.equal(fs.existsSync(output), true);
const written = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(written.candidates.length, 60);
assert.equal(written.candidates.every((candidate) => candidate.verificationStatus === 'verified'), true);
assert.equal(written.candidates.every((candidate) => candidate.verificationMethod === 'google_places_and_official_website'), true);

const outputA = path.join(TMP, 'deterministic-a.json');
const outputB = path.join(TMP, 'deterministic-b.json');
runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--website-concurrency', '4', '--mock-delay-ms', '1', '--mock', '--write', '--output', outputA]);
runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--website-concurrency', '4', '--mock-delay-ms', '1', '--mock', '--write', '--output', outputB]);
const deterministicA = JSON.parse(fs.readFileSync(outputA, 'utf8')).candidates.map((candidate) => candidate.prospectId);
const deterministicB = JSON.parse(fs.readFileSync(outputB, 'utf8')).candidates.map((candidate) => candidate.prospectId);
assert.deepEqual(deterministicA, deterministicB);

const raw = execFileSync(process.execPath, [
  'scripts/gmail/discover-fresh-gmail-prospects.mjs',
  '--provider', 'google_places',
  '--date', DATE,
  '--required-count', '45',
  '--target-count', '45',
  '--max-provider-requests', '30',
  '--mock',
  '--dry-run'
], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
assert.equal(/@[a-z0-9.-]+/i.test(raw), false);
assert.equal(raw.includes('https://'), false);
assert.equal(raw.includes('Mock '), false);
assert.equal(raw.includes('mock address'), false);

const progress = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--website-concurrency', '4', '--mock-delay-ms', '1', '--mock', '--dry-run']);
assert.equal(progress.status, 0);
assert.equal(progress.stderr.includes('gmail_prospect_verification_progress'), true);
assert.equal(/@[a-z0-9.-]+/i.test(progress.stderr), false);
assert.equal(progress.stderr.includes('https://'), false);
assert.equal(progress.stderr.includes('Mock '), false);
assert.equal(progress.stderr.includes('mock address'), false);
const progressSummary = JSON.parse(progress.stdout);
assert.equal(progressSummary.status, 'pass');
assert.equal(progressSummary.gmailSendExecuted, false);
assert.equal(progressSummary.googleSheetsUpdated, false);

assert.equal((workflowText.match(/npm run gmail:source:sync -- --date "\$TARGET_DATE" --input "\$OUTPUT" --write/g) || []).length, 1);
assert.equal(workflowText.includes('gmail:outbox:sync-recovery-single'), false);
assert.equal(workflowText.includes('MailApp.sendEmail'), false);
assert.equal(workflowText.includes('GMAIL_SHEET_SYNC_DRY_RUN=false'), false);

console.log(JSON.stringify({
  googlePlacesDiscoveryTestCount: 55,
  passed: true,
  realNetworkRequestCount: 0,
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  recoveryChanged: false,
  personalDataLogged: false
}, null, 2));

function runDiscover(args) {
  const output = execFileSync(process.execPath, ['scripts/gmail/discover-fresh-gmail-prospects.mjs', ...args], {
    cwd: ROOT,
    env: withoutGooglePlacesKey(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function runDiscoverAllowFailure(args) {
  try {
    return { status: 0, summary: runDiscover(args) };
  } catch (error) {
    return { status: error.status, summary: JSON.parse(error.stdout) };
  }
}

function captureDiscover(args) {
  return spawnSync(process.execPath, ['scripts/gmail/discover-fresh-gmail-prospects.mjs', ...args], {
    cwd: ROOT,
    env: withoutGooglePlacesKey(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function withoutGooglePlacesKey() {
  const env = { ...process.env };
  delete env.GOOGLE_PLACES_API_KEY;
  return env;
}
