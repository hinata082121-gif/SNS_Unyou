#!/usr/bin/env node
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/meta/check-instagram-publishing-readiness.mjs\nPrints safe Instagram publishing readiness booleans without exposing environment values.");
  process.exit(0);
}

const env = process.env;

const flags = {
  publishEnabled: env.INSTAGRAM_PUBLISH_ENABLED === "true",
  dryRun: env.INSTAGRAM_DRY_RUN !== "false",
  imagePublishingEnabled: env.INSTAGRAM_IMAGE_PUBLISH_ENABLED === "true",
  carouselPublishingEnabled: env.INSTAGRAM_CAROUSEL_PUBLISH_ENABLED === "true",
  reelsPublishingEnabled: env.INSTAGRAM_REELS_PUBLISH_ENABLED === "true",
};

const configured = {
  professionalAccountConfigured: env.INSTAGRAM_PROFESSIONAL_ACCOUNT_CONFIGURED === "true",
  instagramUserIdConfigured: Boolean(env.INSTAGRAM_USER_ID),
  facebookPageIdConfigured: Boolean(env.INSTAGRAM_FACEBOOK_PAGE_ID),
  accessTokenConfigured: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
  appIdConfigured: Boolean(env.INSTAGRAM_APP_ID),
  appSecretConfigured: Boolean(env.INSTAGRAM_APP_SECRET),
  graphApiVersionConfigured: Boolean(env.INSTAGRAM_GRAPH_API_VERSION),
  publicMediaBaseUrlConfigured: Boolean(env.INSTAGRAM_PUBLIC_MEDIA_BASE_URL),
  accountModeKnown: Boolean(env.INSTAGRAM_ACCOUNT_MODE),
};

const blockedReasons = [];
if (!configured.professionalAccountConfigured) blockedReasons.push("instagram_professional_account_unconfirmed");
if (!configured.instagramUserIdConfigured) blockedReasons.push("instagram_user_id_missing");
if (!configured.accessTokenConfigured) blockedReasons.push("instagram_access_token_missing");
if (!configured.graphApiVersionConfigured) blockedReasons.push("graph_api_version_missing");
if (!configured.publicMediaBaseUrlConfigured) blockedReasons.push("public_media_base_url_missing");
if (!flags.publishEnabled) blockedReasons.push("instagram_publish_disabled");
if (flags.dryRun) blockedReasons.push("instagram_dry_run_enabled");

const readyForDryRun =
  configured.graphApiVersionConfigured &&
  configured.publicMediaBaseUrlConfigured;

const readyForLivePublish =
  readyForDryRun &&
  configured.professionalAccountConfigured &&
  configured.instagramUserIdConfigured &&
  configured.accessTokenConfigured &&
  flags.publishEnabled &&
  !flags.dryRun;

console.log(JSON.stringify({
  ok: readyForDryRun,
  ...configured,
  contentPublishPermissionExpected: true,
  ...flags,
  readyForDryRun,
  readyForLivePublish,
  blockedReasons,
  checkedSensitiveValues: false,
  livePublishExecuted: false,
}, null, 2));

process.exit(0);
