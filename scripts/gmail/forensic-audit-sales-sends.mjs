import fs from 'node:fs';
import path from 'node:path';
import {
  collectOutboxFiles,
  countIntersection,
  readJson,
  safeHash,
  summarizeOutboxFile,
  writeJson
} from './lib/gmail-safety-audit-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const fromDate = args.from || '2026-06-11';
const outboxDir = args['outbox-dir'] || 'data/gmail/outbox';
const statusDir = args['status-dir'] || 'data/agent-status/tasks';
const summaryDoc = args['summary-doc'] || 'docs/gmail/gmail-sales-incident-safe-summary-2026-06-18.md';
const statusFile = args['status-file'] || 'data/agent-status/tasks/gmail-sales-incident-2026-06-18.json';
const privateDir = args['private-dir'] || 'tmp/gmail-incident';

const files = collectOutboxFiles(outboxDir, fromDate);
const outboxes = files.map(summarizeOutboxFile);
const pairFindings = [];
const allIdentityHashes = [];
const byDate = {};

for (const outbox of outboxes) {
  byDate[outbox.sendDate] = byDate[outbox.sendDate] || [];
  byDate[outbox.sendDate].push(safeOutbox(outbox));
  for (const identityHash of outbox.identityHashes) {
    allIdentityHashes.push(identityHash);
  }
}

for (let i = 0; i < outboxes.length; i += 1) {
  for (let j = i + 1; j < outboxes.length; j += 1) {
    const previous = outboxes[i];
    const current = outboxes[j];
    const overlap = countIntersection(current.identityHashes, previous.identityHashes);
    if (overlap > 0 || current.rowSetHash === previous.rowSetHash) {
      pairFindings.push({
        firstSendDate: previous.sendDate,
        secondSendDate: current.sendDate,
        firstFileHash: safeHash(previous.fileName),
        secondFileHash: safeHash(current.fileName),
        overlapCount: overlap,
        exactRecipientSetMatch: current.rowSetHash === previous.rowSetHash,
        exactContentSetMatch: current.contentSetHash === previous.contentSetHash
      });
    }
  }
}

const statusFindings = readSendStatuses(statusDir, fromDate);
const totalRowsAudited = outboxes.reduce((sum, item) => sum + item.rowCount, 0);
const uniqueIdentityCount = new Set(allIdentityHashes).size;
const duplicateAcrossOutboxes = Math.max(0, allIdentityHashes.length - uniqueIdentityCount);
const incidentOutsideWindowCount = 30;
const now = new Date().toISOString();
const safeSummary = {
  generatedAt: now,
  fromDate,
  outboxFileCount: outboxes.length,
  totalRowsAudited,
  uniqueIdentityCount,
  duplicateAcrossOutboxes,
  repeatedOutboxPairCount: pairFindings.length,
  outsideAllowedWindowCount: incidentOutsideWindowCount,
  outsideAllowedWindowSource: 'user_reported_2026_06_18_0038_0040_jst',
  actualGmailSentMailboxAudited: false,
  statusFindings,
  pairFindings,
  byDate
};

fs.mkdirSync(privateDir, { recursive: true });
writeJson(path.join(privateDir, 'gmail-sales-incident-private-hash-ledger.json'), {
  generatedAt: now,
  note: 'Contains only irreversible hashes and counts; no email addresses, names, body text, or URLs.',
  identityHashesByOutbox: Object.fromEntries(outboxes.map((outbox) => [
    `${outbox.sendDate}:${safeHash(outbox.fileName)}`,
    outbox.identityHashes
  ]))
});

writeJson(statusFile, buildAgentStatus(safeSummary));
writeSummaryDoc(summaryDoc, safeSummary);
console.log(JSON.stringify({
  outboxFileCount: safeSummary.outboxFileCount,
  totalRowsAudited: safeSummary.totalRowsAudited,
  duplicateAcrossOutboxes: safeSummary.duplicateAcrossOutboxes,
  repeatedOutboxPairCount: safeSummary.repeatedOutboxPairCount,
  outsideAllowedWindowCount: safeSummary.outsideAllowedWindowCount,
  actualGmailSentMailboxAudited: safeSummary.actualGmailSentMailboxAudited,
  statusFile,
  summaryDoc
}, null, 2));

function safeOutbox(outbox) {
  return {
    fileHash: safeHash(outbox.fileName),
    rowCount: outbox.rowCount,
    batchIdCount: outbox.batchIds.length,
    rowSetHash: outbox.rowSetHash,
    contentSetHash: outbox.contentSetHash,
    uniqueEmailCount: outbox.uniqueEmailCount,
    uniqueBusinessCount: outbox.uniqueBusinessCount,
    duplicateEmailCount: outbox.duplicateEmailCount,
    duplicateBusinessCount: outbox.duplicateBusinessCount
  };
}

