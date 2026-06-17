#!/usr/bin/env node
import { computeApprovalChecksum, findPost, loadScheduledPosts, saveScheduledPosts } from "./lib/instagram-publishing-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/approve-post.mjs --id <post-id>\nMarks a scheduled Instagram post as human-approved without publishing.");
  process.exit(0);
}

const id = argValue("id");
const plan = loadScheduledPosts();
const post = findPost(plan, id);
if (!post) {
  console.log(JSON.stringify({ ok: false, id, blockedReason: "post_not_found", livePublishExecuted: false }, null, 2));
  process.exit(1);
}

post.approvalStatus = "approved";
post.publishStatus = "ready";
post.approvedAt = new Date().toISOString();
post.approvedBy = "human";
post.approvalChecksum = computeApprovalChecksum(post);
post.updatedAt = new Date().toISOString();
saveScheduledPosts(plan);

console.log(JSON.stringify({
  ok: true,
  id,
  approvalStatus: post.approvalStatus,
  publishStatus: post.publishStatus,
  checksumSaved: true,
  livePublishExecuted: false,
}, null, 2));

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
