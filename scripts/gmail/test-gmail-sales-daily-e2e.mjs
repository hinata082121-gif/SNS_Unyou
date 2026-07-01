import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const runtimePath = 'scripts/gmail/test-apps-script-gmail-runtime.mjs';
const codePath = 'apps-script/gmail-sales-automation/Code.gs';
const runtimeSource = readFileSync(runtimePath, 'utf8');
const codeSource = readFileSync(codePath, 'utf8');

const requiredScenarioNames = [
  'daily E2E pipeline prepares, enables, sends thirty, audits, and safe rests',
  'prepareDailyPipeline prepares degraded nonzero source below thirty',
  'prepareDailyPipeline excludes unknown contact basis and prepares degraded nonzero batch',
  'prepareDailyPipeline blocks when approved eligible count is zero',
  'manifest candidateCount mismatch blocks send',
  'MailApp exception leaves DELIVERY_UNKNOWN and rerun does not resend',
  'existing DELIVERY_UNKNOWN blocks MailApp',
  'regular Sunday after restart is not operational and sends zero',
  'deployment readiness diagnostic is read-only',
  'deployment readiness separates configured max from stale manifest max',
  'production schema installer sets ready tab and appends missing contact basis columns',
  'production schema installer rolls back header mismatch before property write',
  'contact basis coverage reports operational candidates',
  'contact basis coverage classifies allowed and blocked basis types without auto approval'
];

for (const scenarioName of requiredScenarioNames) {
  assert.equal(runtimeSource.includes(scenarioName), true, `missing scenario: ${scenarioName}`);
}

const mailSendCallSiteCount = (codeSource.match(/MailApp\.sendEmail\s*\(/g) || []).length;
assert.equal(mailSendCallSiteCount, 1);

const output = execFileSync(process.execPath, [runtimePath], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
const marker = '{\n  "runtimeTestScenarioCount"';
const markerIndex = output.lastIndexOf(marker);
assert.notEqual(markerIndex, -1, 'runtime summary not found');
const summary = JSON.parse(output.slice(markerIndex));

assert.equal(summary.passed, true);
assert.equal(summary.realGmailSendExecuted, false);
assert.equal(summary.realGoogleSheetsUpdated, false);
assert.equal(summary.realScriptPropertiesUpdated, false);
assert.equal(summary.appsScriptExecuted, false);
assert.ok(summary.runtimeTestScenarioCount >= 182);

console.log(JSON.stringify({
  e2eTestPassed: true,
  runtimeTestScenarioCount: summary.runtimeTestScenarioCount,
  mailAppSendEmailCallSiteCount: mailSendCallSiteCount,
  actualGmailSend: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0
}, null, 2));
