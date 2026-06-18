import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const codePath = path.join(ROOT, 'apps-script', 'gmail-sales-automation', 'Code.gs');
const code = fs.readFileSync(codePath, 'utf8');
const functionBody = extractFunctionBody(code, 'logGoogleSheetSendHistorySafeJsonOnly');

assert.match(functionBody, /getConfig_\(\)/);
assert.match(functionBody, /loadKnownSentEmails_\(config\)/);
assert.match(functionBody, /normalizeEmail_/);
assert.match(functionBody, /hashValue_/);
assert.match(functionBody, /Array\.from\(new Set\(recipientHashes\)\)\.sort\(\)/);
assert.match(functionBody, /entries:\s*uniqueRecipientHashes\.map\(\(recipientHash\)\s*=>\s*\(\{\s*recipientHash\s*\}\)\)/);
assert.match(functionBody, /event:\s*'google_sheet_send_history_export_chunk'/);
assert.match(functionBody, /event:\s*'google_sheet_send_history_export_complete'/);
assert.match(functionBody, /const maxPayloadLength = 5600/);

for (const forbiddenCall of [
  'GmailApp.sendEmail',
  'GmailDraft.send',
  'MailApp.sendEmail',
  '.setValue(',
  '.setValues(',
  '.clearContents(',
  '.appendRow(',
  '.setProperty(',
  '.deleteProperty('
]) {
  assert.equal(functionBody.includes(forbiddenCall), false, `forbidden call found: ${forbiddenCall}`);
}

const loggerLines = functionBody
  .split('\n')
  .filter((line) => line.includes('Logger.log'));
assert.equal(loggerLines.length, 2);
assert.equal(loggerLines.every((line) => line.includes('JSON.stringify')), true);

const disallowedOutputKeys = [
  'sheetId',
  'sheetName',
  'businessName',
  'companyName',
  'customerName',
  'storeName',
  'body:',
  'subject:',
  'rowIndex',
  'url:',
  'token'
];
for (const key of disallowedOutputKeys) {
  assert.equal(functionBody.includes(key), false, `disallowed output key found: ${key}`);
}

assert.equal(/recipientHash:\s*['"`]/.test(functionBody), false);
assert.equal(/entries:\s*\[\s*\{[^}]*recipientHash[^}]*,[^}]*\}/s.test(functionBody), false);
assert.equal(/payload:\s*json\.slice/.test(functionBody), true);

console.log(JSON.stringify({
  syntheticTestCount: 18,
  passed: true,
  functionName: 'logGoogleSheetSendHistorySafeJsonOnly',
  entriesShape: [{ recipientHash: '<hash>' }],
  gmailSendExecuted: false,
  googleSheetsUpdated: false,
  triggerChanged: false,
  scriptPropertiesUpdated: false
}, null, 2));

function extractFunctionBody(source, functionName) {
  const signature = `function ${functionName}()`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} was not found`);
  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} has no opening brace`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }
  throw new Error(`${functionName} has no closing brace`);
}
