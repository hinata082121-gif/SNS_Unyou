import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function createContext(responseFactory, options = {}) {
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
      fetch: (url, request = {}) => {
        env.fetchCalls.push({ url: String(url), request });
        const payload = JSON.parse(String(request.payload || '{}'));
        const produced = responseFactory(payload, env.fetchCalls.length);
        return {
          getResponseCode: () => produced.statusCode || options.statusCode || 200,
          getHeaders: () => produced.headers || {},
          getContentText: () => JSON.stringify(produced.body || produced)
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return { env, context };
}

function citationSteps(annotations) {
  return {
    steps: [
      { type: 'google_search_call', arguments: { queries: ['redacted public official website'] } },
      { type: 'google_search_result', call_id: 'call-1', result: { count: 1 } },
      {
        type: 'model_output',
        content: [{
          type: 'text',
          text: 'The public official website has contact and business inquiry information for verification.',
          annotations
        }]
      }
    ]
  };
}

function annotation(url, overrides = {}) {
  return Object.assign({
    type: 'url_citation',
    url,
    start_index: 4,
    end_index: 20
  }, overrides);
}

const safePrimary = 'https://www.example.com/contact?utm_source=test#fragment';
const safeSecond = 'https://sub.example.co.jp//about?x=1';
const safeThird = 'https://xn--eckwd4c7c.example/contact';
const officialDocs = 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content';
const annotations = [
  annotation(safePrimary),
  annotation(safeSecond),
  annotation(safeThird),
  annotation('http://plain.example/contact'),
  annotation('https://user:pass@example.com/contact'),
  annotation('https://facebook.com/example'),
  annotation('https://google.com/maps/place/example'),
  annotation('https://reviews.io/company/example'),
  annotation('https://amazon.com/shop/example'),
  annotation('https://indeed.com/jobs/example'),
  annotation('https://prtimes.jp/main/html/example'),
  annotation('https://bit.ly/example'),
  annotation('https://127.0.0.1/private'),
  annotation('https://localhost/private')
];
while (annotations.length < 28) annotations.push(annotation(safePrimary));

{
  const { context } = createContext(() => citationSteps(annotations));
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify(citationSteps(annotations)) }, { candidateToken: 'probe' });
  assert.equal(parsed.urlCitationAnnotationCount, 28);
  assert.equal(parsed.citationUrlPresentCount, 28);
  assert.equal(parsed.citationIndexValidCount, 28);
  assert.equal(parsed.citationUrlSyntaxInvalidCount, 2);
  assert.equal(parsed.citationUrlSyntaxValidCount, 26);
  assert.equal(parsed.citationUrlDuplicateCount, 14);
  assert.equal(parsed.citationUrlUniqueCount, 12);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 12);
  assert.equal(parsed.citationUrlSafetyAcceptedCount, 3);
  assert.equal(parsed.citationUrlSafetyRejectedCount, 9);
  assert.equal(parsed.citationUrlFinalAcceptedCount, 3);
  assert.equal(parsed.citations.length, 3);
  const reasonTotal = Object.values(parsed.citationUrlSafetyRejectionReasonCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  assert.equal(reasonTotal, parsed.citationUrlSafetyRejectedCount);
  ['social_network', 'map_listing', 'review_site', 'marketplace', 'job_site', 'press_release_distribution', 'url_shortener', 'private_ip', 'localhost'].forEach((key) => {
    assert.equal(parsed.citationUrlSafetyRejectionReasonCounts[key], 1);
  });
  assert.equal(parsed.citations.some((citation) => String(citation.url).includes('utm_')), false);
  assert.equal(parsed.citations.some((citation) => String(citation.url).includes('#')), false);
}

{
  const { context } = createContext(() => citationSteps([annotation(safePrimary, { start_index: 1000, end_index: 1001 })]));
  const parsed = context.parseGeminiGroundingInteractionResponse_({ getContentText: () => JSON.stringify(citationSteps([annotation(safePrimary, { start_index: 1000, end_index: 1001 })])) }, { candidateToken: 'probe' });
  assert.equal(parsed.urlCitationAnnotationCount, 1);
  assert.equal(parsed.citationIndexInvalidCount, 1);
  assert.equal(parsed.citationUrlFinalAcceptedCount, 0);
}

