import dns from "node:dns/promises";
import net from "node:net";

const VALID_TYPES = new Set(["none", "image", "video", "carousel"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/png"]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime"]);
const MAX_REDIRECTS = 3;

export async function validateThreadsMedia(media, options = {}) {
  const network = options.network === true;
  const timeoutMs = Number(options.timeoutMs || 7000);
  const normalized = normalizeMedia(media);
  const errors = [];
  const warnings = [];

  if (!VALID_TYPES.has(normalized.type)) errors.push("media_type_invalid");
  if (normalized.type === "none") {
    if (normalized.items.length) errors.push("none_media_must_not_have_items");
    return result(errors, warnings, normalized);
  }

  if (!normalized.items.length) errors.push("media_items_empty");
  if (normalized.type === "image" && normalized.items.length !== 1) errors.push("image_requires_one_item");
  if (normalized.type === "video" && normalized.items.length !== 1) errors.push("video_requires_one_item");
  if (normalized.type === "carousel" && (normalized.items.length < 2 || normalized.items.length > 10)) {
    errors.push("carousel_requires_2_to_10_items");
  }

  for (const [index, item] of normalized.items.entries()) {
    const itemErrors = await validateItem(item, normalized.type, { network, timeoutMs });
    errors.push(...itemErrors.map((error) => `item_${index}_${error}`));
  }

  return result(errors, warnings, normalized);
}

export function normalizeMedia(media) {
  if (!media || typeof media !== "object") return { type: "none", items: [] };
  const type = String(media.type || "none").toLowerCase();
  const items = Array.isArray(media.items)
    ? media.items.map((item) => ({
        url: String(item?.url || "").trim(),
        altText: String(item?.altText || item?.alt_text || "").trim(),
        mimeType: String(item?.mimeType || item?.contentType || "").trim().toLowerCase()
      }))
    : [];
  return { type, items };
}

export function summarizeMediaValidation(validation) {
  return {
    ok: validation.ok,
    mediaType: validation.media.type,
    itemCount: validation.media.items.length,
    errorCount: validation.errors.length,
    errors: validation.errors.slice(0, 10)
  };
}

async function validateItem(item, mediaType, options) {
  const errors = [];
  const urlCheck = validatePublicHttpsUrl(item.url);
  errors.push(...urlCheck.errors);
  if (!item.altText) errors.push("alt_text_missing");
  if (item.altText.length > 1000) errors.push("alt_text_too_long");

  const extension = extensionFromUrl(item.url);
  const effectiveType = mediaType === "carousel" ? inferItemType(item, extension) : mediaType;
  if (effectiveType === "image" && !IMAGE_EXTENSIONS.has(extension)) errors.push("image_extension_not_allowed");
  if (effectiveType === "video" && !VIDEO_EXTENSIONS.has(extension)) errors.push("video_extension_not_allowed");

  if (urlCheck.ok) {
    const ipErrors = await validateHostnameIsPublic(item.url);
    errors.push(...ipErrors);
  }

  if (options.network && errors.length === 0) {
    const networkErrors = await validateFetchableMedia(item.url, effectiveType, options.timeoutMs);
    errors.push(...networkErrors);
  }
  return errors;
}

function inferItemType(item, extension) {
  if (IMAGE_EXTENSIONS.has(extension) || IMAGE_MIME.has(item.mimeType)) return "image";
  if (VIDEO_EXTENSIONS.has(extension) || VIDEO_MIME.has(item.mimeType)) return "video";
  return "unknown";
}

function validatePublicHttpsUrl(value) {
  const errors = [];
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, errors: ["url_invalid"] };
  }
  if (parsed.protocol !== "https:") errors.push("url_must_be_https");
  if (!parsed.hostname) errors.push("hostname_missing");
  if (/localhost/i.test(parsed.hostname)) errors.push("localhost_rejected");
  if (parsed.username || parsed.password) errors.push("url_credentials_rejected");
  if (/(token|signature|x-amz-|secret|key|credential|expires|access_token)=/i.test(parsed.search)) {
    errors.push("signed_or_secret_url_rejected");
  }
  return { ok: errors.length === 0, errors };
}

async function validateHostnameIsPublic(value) {
  const parsed = new URL(value);
  const errors = [];
  const direct = net.isIP(parsed.hostname) ? [{ address: parsed.hostname }] : await safeLookup(parsed.hostname);
  if (!direct.length) return ["dns_lookup_failed"];
  for (const record of direct) {
    if (isPrivateAddress(record.address)) errors.push("private_ip_rejected");
  }
  return [...new Set(errors)];
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
  if (address === "0.0.0.0" || address === "::") return true;
  if (address === "169.254.169.254") return true;
  if (address.startsWith("127.") || address.startsWith("10.") || address.startsWith("169.254.")) return true;
  if (/^192\.168\./.test(address)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return true;
  if (address === "::1" || /^fc/i.test(address) || /^fd/i.test(address) || /^fe80:/i.test(address)) return true;
  return false;
}

async function validateFetchableMedia(url, mediaType, timeoutMs, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) return ["too_many_redirects"];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return ["redirect_location_missing"];
      return validateFetchableMedia(new URL(location, url).toString(), mediaType, timeoutMs, redirectCount + 1);
    }
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal });
    }
    if (!response.ok) return ["media_not_fetchable"];
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength === 0 && response.headers.has("content-length")) return ["media_empty"];
    if (mediaType === "image" && contentType && !IMAGE_MIME.has(contentType)) return ["image_mime_not_allowed"];
    if (mediaType === "video" && contentType && !VIDEO_MIME.has(contentType)) return ["video_mime_not_allowed"];
    if (mediaType === "unknown") return ["carousel_item_type_unknown"];
    return [];
  } catch {
    return ["media_fetch_failed"];
  } finally {
    clearTimeout(timeout);
  }
}

function extensionFromUrl(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const index = pathname.lastIndexOf(".");
    return index >= 0 ? pathname.slice(index) : "";
  } catch {
    return "";
  }
}

function result(errors, warnings, media) {
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings, media };
}
