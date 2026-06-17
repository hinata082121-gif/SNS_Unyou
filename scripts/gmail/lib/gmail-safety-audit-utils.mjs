import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

export function asRows(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.candidates)) return value.candidates;
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && Array.isArray(value.prospects)) return value.prospects;
  return [];
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

export function safeHash(value) {
  return sha256(value).slice(0, 16);
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeEmail(value) {
  return normalizeText(value);
}

export function normalizeBody(value) {
  return String(value ?? '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sourceDomain(row) {
  const raw = String(row.sourceUrl || row.publicSource || row.source || '').trim();
  try {
    return raw ? new URL(raw).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    return String(row.sourceDomain || '').trim().toLowerCase();
  }
}

export function rowIdentity(row) {
  const email = normalizeEmail(row.email || row.contactEmail || row.contact_email || row['メール'] || row['宛先メール']);
  const business = normalizeText(row.name || row.storeName || row.businessName || row['店舗名']);
  const domain = sourceDomain(row);
  const dedupe = normalizeText(row.dedupeKey || row.prospectId || '');
  return {
    emailHash: email ? safeHash(email) : '',
    businessHash: business ? safeHash(business) : '',
    domainHash: domain ? safeHash(domain) : '',
    dedupeHash: dedupe ? safeHash(dedupe) : '',
    fingerprint: safeHash([email, business, domain, dedupe].join('|'))
  };
}

export function rowContentHash(row) {
  return safeHash([
    normalizeText(row.subject || row['件名']),
    normalizeBody(row.body || row['本文'])
  ].join('\n---\n'));
}

export function collectOutboxFiles(dir, fromDate = '2026-06-11') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const match = entry.name.match(/^(\d{4}-\d{2}-\d{2}).*gmail-sales-outbox-30\.json$/);
      if (!match || match[1] < fromDate) return null;
      return {
        filePath: path.join(dir, entry.name),
        fileName: entry.name,
        sendDate: match[1]
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function summarizeOutboxFile(file) {
  const rows = asRows(readJson(file.filePath, { candidates: [] }));
  const identityHashes = rows.map((row) => rowIdentity(row).fingerprint);
  const emailHashes = rows.map((row) => rowIdentity(row).emailHash).filter(Boolean);
  const businessHashes = rows.map((row) => rowIdentity(row).businessHash).filter(Boolean);
  const bodyHashes = rows.map(rowContentHash);
  const batchIds = new Set(rows.map((row) => String(row.sendBatchId || '').trim()).filter(Boolean));
  return {
    sendDate: file.sendDate,
    fileName: file.fileName,
    rowCount: rows.length,
    batchIds: [...batchIds],
    rowSetHash: safeHash(identityHashes.slice().sort().join('|')),
    emailSetHash: safeHash(emailHashes.slice().sort().join('|')),
    businessSetHash: safeHash(businessHashes.slice().sort().join('|')),
    contentSetHash: safeHash(bodyHashes.slice().sort().join('|')),
    uniqueEmailCount: new Set(emailHashes).size,
    uniqueBusinessCount: new Set(businessHashes).size,
    duplicateEmailCount: Math.max(0, emailHashes.length - new Set(emailHashes).size),
    duplicateBusinessCount: Math.max(0, businessHashes.length - new Set(businessHashes).size),
    identityHashes
  };
}

export function countIntersection(a, b) {
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item)).length;
}
