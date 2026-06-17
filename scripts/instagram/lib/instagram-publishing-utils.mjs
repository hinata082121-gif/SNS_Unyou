import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export const ROOT = process.cwd();
export const POSTS_PATH = path.join(ROOT, "data", "instagram", "publishing", "scheduled-posts.json");
export const HISTORY_PATH = path.join(ROOT, "data", "instagram", "publishing", "publish-history.json");

const VALID_FORMATS = new Set(["image", "carousel", "reel"]);
const VALID_APPROVAL = new Set(["needs_human_review", "approved"]);
const VALID_PUBLISH = new Set(["draft", "ready", "blocked", "published", "published_manual", "failed"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/png"]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime"]);

export function loadScheduledPosts(filePath = POSTS_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveScheduledPosts(plan, filePath = POSTS_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

export function loadPublishHistory(filePath = HISTORY_PATH) {
  if (!fs.existsSync(filePath)) return { schemaVersion: "instagram-publish-history-v1", entries: [] };
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function savePublishHistory(history, filePath = HISTORY_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

export function findPost(plan, id) {
  return Array.isArray(plan.posts) ? plan.posts.find((post) => post.id === id) : null;
}

export function computeApprovalChecksum(post) {
  const stable = {
    id: post.id,
    format: post.format,
    title: post.title,
    caption: post.caption,
    hashtags: post.hashtags,
    media: post.media,
    crossPost: post.crossPost,
  };
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function validateScheduledPost(post, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const env = options.env || process.env;
  const history = options.history || loadPublishHistory();
  const errors = [];
  const warnings = [];

  if (!post || typeof post !== "object") errors.push("post_missing");
  if (!post?.id) errors.push("id_missing");
  if (post?.platform !== "instagram") errors.push("platform_must_be_instagram");
  if (!VALID_FORMATS.has(post?.format)) errors.push("format_invalid");
  if (!String(post?.caption || "").trim()) errors.push("caption_missing");
  if (!Array.isArray(post?.hashtags)) errors.push("hashtags_missing");
  if (!String(post?.altText || "").trim()) warnings.push("post_alt_text_missing");
  if (!VALID_APPROVAL.has(post?.approvalStatus)) errors.push("approval_status_invalid");
  if (!VALID_PUBLISH.has(post?.publishStatus)) errors.push("publish_status_invalid");
  if (post?.approvalStatus !== "approved") errors.push("approval_required");
  if (post?.publishStatus !== "ready") errors.push("publish_status_not_ready");
  if (post?.approvalChecksum && post.approvalChecksum !== computeApprovalChecksum(post)) {
    errors.push("approval_checksum_mismatch");
  }
  if (history.entries?.some((entry) => entry.id === post?.id && entry.published === true)) {
    errors.push("duplicate_publish_history");
  }
  if (!isPublishWindow(post?.scheduledAt, now, options.windowMinutes || 90)) {
    errors.push("outside_publish_window");
  }

  const mediaValidation = await validateInstagramMedia(post?.media, post?.format, {
    network: options.network === true,
  });
  errors.push(...mediaValidation.errors);
  warnings.push(...mediaValidation.warnings);

  const featureErrors = validateFeatureFlags(post, env);
  errors.push(...featureErrors);

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    media: mediaValidation.summary,
    safeToPublish: errors.length === 0,
  };
}

export async function validateInstagramMedia(media, format, options = {}) {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(media?.items) ? media.items : [];
  if (!items.length) errors.push("media_items_missing");
  if (format === "image" && items.length !== 1) errors.push("image_requires_one_item");
  if (format === "reel" && items.length !== 1) errors.push("reel_requires_one_item");
  if (format === "carousel" && (items.length < 2 || items.length > 10)) errors.push("carousel_requires_2_to_10_items");

  for (const [index, item] of items.entries()) {
    const prefix = `item_${index}`;
    if (!item.assetPath && !item.publicUrl) errors.push(`${prefix}_asset_or_public_url_missing`);
    if (!String(item.altText || "").trim()) errors.push(`${prefix}_alt_text_missing`);
    if (item.publicUrl) {
      const publicUrlErrors = await validatePublicMediaUrl(item.publicUrl, { network: options.network === true });
      errors.push(...publicUrlErrors.map((error) => `${prefix}_${error}`));
    } else {
      warnings.push(`${prefix}_public_url_missing`);
    }
    if (format === "reel" && !String(item.mimeType || "").startsWith("video/")) errors.push(`${prefix}_reel_requires_video`);
    if (format !== "reel" && item.mimeType && !IMAGE_MIME.has(String(item.mimeType).toLowerCase())) {
      errors.push(`${prefix}_image_mime_invalid`);
    }
    if (format === "reel" && item.mimeType && !VIDEO_MIME.has(String(item.mimeType).toLowerCase())) {
      errors.push(`${prefix}_video_mime_invalid`);
    }
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    summary: {
      itemCount: items.length,
      format,
      publicUrlCount: items.filter((item) => item.publicUrl).length,
      networkChecked: options.network === true,
    },
  };
}

export function validateFeatureFlags(post, env = process.env) {
  const errors = [];
  if (env.INSTAGRAM_PUBLISH_ENABLED !== "true") errors.push("instagram_publish_disabled");
  if (env.INSTAGRAM_DRY_RUN !== "false") errors.push("instagram_dry_run_enabled");
  if (post?.format === "image" && env.INSTAGRAM_IMAGE_PUBLISH_ENABLED !== "true") errors.push("instagram_image_publish_disabled");
  if (post?.format === "carousel" && env.INSTAGRAM_CAROUSEL_PUBLISH_ENABLED !== "true") errors.push("instagram_carousel_publish_disabled");
  if (post?.format === "reel" && env.INSTAGRAM_REELS_PUBLISH_ENABLED !== "true") errors.push("instagram_reels_publish_disabled");
  if (!env.INSTAGRAM_USER_ID) errors.push("instagram_user_id_missing");
  if (!env.INSTAGRAM_ACCESS_TOKEN) errors.push("instagram_access_token_missing");
  if (!env.INSTAGRAM_GRAPH_API_VERSION) errors.push("instagram_graph_api_version_missing");
  return errors;
}

export async function validatePublicMediaUrl(value, options = {}) {
  const errors = [];
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return ["url_invalid"];
  }
  if (parsed.protocol !== "https:") errors.push("url_must_be_https");
  if (/localhost/i.test(parsed.hostname)) errors.push("localhost_rejected");
  if (parsed.username || parsed.password) errors.push("url_credentials_rejected");
  if (/(token|signature|x-amz-|secret|key|credential|expires|access_token)=/i.test(parsed.search)) {
    errors.push("signed_or_secret_url_rejected");
  }
  const ips = net.isIP(parsed.hostname) ? [{ address: parsed.hostname }] : await safeLookup(parsed.hostname);
  if (!ips.length) errors.push("dns_lookup_failed");
  if (ips.some((record) => isPrivateAddress(record.address))) errors.push("private_ip_rejected");
  if (options.network === true && errors.length === 0) {
    const networkError = await fetchableMediaError(value);
    if (networkError) errors.push(networkError);
  }
  return [...new Set(errors)];
}

export function isPublishWindow(scheduledAt, now, windowMinutes) {
  if (!scheduledAt) return false;
  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  const diff = Math.abs(now.getTime() - scheduled.getTime());
  return diff <= windowMinutes * 60 * 1000;
}

async function fetchableMediaError(value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(value, { method: "HEAD", signal: controller.signal });
    if (!response.ok) return "media_not_fetchable";
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) return "content_type_invalid";
    return "";
  } catch {
    return "media_fetch_failed";
  } finally {
    clearTimeout(timeout);
  }
}

async function safeLookup(hostname) {
  try {
    return await dns.lookup(hostname, { all: true });
  } catch {
    return [];
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
