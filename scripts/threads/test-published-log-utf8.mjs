#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writePublishedLogAtomic } from "./lib/published-log-writer.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "threads-published-utf8-"));
const filePath = path.join(tmp, "2026-06-23-19.json");
const fixture = {
  ok: true,
  commandReached: true,
  slot: "19",
  postDate: "2026-06-23",
  publishEnabled: true,
  dryRun: false,
  insideSlotWindow: true,
  apiConfigured: true,
  planEnsured: true,
  planGenerated: false,
  postPrepared: true,
  postValidated: true,
  mediaType: "none",
  mediaItemCount: 0,
  contentPillar: "humor_and_aruaru",
  format: "shop_sns_aruaru",
  hookType: "relatable",
  targetIndustry: "業種共通",
  hasQuestion: false,
  hasCta: false,
  hasDirectSalesCta: false,
  textLengthBand: "target70To180",
  mediaValidated: true,
  mediaValidationErrorCount: 0,
  wouldPublish: true,
  published: true,
  compensationPostExecuted: false,
  blockedReason: "",
  postIdPresent: true,
  postIdHash: "redacted-test",
  errorSummary: "店舗SNSあるある / 普通の文→少しラフな文 / 飲食店 / 美容室 / 整体・サロン"
};

writePublishedLogAtomic(filePath, fixture);
const bytes = fs.readFileSync(filePath);
assert.notDeepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);

const nodeParsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
assert.equal(nodeParsed.targetIndustry, "業種共通");
assert.equal(nodeParsed.errorSummary.includes("普通の文→少しラフな文"), true);

const ps = spawnSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `$j=$null; $j = Get-Content -LiteralPath '${escapePowerShell(filePath)}' -Raw -Encoding UTF8 | ConvertFrom-Json; [pscustomobject]@{ parseSucceeded=($null -ne $j); targetIndustryMatches=($j.targetIndustry -eq '業種共通'); malformedJsonCount=0 } | ConvertTo-Json -Compress`
], { encoding: "utf8" });
assert.equal(ps.status, 0, ps.stderr || ps.stdout);
const psParsed = JSON.parse(ps.stdout);
assert.equal(psParsed.parseSucceeded, true);
assert.equal(psParsed.targetIndustryMatches, true);

const py = spawnSync("python", ["-c", [
  "import json,sys",
  "p=sys.argv[1]",
  "data=json.load(open(p, encoding='utf-8'))",
  "print(json.dumps({'parseSucceeded': True, 'targetIndustryMatches': data.get('targetIndustry') == '業種共通'}, ensure_ascii=True))"
].join(";"), filePath], { encoding: "utf8" });
assert.equal(py.status, 0, py.stderr || py.stdout);
const pyParsed = JSON.parse(py.stdout);
assert.equal(pyParsed.parseSucceeded, true);
assert.equal(pyParsed.targetIndustryMatches, true);

console.log(JSON.stringify({
  publishedLogUtf8TestCount: 10,
  passed: true,
  nodeJsonParseSucceeded: true,
  powershellConvertFromJsonSucceeded: true,
  pythonJsonLoadsSucceeded: true,
  japaneseExactMatch: true,
  hasBom: false,
  malformedJsonCount: 0,
  realThreadsApiCallCount: 0,
  realPostCount: 0
}));

function escapePowerShell(value) {
  return String(value).replace(/'/g, "''");
}
