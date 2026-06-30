import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function createContext(responseFactory) {
  const env = {
    props: {
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false',
      GMAIL_SALES_AI_ENABLED: 'true',
      GMAIL_SALES_AI_PROVIDER: 'gemini',
      GMAIL_SALES_AI_MODEL: 'gemini-mock',
      GMAIL_SALES_AI_API_KEY: 'mock-redacted-token',
      GMAIL_SALES_GROUNDING_MODEL: 'gemini-mock-grounded'
    },
    fetchCalls: [],
    propertyWriteCount: 0,
    sheetWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0,
    logs: []
  };
  const context = {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, Date, URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => 'uuid',
      formatDate: () => '2026-07-01'
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
    SpreadsheetApp: { openById: () => null, flush: () => {} },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { env.triggerWriteCount += 1; } }) }) }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { env.mailSendCount += 1; } },
    GmailApp: { search: () => [], createDraft: () => { env.draftCreateCount += 1; } },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: {
      fetch: (url, options = {}) => {
        env.fetchCalls.push({ url: String(url), options });
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify(responseFactory())
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return { env, context };
}

function validSteps({ camel = false } = {}) {
  const annotation = camel
    ? { type: 'url_citation', url: 'https://official.example/contact', startIndex: 4, endIndex: 20 }
    : { type: 'url_citation', url: 'https://official.example/contact', start_index: 4, end_index: 20 };
  return {
    steps: [
      { type: 'google_search_call', arguments: { queries: ['redacted official website'] } },
      { type: 'google_search_result', call_id: 'call-1', result: { count: 1 } },
      {
        type: 'model_output',
        content: [{
          type: 'text',
          text: 'The official website has contact and business inquiry details.',
          annotations: [annotation]
        }]
      }
    ]
  };
}

function target() {
  return { candidateToken: 'contract-probe' };
}

{
  const { env, context } = createContext(() => validSteps());
  const grounding = { model: 'gemini-mock-grounded', apiKey: env.props.GMAIL_SALES_AI_API_KEY };
  const search = context.callGeminiGroundedSearch_(grounding, 'safe public prompt');
  const payload = JSON.parse(env.fetchCalls[0].options.payload);
  assert.equal(env.fetchCalls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(env.fetchCalls[0].url.includes(env.props.GMAIL_SALES_AI_API_KEY), false);
  assert.equal(env.fetchCalls[0].options.headers['x-goog-api-key'], env.props.GMAIL_SALES_AI_API_KEY);
  assert.deepEqual(payload.tools, [{ type: 'google_search' }]);
  assert.equal(payload.store, false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'previous_interaction_id'), false);
  const parsed = context.parseGeminiGroundingInteractionResponse_(search.response, target());
  assert.equal(parsed.responseJsonParsed, true);
  assert.equal(parsed.googleSearchCallStepCount, 1);
  assert.equal(parsed.googleSearchExecutedQueryCount, 1);
  assert.equal(parsed.googleSearchResultStepCount, 1);
  assert.equal(parsed.modelOutputStepCount, 1);
  assert.equal(parsed.modelOutputTextPresentCount, 1);
  assert.equal(parsed.urlCitationAnnotationCount, 1);
  assert.equal(parsed.citationUrlAcceptedCount, 1);
  assert.equal(parsed.citations.length, 1);
}

{
  const { context } = createContext(() => validSteps({ camel: true }));
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify(validSteps({ camel: true })) }, target());
  assert.equal(parsed.urlCitationAnnotationCount, 1);
  assert.equal(parsed.citationUrlAcceptedCount, 1);
}

{
  const { context } = createContext(() => ({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Body mentions https://body-only.example but has no citation.', annotations: [] }] }] }));
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Body mentions https://body-only.example but has no citation.', annotations: [] }] }] }) }, target());
  assert.equal(parsed.citations.length, 0);
  assert.equal(parsed.groundingToolNotInvoked, true);
  assert.equal(parsed.groundingAnnotationMissing, true);
}

{
  const { context } = createContext(() => ({ steps: [{ type: 'google_search_call', arguments: { query: 'redacted' } }, { type: 'model_output', content: [{ type: 'text', text: 'No citation.', annotations: [] }] }] }));
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify({ steps: [{ type: 'google_search_call', arguments: { query: 'redacted' } }, { type: 'model_output', content: [{ type: 'text', text: 'No citation.', annotations: [] }] }] }) }, target());
  assert.equal(parsed.googleSearchCallStepCount, 1);
  assert.equal(parsed.googleSearchExecutedQueryCount, 1);
  assert.equal(parsed.groundingCalledWithoutCitation, true);
  assert.equal(parsed.citations.length, 0);
}

{
  const { env, context } = createContext(() => validSteps());
  const result = context.testGmailSalesGroundingResponseContractOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.httpRequestExecuted, true);
  assert.equal(result.httpSuccess, true);
  assert.equal(result.responseJsonParsed, true);
  assert.equal(result.googleSearchCallStepCount, 1);
  assert.equal(result.urlCitationAnnotationCount, 1);
  assert.equal(result.responseContractValid, true);
  assert.equal(result.storeDisabled, true);
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

console.log(JSON.stringify({
  groundingResponseContractTestPassed: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionSheetUpdate: 0,
  actualProductionTriggerChange: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
