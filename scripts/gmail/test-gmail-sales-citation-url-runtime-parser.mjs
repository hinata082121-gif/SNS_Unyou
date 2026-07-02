import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function createContext({ exposeUrl = true } = {}) {
  const env = {
    logs: [],
    propertyWriteCount: 0,
    sheetWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0,
    fetchCount: 0,
    props: {}
  };
  const context = {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, Date,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      formatDate: () => '2026-07-01',
      getUuid: () => 'uuid'
    },
    Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
    Logger: { log: (value) => env.logs.push(String(value)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => env.props[key],
        getProperties: () => Object.assign({}, env.props),
        setProperty: (key, value) => {
          env.propertyWriteCount += 1;
          env.props[key] = String(value);
        },
        setProperties: (values) => {
          env.propertyWriteCount += 1;
          Object.assign(env.props, values);
        },
        deleteProperty: (key) => {
          env.propertyWriteCount += 1;
          delete env.props[key];
        }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: { openById: () => null, flush: () => { env.sheetWriteCount += 1; } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { env.triggerWriteCount += 1; } }) }) }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: {
      fetch: () => {
        env.fetchCount += 1;
        return {
          getResponseCode: () => 200,
          getHeaders: () => ({}),
          getContentText: () => JSON.stringify({
            steps: [{
              type: 'google_search_call',
              arguments: { queries: ['redacted'] }
            }, {
              type: 'model_output',
              content: [{
                type: 'text',
                text: 'Official source text.',
                annotations: [{
                  type: 'url_citation',
                  url: 'https://example.com/%zz',
                  start_index: 0,
                  end_index: 8
                }]
              }]
            }]
          })
        };
      }
    }
  };
  if (exposeUrl) {
    context.URL = URL;
    context.URLSearchParams = URLSearchParams;
  }
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return { context, env };
}

function assertReadOnly(env) {
  assert.equal(env.fetchCount, 0);
  assert.equal(env.propertyWriteCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

for (const exposeUrl of [true, false]) {
  const { context, env } = createContext({ exposeUrl });
  const probe = context.testGmailSalesCitationUrlParserRuntimeCompatibilityOnce();
  assert.equal(probe.status, 'pass');
  assert.equal(probe.runtimeParserCompatible, true);
  assert.equal(probe.fallbackParserAvailable, true);
  assert.equal(probe.syntaxValidCount, probe.expectedValidFixtureCount);
  assert.equal(probe.syntaxInvalidCount, probe.expectedInvalidFixtureCount);
  assert.equal(probe.normalizationSucceededCount, probe.expectedValidFixtureCount);
  assert.equal(probe.gmailSendExecuted, false);
  assert.equal(probe.googleSheetsUpdated, false);
  assert.equal(probe.candidateRowsUpdated, false);
  assert.equal(probe.scriptPropertiesUpdated, false);
  assert.equal(probe.triggerChanged, false);
  assert.equal(probe.aiApiCalled, false);
  assertReadOnly(env);
}

{
  const { context } = createContext({ exposeUrl: false });
  const normalized = context.normalizeGroundingCitationUrlAppsScriptSafe_('https://EXAMPLE.com.:443//a//b?utm_source=x&x=1#frag');
  assert.equal(normalized.ok, true);
  assert.equal(normalized.host, 'example.com');
  assert.equal(normalized.url, 'https://example.com/a/b?x=1');
  assert.equal(context.normalizeGroundingCitationUrlAppsScriptSafe_('http://example.com/').reasonCode, 'unsupported_scheme');
  assert.equal(context.normalizeGroundingCitationUrlAppsScriptSafe_('https://user:pass@example.com/').reasonCode, 'credential_in_url');
  assert.equal(context.normalizeGroundingCitationUrlAppsScriptSafe_('https://example.com/%zz').reasonCode, 'malformed_percent_encoding');
}

{
  const { context, env } = createContext({ exposeUrl: false });
  env.props.GMAIL_SALES_AI_ENABLED = 'true';
  env.props.GMAIL_SALES_AI_PROVIDER = 'gemini';
  env.props.GMAIL_SALES_AI_MODEL = 'gemini-2.5-flash-lite';
  env.props.GMAIL_SALES_AI_API_KEY = 'redacted-token';
  env.props.GMAIL_SALES_GROUNDING_MODEL = 'gemini-2.5-flash-lite';
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify([
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite'
  ]);
  const result = context.normalizeGmailSalesGroundingModelCascadePropertyOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.configuredModelCount, 4);
  assert.equal(result.activeModelCount, 4);
  assert.equal(result.duplicateModelExcludedCount, 0);
  assert.equal(result.propertyUpdated, true);
  const second = context.normalizeGmailSalesGroundingModelCascadePropertyOnce();
  assert.equal(second.idempotent, true);
  assert.equal(second.propertyUpdated, false);
  assert.equal(env.fetchCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

{
  const { context } = createContext({ exposeUrl: false });
  const response = {
    steps: [{
      type: 'google_search_call',
      arguments: { queries: ['redacted'] }
    }, {
      type: 'model_output',
      content: [{
        type: 'text',
        text: 'Official source text.',
        annotations: [{
          type: 'url_citation',
          url: 'https://example.com/contact',
          start_index: 99,
          end_index: 100
        }]
      }]
    }]
  };
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify(response) }, { candidateToken: 'probe' });
  assert.equal(parsed.citationIndexInvalidCount, 1);
  assert.equal(parsed.citationUrlSyntaxValidCount, 1);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 1);
  assert.equal(parsed.citationUrlFinalAcceptedCount, 1);
  assert.equal(parsed.citationUrlEligibleForSafetyDespiteInvalidSpanCount, 1);
}