{
  const { context } = createContext(() => citationSteps([annotation(safePrimary)]));
  assert.equal(context.classifyGroundingProviderError_(429, ''), 'rate_limited');
  assert.equal(context.classifyGroundingProviderError_(500, ''), 'server_error');
  assert.equal(context.classifyGroundingProviderError_(401, ''), 'authentication_error');
  assert.equal(context.classifyGroundingCitationUrlSafety_(officialDocs).accepted, true);
  assert.equal(context.classifyGroundingCitationUrlSafety_(officialDocs).reasonCode, 'accepted_official_documentation');
  assert.equal(context.classifyGroundingCitationUrlSafety_('https://www.google.com/search?q=example').reasonCode, 'unrelated_google_service');
  assert.equal(context.classifyGroundingCitationUrlSafety_('https://google.com/url?q=https%3A%2F%2Fexample.com').reasonCode, 'unsupported_google_redirect');
  assert.equal(context.classifyGroundingCitationUrlSafety_('https://google.com/maps/place/example').reasonCode, 'map_listing');
  assert.equal(context.classifyGroundingCitationUrlSafety_('https://news.google.com/articles/redacted').reasonCode, 'unrelated_google_service');
}

{
  const { context } = createContext(() => citationSteps([annotation(safePrimary)]));
  const normalized = context.normalizeGmailSalesGroundingModelCascade_('', 'gemini-2.5-flash-lite');
  assert.equal(JSON.stringify(normalized.activeModelCascade), JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']));
  assert.equal(normalized.activeModelCount, 4);
  assert.equal(normalized.activeModelCascade.includes('gemini-2.0-flash'), false);
  assert.equal(context.isGmailSalesGroundingModelPermanentlyUnavailable_('gemini-2.0-flash'), true);
  assert.equal(context.isGmailSalesGroundingModelPermanentlyUnavailable_('gemini-2.0-flash-001'), true);
  assert.equal(context.isGmailSalesGroundingModelPermanentlyUnavailable_('gemini-2.0-flash-exp'), true);
}

{
  const { context } = createContext(() => citationSteps([annotation(safePrimary)]));
  const normalized = context.normalizeGmailSalesGroundingModelCascade_(JSON.stringify(['gemini-2.0-flash', 'bad model', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite']), 'gemini-2.5-flash-lite');
  assert.equal(JSON.stringify(normalized.activeModelCascade), JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']));
  assert.equal(normalized.shutdownModelExcludedCount, 1);
  assert.equal(normalized.malformedModelExcludedCount, 1);
  assert.equal(normalized.duplicateModelExcludedCount >= 1, true);
  assert.equal(normalized.modelConfigurationValid, true);
}

{
  const { env, context } = createContext(() => citationSteps([annotation(officialDocs)]));
  const result = context.testGmailSalesGroundingCitationAcceptanceContractOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.httpRequestExecuted, true);
  assert.equal(result.httpSuccess, true);
  assert.equal(result.citationAcceptanceValid, true);
  assert.equal(result.citationUrlFinalAcceptedCount, 1);
  assert.equal(result.citationUrlSafetyInvariantValid, true);
  assert.equal(result.citationUrlSafetyRejectionReasonCountTotal, 0);
  assert.equal(result.citationUrlOfficialDocumentationCandidateCount, 1);
  assert.equal(result.probeScenarioVersion, 'citation-acceptance-official-docs-v2');
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.triggerWriteCount, 0);
  assert.equal(env.propertyWriteCount, 1);
  const propertyWritesBeforeInspect = env.propertyWriteCount;
  const inspected = context.inspectGmailSalesGroundingCitationAcceptanceProbeStatus();
  assert.equal(inspected.lastProbeValid, true);
  assert.equal(inspected.citationUrlSafetyAcceptedCount, 1);
  assert.equal(inspected.citationUrlFinalAcceptedCount, 1);
  assert.equal(inspected.aiApiCalled, false);
  assert.equal(env.propertyWriteCount, propertyWritesBeforeInspect);
}

{
  const { env, context } = createContext(() => citationSteps([annotation(safePrimary)]));
  context.classifyGroundingCitationUrlSafety_ = () => ({ ok: false });
  const result = context.testGmailSalesGroundingCitationAcceptanceContractOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.citationAcceptanceValid, false);
  assert.equal(result.citationUrlSafetyRejectedCount, 1);
  assert.equal(result.citationUrlSafetyRejectionReasonCounts.unknown_safety_rejection, 1);
  assert.equal(result.citationUrlSafetyRejectionReasonCountTotal, 1);
  assert.equal(env.mailSendCount, 0);
}

{
  const { env, context } = createContext(() => citationSteps([annotation(safePrimary)]));
  const result = context.testGmailSalesGroundingCitationAcceptanceContractOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.citationAcceptanceValid, false);
  assert.equal(result.citationUrlSafetyAcceptedCount, 1);
  assert.equal(result.citationUrlIdentityValidationAttemptCount, 1);
  assert.equal(result.citationUrlIdentityAcceptedCount, 0);
  assert.equal(result.citationUrlIdentityRejectedCount, 1);
  assert.equal(result.citationUrlFinalAcceptedCount, 0);
  assert.equal(result.citationUrlSafetyRejectionReasonCountTotal, 0);
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.mailSendCount, 0);
}

