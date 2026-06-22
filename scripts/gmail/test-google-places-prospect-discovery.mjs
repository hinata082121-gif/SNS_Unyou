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
assert.equal(workflowText.includes('--summary-file "$SUMMARY"'), true);
assert.equal(workflowText.includes('> "$SUMMARY"'), false);
assert.equal(workflowText.includes('set +e'), true);
assert.equal(workflowText.includes('DISCOVERY_EXIT=$?'), true);
assert.equal(workflowText.includes('discovery_summary_missing'), true);
assert.equal(workflowText.includes('validate-candidate-discovery-summary.mjs'), true);
assert.equal(workflowText.includes('npm run gmail:source:sync -- --date "$TARGET_DATE" --input "$OUTPUT" --write'), true);
assert.equal(workflowText.indexOf('validate-candidate-discovery-summary.mjs') < workflowText.indexOf('npm run gmail:source:sync -- --date "$TARGET_DATE" --input "$OUTPUT" --write'), true);
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

const shortSummaryFile = path.join(TMP, 'short-summary.json');
const shortWithSummary = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '20', '--max-provider-requests', '4', '--mock', '--dry-run', '--summary-file', shortSummaryFile]);
assert.equal(shortWithSummary.status, 1);
assert.equal(fs.existsSync(shortSummaryFile), true);
const shortFileSummary = JSON.parse(fs.readFileSync(shortSummaryFile, 'utf8'));
assert.equal(shortFileSummary.blockedReason, 'strict_eligible_count_below_required');
assert.equal(shortFileSummary.strictEligibleCandidateCount < 45, true);
assert.equal(shortWithSummary.stdout.trim().split(/\r?\n/).some((line) => JSON.parse(line).blockedReason === 'strict_eligible_count_below_required'), true);
assert.equal(fs.readdirSync(TMP).some((name) => name.includes('short-summary.json.') && name.endsWith('.tmp')), false);

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

const deadlineSummaryFile = path.join(TMP, 'deadline-summary.json');
const deadlineWithSummary = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--max-provider-requests', '30', '--max-verification-duration-ms', '1', '--website-concurrency', '4', '--mock-delay-ms', '20', '--mock', '--dry-run', '--summary-file', deadlineSummaryFile]);
assert.equal(deadlineWithSummary.status, 1);
assert.equal(JSON.parse(fs.readFileSync(deadlineSummaryFile, 'utf8')).blockedReason, 'website_verification_deadline_exceeded');

const api401SummaryFile = path.join(TMP, 'api-401-summary.json');
const api401 = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '90', '--mock-provider-error', 'google_places_http_401', '--dry-run', '--summary-file', api401SummaryFile]);
assert.equal(api401.status, 1);
assert.equal(fs.existsSync(api401SummaryFile), true);
const api401Summary = JSON.parse(fs.readFileSync(api401SummaryFile, 'utf8'));
assert.equal(api401Summary.status, 'failed');
assert.equal(api401Summary.errorCode, 'google_places_http_401');

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

const validatorOutput = path.join(TMP, 'validator-verified.json');
const validatorSummaryFile = path.join(TMP, 'validator-pass-summary.json');
const writeWithSummary = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--mock', '--write', '--output', validatorOutput, '--summary-file', validatorSummaryFile]);
assert.equal(writeWithSummary.status, 0);
assert.equal(JSON.parse(fs.readFileSync(validatorSummaryFile, 'utf8')).outputCreated, true);

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

const progressSummaryFile = path.join(TMP, 'progress-summary.json');
const progressWithSummaryFile = captureDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '45', '--max-provider-requests', '30', '--website-concurrency', '4', '--mock-delay-ms', '1', '--mock', '--dry-run', '--summary-file', progressSummaryFile]);
assert.equal(progressWithSummaryFile.status, 0);
assert.equal(progressWithSummaryFile.stdout.includes('gmail_prospect_verification_progress'), true);
const progressSummaryFromFile = JSON.parse(fs.readFileSync(progressSummaryFile, 'utf8'));
assert.equal(progressSummaryFromFile.status, 'pass');
assert.equal(progressSummaryFromFile.event, undefined);
assert.equal(progressSummaryFromFile.strictEligibleCandidateCount, 45);
assert.equal(/gmail_prospect_verification_progress/.test(fs.readFileSync(progressSummaryFile, 'utf8')), false);
assert.equal(/@[a-z0-9.-]+/i.test(progressWithSummaryFile.stdout), false);
assert.equal(progressWithSummaryFile.stdout.includes('https://'), false);

const validatorPass = captureValidator(['--summary', validatorSummaryFile, '--output', validatorOutput, '--min-strict-eligible', '45', '--max-provider-requests', '30', '--max-website-requests', '320']);
assert.equal(validatorPass.status, 0);
assert.equal(JSON.parse(validatorPass.stdout).status, 'pass');
const validatorBlocked = captureValidator(['--summary', shortSummaryFile, '--output', output, '--min-strict-eligible', '45', '--max-provider-requests', '30', '--max-website-requests', '320']);
assert.equal(validatorBlocked.status, 1);
assert.equal(JSON.parse(validatorBlocked.stdout).sourceSyncExecuted, false);
const validatorMissing = captureValidator(['--summary', path.join(TMP, 'missing-summary.json'), '--output', output]);
assert.equal(validatorMissing.status, 1);
assert.equal(JSON.parse(validatorMissing.stdout).blockedReason, 'discovery_summary_invalid_json');

assert.equal((workflowText.match(/npm run gmail:source:sync -- --date "\$TARGET_DATE" --input "\$OUTPUT" --write/g) || []).length, 1);
assert.equal(workflowText.includes('gmail:outbox:sync-recovery-single'), false);
assert.equal(workflowText.includes('MailApp.sendEmail'), false);
assert.equal(workflowText.includes('GMAIL_SHEET_SYNC_DRY_RUN=false'), false);

console.log(JSON.stringify({
  googlePlacesDiscoveryTestCount: 78,
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

function captureValidator(args) {
  return spawnSync(process.execPath, ['scripts/gmail/validate-candidate-discovery-summary.mjs', ...args], {
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
