#!/usr/bin/env node
import dns from "node:dns/promises";
import net from "node:net";
import { loadInstagramPosts } from "./lib/instagram-content-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/validate-instagram-media.mjs [--network]\nValidates Instagram draft media metadata without publishing.");
  process.exit(0);
}

const network = process.argv.includes("--network");
const plan = loadInstagramPosts();
const posts = Array.isArray(plan.posts) ? plan.posts : [];
let mediaItemCount = 0;
let publicUrlMissingCount = 0;
let altTextMissingCount = 0;
let localAssetPathCount = 0;
let secretLikeUrlCount = 0;
let privateUrlRejectedCount = 0;
let fetchableCheckedCount = 0;
let fetchableErrorCount = 0;
let carouselItemCountMismatchCount = 0;

for (const post of posts) {
  const items = Array.isArray(post.media?.items) ? post.media.items : [];
  if (post.media?.type === "carousel" && items.length !== Number(post.slideCount)) {
    carouselItemCountMismatchCount += 1;
  }
  for (const item of items) {
    mediaItemCount += 1;
    if (!String(item.altText || "").trim()) altTextMissingCount += 1;
    if (String(item.assetPath || "").trim()) localAssetPathCount += 1;
    const publicUrl = String(item.publicUrl || "").trim();
    if (!publicUrl) {
      publicUrlMissingCount += 1;
      continue;
    }
    const urlCheck = await validatePublicUrl(publicUrl);
    if (urlCheck.secretLike) secretLikeUrlCount += 1;
    if (!urlCheck.public) privateUrlRejectedCount += 1;
    if (network && urlCheck.public) {
      fetchableCheckedCount += 1;
      const ok = await isFetchable(publicUrl);
      if (!ok) fetchableErrorCount += 1;
    }
  }
}

const summary = {
  ok: altTextMissingCount === 0 &&
    secretLikeUrlCount === 0 &&
    privateUrlRejectedCount === 0 &&
    fetchableErrorCount === 0 &&
    carouselItemCountMismatchCount === 0,
  publishReady: false,
  networkChecked: network,
  mediaItemCount,
  localAssetPathCount,
  publicUrlMissingCount,
  altTextMissingCount,
  secretLikeUrlCount,
  privateUrlRejectedCount,
  fetchableCheckedCount,
  fetchableErrorCount,
  carouselItemCountMismatchCount,
  livePublishExecuted: false
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

async function validatePublicUrl(value) {
  try {
    const parsed = new URL(value);
    const secretLike = /(token|signature|secret|key|credential|expires|access_token)=/i.test(parsed.search);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return { public: false, secretLike };
    }
    const records = net.isIP(parsed.hostname)
      ? [{ address: parsed.hostname }]
      : await dns.lookup(parsed.hostname, { all: true });
    return {
      public: records.every((record) => !isPrivateAddress(record.address)),
      secretLike
    };
  } catch {
    return { public: false, secretLike: false };
  }
}

function isPrivateAddress(address) {
  if (!address) return true;
  if (address === "0.0.0.0" || address === "::" || address === "169.254.169.254") return true;
  if (address.startsWith("127.") || address.startsWith("10.") || address.startsWith("169.254.")) return true;
  if (/^192\.168\./.test(address)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return true;
  if (address === "::1" || /^fc/i.test(address) || /^fd/i.test(address) || /^fe80:/i.test(address)) return true;
  return false;
}

async function isFetchable(value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(value, { method: "HEAD", signal: controller.signal });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    return response.ok && (contentType.startsWith("image/") || contentType.startsWith("video/"));
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
