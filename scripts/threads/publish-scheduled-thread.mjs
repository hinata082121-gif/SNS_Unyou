#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

const DEFAULT_PLAN = "docs/threads/post-plans/threads-post-plan-2026-06-week1.md";
const MAX_LENGTH = 500;

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/publish-scheduled-thread.mjs --slot 11|19 [--date YYYY-MM-DD] [--plan docs/threads/post-plans/file.md]\nPublishes text posts only when THREADS_PUBLISH_ENABLED=true and THREADS_DRY_RUN=false. Otherwise records blocked/dry-run status.");
  process.exit(0);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const slot = argValue("slot", "11");
const postDate = argValue("date", new Date().toISOString().slice(0, 10));
const planFile = argValue("plan", DEFAULT_PLAN);
const publishEnabled = process.env.THREADS_PUBLISH_ENABLED === "true";
const dryRun = process.env.THREADS_DRY_RUN !== "false";
const accessToken = process.env.THREADS_ACCESS_TOKEN || "";
const threadsUserId = process.env.THREADS_USER_ID || "";
const apiVersion = normalizeApiVersion(process.env.THREADS_API_VERSION || "v1.0");
const graphBaseUrl = normalizeBaseUrl(process.env.THREADS_GRAPH_BASE_URL || "https://graph.threads.net");
const hasToken = Boolean(accessToken);
const hasUserId = Boolean(threadsUserId);
const draft = readDraft({ planFile, postDate, slot });

const result = {
  ok: false,
  slot,
  postDate,
  publishEnabled,
  dryRun,
  apiConfigured: hasToken && hasUserId,
  postPrepared: Boolean(draft.text),
  postValidated: draft.ok,
  wouldPublish: false,
  published: false,
  blockedReason: "",
  postIdPresent: false,
  postIdHash: "",
  errorSummary: ""
};

if (!draft.ok) {
  result.blockedReason = draft.blockedReason;
} else if (!hasToken || !hasUserId) {
  result.blockedReason = "threads_api_not_configured";
} else if (!publishEnabled) {
  result.ok = true;
  result.wouldPublish = false;
  result.blockedReason = "publish_disabled";
} else if (dryRun) {
  result.ok = true;
  result.wouldPublish = true;
  result.blockedReason = "threads_dry_run";
} else {
  const publishResult = await publishTextThread({
    baseUrl: graphBaseUrl,
    apiVersion,
    userId: threadsUserId,
    accessToken,
    text: draft.text
  });
  result.ok = publishResult.ok;
  result.published = publishResult.published;
  result.postIdPresent = publishResult.postIdPresent;
  result.postIdHash = publishResult.postIdHash;
  result.blockedReason = publishResult.ok ? "" : "threads_api_publish_failed";
  result.errorSummary = publishResult.errorSummary;
}

writeSafePublishLog(result);
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);

function readDraft({ planFile, postDate, slot }) {
  const fullPath = path.resolve(process.cwd(), planFile);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, text: "", blockedReason: "plan_file_not_found" };
  }

  const text = fs.readFileSync(fullPath, "utf8");
  const daySection = findSection(text, `## ${postDate}`, /^## \d{4}-\d{2}-\d{2}/m);
  if (!daySection) {
    return { ok: false, text: "", blockedReason: "post_date_not_found" };
  }

  const slotSection = findSection(daySection, `### ${slot}:00`, /^### \d{2}:00/m);
  if (!slotSection) {
    return { ok: false, text: "", blockedReason: "post_slot_not_found" };
  }

  const match = slotSection.match(/- 投稿文案:\s*(.+)/);
  const draftText = match ? match[1].trim() : "";
  if (!draftText) {
    return { ok: false, text: "", blockedReason: "post_text_empty" };
  }
  if (draftText.length > MAX_LENGTH) {
    return { ok: false, text: "", blockedReason: "post_text_too_long" };
  }
  return { ok: true, text: draftText, blockedReason: "" };
}

function findSection(source, heading, nextHeadingPattern) {
  const start = source.indexOf(heading);
  if (start < 0) return "";
  const rest = source.slice(start + heading.length);
  const next = rest.search(nextHeadingPattern);
  return next >= 0 ? rest.slice(0, next) : rest;
}

async function publishTextThread({ baseUrl, apiVersion, userId, accessToken, text }) {
  try {
    const createBody = new URLSearchParams();
    createBody.set("media_type", "TEXT");
    createBody.set("text", text);
    createBody.set("access_token", accessToken);
    const createResponse = await fetch(`${baseUrl}/${apiVersion}/${encodeURIComponent(userId)}/threads`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: createBody
    });
    const createJson = await safeJson(createResponse);
    const creationId = String(createJson.id || createJson.creation_id || "");
    if (!createResponse.ok || !creationId) {
      return {
        ok: false,
        published: false,
        postIdPresent: false,
        postIdHash: "",
        errorSummary: safeErrorSummary(createResponse.status, createJson)
      };
    }

    const publishBody = new URLSearchParams();
    publishBody.set("creation_id", creationId);
    publishBody.set("access_token", accessToken);
    const publishResponse = await fetch(`${baseUrl}/${apiVersion}/${encodeURIComponent(userId)}/threads_publish`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: publishBody
    });
    const publishJson = await safeJson(publishResponse);
    const postId = String(publishJson.id || publishJson.thread_id || "");
    return {
      ok: publishResponse.ok && Boolean(postId),
      published: publishResponse.ok && Boolean(postId),
      postIdPresent: Boolean(postId),
      postIdHash: postId ? hashValue(postId) : "",
      errorSummary: publishResponse.ok ? "" : safeErrorSummary(publishResponse.status, publishJson)
    };
  } catch {
    return {
      ok: false,
      published: false,
      postIdPresent: false,
      postIdHash: "",
      errorSummary: "request_failed"
    };
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function safeErrorSummary(status, body) {
  const error = body && body.error ? body.error : {};
  const code = error.code || body.code || "";
  const type = error.type || body.type || "";
  const message = String(error.message || body.message || "").slice(0, 120);
  return JSON.stringify({ status, code, type, message });
}

function writeSafePublishLog(value) {
  const safe = {
    ok: value.ok,
    slot: value.slot,
    postDate: value.postDate,
    publishEnabled: value.publishEnabled,
    dryRun: value.dryRun,
    apiConfigured: value.apiConfigured,
    postPrepared: value.postPrepared,
    postValidated: value.postValidated,
    wouldPublish: value.wouldPublish,
    published: value.published,
    blockedReason: value.blockedReason,
    postIdPresent: value.postIdPresent,
    postIdHash: value.postIdHash,
    errorSummary: value.errorSummary
  };
  const outDir = path.join(process.cwd(), "data", "threads", "published");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${new Date().toISOString().slice(0, 10)}-${value.slot}.json`),
    `${JSON.stringify(safe, null, 2)}\n`
  );
}

function normalizeApiVersion(value) {
  const clean = String(value || "v1.0").trim();
  return clean.startsWith("v") ? clean : `v${clean}`;
}

function normalizeBaseUrl(value) {
  return String(value || "https://graph.threads.net").trim().replace(/\/+$/, "");
}

function hashValue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 12);
}
