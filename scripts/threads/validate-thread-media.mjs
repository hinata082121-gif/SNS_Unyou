#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateThreadsMedia, summarizeMediaValidation } from "./lib/media-validation.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/validate-thread-media.mjs --media-json path [--network]\nValidates Threads media metadata without publishing and without printing URLs.");
  process.exit(0);
}

const mediaJson = argValue("media-json", "");
const network = process.argv.includes("--network");
if (!mediaJson) {
  console.error(JSON.stringify({ ok: false, reason: "media_json_required" }));
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), mediaJson);
const media = JSON.parse(fs.readFileSync(fullPath, "utf8"));
const validation = await validateThreadsMedia(media, { network });
console.log(JSON.stringify({
  ...summarizeMediaValidation(validation),
  networkChecked: network,
  sensitiveDataLogged: false
}));
process.exit(validation.ok ? 0 : 1);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}
