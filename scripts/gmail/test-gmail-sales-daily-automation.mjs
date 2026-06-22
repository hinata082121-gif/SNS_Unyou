#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const outputDir = path.join('tmp', 'gmail-daily-automation-test');
fs.rmSync(outputDir, { recursive: true, force: true });

const simulate = JSON.parse(execFileSync(process.execPath, [
  'scripts/gmail/run-gmail-sales-daily-automation.mjs',
  '--phase', 'simulate',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'true',
  '--output-dir', outputDir
], {
  cwd: ROOT,
  env: Object.assign({}, process.env, {
    GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
    GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
    GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
  }),
  encoding: 'utf8'
}));

assert.equal(simulate.ok, true);
assert.equal(simulate.mode, 'normal_daily');
assert.equal(simulate.expectedCount, 30);
assert.equal(simulate.requestedSourceCount, 90);
assert.equal(simulate.sourceCount, 90);
assert.equal(simulate.eligibleCandidateCount >= 30, true);
assert.equal(simulate.strictAutoApprovalPassed, true);
assert.equal(simulate.manifestCreated, true);
assert.equal(simulate.payloadCreated, true);
assert.equal(simulate.webhookCalled, false);
assert.equal(simulate.networkRequestCount, 0);
assert.equal(simulate.gmailSendExecuted, false);
assert.equal(simulate.googleSheetsUpdatedByNode, false);
assert.equal(simulate.scriptPropertiesUpdatedByNode, false);

const payloadPath = path.join(outputDir, 'prepare-normal-daily-payload-private.json');
assert.equal(fs.existsSync(payloadPath), true);
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
assert.equal(payload.action, 'prepare_normal_daily');
assert.equal(payload.mode, 'normal_daily');
assert.equal(payload.automationVersion, 'normal-daily-v1');
assert.equal(payload.autoApprovalPolicyVersion, 'automatic-strict-gate-v1');
assert.equal(payload.manifest.approvalType, 'automatic_strict_gate');
assert.equal(payload.manifest.targetAutoApproved, true);
assert.equal(payload.manifest.humanReviewCompleted, false);
assert.equal(payload.manifest.humanReviewedCount, 0);
assert.equal(payload.manifest.recoverySingle, undefined);
assert.equal(payload.rows.length, 30);
assert.equal(payload.headers.length, 26);
assert.match(payload.signature, /^[a-f0-9]{64}$/);
assert.match(payload.bodyDigest, /^[a-f0-9]{64}$/);

const prepareMock = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--source-mode', 'synthetic',
  '--output-dir', path.join(outputDir, 'prepare-mock')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://pass',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
});
assert.equal(prepareMock.ok, true);
assert.equal(prepareMock.sourceResolved, true);
assert.equal(prepareMock.sourceCount, 90);
assert.equal(prepareMock.eligibleCandidateCount >= 30, true);
assert.equal(prepareMock.candidateCount, 30);
assert.equal(prepareMock.strictAutoApprovalPassed, true);
assert.equal(prepareMock.webhookCalled, true);
assert.equal(prepareMock.appsScriptPrepareAccepted, true);
assert.equal(prepareMock.networkRequestCount, 0);

const unavailable = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'false',
  '--output-dir', path.join(outputDir, 'source-unavailable')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(unavailable.ok, false);
assert.equal(unavailable.blockedReason, 'source_input_unavailable');
assert.equal(unavailable.webhookCalled, false);
assert.equal(unavailable.networkRequestCount, 0);

const candidateShort = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'source-29')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://source-29',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(candidateShort.ok, false);
assert.equal(candidateShort.blockedReason, 'source_available_count_insufficient');
assert.equal(candidateShort.webhookCalled, false);
assert.equal(candidateShort.networkRequestCount, 0);

const sourceThirtyEligibleTwentyThree = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'source-30-eligible-23')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://source-30-eligible-23',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(sourceThirtyEligibleTwentyThree.ok, false);
assert.equal(sourceThirtyEligibleTwentyThree.sourceCount, 30);
assert.equal(sourceThirtyEligibleTwentyThree.eligibleCandidateCount, 23);
assert.equal(sourceThirtyEligibleTwentyThree.blockedReason, 'eligible_candidate_count_insufficient');

const eligibleShort = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'eligible-29')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://eligible-29',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(eligibleShort.ok, false);
assert.equal(eligibleShort.blockedReason, 'eligible_candidate_count_insufficient');
assert.equal(eligibleShort.sourceCount, 90);
assert.equal(eligibleShort.eligibleCandidateCount, 29);
assert.equal(eligibleShort.webhookCalled, false);
assert.equal(eligibleShort.networkRequestCount, 0);

const eligibleFortyFive = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'eligible-45')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://eligible-45',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
});
assert.equal(eligibleFortyFive.ok, true);
assert.equal(eligibleFortyFive.sourceCount, 90);
assert.equal(eligibleFortyFive.eligibleCandidateCount, 45);
assert.equal(eligibleFortyFive.selectedCandidateCount, 30);
assert.equal(eligibleFortyFive.excludedCount, 45);

