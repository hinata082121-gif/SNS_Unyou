#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { safeSummary } from '../gmail/pool-utils.mjs';

const taskDir = path.join('data', 'agent-status', 'tasks');
const records = [];

if (fs.existsSync(taskDir)) {
  for (const fileName of fs.readdirSync(taskDir)) {
    if (!/^sales-kpi-\d{4}-\d{2}-\d{2}\.json$/.test(fileName)) continue;
    try {
      const task = JSON.parse(fs.readFileSync(path.join(taskDir, fileName), 'utf8'));
      records.push(task.metrics || {});
    } catch {
      // Ignore malformed local records.
    }
  }
}

const totals = records.reduce((acc, item) => {
  for (const key of ['sentCount', 'replyCount', 'positiveReplyCount', 'neutralReplyCount', 'negativeReplyCount', 'optOutCount', 'autoReplyCount', 'meetingCount', 'wonCount']) {
    acc[key] += Number(item[key] || 0);
  }
  return acc;
}, {
  sentCount: 0,
  replyCount: 0,
  positiveReplyCount: 0,
  neutralReplyCount: 0,
  negativeReplyCount: 0,
  optOutCount: 0,
  autoReplyCount: 0,
  meetingCount: 0,
  wonCount: 0
});

console.log(safeSummary({
  ok: true,
  dayCount: records.length,
  ...totals,
  totalReplyRate: rate(totals.replyCount, totals.sentCount),
  positiveReplyRate: rate(totals.positiveReplyCount, totals.sentCount),
  meetingRate: rate(totals.meetingCount, totals.sentCount),
  salesConversionRate: rate(totals.wonCount, totals.sentCount),
  containsSensitiveData: false
}));

function rate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}