{
  const { context, env } = createContext({ exposeUrl: false });
  const failover = context.callGeminiGroundedSearchWithFailover_({
    modelCascade: ['gemini-a', 'gemini-b', 'gemini-c', 'gemini-d'],
    apiKey: 'redacted'
  }, 'redacted prompt', { candidateToken: 'probe' }, { now: '2026-07-01T00:00:00.000Z', health: {} });
  assert.equal(failover.ok, false);
  assert.equal(failover.status, 'citation_url_parser_failed');
  assert.equal(failover.failureCategory, 'citation_url_parser_failed');
  assert.equal(failover.localValidationBlocked, true);
  assert.equal(failover.failoverExecuted, false);
  assert.equal(failover.uniqueModelsAttemptedCount, 1);
  assert.equal(env.fetchCount, 1);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

{
  const { context, env } = createContext({ exposeUrl: false });
  const now = new Date().toISOString();
  env.props.GMAIL_SALES_GROUNDING_LAST_RUN_SUMMARY_JSON = JSON.stringify({
    completedAt: now,
    candidateDiscoveryPromptRequestCount: 20,
    groundingHttpRequestCount: 20,
    retryPromptRequestCount: 0,
    failoverPromptRequestCount: 10,
    googleSearchExecutedQueryCount: 20,
    modelRequestCounts: { 'gemini-2.5-flash': 10, 'gemini-2.5-flash-lite': 10 }
  });
  env.props.GMAIL_SALES_GROUNDING_CONTRACT_PROBE_SUMMARY_JSON = JSON.stringify({ completedAt: now, httpRequestExecuted: true });
  env.props.GMAIL_SALES_GROUNDING_CITATION_ACCEPTANCE_PROBE_SUMMARY_JSON = JSON.stringify({ completedAt: now, httpRequestExecuted: true });
  const result = context.repairGmailSalesGroundingUsageAccountingOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.candidateDiscoveryPromptRequestCount, 20);
  assert.equal(result.probeRequestCount, 2);
  assert.equal(result.repairedPromptRequestCount, 22);
  assert.equal(env.fetchCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

console.log(JSON.stringify({
  status: 'pass',
  parserRuntimeCompatibilityTestPassed: true,
  localParserFailoverNetworkCalls: 1,
  propertyWrites: 0,
  gmailSendCount: 0
}));
