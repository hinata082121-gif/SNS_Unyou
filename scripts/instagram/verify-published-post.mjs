#!/usr/bin/env node
import { findPost, loadScheduledPosts } from "./lib/instagram-publishing-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/verify-published-post.mjs --id <post-id>\nPrints a safe publish verification summary without calling Instagram APIs.");
  process.exit(0);
}

const id = argValue("id");
const plan = loadScheduledPosts();
const post = findPost(plan, id);
const verified = Boolean(post?.publishStatus === "published" && post?.safePublishedMediaIdHash);
console.log(JSON.stringify({
  ok: Boolean(post),
  id: id || "",
  publishStatus: post?.publishStatus || "",
  publishedAtPresent: Boolean(post?.publishedAt),
  safePublishedMediaIdHashPresent: Boolean(post?.safePublishedMediaIdHash),
  verified,
  livePublishExecuted: false,
}, null, 2));
process.exit(post ? 0 : 1);

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
