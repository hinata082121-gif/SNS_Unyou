#!/usr/bin/env node
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/meta/check-threads-publishing-readiness.mjs\nPrints safe Threads publishing readiness booleans without exposing environment values.");
  process.exit(0);
}

const env = process.env;
const configured = {
  threadsUserIdConfigured: Boolean(env.THREADS_USER_ID),
  accessTokenConfigured: Boolean(env.THREADS_ACCESS_TOKEN),
  threadsAppIdConfigured: Boolean(env.THREADS_APP_ID),
  threadsAppSecretConfigured: Boolean(env.THREADS_APP_SECRET),
  graphApiVersionConfigured: Boolean(env.THREADS_API_VERSION),
  publicMediaBaseUrlConfigured: Boolean(env.THREADS_PUBLIC_MEDIA_BASE_URL || env.INSTAGRAM_PUBLIC_MEDIA_BASE_URL),
};

const flags = {
  publishEnabled: env.THREADS_PUBLISH_ENABLED === "true",
  dryRun: env.THREADS_DRY_RUN !== "false",
  mediaPublishingEnabled: env.THREADS_MEDIA_PUBLISH_ENABLED === "true",
  imagePublishingEnabled: env.THREADS_IMAGE_PUBLISH_ENABLED === "true",
  videoPublishingEnabled: env.THREADS_VIDEO_PUBLISH_ENABLED === "true",
  carouselPublishingEnabled: env.THREADS_CAROUSEL_PUBLISH_ENABLED === "true",
};

const blockedReasons = [];
if (!configured.threadsUserIdConfigured) blockedReasons.push("threads_user_id_missing");
if (!configured.accessTokenConfigured) blockedReasons.push("threads_access_token_missing");
if (!configured.graphApiVersionConfigured) blockedReasons.push("threads_api_version_missing");
if (!configured.publicMediaBaseUrlConfigured) blockedReasons.push("public_media_base_url_missing");
if (!flags.publishEnabled) blockedReasons.push("threads_publish_disabled");
if (flags.dryRun) blockedReasons.push("threads_dry_run_enabled");

const readyForDryRun = configured.graphApiVersionConfigured;
const readyForLivePublish =
  readyForDryRun &&
  configured.threadsUserIdConfigured &&
  configured.accessTokenConfigured &&
  flags.publishEnabled &&
  !flags.dryRun;

console.log(JSON.stringify({
  ok: readyForDryRun,
  ...configured,
  ...flags,
  readyForDryRun,
  readyForLivePublish,
  blockedReasons,
  checkedSensitiveValues: false,
  livePublishExecuted: false,
}, null, 2));

process.exit(0);
