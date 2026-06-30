# Gmail Grounded Official Source Discovery

Date: 2026-07-01

This note documents the Gemini Grounded Search step for Gmail Sales contact-basis automation.

## Purpose

Official evidence enrichment cannot run when a candidate has no source reference or official domain. The grounded source discovery step searches only for official public source URLs and writes only source-reference metadata for rows that are already in the replenishment queue.

It does not change send authority, send limits, manifest/state gates, suppression checks, history checks, or the `MailApp.sendEmail` call site.

## Public Functions

- `inspectGmailSalesGroundedOfficialSourceDiscoveryStatus`
  - Read-only aggregate status.
  - Reports configuration presence, queue counts, last-run counts, budget state, and next action.
  - Does not expose URLs, business names, emails, prompts, API keys, or hashes.

- `runGmailSalesGroundedOfficialSourceDiscoveryOnce`
  - Requires `LIVE_SEND_ENABLED=false` and `AUTO_SEND_ENABLED=false`.
  - Requires Gemini provider configuration.
  - Uses `UrlFetchApp.fetch` with the API key in `x-goog-api-key`, not in the URL.
  - Uses Google Search grounding and accepts only citation-derived URLs.
  - Processes at most 10 candidates per run and at most 30 search requests per day.
  - Writes `sourceReference`, `sourceReferenceHash`, `sourceType`, and aggregate-safe audit metadata.
  - Updates replenishment queue status for discovered or missing sources.

## Safety Gates

Accepted source URLs must be:

- citation-backed
- `http` or `https`
- non-localhost
- non-private IP
- non-shortener
- non-social
- non-directory/maps
- non-recruiting
- non-press-release
- above the official confidence threshold
- matched by model-declared business identity
- free of risk flags

The model response body alone is not trusted for URLs. URLs are accepted only from grounding citation fields.

## Control Loop Order

During the AI verification phase:

1. refresh contact-basis review queue
2. run grounded official source discovery
3. run official evidence enrichment
4. run AI contact-basis verification

If grounded discovery is blocked by missing provider configuration, the phase stops fail-closed before enrichment or AI verification.

## Production Steps

1. Replace Apps Script `Code.gs` with the latest local version.
2. Save.
3. Confirm safe rest.
4. Confirm Gemini provider configuration.
5. Run `inspectGmailSalesGroundedOfficialSourceDiscoveryStatus`.
6. If eligible targets exist, run `runGmailSalesGroundedOfficialSourceDiscoveryOnce` once.
7. Re-run the inspector.
8. Continue to official evidence enrichment only when the next action allows it.

Do not run the send authority as part of this repair step.
