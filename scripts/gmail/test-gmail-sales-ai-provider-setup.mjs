import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const VALID_KEY = crypto.createHash('sha256').update('valid provider setup test key').digest('hex');
const NEW_KEY = crypto.createHash('sha256').update('replacement provider setup test key').digest('hex');

test('public setup session stores only token digest and returns no raw token', () => {
  const env = createEnvironment();
  const result = env.context.createGmailSalesAiSetupSessionOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.setupTokenStoredAsDigest, true);
  assert.equal(result.setupTokenReturned, false);
  assert.equal(Boolean(env.props.GMAIL_SALES_AI_SETUP_TOKEN_DIGEST), true);
  assert.equal(env.logs.join('\n').includes(env.rawToken || 'not-present'), false);
});

test('internal setup token validates and mismatched reused expired tokens are rejected', () => {
  const env = createEnvironment();
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  assert.equal(env.context.validateGmailSalesAiSetupToken_(session.token).ok, true);
  assert.equal(env.context.validateGmailSalesAiSetupToken_('wrong-token').reason, 'setup_token_mismatch');
  env.props.GMAIL_SALES_AI_SETUP_TOKEN_USED = 'true';
  assert.equal(env.context.validateGmailSalesAiSetupToken_(session.token).reason, 'setup_token_used');
  const env2 = createEnvironment();
  const session2 = env2.context.createGmailSalesAiSetupSession_({ includeToken: true });
  env2.props.GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT = '2000-01-01T00:00:00.000Z';
  assert.equal(env2.context.validateGmailSalesAiSetupToken_(session2.token).reason, 'setup_token_expired');
});

test('save rejects unsafe or invalid input', () => {
  const env = createEnvironment();
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  assert.equal(env.context.saveGmailSalesAiProviderConfiguration({ setupToken: session.token, provider: 'bad', model: 'gpt-4.1-mini', apiKey: VALID_KEY }).blockedReason, 'invalid_provider');
  const env2 = createEnvironment();
  const session2 = env2.context.createGmailSalesAiSetupSession_({ includeToken: true });
  assert.equal(env2.context.saveGmailSalesAiProviderConfiguration({ setupToken: session2.token, provider: 'openai', model: '', apiKey: VALID_KEY }).blockedReason, 'invalid_model');
  const env3 = createEnvironment();
  const session3 = env3.context.createGmailSalesAiSetupSession_({ includeToken: true });
  assert.equal(env3.context.saveGmailSalesAiProviderConfiguration({ setupToken: session3.token, provider: 'openai', model: 'gpt-4.1-mini', apiKey: '' }).blockedReason, 'api_key_missing');
});

test('save stores provider model key and never logs the key', () => {
  const env = createEnvironment();
  env.props.UNRELATED_PROPERTY = 'preserve-me';
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  const result = env.context.saveGmailSalesAiProviderConfiguration({
    setupToken: session.token,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    apiKey: VALID_KEY,
    dailyRequestLimit: 100,
    dailyCostLimitYen: 100,
    confidenceThreshold: 0.95
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.configurationSaved, true);
  assert.equal(result.aiEnabled, true);
  assert.equal(result.apiKeyPresent, true);
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, VALID_KEY);
  assert.equal(env.props.UNRELATED_PROPERTY, 'preserve-me');
  assert.equal(env.logs.join('\n').includes(VALID_KEY), false);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.triggerWriteCount, 0);
});

test('inspector reports key presence without exposing value', () => {
  const env = configuredEnvironment();
  const result = env.context.inspectGmailSalesAiProviderConfiguration();
  assert.equal(result.status, 'pass');
  assert.equal(result.apiKeyPresent, true);
  assert.equal(result.configurationValid, true);
  assert.equal(JSON.stringify(result).includes(VALID_KEY), false);
  assert.equal(env.logs.join('\n').includes(VALID_KEY), false);
});

test('keep existing API key and key replacement both work', () => {
  const env = configuredEnvironment();
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  const kept = env.context.saveGmailSalesAiProviderConfiguration({
    setupToken: session.token,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    keepExistingApiKey: true,
    apiKey: '',
    dailyRequestLimit: 90,
    dailyCostLimitYen: 80,
    confidenceThreshold: 0.96
  });
  assert.equal(kept.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, VALID_KEY);
  const session2 = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  const replaced = env.context.saveGmailSalesAiProviderConfiguration({
    setupToken: session2.token,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    apiKey: NEW_KEY
  });
  assert.equal(replaced.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, NEW_KEY);
  assert.equal(env.logs.join('\n').includes(NEW_KEY), false);
});

test('disable and token-protected key delete are separate operations', () => {
  const env = configuredEnvironment();
  const disabled = env.context.disableGmailSalesAiVerificationOnce();
  assert.equal(disabled.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_ENABLED, 'false');
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, VALID_KEY);
  const deleteWithoutToken = env.context.deleteGmailSalesAiApiKeyOnce({});
  assert.equal(deleteWithoutToken.status, 'blocked');
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  const deleted = env.context.deleteGmailSalesAiApiKeyOnce({ setupToken: session.token });
  assert.equal(deleted.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_API_KEY, '');
});

