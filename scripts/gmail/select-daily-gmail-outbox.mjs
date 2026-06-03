import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_POOL_FILE, OUTBOX_HEADERS, asCandidates, buildBatchId, candidateEmail, dedupeKey, hasOptOutText, isAvailable, isValidEmail, parseArgs, readJson, safeSummary, toTsv, writeJson } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/select-daily-gmail-outbox.mjs --date YYYY-MM-DD --next-action-date YYYY-MM-DD [--pool data/gmail/pool/gmail-ready-candidate-pool.json]

Selects exactly 30 available candidates and writes Git-ignored outbox JSON/TSV. Does not send email.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}
if (!args.date || !args['next-action-date']) {
  printHelp();
  process.exit(1);
}

const poolFile = args.pool || DEFAULT_POOL_FILE;
const sendDate = args.date;
const nextActionDate = args['next-action-date'];
const sendBatchId = buildBatchId(sendDate);
const pool = readJson(poolFile, { candidates: [] });
const candidates = asCandidates(pool);
const usedEmail = new Set();
const usedDedupe = new Set();
const selected = [];
const summary = {
  poolTotal: candidates.length,
  availableChecked: 0,
  selected: 0,
  shortage: 30,
  outboxCreated: false,
  sheetsReadyTsvCreated: false
};

for (const candidate of candidates) {
  if (!isAvailable(candidate)) continue;
  summary.availableChecked += 1;
  const email = candidateEmail(candidate);
  const key = dedupeKey(candidate);
  const body = candidate.body || buildDefaultBody(candidate);
  if (!isValidEmail(email)) continue;
  if (usedEmail.has(email) || usedDedupe.has(key)) continue;
  if (!hasOptOutText(body)) continue;
  selected.push({
    prospectId: candidate.prospectId || key,
    name: candidate.name || '',
    businessType: candidate.businessType || '',
    area: candidate.area || '',
    email,
    contactEmail: candidate.contactEmail || '',
    publicSource: candidate.publicSource || '',
    sourceUrl: candidate.sourceUrl || '',
    issueHypothesis: candidate.issueHypothesis || '',
    salesAngle: candidate.salesAngle || '',
    subject: candidate.subject || 'SNSの見え方について、簡単な無料確認のご案内',
    body,
    status: 'ready',
    sendDate,
    nextActionDate,
    dedupeKey: key,
    sendBatchId,
    sentAt: '',
    sentBy: '',
    sentStatus: '',
    errorMessage: '',
    replyStatus: '',
    unsubscribe: false,
    doNotContact: false,
    lastCheckedAt: '',
    notes: 'Gmail-ready poolから切り出し'
  });
  usedEmail.add(email);
  usedDedupe.add(key);
  if (selected.length === 30) break;
}

summary.selected = selected.length;
summary.shortage = Math.max(0, 30 - selected.length);

if (selected.length !== 30) {
  console.log(safeSummary(summary));
  process.exit(2);
}

const outboxDir = 'data/gmail/outbox';
fs.mkdirSync(outboxDir, { recursive: true });
const outboxJson = path.join(outboxDir, `${sendDate}-gmail-sales-outbox-30.json`);
const sheetsJson = path.join(outboxDir, `${sendDate}-gmail-sales-sheets-ready.json`);
const sheetsTsv = path.join(outboxDir, `${sendDate}-gmail-sales-sheets-ready.tsv`);

writeJson(outboxJson, { generatedAt: new Date().toISOString(), candidates: selected });
writeJson(sheetsJson, { generatedAt: new Date().toISOString(), headers: OUTBOX_HEADERS, rows: selected });
fs.writeFileSync(sheetsTsv, toTsv(selected), 'utf8');

summary.outboxCreated = true;
summary.sheetsReadyTsvCreated = true;
console.log(safeSummary(summary));

function buildDefaultBody(candidate) {
  const name = candidate.name || 'ご担当者';
  return `${name} さま\n\n突然のご連絡失礼いたします。\nICHI Socialです。\n\n小規模店舗さま向けに、Instagramプロフィールや予約導線の見え方を整理するSNS運用サポートを行っています。\n\nもし現在SNS運用や予約導線の整理でお困りでしたら、無料で簡単に確認できます。\n\n今後のご案内が不要な場合は、その旨をご返信いただければ以後のご連絡は控えます。\n\nICHI Social`;
}
