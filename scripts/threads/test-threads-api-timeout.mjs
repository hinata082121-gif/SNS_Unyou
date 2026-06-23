#!/usr/bin/env node
import assert from "node:assert/strict";

process.env.THREADS_API_TIMEOUT_MS = "50";
const { publishThread } = await import("./lib/threads-api-client.mjs");

let fetchCallCount = 0;
globalThis.fetch = (_url, options) => {
  fetchCallCount += 1;
  return new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
};

const result = await publishThread({
  baseUrl: "https://example.invalid",
  apiVersion: "v1.0",
  userId: "synthetic-user",
  accessToken: "synthetic-token",
  text: "synthetic safe text",
  media: { type: "none", items: [] },
  featureFlags: { media: false, image: false, video: false, carousel: false }
});

assert.equal(result.ok, false);
assert.equal(result.blockedReason, "threads_api_timeout");
assert.equal(fetchCallCount, 1);

console.log(JSON.stringify({
  threadsApiTimeoutTestCount: 3,
  passed: true,
  fetchCallCount,
  blockedReason: result.blockedReason,
  retryCount: 0,
  realThreadsApiCallCount: 0
}));
