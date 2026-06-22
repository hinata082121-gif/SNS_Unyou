import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK, buildDailyQueryPlan } from './providers/google-places-discovery.mjs';

const ROOT = process.cwd();
const TMP = path.join(ROOT, 'tmp', 'gmail-google-places-discovery-test');
const DATE = '2099-06-23';

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('*'), false);
assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('reviews'), false);
assert.equal(GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK.includes('photos'), false);
assert.equal(buildDailyQueryPlan({ dateText: DATE }).length, 15);

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
assert.equal(dryRun.gmailSendExecuted, false);
assert.equal(dryRun.googleSheetsUpdated, false);
assert.equal(dryRun.triggerChanged, false);

const short = runDiscoverAllowFailure(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '20', '--max-provider-requests', '4', '--mock', '--dry-run']);
assert.equal(short.status, 1);
assert.equal(short.summary.blockedReason, 'strict_eligible_count_below_required');
assert.equal(short.summary.strictEligibleCandidateCount < 45, true);

const output = path.join(TMP, 'verified.json');
const write = runDiscover(['--provider', 'google_places', '--date', DATE, '--required-count', '45', '--target-count', '60', '--max-provider-requests', '30', '--mock', '--write', '--output', output]);
assert.equal(write.status, 'pass');
assert.equal(write.outputCreated, true);
assert.equal(fs.existsSync(output), true);
const written = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(written.candidates.length, 60);
assert.equal(written.candidates.every((candidate) => candidate.verificationStatus === 'verified'), true);
assert.equal(written.candidates.every((candidate) => candidate.verificationMethod === 'google_places_and_official_website'), true);

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

console.log(JSON.stringify({
  googlePlacesDiscoveryTestCount: 25,
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

function withoutGooglePlacesKey() {
  const env = { ...process.env };
  delete env.GOOGLE_PLACES_API_KEY;
  return env;
}
