#!/usr/bin/env node
import { findPost, loadScheduledPosts } from "./lib/instagram-publishing-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/prepare-threads-cross-post.mjs --id <instagram-post-id>\nPrepares safe Threads cross-post summary after Instagram success. Does not publish.");
  process.exit(0);
}

const id = argValue("id");
const plan = loadScheduledPosts();
const post = findPost(plan, id);
const crossPost = post?.crossPost || {};
const instagramSucceeded = post?.publishStatus === "published";
const enabled = crossPost.enabled === true;
const blockedReasons = [];
if (!post) blockedReasons.push("instagram_post_not_found");
if (!instagramSucceeded) blockedReasons.push("instagram_not_published");
if (!enabled) blockedReasons.push("cross_post_disabled");
if (crossPost.approvalStatus !== "approved") blockedReasons.push("threads_cross_post_approval_required");
if (crossPost.publishStatus !== "ready") blockedReasons.push("threads_cross_post_not_ready");
if (crossPost.mediaMode && crossPost.mediaMode !== "none" && process.env.THREADS_MEDIA_PUBLISH_ENABLED !== "true") {
  blockedReasons.push("threads_media_publish_disabled");
}

console.log(JSON.stringify({
  ok: blockedReasons.length === 0,
  instagramPostId: id || "",
  crossPostEnabled: enabled,
  instagramSucceeded,
  threadsSlot: crossPost.slot || "",
  mediaMode: crossPost.mediaMode || "none",
  approvalStatus: crossPost.approvalStatus || "",
  publishStatus: crossPost.publishStatus || "",
  blockedReasons,
  threadsLivePostExecuted: false,
}, null, 2));
process.exit(blockedReasons.length === 0 ? 0 : 1);

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
