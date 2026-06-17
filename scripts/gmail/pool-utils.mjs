import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_POOL_FILE = 'data/gmail/pool/gmail-ready-candidate-pool.json';
export const DEFAULT_EXCLUDED_FILE = 'data/gmail/pool/gmail-candidate-pool-excluded.json';

export const OUTBOX_HEADERS = [
  'prospectId',
  'name',
  'businessType',
  'area',
  'email',
  'contactEmail',
  'publicSource',
  'sourceUrl',
  'issueHypothesis',
  'salesAngle',
  'subject',
  'body',
  'status',
  'sendDate',
  'nextActionDate',
  'dedupeKey',
  'sendBatchId',
  'sentAt',
  'sentBy',
  'sentStatus',
  'errorMessage',
  'replyStatus',
  'unsubscribe',
  'doNotContact',
  'lastCheckedAt',
  'notes'
];

export function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function asCandidates(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.candidates)) return value.candidates;
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && Array.isArray(value.prospects)) return value.prospects;
  return [];
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function hashValue(value, length = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

export function candidateEmail(candidate) {
  return normalizeEmail(candidate.email || candidate.contactEmail || candidate.contact_email);
}

export function candidateName(candidate) {
  return String(candidate.name || candidate.storeName || candidate.businessName || '').trim().toLowerCase();
}

export function sourceDomain(candidate) {
  const raw = String(candidate.sourceUrl || candidate.publicSource || candidate.source || '').trim();
  try {
    return raw ? new URL(raw).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    return String(candidate.sourceDomain || '').trim().toLowerCase();
  }
}

export function dedupeKey(candidate) {
  return String(
    candidate.dedupeKey ||
    `${candidateEmail(candidate)}|${candidateName(candidate)}|${sourceDomain(candidate)}`
  ).trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isAvailable(candidate) {
  return String(candidate.status || 'available').toLowerCase() === 'available';
}

export function hasOptOutText(body) {
  const text = normalizeEmailBody(body);
  return text.includes('不要') || text.includes('今後のご案内が不要') || text.includes('ご返信不要');
}

export function normalizeEmailBody(body) {
  return String(body ?? '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeEmailSubject(subject) {
  return String(subject ?? '')
    .replace(/\\r\\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildBatchId(sendDate) {
  return `gmail-sales-${sendDate}`;
}

export function jstDate(daysFromToday = 0) {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const base = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + daysFromToday
  ));
  return base.toISOString().slice(0, 10);
}

export function addDaysToDate(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function resolveDateArg(value, fallbackMode = 'today') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'today') return jstDate(0);
  if (raw === 'tomorrow') return jstDate(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallbackMode === 'tomorrow' ? jstDate(1) : jstDate(0);
}

export function safeSummary(summary) {
  return JSON.stringify(summary, null, 2);
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export function toTsv(rows) {
  const escapeCell = (value, key) => {
    const normalized = key === 'body'
      ? normalizeEmailBody(value)
      : key === 'subject'
        ? normalizeEmailSubject(value)
        : String(value ?? '');
    return normalized.replace(/\r?\n/g, '\\n').replace(/\t/g, ' ');
  };
  return [
    OUTBOX_HEADERS.join('\t'),
    ...rows.map((row) => OUTBOX_HEADERS.map((key) => escapeCell(row[key], key)).join('\t'))
  ].join('\n') + '\n';
}
