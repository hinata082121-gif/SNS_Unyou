#!/usr/bin/env node
import { findPost, loadScheduledPosts, validateScheduledPost } from "./lib/instagram-publishing-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/prepare-scheduled-post.mjs [--id <post-id>]\nPrepares a safe summary for the next Instagram draft without publishing.");
  process.exit(0);
}

const id = argValue("id");
const plan = loadScheduledPosts();
const posts = Array.isArray(plan.posts) ? plan.posts : [];
const post = id ? findPost(plan, id) : posts.find((item) => item.publishStatus === "draft" || item.publishStatus === "ready");
const validation = post
  ? await validateScheduledPost(post, { network: false })
  : { ok: false, errors: ["post_not_found"], warnings: [], media: {}, safeToPublish: false };

console.log(JSON.stringify({
  ok: Boolean(post),
  id: post?.id || "",
  sequence: post?.sequence || 0,
  format: post?.format || "",
  approvalStatus: post?.approvalStatus || "",
  publishStatus: post?.publishStatus || "",
  validationOk: validation.ok,
  validationErrorCount: validation.errors.length,
  validationErrors: validation.errors,
  media: validation.media,
  livePublishExecuted: false,
}, null, 2));
process.exit(post ? 0 : 1);

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
