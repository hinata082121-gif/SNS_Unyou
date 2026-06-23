#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { validateThreadsMedia } from "./lib/media-validation.mjs";
import { publishThread } from "./lib/threads-api-client.mjs";

loadLocalEnv();

const DEFAULT_PLAN = "docs/threads/post-plans/threads-post-plan-2026-06-week1.md";
const MAX_LENGTH = 500;

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/publish-scheduled-thread.mjs --slot 11|19 [--date YYYY-MM-DD] [--plan docs/threads/post-plans/file.md]\nPublishes text or enabled image posts only inside the slot window and when THREADS_PUBLISH_ENABLED=true and THREADS_DRY_RUN=false. Otherwise records blocked/dry-run status.");
  process.exit(0);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const slot = argValue("slot", "11");
const postDate = argValue("date", jstDate(0));
const planFile = argValue("plan", DEFAULT_PLAN);
const publishEnabled = process.env.THREADS_PUBLISH_ENABLED === "true";
const dryRun = process.env.THREADS_DRY_RUN !== "false";
const accessToken = process.env.THREADS_ACCESS_TOKEN || "";
const threadsUserId = process.env.THREADS_USER_ID || "";
const apiVersion = normalizeApiVersion(process.env.THREADS_API_VERSION || "v1.0");
const graphBaseUrl = normalizeBaseUrl(process.env.THREADS_GRAPH_BASE_URL || "https://graph.threads.net");
const mediaFeatureFlags = {
  media: process.env.THREADS_MEDIA_PUBLISH_ENABLED === "true",
  image: process.env.THREADS_IMAGE_PUBLISH_ENABLED === "true",
  video: process.env.THREADS_VIDEO_PUBLISH_ENABLED === "true",
  carousel: process.env.THREADS_CAROUSEL_PUBLISH_ENABLED === "true"
};
const hasToken = Boolean(accessToken);
const hasUserId = Boolean(threadsUserId);
const alreadyPublished = isAlreadyPublished({ postDate, slot });
const slotWindow = getSlotWindowStatus({ postDate, slot, now: getNow() });

const result = {
  ok: false,
  commandReached: true,
  slot,
  postDate,
  slotWindowStart: slotWindow.windowStart,
  slotWindowEnd: slotWindow.windowEnd,
  insideSlotWindow: slotWindow.inside,
  publishEnabled,
  dryRun,
  apiConfigured: hasToken && hasUserId,
  planEnsured: false,
  planGenerated: false,
  postPrepared: false,
  postValidated: false,
  mediaType: "none",
  mediaItemCount: 0,
  mediaValidated: false,
  mediaValidationErrorCount: 0,
  wouldPublish: false,
  published: false,
  compensationPostExecuted: false,
  blockedReason: "",
  postIdPresent: false,
  postIdHash: "",
  errorSummary: ""
};

if (alreadyPublished) {
  result.blockedReason = "already_published";
} else if (!slotWindow.inside) {
  result.ok = true;
  result.blockedReason = "outside_slot_window";
} else {
  const planEnsure = ensureDailyThreadsPlan({
    date: postDate,
    requiredSlots: ["11", "19"]
  });
  result.planEnsured = planEnsure.ok;
  result.planGenerated = planEnsure.generated;
  const draft = planEnsure.ok ? readDraft({ planFile, postDate, slot }) : {
    ok: false,
    text: "",
    blockedReason: planEnsure.blockedReason || "daily_plan_generation_failed"
  };
  result.postPrepared = Boolean(draft.text);
  result.postValidated = draft.ok;
  result.mediaType = draft.media?.type || "none";
  result.mediaItemCount = Array.isArray(draft.media?.items) ? draft.media.items.length : 0;
  const mediaValidation = draft.ok
    ? await validateThreadsMedia(draft.media, { network: publishEnabled && !dryRun })
    : { ok: true, errors: [], media: { type: "none", items: [] } };
  result.mediaValidated = draft.ok ? mediaValidation.ok : false;
  result.mediaValidationErrorCount = mediaValidation.errors.length;

  if (!draft.ok) {
    result.blockedReason = draft.blockedReason;
  } else if (!mediaValidation.ok) {
    result.blockedReason = "media_validation_failed";
  } else if (!isMediaPublishEnabled(draft.media, mediaFeatureFlags)) {
    result.blockedReason = `${draft.media?.type || "media"}_publish_disabled`;
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
    const publishResult = await publishThread({
      baseUrl: graphBaseUrl,
      apiVersion,
      userId: threadsUserId,
      accessToken,
      text: draft.text,
      media: draft.media,
      featureFlags: mediaFeatureFlags
    });
    result.ok = publishResult.ok;
    result.published = publishResult.published;
    result.postIdPresent = publishResult.postIdPresent;
    result.postIdHash = publishResult.postIdHash;
    result.blockedReason = publishResult.ok ? "" : "threads_api_publish_failed";
    result.errorSummary = publishResult.errorSummary;
  }
}

writeSafePublishLog(result);
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);

function readDraft({ planFile, postDate, slot }) {
  const jsonDraft = readJsonDraft({ postDate, slot });
  if (jsonDraft.ok || jsonDraft.blockedReason !== "json_plan_not_found") {
    return jsonDraft;
  }

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
  return { ok: true, text: draftText, media: { type: "none", items: [] }, blockedReason: "" };
}