{
  const { env, context } = createContext((payload) => {
    if (payload.model === 'gemini-3.5-flash') return { statusCode: 500, body: { error: { status: 'UNAVAILABLE' } } };
    return { body: citationSteps([annotation(safePrimary)]) };
  });
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const result = context.testGmailSalesGroundingModelFailoverOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.selectedModel, 'gemini-3.1-flash-lite');
  assert.equal(result.failoverExecuted, true);
  assert.equal(result.responseContractValid, true);
  assert.equal(result.citationAcceptanceValid, true);
  assert.equal(env.fetchCalls.length, 3);
  assert.equal(env.fetchCalls.every((call) => JSON.parse(call.request.payload).store === false), true);
  assert.equal(env.fetchCalls.every((call) => Object.prototype.hasOwnProperty.call(JSON.parse(call.request.payload), 'previous_interaction_id') === false), true);
  assert.equal(env.fetchCalls.every((call) => call.request.headers['x-goog-api-key'] === env.props.GMAIL_SALES_AI_API_KEY), true);
}

{
  const { env, context } = createContext((payload) => {
    if (payload.model === 'gemini-3.5-flash') return { statusCode: 429, body: { error: { status: 'RESOURCE_EXHAUSTED' } } };
    if (payload.model === 'gemini-3.1-flash-lite') return { statusCode: 503, body: { error: { status: 'UNAVAILABLE' } } };
    if (payload.model === 'gemini-2.5-flash') return { statusCode: 500, body: { error: { status: 'UNAVAILABLE' } } };
    return { body: citationSteps([annotation(safePrimary)]) };
  });
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const result = context.testGmailSalesGroundingModelFailoverOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.selectedModel, 'gemini-2.5-flash-lite');
  assert.equal(result.failoverExecuted, true);
  assert.equal(result.modelsAttemptedCount, 6);
}

{
  const { env, context } = createContext(() => ({ statusCode: 503, body: { error: { status: 'UNAVAILABLE' } } }));
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const result = context.testGmailSalesGroundingModelFailoverOnce();
  assert.equal(result.status, 'blocked');
  assert.equal(result.modelSuccessCount, 0);
  assert.equal(result.modelsAttemptedCount, 8);
  assert.equal(result.allModelsUnavailable, true);
}

{
  const { env, context } = createContext((payload) => {
    if (payload.model === 'gemini-3.5-flash') return { statusCode: 404, body: { error: { status: 'NOT_FOUND' } } };
    return { body: citationSteps([annotation(safePrimary)]) };
  });
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify(['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const result = context.testGmailSalesGroundingModelFailoverOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.selectedModel, 'gemini-3.1-flash-lite');
  assert.equal(result.providerErrorCategoryCounts.model_not_found, 1);
}

{
  const { env, context } = createContext(() => ({ body: citationSteps([annotation(safePrimary)]) }));
  env.props.GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON = JSON.stringify(['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-exp']);
  const result = context.testGmailSalesGroundingModelFailoverOnce();
  assert.equal(result.status, 'pass');
  assert.equal(result.activeModelCascade.includes('gemini-2.0-flash'), false);
  assert.equal(result.shutdownModelExcludedCount, 3);
  assert.equal(env.fetchCalls.some((call) => JSON.parse(call.request.payload).model.indexOf('gemini-2.0-') === 0), false);
}

console.log(JSON.stringify({
  groundingCitationSafetyTestPassed: true,
  citationUrlSafetyRejectedReasonCountsSumMatches: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionSheetUpdate: 0,
  actualProductionTriggerChange: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