function readSendStatuses(dir, fromDateText) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^gmail-daily-sales-send-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
    .map((entry) => {
      const date = entry.name.match(/(\d{4}-\d{2}-\d{2})/)[1];
      if (date < fromDateText) return null;
      const task = readJson(path.join(dir, entry.name), {});
      const metrics = task.metrics || {};
      return {
        date,
        status: task.status || 'unknown',
        sentCount: Number(metrics.sentCount || metrics.processed || 0),
        failedCount: Number(metrics.failedCount || 0),
        batchMarkedSent: metrics.batchMarkedSent === true,
        safeMetricOnly: true
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildAgentStatus(summary) {
  return {
    id: 'gmail-sales-incident-2026-06-18',
    agent: 'Codex',
    avatar: 'ops-monitor',
    title: 'Gmail営業誤送信事故監査',
    category: 'gmail_send',
    status: 'blocked',
    phase: '送信停止・安全監査中',
    progress: 70,
    priority: 'critical',
    createdAt: '2026-06-18T00:00:00.000+09:00',
    updatedAt: summary.generatedAt,
    summary: '2026-06-11以降のGmail営業outboxを安全なハッシュと件数だけで監査し、重複・再利用・時間外送信扱いを記録した。',
    artifacts: [
      'docs/gmail/gmail-sales-incident-safe-summary-2026-06-18.md',
      'docs/gmail/gmail-sales-incident-response-2026-06-18.md',
      'docs/gmail/gmail-sales-safety-guard-runbook-2026-06-18.md'
    ],
    metrics: {
      fromDate: summary.fromDate,
      outboxFileCount: summary.outboxFileCount,
      totalRowsAudited: summary.totalRowsAudited,
      duplicateAcrossOutboxes: summary.duplicateAcrossOutboxes,
      repeatedOutboxPairCount: summary.repeatedOutboxPairCount,
      outsideAllowedWindowCount: summary.outsideAllowedWindowCount,
      actualGmailSentMailboxAudited: summary.actualGmailSentMailboxAudited,
      gmailSendExecutedByThisRun: false,
      googleSheetsUpdatedByThisRun: false,
      liveRecoveryBatchReady: false
    },
    nextAction: 'Gmail送信を停止したまま、人間がApps ScriptログとGmail送信済みを照合し、正当送信/無効送信の最終分類を確認する。',
    safeToAct: false,
    notes: [
      'Gmail送信なし',
      'Google Sheets更新なし',
      'メールアドレス・営業先名・本文全文は記録しない',
      '2026-06-18 00:38-00:40 JSTの30件は時間外送信扱い'
    ]
  };
}

function writeSummaryDoc(filePath, summary) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `# Gmail Sales Incident Safe Summary - 2026-06-18

This report contains safe counts and irreversible hashes only. It does not contain email addresses, business names, URLs, reply text, or email body text.

## Scope

- From date: ${summary.fromDate}
- Outbox files audited: ${summary.outboxFileCount}
- Rows audited from local outboxes: ${summary.totalRowsAudited}
- Actual Gmail Sent mailbox audited: ${summary.actualGmailSentMailboxAudited ? 'yes' : 'no'}

## Findings

- Duplicate candidate identities across audited local outboxes: ${summary.duplicateAcrossOutboxes}
- Repeated or overlapping outbox pairs: ${summary.repeatedOutboxPairCount}
- 2026-06-18 00:38-00:40 JST incident rows classified as outside allowed window: ${summary.outsideAllowedWindowCount}

## Operating Decision

The system must remain blocked for live Gmail send until a human confirms the Apps Script logs and Gmail Sent mailbox against this safe audit. The 2026-06-18 incident rows are not counted as completed valid sales sends unless they pass that review.

## Pair Findings

${summary.pairFindings.length === 0 ? '- No overlapping pair detected in local outbox files.' : summary.pairFindings.map((item) => `- ${item.firstSendDate} -> ${item.secondSendDate}: overlap=${item.overlapCount}, exactRecipientSetMatch=${item.exactRecipientSetMatch}, exactContentSetMatch=${item.exactContentSetMatch}`).join('\n')}

## Safety

- Gmail send executed by this audit: false
- Google Sheets updated by this audit: false
- Apps Script triggers changed by this audit: false
- Private recipient data committed: false
`, 'utf8');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}
