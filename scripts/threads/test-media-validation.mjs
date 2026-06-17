#!/usr/bin/env node
import { validateThreadsMedia } from "./lib/media-validation.mjs";

const cases = [
  {
    name: "valid_image_metadata",
    media: {
      type: "image",
      items: [{ url: "https://example.com/sample.jpg", altText: "SNSチェック項目の図解" }]
    },
    ok: true
  },
  {
    name: "localhost_rejected",
    media: {
      type: "image",
      items: [{ url: "https://localhost/sample.jpg", altText: "ローカル画像" }]
    },
    ok: false
  },
  {
    name: "private_ip_rejected",
    media: {
      type: "image",
      items: [{ url: "https://192.168.0.10/sample.jpg", altText: "ローカル画像" }]
    },
    ok: false
  },
  {
    name: "file_url_rejected",
    media: {
      type: "image",
      items: [{ url: "file:///C:/tmp/sample.jpg", altText: "ローカル画像" }]
    },
    ok: false
  },
  {
    name: "extension_mismatch_rejected",
    media: {
      type: "image",
      items: [{ url: "https://example.com/sample.txt", altText: "テキスト" }]
    },
    ok: false
  },
  {
    name: "alt_text_required",
    media: {
      type: "image",
      items: [{ url: "https://example.com/sample.jpg", altText: "" }]
    },
    ok: false
  }
];

const results = [];
for (const testCase of cases) {
  const validation = await validateThreadsMedia(testCase.media, { network: false });
  results.push({
    name: testCase.name,
    expectedOk: testCase.ok,
    actualOk: validation.ok,
    passed: validation.ok === testCase.ok,
    errorCount: validation.errors.length
  });
}

const failed = results.filter((item) => !item.passed);
console.log(JSON.stringify({
  ok: failed.length === 0,
  caseCount: results.length,
  failedCount: failed.length,
  results,
  sensitiveDataLogged: false
}, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
