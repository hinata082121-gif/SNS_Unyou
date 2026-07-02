import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function createContext() {
  const env = {
    propertyWriteCount: 0,
    sheetWriteCount: 0,
    triggerWriteCount: 0,
    mailSendCount: 0,
    draftCreateCount: 0,
    fetchCalls: [],
    logs: [],
    props: {
      AUTO_SEND_ENABLED: 'false',
      LIVE_SEND_ENABLED: 'false'
    }
  };
  const context = {
    console: { log: (value) => env.logs.push(String(value)) },
    JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, Date, URL,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map((byte) => byte > 127 ? byte - 256 : byte),
      getUuid: () => 'uuid',
      formatDate: () => '2026-07-02'
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
    UrlFetchApp: { fetch: () => { env.fetchCalls.push({}); throw new Error('network disabled in citation span validation test'); } }
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return { env, context };
}

function responseWithAnnotations(text, annotations) {
  return {
    getContentText: () => JSON.stringify({
      steps: [
        { type: 'google_search_call', arguments: { queries: ['redacted public official source'] } },
        { type: 'google_search_result', result: { count: 1 } },
        { type: 'model_output', content: [{ type: 'text', text, annotations }] }
      ]
    })
  };
}

function multiBlockResponse(blocks) {
  return {
    getContentText: () => JSON.stringify({
      steps: [
        { type: 'google_search_call', arguments: { queries: ['redacted public official source'] } },
        { type: 'google_search_result', result: { count: 1 } },
        { type: 'model_output', content: blocks }
      ]
    })
  };
}

function annotation(url, overrides = {}) {
  return Object.assign({ type: 'url_citation', url, start_index: 999, end_index: 1001 }, overrides);
}

const fixtureUrls = [
  'https://example.com/a',
  'https://example.com/b',
  'https://example.com/c',
  'https://example.com/d',
  'https://example.com/e',
  'https://example.com/f',
  'https://example.com/g'
];

{
  const { env, context } = createContext();
  const parsed = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('short cited text', fixtureUrls.map((url) => annotation(url))),
    { candidateToken: 'span-probe' }
  );
  assert.equal(parsed.urlCitationAnnotationCount, 7);
  assert.equal(parsed.citationUrlPresentCount, 7);
  assert.equal(parsed.citationUrlSyntaxValidCount, 7);
  assert.equal(parsed.citationUrlSyntaxInvalidCount, 0);
  assert.equal(parsed.citationSpanInvalidCount, 7);
  assert.equal(parsed.citationIndexInvalidCount, 7);
  assert.equal(parsed.citationUrlNormalizedCount, 7);
  assert.equal(parsed.citationUrlUniqueCount, 7);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 7);
  assert.equal(parsed.citationUrlIdentityValidationAttemptCount, 7);
  assert.equal(parsed.citationUrlFinalAcceptedCount, 7);
  assert.equal(parsed.citationUrlEligibleForSafetyDespiteInvalidSpanCount, 7);
  assert.equal(parsed.citationUrlEligibleForInlineRenderingCount, 0);
  assert.equal(parsed.citationPipelineInvariantValid, true);
  assert.equal(parsed.citationSpanValidationReasonCounts.index_out_of_concatenated_text_range, 7);
  assert.equal(env.fetchCalls.length, 0);
  assert.equal(env.mailSendCount, 0);
  assert.equal(env.draftCreateCount, 0);
  assert.equal(env.sheetWriteCount, 0);
  assert.equal(env.triggerWriteCount, 0);
}

{
  const { context } = createContext();
  const snake = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('abcdef', [annotation(fixtureUrls[0], { start_index: 1, end_index: 3 })]),
    { candidateToken: 'span-probe' }
  );
  assert.equal(snake.citationSpanValidCount, 1);
  assert.equal(snake.citationUrlEligibleForInlineRenderingCount, 1);

  const camel = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('abcdef', [annotation(fixtureUrls[0], { start_index: undefined, end_index: undefined, startIndex: 1, endIndex: 3 })]),
    { candidateToken: 'span-probe' }
  );
  assert.equal(camel.citationSpanValidCount, 1);
}

{
  const { context } = createContext();
  const parsed = context.parseGeminiGroundingInteractionResponse_(
    multiBlockResponse([
      { type: 'text', text: 'first block ' },
      { type: 'text', text: 'second block', annotations: [annotation(fixtureUrls[0], { start_index: 12, end_index: 18 })] }
    ]),
    { candidateToken: 'span-probe' }
  );
  assert.equal(parsed.citationSpanValidCount, 1);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 1);
}

{
  const { context } = createContext();
  const parsed = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('日本語🙂text', [
      annotation(fixtureUrls[0], { start_index: 0, end_index: 3 }),
      annotation(fixtureUrls[1], { start_index: 0, end_index: 4 })
    ]),
    { candidateToken: 'span-probe' }
  );
  assert.equal(parsed.citationSpanValidCount, 2);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 2);
}

{
  const { context } = createContext();
  const parsed = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('abcdef', [
      annotation(fixtureUrls[0], { start_index: undefined, end_index: 1 }),
      annotation(fixtureUrls[1], { start_index: -1, end_index: 1 }),
      annotation(fixtureUrls[2], { start_index: 5, end_index: 1 }),
      annotation(fixtureUrls[3], { start_index: 99, end_index: 100 }),
      { type: 'url_citation', start_index: 0, end_index: 1 },
      { type: 'url_citation', url: 'not a url', start_index: 0, end_index: 1 }
    ]),
    { candidateToken: 'span-probe' }
  );
  assert.equal(parsed.citationSpanValidationReasonCounts.missing_start_index, 1);
  assert.equal(parsed.citationSpanValidationReasonCounts.negative_index, 1);
  assert.equal(parsed.citationSpanValidationReasonCounts.start_after_end, 1);
  assert.equal(parsed.citationSpanValidationReasonCounts.index_out_of_concatenated_text_range, 1);
  assert.equal(parsed.citationUrlMissingCount, 1);
  assert.equal(parsed.citationUrlSyntaxInvalidCount, 2);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 4);
}

{
  const { context } = createContext();
  const parsed = context.parseGeminiGroundingInteractionResponse_(
    responseWithAnnotations('plain text contains a URL-like token that must not be parsed', []),
    { candidateToken: 'span-probe' }
  );
  assert.equal(parsed.urlCitationAnnotationCount, 0);
  assert.equal(parsed.citationUrlSafetyValidationAttemptCount, 0);
}

console.log(JSON.stringify({
  citationSpanValidationTestPassed: true,
  annotationUrlOnly: true,
  invalidSpanStillSafetyValidated: true,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualProductionSheetUpdate: 0,
  actualProductionTriggerChange: 0,
  actualProductionGeminiCall: 0,
  mailAppSendEmailCallSiteCount: (code.match(/MailApp\.sendEmail\s*\(/g) || []).length
}, null, 2));
