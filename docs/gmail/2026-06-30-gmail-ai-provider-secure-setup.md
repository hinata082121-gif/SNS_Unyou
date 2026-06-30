# Gmail AI Provider Secure Setup

Date: 2026-06-30

This document describes the secure setup path for AI provider settings when the Apps Script project has more than 50 Script Properties and the project settings UI cannot be used reliably.

## Why This Exists

The Gmail sales automation already installs non-secret AI defaults, but the provider, model, and API key still need to be configured. Because the Script Properties settings screen cannot handle the current property count, operators must not use that screen for this setup.

The setup path uses Apps Script UI / HTMLService and a one-time setup token. The Web App path can now create its own setup session, so operators no longer need to run a dialog function before opening `/exec`.

## Security Rules

- Do not paste an API key into `Code.gs`.
- Do not store an API key in Google Sheets.
- Do not print an API key to logs.
- Do not commit an API key to Git.
- Do not store the raw setup token in Script Properties.
- Do not run Gmail send functions from the setup UI.
- Do not run AI contact-basis verification from the setup UI.

Allowed setup outputs are aggregate flags only:

- provider configured
- model configured
- API key present
- daily request limit
- daily cost limit
- confidence threshold

## Setup Session

`createGmailSalesAiSetupSessionOnce` creates a setup session while safe-rest is active:

- stores only `GMAIL_SALES_AI_SETUP_TOKEN_DIGEST`
- stores `GMAIL_SALES_AI_SETUP_TOKEN_EXPIRES_AT`
- stores `GMAIL_SALES_AI_SETUP_TOKEN_USED=false`
- expires after 10 minutes
- can be used once

The raw token is used only inside the setup page/dialog. It is not logged and is not written to Sheets.

For the standalone Web App, `/exec` creates a fresh setup session during page rendering:

- no setup token is accepted from the URL
- no setup token is added to the URL
- the previous setup session is invalidated by a reload
- the raw token is injected only into the generated HTML page memory
- Script Properties keep only digest, expiry, used flag, and version metadata

If the bound dialog cannot open, the dialog path invalidates the newly created session and returns a fallback result. It does not leave a usable setup token behind.

## Setup UI

Bound Spreadsheet entry point:

1. Run `showGmailSalesAiProviderSetupDialog`.
2. If Spreadsheet UI is available, a modal setup dialog opens.
3. Enter provider, model, API key, request budget, cost budget, and confidence threshold.
4. Confirm and save.
5. The password input is cleared immediately after save.

Standalone fallback:

- `doGet` routes to the same AI setup page.
- Deploy the Web App for the executing user only.
- Do not allow anonymous access.
- Use HTTPS only.
- Open the Web App `/exec` URL directly.
- A valid setup token is created automatically when the page loads.
- Do not add any query parameter for setup tokens.
- If saving fails with a setup-session error, reload the page and retry with the new session.

## Saved Properties

`saveGmailSalesAiProviderConfiguration` validates the token and saves:

- `GMAIL_SALES_AI_ENABLED=true`
- `GMAIL_SALES_AI_PROVIDER`
- `GMAIL_SALES_AI_MODEL`
- `GMAIL_SALES_AI_API_KEY`
- `GMAIL_SALES_AI_MAX_DAILY_REQUESTS`
- `GMAIL_SALES_AI_MAX_DAILY_COST_YEN`
- `GMAIL_SALES_AI_CONFIDENCE_THRESHOLD`
- `GMAIL_SALES_AI_POLICY_VERSION=contact-basis-policy-v1`
- `GMAIL_SALES_AI_DATA_MINIMIZATION_MODE=strict`

It uses `setProperties(values, false)` and does not delete unrelated properties.

Safe blocked reasons returned by the save function include:

- `setup_token_missing`
- `setup_token_invalid`
- `setup_token_expired`
- `setup_token_already_used`
- `invalid_provider`
- `invalid_model`
- `invalid_api_key_format`
- `invalid_limits`
- `configuration_readback_failed`

## Updating Settings

Use the same setup UI to update provider/model/limits.

To keep the existing API key, check the keep-existing-key option and leave the API key field empty. The saved key is never displayed.

To replace the key, enter a new key during a fresh setup session.

## Disable or Delete

`disableGmailSalesAiVerificationOnce` sets:

- `GMAIL_SALES_AI_ENABLED=false`

It does not delete the API key.

`deleteGmailSalesAiApiKeyOnce` requires a valid setup token and clears the key separately. This prevents accidental key deletion.

## Verification

After saving:

1. Run `inspectGmailSalesAiProviderConfiguration`.
2. Confirm `configurationValid=true`.
3. Confirm `apiKeyPresent=true`.
4. Confirm the setup-session fields are safe:
   - `setupSessionActive=false`
   - `setupSessionUsed=true` after a successful save
5. Run `inspectGmailSalesAiContactBasisStatus`.
6. Confirm `aiEnabled=true`.
7. Confirm review schema and pending AI eligible counts are unchanged.

Then run `runGmailSalesAiContactBasisVerificationOnce` once. The setup UI does not change candidates, review rows, manifests, state, triggers, or send authority.

## Shortest Standalone Setup Steps

1. Reflect the latest `Code.gs` in Apps Script.
2. Deploy the Web App as a new version for the executing user only.
3. Open the Web App `/exec` URL.
4. Enter provider, model, API key, and limits.
5. Save once.
6. Run `inspectGmailSalesAiProviderConfiguration`.
7. Confirm the configuration and setup-session aggregate flags.
8. Run `inspectGmailSalesAiContactBasisStatus`.
9. Confirm `aiEnabled=true`.
10. Run `runGmailSalesAiContactBasisVerificationOnce` once.
