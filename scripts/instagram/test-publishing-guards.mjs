#!/usr/bin/env node
import { validateInstagramMedia, validateScheduledPost } from "./lib/instagram-publishing-utils.mjs";

const basePost = {
  id: "test-instagram-post",
  platform: "instagram",
  sequence: 99,
  format: "image",
  title: "Guard test",
  caption: "Safe caption",
  hashtags: ["#SNS運用"],
  altText: "Safe alt text",
  media: {
    items: [{
      publicUrl: "https://example.com/social-media/test.png",
      mimeType: "image/png",
      width: 1080,
      height: 1350,
      order: 1,
      altText: "Safe image alt text",
    }],
  },
  scheduledAt: new Date().toISOString(),
  timezone: "Asia/Tokyo",
  crossPost: { enabled: false },
  approvalStatus: "approved",
  publishStatus: "ready",
  approvalChecksum: "",
};

const disabledEnv = {
  INSTAGRAM_PUBLISH_ENABLED: "false",
  INSTAGRAM_DRY_RUN: "true",
  INSTAGRAM_IMAGE_PUBLISH_ENABLED: "false",
  INSTAGRAM_CAROUSEL_PUBLISH_ENABLED: "false",
  INSTAGRAM_REELS_PUBLISH_ENABLED: "false",
};

const featureFlagValidation = await validateScheduledPost(basePost, {
  env: disabledEnv,
  history: { entries: [] },
  network: false,
});
const invalidUrlValidation = await validateInstagramMedia({
  items: [{
    publicUrl: "http://localhost/private.png",
    mimeType: "image/png",
    altText: "invalid",
  }],
}, "image", { network: false });
const duplicateValidation = await validateScheduledPost(basePost, {
  env: {
    INSTAGRAM_PUBLISH_ENABLED: "true",
    INSTAGRAM_DRY_RUN: "false",
    INSTAGRAM_IMAGE_PUBLISH_ENABLED: "true",
    INSTAGRAM_USER_ID: "configured",
    INSTAGRAM_ACCESS_TOKEN: "configured",
    INSTAGRAM_GRAPH_API_VERSION: "v19.0",
  },
  history: { entries: [{ id: "test-instagram-post", published: true }] },
  network: false,
});
const approvalValidation = await validateScheduledPost({
  ...basePost,
  approvalStatus: "needs_human_review",
}, {
  env: {
    INSTAGRAM_PUBLISH_ENABLED: "true",
    INSTAGRAM_DRY_RUN: "false",
    INSTAGRAM_IMAGE_PUBLISH_ENABLED: "true",
    INSTAGRAM_USER_ID: "configured",
    INSTAGRAM_ACCESS_TOKEN: "configured",
    INSTAGRAM_GRAPH_API_VERSION: "v19.0",
  },
  history: { entries: [] },
  network: false,
});

const checks = {
  featureFlagFalseBlocks: featureFlagValidation.errors.includes("instagram_publish_disabled"),
  dryRunBlocks: featureFlagValidation.errors.includes("instagram_dry_run_enabled"),
  approvalRequiredCovered: approvalValidation.errors.includes("approval_required"),
  invalidMediaUrlRejected: invalidUrlValidation.errors.some((error) => error.includes("localhost_rejected") || error.includes("url_must_be_https")),
  duplicatePublishBlocked: duplicateValidation.errors.includes("duplicate_publish_history"),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  ok,
  ...checks,
  livePublishExecuted: false,
  threadsLivePostExecuted: false,
}, null, 2));
process.exit(ok ? 0 : 1);
