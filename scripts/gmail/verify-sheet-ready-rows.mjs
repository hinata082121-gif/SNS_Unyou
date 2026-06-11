#!/usr/bin/env node
import { loadLocalEnv } from '../lib/load-local-env.mjs';
import { buildBatchId, parseArgs, resolveDateArg, safeSummary } from './pool-utils.mjs';

loadLocalEnv();

function printHelp() {
  console.log(`Usage: node scripts/gmail/verify-sheet-ready-rows.mjs [--date YYYY-MM-DD|today|tomorrow]

Records the expected ready-row verification target. Does not connect to Google Sheets or print secrets. Use Apps Script runPreflightDiagnosticsOnly() and runPreflightCheckOnly() for production verification.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const sendDate = resolveDateArg(args.date, 'tomorrow');
const sendBatchId = args['send-batch-id'] || buildBatchId(sendDate);
console.log(safeSummary({
  ok: true,
  sendDate,
  sendBatchId,
  expectedReadyRows: 30,
  sheetConnected: null,
  readyRowsVerified: false,
  verificationMethod: 'apps_script_preflight_required',
  nextAction: 'Run runPreflightDiagnosticsOnly() and runPreflightCheckOnly() after Sheet sync or manual paste.'
}));