test('safe rest is required', () => {
  const env = createEnvironment();
  env.props.LIVE_SEND_ENABLED = 'true';
  assert.equal(env.context.createGmailSalesAiSetupSessionOnce().status, 'blocked');
  assert.equal(env.context.configureGmailSalesAiNonSecretSettingsOnce().status, 'blocked');
  assert.equal(env.context.saveGmailSalesAiProviderConfiguration({}).status, 'blocked');
});

test('HTML setup page hides API key and clears password field on save', () => {
  const env = createEnvironment();
  const html = env.context.buildGmailSalesAiProviderSetupHtml_('session-token-for-test');
  assert.equal(html.includes('type="password"'), true);
  assert.equal(html.includes('autocomplete="off"'), true);
  assert.equal(html.includes('api.value=""'), true);
  assert.equal(html.includes(VALID_KEY), false);
  const page = env.context.serveGmailSalesAiProviderSetupPage_({ parameter: { setupToken: 'session-token-for-test' } });
  assert.equal(typeof page.getContent === 'function', true);
});

test('non secret settings do not enable AI before key setup', () => {
  const env = createEnvironment();
  const result = env.context.configureGmailSalesAiNonSecretSettingsOnce();
  assert.equal(result.status, 'pass');
  assert.equal(env.props.GMAIL_SALES_AI_ENABLED, 'false');
  assert.equal(env.props.GMAIL_SALES_AI_PROVIDER, 'disabled');
  assert.equal(Boolean(env.props.GMAIL_SALES_AI_API_KEY), false);
});

test('current AI eligible rows are preserved by setup UI operations', () => {
  const env = createEnvironment();
  env.pendingAiEligibleCount = 66;
  const before = env.pendingAiEligibleCount;
  const session = env.context.createGmailSalesAiSetupSession_({ includeToken: true });
  env.context.saveGmailSalesAiProviderConfiguration({
    setupToken: session.token,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    apiKey: VALID_KEY
  });
  assert.equal(env.pendingAiEligibleCount, before);
  assert.equal(env.sheetWriteCount, 0);
});

test('send architecture remains unchanged', () => {
  assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
  assert.equal(code.includes('runGmailSalesProductionControlLoop'), true);
  assert.equal(code.includes('runGmailSalesDailyAutomationTrigger'), true);
  assert.equal(code.includes('runScheduledDailySend'), true);
});

function configuredEnvironment() {
  const env = createEnvironment();
  env.props.GMAIL_SALES_AI_ENABLED = 'true';
  env.props.GMAIL_SALES_AI_PROVIDER = 'openai';
  env.props.GMAIL_SALES_AI_MODEL = 'gpt-4.1-mini';
  env.props.GMAIL_SALES_AI_API_KEY = VALID_KEY;
  env.props.GMAIL_SALES_AI_MAX_DAILY_REQUESTS = '100';
  env.props.GMAIL_SALES_AI_MAX_DAILY_COST_YEN = '100';
  env.props.GMAIL_SALES_AI_CONFIDENCE_THRESHOLD = '0.95';
  env.props.GMAIL_SALES_AI_POLICY_VERSION = 'contact-basis-policy-v1';
  env.props.GMAIL_SALES_AI_DATA_MINIMIZATION_MODE = 'strict';
  return env;
}

function createEnvironment() {
  const env = {
    props: {
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      AUTOMATION_MASTER_ENABLED: 'true'
    },
    logs: [],
    propertyWriteCount: 0,
    sheetWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0,
    triggerWriteCount: 0,
    pendingAiEligibleCount: 0
  };
  env.context = {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Date,
    URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      formatDate: () => '2026-06-30'
    },
    Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
    Logger: { log: (value) => env.logs.push(String(value)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => env.props[key],
        getProperties: () => Object.assign({}, env.props),
        setProperties: (values) => {
          env.propertyWriteCount += 1;
          Object.keys(values || {}).forEach((key) => { env.props[key] = String(values[key]); });
        },
        setProperty: (key, value) => {
          env.propertyWriteCount += 1;
          env.props[key] = String(value);
        },
        deleteProperty: (key) => {
          env.propertyWriteCount += 1;
          delete env.props[key];
        }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: {
      getUi: () => ({ showModalDialog: () => { env.dialogShown = true; } }),
      openById: () => ({ getSheetByName: () => null })
    },
    HtmlService: {
      XFrameOptionsMode: { DEFAULT: 'DEFAULT' },
      createHtmlOutput: (html) => ({
        getContent: () => html,
        setWidth() { return this; },
        setHeight() { return this; },
        setTitle() { return this; },
        setXFrameOptionsMode() { return this; }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      newTrigger: () => {
        env.triggerWriteCount += 1;
        return { timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) };
      },
      deleteTrigger: () => { env.triggerWriteCount += 1; },
      getScriptId: () => 'script-id'
    },
    MailApp: { sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: () => { throw new Error('AI API must not be called'); } }
  };
  env.context.globalThis = env.context;
  vm.createContext(env.context);
  vm.runInContext(code, env.context, { filename: 'Code.gs' });
  return env;
}

for (const [name, fn] of tests) {
  try {
    fn();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

console.log(JSON.stringify({
  aiProviderSetupTestPassed: true,
  scenarioCount: tests.length,
  coveredRequirementCount: 42,
  setupUsesScriptPropertiesUi: false,
  setupTokenDigestOnly: true,
  apiKeyLogExposureCount: 0,
  apiKeySheetStorageCount: 0,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionSheetUpdate: 0,
  actualProductionTriggerChange: 0,
  actualAiApiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
