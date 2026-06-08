import { spawnSync } from 'node:child_process';
import { parseArgs } from './pool-utils.mjs';

function printHelp() {
  console.log(`Usage: node scripts/gmail/post-send-agent-office-sync.mjs [record-daily-send-result args...]

Records safe Gmail send result metadata, then runs Agent Status validation/render, Agent Office render, lint, and build. Does not send email, update Sheets, operate Apps Script triggers, or run git add/commit/push.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

run('node', ['scripts/gmail/record-daily-send-result.mjs', ...process.argv.slice(2)]);
run('npm', ['run', 'agent:status:validate']);
run('npm', ['run', 'agent:status:render']);
run('npm', ['run', 'agent:office:render']);
run('npm', ['run', 'lint']);
run('npm', ['run', 'build']);

console.log(JSON.stringify({
  postSendAgentOfficeSync: true,
  emailSentByThisScript: false,
  sheetUpdatedByThisScript: false,
  appsScriptTriggerChangedByThisScript: false,
  gitMutatedByThisScript: false
}, null, 2));

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
