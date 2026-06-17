import crypto from "node:crypto";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 180000;

export async function createImageContainer(options) {
  return createMediaContainer(options, {
    image_url: options.imageUrl,
    caption: options.caption,
    is_carousel_item: options.isCarouselItem ? "true" : "",
  });
}

export async function createCarouselItemContainer(options) {
  return createMediaContainer(options, {
    image_url: options.imageUrl,
    is_carousel_item: "true",
  });
}

export async function createCarouselContainer(options) {
  return createMediaContainer(options, {
    media_type: "CAROUSEL",
    children: options.children.join(","),
    caption: options.caption,
  });
}

export async function createReelContainer(options) {
  return createMediaContainer(options, {
    media_type: "REELS",
    video_url: options.videoUrl,
    caption: options.caption,
  });
}

export async function getContainerStatus({ baseUrl, apiVersion, containerId, accessToken, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const url = `${normalizeBaseUrl(baseUrl)}/${normalizeApiVersion(apiVersion)}/${encodeURIComponent(containerId)}?fields=status_code,status`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  }, timeoutMs);
  const body = await safeJson(response);
  return {
    ok: response.ok,
    httpStatus: response.status,
    statusCode: String(body.status_code || body.status || ""),
    retryable: response.status >= 500 || response.status === 429,
    errorSummary: response.ok ? "" : safeErrorSummary(response.status, body),
  };
}

export async function waitForContainerReady(options) {
  const startedAt = Date.now();
  const maxWaitMs = Number(options.maxWaitMs || DEFAULT_MAX_WAIT_MS);
  const pollIntervalMs = Number(options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
  let lastStatus = null;

  while (Date.now() - startedAt <= maxWaitMs) {
    lastStatus = await getContainerStatus(options);
    if (["FINISHED", "READY", "PUBLISHED"].includes(lastStatus.statusCode)) {
      return { ok: true, ready: true, attemptsDurationMs: Date.now() - startedAt, lastStatus };
    }
    if (["ERROR", "EXPIRED"].includes(lastStatus.statusCode)) {
      return { ok: false, ready: false, attemptsDurationMs: Date.now() - startedAt, lastStatus };
    }
    await delay(pollIntervalMs);
  }

  return { ok: false, ready: false, attemptsDurationMs: Date.now() - startedAt, lastStatus };
}

export async function publishContainer({ baseUrl, apiVersion, userId, containerId, accessToken, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const body = new URLSearchParams();
  body.set("creation_id", containerId);
  body.set("access_token", accessToken);
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(baseUrl)}/${normalizeApiVersion(apiVersion)}/${encodeURIComponent(userId)}/media_publish`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    timeoutMs,
  );
  const json = await safeJson(response);
  const mediaId = String(json.id || "");
  return {
    ok: response.ok && Boolean(mediaId),
    published: response.ok && Boolean(mediaId),
    httpStatus: response.status,
    safePublishedMediaIdHash: mediaId ? hashValue(mediaId) : "",
    mediaIdPresent: Boolean(mediaId),
    retryable: response.status >= 500 || response.status === 429,
    errorSummary: response.ok ? "" : safeErrorSummary(response.status, json),
  };
}

export function getPublishedMediaSafeSummary(result) {
  return {
    ok: Boolean(result?.ok),
    published: Boolean(result?.published),
    mediaIdPresent: Boolean(result?.mediaIdPresent),
    safePublishedMediaIdHash: result?.safePublishedMediaIdHash || "",
    httpStatus: result?.httpStatus || 0,
    retryable: Boolean(result?.retryable),
    errorSummary: result?.errorSummary || "",
  };
}

async function createMediaContainer({ baseUrl, apiVersion, userId, accessToken, timeoutMs = DEFAULT_TIMEOUT_MS }, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  }
  body.set("access_token", accessToken);
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(baseUrl)}/${normalizeApiVersion(apiVersion)}/${encodeURIComponent(userId)}/media`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    timeoutMs,
  );
  const json = await safeJson(response);
  const containerId = String(json.id || "");
  return {
    ok: response.ok && Boolean(containerId),
    containerIdPresent: Boolean(containerId),
    containerId,
    containerIdHash: containerId ? hashValue(containerId) : "",
    httpStatus: response.status,
    retryable: response.status >= 500 || response.status === 429,
    errorSummary: response.ok ? "" : safeErrorSummary(response.status, json),
  };
}

export function normalizeApiVersion(value) {
  const clean = String(value || "v19.0").trim();
  return clean.startsWith("v") ? clean : `v${clean}`;
}

export function normalizeBaseUrl(value) {
  return String(value || "https://graph.facebook.com").trim().replace(/\/+$/, "");
}

export function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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
  const error = body?.error || {};
  return JSON.stringify({
    status,
    code: error.code || body?.code || "",
    subcode: error.error_subcode || error.subcode || "",
    type: error.type || body?.type || "",
    message: String(error.message || body?.message || "").slice(0, 140),
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
