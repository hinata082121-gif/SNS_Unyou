#!/usr/bin/env node
import { loadInstagramBrand } from "./lib/instagram-content-utils.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/instagram/check-instagram-api-readiness.mjs\nPrints safe Instagram API readiness categories without reading secrets.");
  process.exit(0);
}

const brand = loadInstagramBrand();

const readiness = {
  ok: true,
  brandHandle: brand.handle,
  profileUrl: brand.profileUrl,
  livePublishExecuted: false,
  productionPublishImplemented: false,
  confirmedSupported: [
    "professional_account_access",
    "image_content_publishing",
    "carousel_content_publishing",
    "reels_content_publishing",
    "media_container_creation",
    "media_publish",
    "container_status_polling",
    "insights_for_professional_accounts"
  ],
  permissionRequired: [
    "instagram_basic_or_instagram_business_basic",
    "instagram_content_publish_or_instagram_business_content_publish",
    "pages_show_list_when_using_facebook_login",
    "pages_read_engagement_when_using_facebook_login"
  ],
  accountConfigurationRequired: [
    "instagram_professional_account",
    "business_or_creator_account",
    "facebook_page_connection_when_using_facebook_login",
    "meta_developer_app",
    "app_mode_and_review_matching_production_use"
  ],
  appReviewRequired: [
    "production_use_of_content_publish_permissions",
    "production_use_of_insights_or_comment_management_permissions"
  ],
  manualOnly: [
    "profile_text_change_in_this_repo",
    "bio_link_change_in_this_repo",
    "highlight_creation",
    "first_visual_design_approval"
  ],
  unknownNeedsReview: [
    "current_account_permission_state",
    "current_app_review_state",
    "current_token_lifetime",
    "current_page_connection_state",
    "stories_publishing_availability_for_this_account"
  ],
  implementationPolicy: {
    publishDefaultEnabled: false,
    dryRunDefault: true,
    browserAutomationAllowed: false,
    passwordAutomationAllowed: false,
    nonOfficialAutomationAllowed: false
  }
};

console.log(JSON.stringify(readiness, null, 2));