const pagedSource = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--requested-source-count', '150',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'source-paged')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://source-paged',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
});
assert.equal(pagedSource.ok, true);
assert.equal(pagedSource.requestedSourceCount, 150);
assert.equal(pagedSource.sourceCount, 150);
assert.equal(pagedSource.selectedCandidateCount, 30);
assert.equal(pagedSource.networkRequestCount, 0);

const duplicate = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--output-dir', path.join(outputDir, 'source-duplicate')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://source-duplicate',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(duplicate.ok, false);
assert.equal(duplicate.blockedReason, 'eligible_candidate_count_insufficient');
assert.equal(duplicate.eligibleCandidateCount, 29);
assert.equal(duplicate.webhookCalled, false);
assert.equal(duplicate.networkRequestCount, 0);

const webhookRejected = runDailyAutomation([
  '--phase', 'prepare',
  '--target-date', '2026-06-22',
  '--expected-count', '30',
  '--dry-run', 'false',
  '--allow-network', 'true',
  '--source-mode', 'synthetic',
  '--output-dir', path.join(outputDir, 'webhook-reject')
], {
  GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
  GMAIL_APPS_SCRIPT_WEBHOOK_URL: 'mock://reject',
  GMAIL_SALES_AUTOMATION_VERSION: 'normal-daily-v1',
  GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
}, { expectFailure: true });
assert.equal(webhookRejected.ok, false);
assert.equal(webhookRejected.webhookCalled, true);
assert.equal(webhookRejected.appsScriptPrepareAccepted, false);
assert.equal(webhookRejected.networkRequestCount, 0);

let unsetRejected = false;
try {
  execFileSync(process.execPath, [
    'scripts/gmail/run-gmail-sales-daily-automation.mjs',
    '--phase', 'simulate',
    '--target-date', '2026-06-22',
    '--expected-count', '30',
    '--dry-run', 'true',
    '--output-dir', path.join(outputDir, 'unset')
  ], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      GMAIL_AUTOMATION_SHARED_SECRET: 'synthetic-secret',
      GMAIL_SALES_AUTOMATION_VERSION: 'unset',
      GMAIL_SALES_AUTO_APPROVAL_POLICY_VERSION: 'automatic-strict-gate-v1'
    }),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
} catch (error) {
  unsetRejected = String(error.stdout || '').includes('version_not_configured');
}
assert.equal(unsetRejected, true);

const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'gmail-sales-automation', 'Code.gs'), 'utf8');
assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal(/GmailApp\.createDraft\s*\(/.test(code), false);
assert.equal(code.includes('handleGmailSalesNormalDailyPrepareWebhook_'), true);
assert.equal(code.includes('runGmailSalesDailyAutomationTrigger'), true);
assert.equal(code.includes('runGmailSalesDailyAutomationHealthCheck'), true);
assert.equal(code.includes('getGmailSalesDailyTriggerSchedule_'), true);
assert.equal(code.includes('GMAIL_DAILY_TRIGGER_MIN_SAFE_MARGIN_MINUTES'), true);
assert.equal(code.includes('.atHour(triggerSchedule.hour)'), true);
assert.equal(code.includes('.nearMinute(triggerSchedule.minute)'), true);
assert.equal(code.includes(".inTimezone(triggerSchedule.timezone)"), true);
assert.equal(code.includes("timezoneConfigured: triggerSchedule.timezone === GMAIL_SALES_TIMEZONE_DEFAULT"), true);
assert.equal(code.includes('GMAIL_DAILY_AUTOMATION_STATE_JSON'), true);
assert.equal(code.includes('automatic_strict_gate'), true);

const workflowPath = path.join(ROOT, '.github', 'workflows', 'gmail-sales-daily-prepare.yml');
assert.equal(fs.existsSync(workflowPath), true);
const workflow = fs.readFileSync(workflowPath, 'utf8');
assert.equal(workflow.includes('workflow_dispatch:'), true);
assert.equal(workflow.includes('schedule:'), true);
assert.equal(workflow.includes('GMAIL_APPS_SCRIPT_WEBHOOK_URL'), true);
assert.equal(workflow.includes('GMAIL_AUTOMATION_SHARED_SECRET'), true);
assert.equal(workflow.includes('npm run gmail:sales:send-safety:test'), true);
assert.equal(workflow.includes('run-gmail-sales-daily-automation.mjs'), true);

console.log(JSON.stringify({
  dailyAutomationTestScenarioCount: 22,
  passed: true,
  workflowPresent: true,
  strictAutoApprovalPassed: true,
  networkRequestCount: 0,
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  scriptPropertiesUpdated: false,
  triggerCreated: false
}, null, 2));

function runDailyAutomation(extraArgs, extraEnv = {}, options = {}) {
  try {
    return JSON.parse(execFileSync(process.execPath, [
      'scripts/gmail/run-gmail-sales-daily-automation.mjs',
      ...extraArgs
    ], {
      cwd: ROOT,
      env: Object.assign({}, process.env, extraEnv),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }));
  } catch (error) {
    if (!options.expectFailure) throw error;
    return JSON.parse(String(error.stdout || '{}'));
  }
}