function readJsonDraft({ postDate, slot }) {
  const fullPath = path.join(process.cwd(), "data", "threads", "post-plans", `${postDate}.json`);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, text: "", blockedReason: "json_plan_not_found" };
  }
  try {
    const plan = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const post = Array.isArray(plan.posts)
      ? plan.posts.find((item) => normalizeSlot(item.time) === slot)
      : null;
    if (!post) return { ok: false, text: "", blockedReason: "post_slot_not_found" };
    const draftText = [post.text, post.cta].filter(Boolean).join("\n\n").trim();
    if (!draftText) return { ok: false, text: "", blockedReason: "post_text_empty" };
    if (draftText.length > MAX_LENGTH) return { ok: false, text: "", blockedReason: "post_text_too_long" };
    return { ok: true, text: draftText, media: post.media || { type: "none", items: [] }, blockedReason: "" };
  } catch {
    return { ok: false, text: "", blockedReason: "generated_plan_invalid" };
  }
}

function ensureDailyThreadsPlan({ date, requiredSlots }) {
  const existing = inspectPlan({ date, requiredSlots });
  if (existing.ok) {
    return { ok: true, existed: true, generated: false, date, slotsPrepared: existing.slotsPrepared };
  }
  const generated = spawnSync("node", ["scripts/threads/create-daily-post-plan.mjs", date], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (generated.status !== 0) {
    return { ok: false, existed: false, generated: false, date, slotsPrepared: [], blockedReason: "daily_plan_generation_failed" };
  }
  const refreshed = inspectPlan({ date, requiredSlots });
  return refreshed.ok
    ? { ok: true, existed: false, generated: true, date, slotsPrepared: refreshed.slotsPrepared }
    : { ok: false, existed: false, generated: true, date, slotsPrepared: refreshed.slotsPrepared, blockedReason: "generated_plan_invalid" };
}

function inspectPlan({ date, requiredSlots }) {
  const fullPath = path.join(process.cwd(), "data", "threads", "post-plans", `${date}.json`);
  if (!fs.existsSync(fullPath)) return { ok: false, slotsPrepared: [] };
  try {
    const plan = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const slotsPrepared = Array.isArray(plan.posts)
      ? plan.posts.map((post) => normalizeSlot(post.time)).filter(Boolean)
      : [];
    return {
      ok: requiredSlots.every((requiredSlot) => slotsPrepared.includes(requiredSlot)),
      slotsPrepared
    };
  } catch {
    return { ok: false, slotsPrepared: [] };
  }
}

function normalizeSlot(value) {
  const match = String(value || "").match(/^(\d{1,2})(?::00)?$/);
  return match ? match[1].padStart(2, "0") : "";
}

function isAlreadyPublished({ postDate, slot }) {
  const logPath = path.join(process.cwd(), "data", "threads", "published", `${postDate}-${slot}.json`);
  if (!fs.existsSync(logPath)) return false;
  try {
    const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
    return log.published === true;
  } catch {
    return false;
  }
}

function getNow() {
  const override = String(process.env.THREADS_NOW_ISO || "").trim();
  return override ? new Date(override) : new Date();
}

function getSlotWindowStatus({ postDate, slot, now }) {
  const windows = {
    "11": ["10:55", "11:30"],
    "19": ["18:55", "19:30"]
  };
  const [start, end] = windows[slot] || ["00:00", "00:00"];
  const current = jstParts(now);
  const windowStart = `${postDate}T${start}:00+09:00`;
  const windowEnd = `${postDate}T${end}:00+09:00`;
  const currentMinutes = current.hour * 60 + current.minute;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return {
    windowStart,
    windowEnd,
    inside: current.date === postDate && currentMinutes >= startMinutes && currentMinutes <= endMinutes
  };
}

function jstParts(value) {
  const date = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return {
    date: date.toISOString().slice(0, 10),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

function findSection(source, heading, nextHeadingPattern) {
  const start = source.indexOf(heading);
  if (start < 0) return "";
  const rest = source.slice(start + heading.length);
  const next = rest.search(nextHeadingPattern);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function writeSafePublishLog(value) {
  const safe = {
    ok: value.ok,
    commandReached: value.commandReached,
    slot: value.slot,
    postDate: value.postDate,
    publishEnabled: value.publishEnabled,
    dryRun: value.dryRun,
    insideSlotWindow: value.insideSlotWindow,
    apiConfigured: value.apiConfigured,
    planEnsured: value.planEnsured,
    planGenerated: value.planGenerated,
    postPrepared: value.postPrepared,
    postValidated: value.postValidated,
    mediaType: value.mediaType,
    mediaItemCount: value.mediaItemCount,
    mediaValidated: value.mediaValidated,
    mediaValidationErrorCount: value.mediaValidationErrorCount,
    wouldPublish: value.wouldPublish,
    published: value.published,
    compensationPostExecuted: value.compensationPostExecuted,
    blockedReason: value.blockedReason,
    postIdPresent: value.postIdPresent,
    postIdHash: value.postIdHash,
    errorSummary: value.errorSummary
  };
  const outDir = path.join(process.cwd(), "data", "threads", "published");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${value.postDate}-${value.slot}.json`),
    `${JSON.stringify(safe, null, 2)}\n`
  );
}

function jstDate(daysFromToday = 0) {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const base = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + daysFromToday
  ));
  return base.toISOString().slice(0, 10);
}

function normalizeApiVersion(value) {
  const clean = String(value || "v1.0").trim();
  return clean.startsWith("v") ? clean : `v${clean}`;
}

function normalizeBaseUrl(value) {
  return String(value || "https://graph.threads.net").trim().replace(/\/+$/, "");
}

function isMediaPublishEnabled(media, flags) {
  const type = String(media?.type || "none").toLowerCase();
  if (type === "none") return true;
  if (!flags.media) return false;
  if (type === "image") return flags.image;
  if (type === "video") return flags.video;
  if (type === "carousel") return flags.carousel;
  return false;
}
