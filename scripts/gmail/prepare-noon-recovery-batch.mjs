import {
  asRows,
  collectOutboxFiles,
  readJson,
  rowIdentity,
  summarizeOutboxFile,
  writeJson
} from './lib/gmail-safety-audit-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || '2026-06-18';
const poolFile = args.pool || 'data/gmail/pool/gmail-ready-candidate-pool.json';
const statusFile = args['status-file'] || 'data/agent-status/tasks/gmail-noon-recovery-2026-06-18.json';
const outboxDir = args['outbox-dir'] || 'data/gmail/outbox';
const fromDate = args.from || '2026-06-11';

const poolRows = asRows(readJson(poolFile, { candidates: [] }));
const usedFingerprints = new Set();
for (const file of collectOutboxFiles(outboxDir, fromDate)) {
  for (const fingerprint of summarizeOutboxFile(file).identityHashes) {
    usedFingerprints.add(fingerprint);
  }
}

let availableAfterIncidentExclusion = 0;
let invalidOrUnavailableCount = 0;
for (const row of poolRows) {
  const status = String(row.status || 'available').toLowerCase();
  if (status !== 'available') {
    invalidOrUnavailableCount += 1;
    continue;
  }
  const fingerprint = rowIdentity(row).fingerprint;
  if (!fingerprint || usedFingerprints.has(fingerprint)) {
    invalidOrUnavailableCount += 1;
    continue;
  }
  availableAfterIncidentExclusion += 1;
}

const readyForRecovery = availableAfterIncidentExclusion >= 30 && args['human-approved'] === true;
const task = {
  id: 'gmail-noon-recovery-2026-06-18',
  agent: 'Codex',
  avatar: 'ops-monitor',
  title: 'Gmail営業 2026-06-18 昼再開判定',
  category: 'gmail_send',
  status: readyForRecovery ? 'needs_review' : 'blocked',
  phase: readyForRecovery ? '候補数は足りるが人間承認待ち' : '事故監査未完了・昼再開停止',
  progress: readyForRecovery ? 80 : 60,
  priority: 'critical',
  createdAt: '2026-06-18T00:00:00.000+09:00',
  updatedAt: new Date().toISOString(),
  summary: '2026-06-18の昼再開可否を、事故以降のoutbox履歴を除外した安全件数だけで判定した。',
  artifacts: [
    'docs/gmail/gmail-sales-incident-response-2026-06-18.md',
    'docs/gmail/gmail-sales-safety-guard-runbook-2026-06-18.md'
  ],
  metrics: {
    targetDate,
    availableAfterIncidentExclusion,
    minimumRequired: 30,
    shortage: Math.max(0, 30 - availableAfterIncidentExclusion),
    humanApproved: args['human-approved'] === true,
    recoveryOutboxCreated: false,
    gmailSendExecutedByThisRun: false,
    googleSheetsUpdatedByThisRun: false,
    excludedHistoricalWindowFrom: fromDate
  },
  nextAction: readyForRecovery
    ? '人間が監査結果を確認し、明示承認後にだけ復旧用outboxを別途作成する。'
    : 'Gmail送信を停止したまま、事故監査と安全候補補充を完了する。',
  safeToAct: false,
  notes: [
    'このスクリプトは復旧用outbox/TSVを作成しない',
    'Gmail送信なし',
    'Google Sheets更新なし',
    '候補詳細・メールアドレス・営業先名は表示しない'
  ]
};

writeJson(statusFile, task);
console.log(JSON.stringify({
  targetDate,
  availableAfterIncidentExclusion,
  invalidOrUnavailableCount,
  recoveryOutboxCreated: false,
  statusFile
}, null, 2));

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
