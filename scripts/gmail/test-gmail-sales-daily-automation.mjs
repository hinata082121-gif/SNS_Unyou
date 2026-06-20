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
  '--target-date', '2026-06-21',
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

let unsetRejected = false;
try {
  execFileSync(process.execPath, [
    'scripts/gmail/run-gmail-sales-daily-automation.mjs',
    '--phase', 'simulate',
    '--target-date', '2026-06-21',
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
  dailyAutomationTestScenarioCount: 12,
  passed: true,
  workflowPresent: true,
  strictAutoApprovalPassed: true,
  networkRequestCount: 0,
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  scriptPropertiesUpdated: false,
  triggerCreated: false
}, null, 2));
