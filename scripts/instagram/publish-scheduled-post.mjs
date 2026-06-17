#!/usr/bin/env node
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createImageContainer,
  createReelContainer,
  getPublishedMediaSafeSummary,
  normalizeApiVersion,
  publishContainer,
  waitForContainerReady,
} from "./lib/instagram-api-client.mjs";
import {
  findPost,
  loadPublishHistory,
  loadScheduledPosts,
  savePublishHistory,
  saveScheduledPosts,
  validateScheduledPost,
} from "./lib/instagram-publishing-utils.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/publish-scheduled-post.mjs --id <post-id> [--dry-run]\nRuns Instagram publish preflight and only publishes when all live flags and approvals are satisfied.");
  process.exit(0);
}

const id = argValue("id");
const forceDryRun = process.argv.includes("--dry-run");
const plan = loadScheduledPosts();
const history = loadPublishHistory();
const post = findPost(plan, id);
const validation = post
  ? await validateScheduledPost(post, { network: false, history })
  : { ok: false, errors: ["post_not_found"], warnings: [], media: {}, safeToPublish: false };

const dryRun = forceDryRun || process.env.INSTAGRAM_DRY_RUN !== "false";
const publishEnabled = process.env.INSTAGRAM_PUBLISH_ENABLED === "true";
const baseSummary = {
  id: id || "",
  format: post?.format || "",
  publishEnabled,
  dryRun,
  validationOk: validation.ok,
  safeToPublish: validation.safeToPublish && publishEnabled && !dryRun,
  validationErrorCount: validation.errors.length,
  validationErrors: validation.errors,
  livePublishExecuted: false,
};

if (!post || !validation.ok || !publishEnabled || dryRun) {
  const blockedReason = !post
    ? "post_not_found"
    : !validation.ok
      ? "preflight_failed"
      : !publishEnabled
        ? "instagram_publish_disabled"
        : "instagram_dry_run";
  console.log(JSON.stringify({ ok: !post ? false : true, ...baseSummary, blockedReason }, null, 2));
  process.exit(post ? 0 : 1);
}

const apiBase = process.env.INSTAGRAM_GRAPH_BASE_URL || "https://graph.facebook.com";
const apiVersion = normalizeApiVersion(process.env.INSTAGRAM_GRAPH_API_VERSION);
const common = {
  baseUrl: apiBase,
  apiVersion,
  userId: process.env.INSTAGRAM_USER_ID,
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
};

let creation;
if (post.format === "image") {
  creation = await createImageContainer({
    ...common,
    imageUrl: post.media.items[0].publicUrl,
    caption: buildCaption(post),
  });
} else if (post.format === "carousel") {
  const children = [];
  for (const item of post.media.items) {
    const child = await createCarouselItemContainer({ ...common, imageUrl: item.publicUrl });
    if (!child.ok) {
      console.log(JSON.stringify({ ok: false, ...baseSummary, blockedReason: "carousel_item_container_failed", containerIdHash: child.containerIdHash, errorSummary: child.errorSummary }, null, 2));
      process.exit(1);
    }
    children.push(child.containerId);
  }
  creation = await createCarouselContainer({ ...common, children, caption: buildCaption(post) });
} else if (post.format === "reel") {
  creation = await createReelContainer({
    ...common,
    videoUrl: post.media.items[0].publicUrl,
    caption: buildCaption(post),
  });
} else {
  console.log(JSON.stringify({ ok: false, ...baseSummary, blockedReason: "format_unsupported" }, null, 2));
  process.exit(1);
}

if (!creation.ok) {
  console.log(JSON.stringify({ ok: false, ...baseSummary, blockedReason: "container_create_failed", containerIdHash: creation.containerIdHash, errorSummary: creation.errorSummary }, null, 2));
  process.exit(1);
}

const ready = await waitForContainerReady({ ...common, containerId: creation.containerId });
if (!ready.ok) {
  console.log(JSON.stringify({ ok: false, ...baseSummary, blockedReason: "container_not_ready", containerIdHash: creation.containerIdHash, lastStatus: ready.lastStatus?.statusCode || "" }, null, 2));
  process.exit(1);
}

const published = await publishContainer({ ...common, containerId: creation.containerId });
const safeSummary = getPublishedMediaSafeSummary(published);
post.publishAttemptCount = Number(post.publishAttemptCount || 0) + 1;
post.updatedAt = new Date().toISOString();
if (published.ok) {
  post.publishStatus = "published";
  post.publishedAt = new Date().toISOString();
  post.safePublishedMediaIdHash = published.safePublishedMediaIdHash;
  post.retryAllowed = false;
}
history.entries.push({
  id: post.id,
  sequence: post.sequence,
  format: post.format,
  published: published.ok,
  publishedAt: post.publishedAt || "",
  safePublishedMediaIdHash: published.safePublishedMediaIdHash || "",
  retryAllowed: !published.ok,
  errorSummary: published.errorSummary || "",
});
saveScheduledPosts(plan);
savePublishHistory(history);

console.log(JSON.stringify({
  ok: published.ok,
  ...baseSummary,
  livePublishExecuted: published.ok,
  containerIdHash: creation.containerIdHash,
  published: published.published,
  result: safeSummary,
}, null, 2));
process.exit(published.ok ? 0 : 1);

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function buildCaption(post) {
  return [post.caption, ...(post.hashtags || [])].filter(Boolean).join("\n\n");
}
