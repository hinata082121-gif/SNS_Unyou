import { validateThreadsMedia } from "./media-validation.mjs";

const DEFAULT_API_TIMEOUT_MS = 20000;

export async function publishThread({ baseUrl, apiVersion, userId, accessToken, text, media, featureFlags }) {
  const normalizedMedia = media && media.type && media.type !== "none" ? media : { type: "none", items: [] };
  const validation = await validateThreadsMedia(normalizedMedia, { network: normalizedMedia.type !== "none" });
  if (!validation.ok) {
    return failure("media_validation_failed", { mediaValidation: validation });
  }

  if (normalizedMedia.type === "none") {
    return publishContainer({ baseUrl, apiVersion, userId, accessToken, params: { media_type: "TEXT", text } });
  }
  if (normalizedMedia.type === "image") {
    if (!featureFlags.media || !featureFlags.image) return failure("image_publish_disabled");
    return publishContainer({
      baseUrl,
      apiVersion,
      userId,
      accessToken,
      params: {
        media_type: "IMAGE",
        text,
        image_url: normalizedMedia.items[0].url,
        alt_text: normalizedMedia.items[0].altText
      }
    });
  }
  if (normalizedMedia.type === "video") return failure("video_publish_unsupported_or_disabled");
  if (normalizedMedia.type === "carousel") return failure("carousel_publish_unsupported_or_disabled");
  return failure("media_type_unsupported");
}

async function publishContainer({ baseUrl, apiVersion, userId, accessToken, params }) {
  const createBody = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") createBody.set(key, String(value));
  }
  createBody.set("access_token", accessToken);
  const createResult = await fetchWithTimeout(`${baseUrl}/${apiVersion}/${encodeURIComponent(userId)}/threads`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: createBody
  }, apiTimeoutMs());
  if (createResult.timedOut) return failure("threads_api_timeout");
  const createResponse = createResult.response;
  const createJson = await safeJson(createResponse);
  const creationId = String(createJson.id || createJson.creation_id || "");
  if (!createResponse.ok || !creationId) {
    return failure("container_create_failed", {
      status: createResponse.status,
      errorSummary: safeErrorSummary(createResponse.status, createJson)
    });
  }

  const publishBody = new URLSearchParams();
  publishBody.set("creation_id", creationId);
  publishBody.set("access_token", accessToken);
  const publishResult = await fetchWithTimeout(`${baseUrl}/${apiVersion}/${encodeURIComponent(userId)}/threads_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: publishBody
  }, apiTimeoutMs());
  if (publishResult.timedOut) return failure("publish_status_unknown");
  const publishResponse = publishResult.response;
  const publishJson = await safeJson(publishResponse);
  const postId = String(publishJson.id || publishJson.thread_id || "");
  return {
    ok: publishResponse.ok && Boolean(postId),
    published: publishResponse.ok && Boolean(postId),
    postIdPresent: Boolean(postId),
    postIdHash: postId ? hashValue(postId) : "",
    blockedReason: publishResponse.ok && postId ? "" : "threads_api_publish_failed",
    errorSummary: publishResponse.ok ? "" : safeErrorSummary(publishResponse.status, publishJson)
  };
}

function failure(reason, extra = {}) {
  return {
    ok: false,
    published: false,
    postIdPresent: false,
    postIdHash: "",
    blockedReason: reason,
    errorSummary: reason,
    ...extra
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, timedOut: false };
  } catch (error) {
    if (error?.name === "AbortError") return { response: null, timedOut: true };
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function safeErrorSummary(status, body) {
  const error = body && body.error ? body.error : {};
  const code = error.code || body.code || "";
  const type = error.type || body.type || "";
  const message = String(error.message || body.message || "").slice(0, 120);
  return JSON.stringify({ status, code, type, message });
}

function hashValue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 12);
}

function apiTimeoutMs() {
  const value = Number(process.env.THREADS_API_TIMEOUT_MS || DEFAULT_API_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_API_TIMEOUT_MS;
}
