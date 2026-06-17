#!/usr/bin/env node
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { findPost, loadScheduledPosts, loadPublishHistory, validateScheduledPost } from "./lib/instagram-publishing-utils.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/validate-scheduled-post.mjs --id <post-id> [--network]\nValidates an Instagram scheduled post without publishing.");
  process.exit(0);
}

const id = argValue("id");
const network = process.argv.includes("--network");
const plan = loadScheduledPosts();
const post = findPost(plan, id);
const validation = post
  ? await validateScheduledPost(post, { network, history: loadPublishHistory() })
  : { ok: false, errors: ["post_not_found"], warnings: [], media: {}, safeToPublish: false };

console.log(JSON.stringify({
  ok: validation.ok,
  id: id || "",
  format: post?.format || "",
  publishStatus: post?.publishStatus || "",
  approvalStatus: post?.approvalStatus || "",
  safeToPublish: validation.safeToPublish,
  media: validation.media,
  errorCount: validation.errors.length,
  errors: validation.errors,
  warningCount: validation.warnings.length,
  livePublishExecuted: false,
}, null, 2));
process.exit(validation.ok ? 0 : 1);

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
