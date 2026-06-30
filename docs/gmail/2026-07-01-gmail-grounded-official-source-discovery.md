# Gmail Grounded Official Source Discovery

Date: 2026-07-01

This note documents the Gemini Grounded Search step for Gmail Sales contact-basis automation.

## Purpose

Official evidence enrichment cannot run when a candidate has no source reference or official domain. The grounded source discovery step searches only for official public source URLs and writes only source-reference metadata for rows that are already in the replenishment queue.

It does not change send authority, send limits, manifest/state gates, suppression checks, history checks, or the `MailApp.sendEmail` call site.

## P0.3.7 Identity Join Repair

The first production diagnostic showed `replenishmentQueueCount=66` but `eligibleDiscoveryTargetCount=0`. Gemini provider configuration was valid, and no Gemini request was attempted. The failure was before API dispatch: the replenishment queue was intentionally non-identifying, while grounded search needs a public business, brand, or service identity.

The repair keeps the queue non-identifying and resolves identity at runtime:

1. read replenishment queue rows
2. join to review rows by non-content identifiers
3. join to source rows from the review row
4. verify source digest still matches
5. extract public business identity from source/review aliases
6. build the search payload only for eligible rows

The queue, inspector, logs, and last-run summary do not store raw business names, emails, phone numbers, URLs, prompts, or source row contents.

## Runtime Join Keys

Join priority:

1. `sourceRowKey`
2. `reviewId`
3. `leadIdHash`
4. `sourceRowDigest`
5. `candidateToken`, only when it resolves uniquely to current Review data
6. existing compatible unique keys if present

Email address, business name, person name, and row number alone are not join keys.

## Public Identity Resolver

The resolver accepts existing source/review aliases for public identity:

- business/company/organization/corporate/operator/account/site-title names
- brand names
- service names
- Japanese company, brand, service, store, and organization headers

At least one of public business name, public brand name, or public service name is required. Industry, location, and domain hint may enrich the prompt but cannot make a row eligible by themselves.

Diagnostics distinguish join failures from true identity absence:

- `repair_source_identity_join` when review/source joins fail
- `refresh_review_queue` when source digests are stale
- `replenish_with_new_candidates` only when joins succeed but public identity is genuinely absent
- `run_source_discovery` when eligible targets exist

## P0.3.8 Queue Repair

Grounded discovery now repairs the evidence replenishment queue before attempting Gemini search:

- resolves canonical and legacy queue sheet names
- distinguishes physical queue rows from eligible discovery rows
- migrates old P0.3.5 headers without deleting rows
- normalizes legacy pending statuses
- rebuilds the queue from Review and Source when the queue is empty but Review still has `needs_more_evidence` rows
- deduplicates rebuilt rows by non-identifying stable keys

If no source reference has been applied and no evidence digest changed, `ready_for_ai_verification` is not returned.

## P0.3.9 Legacy Token-Only Queue Repair

Some legacy queues can contain 66 physical pending rows while still being unusable because every row has only a raw `candidateToken` and no stable key such as `sourceRowKey`, `reviewId`, `leadIdHash`, or `sourceRowDigest`.

Grounded discovery now detects that state as `repair_replenishment_queue`, rebuilds canonical rows from Review `needs_more_evidence` rows, replaces the legacy token-only queue rows, and continues the same run into grounded source discovery when the repair reads back successfully.

The run reports aggregate repair fields such as canonical rows built/applied, legacy rows replaced, resolvable join key counts before/after, and unresolved legacy row count. `googleSheetsUpdated=true` when the repair writes queue headers, schema, status, or canonical row data, even if no source reference has been applied yet.

## P0.3.10 Eligibility Snapshot

A production run showed the queue inspector reporting 66 resolvable rows while the discovery executor produced zero targets. The cause was divergent eligibility routing: `invalid_source_reference` rows were repair/rebuild eligible, but not allowed into grounded source discovery.

Grounded discovery now uses one shared eligibility snapshot for read-only inspectors and the executor. The snapshot includes physical, parsed, status-eligible, failure-reason-eligible, join-eligible, policy-eligible, identity-present, and final-eligible counts. Every excluded row increments an aggregate reason; a physical queue with zero final targets and empty exclusion reasons is invalid.

`invalid_source_reference` is a discovery-eligible reason. The invalid existing URL is not trusted, fetched, or included in the search payload. Discovery searches from public business identity only and writes back only citation-verified official URLs.

`candidateToken` resolution is unique-map based. A raw token is counted separately from a uniquely resolved token, ambiguous token, or unresolved token. If the snapshot reports resolved tokens but source join remains zero, the run blocks with `eligibility_snapshot_invariant_failed` before any Gemini request.

`replenishmentQueueCount` is now the final discovery-eligible count. Physical and intermediate counts are reported separately as `replenishmentQueuePhysicalCount`, `replenishmentQueueParsedCount`, `replenishmentQueueStatusEligibleCount`, `replenishmentQueueReasonEligibleCount`, `replenishmentQueueJoinEligibleCount`, and `replenishmentQueueFinalEligibleCount`.

## P0.3.11 Grounding Response Contract

Grounded Discovery now separates HTTP success from actual Google Search tool execution. `searchRequestSuccessCount` remains HTTP-oriented compatibility data; Google Search execution is measured with `googleSearchCallStepCount` and `googleSearchExecutedQueryCount`.

Requests explicitly set `store=false`, use the API key only in the `x-goog-api-key` header, and do not share `previous_interaction_id` across candidates.

The parser reads Interactions `steps` and extracts official-source candidates only from `model_output` text block `url_citation` annotations. Body-only URLs and search-result/suggestion URLs are not accepted. Snake_case and camelCase citation ranges are supported.

Discovery is blocked with `run_grounding_contract_probe` until `testGmailSalesGroundingResponseContractOnce` records a valid response contract. Queue repair/read-back failures also block before any Gemini candidate request.

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
6. Run `inspectGmailSalesEvidenceReplenishmentQueueStatus` if queue count, schema, or rebuild state is unclear.
7. Confirm `sourceJoinSucceededCount`, `publicBusinessIdentityPresentCount`, and `eligibleDiscoveryTargetCount`.
8. If `recommendedNextAction=run_source_discovery` or `rebuild_replenishment_queue`, run `runGmailSalesGroundedOfficialSourceDiscoveryOnce` once.
9. Re-run the inspector.
10. Continue to official evidence enrichment only when `sourceReferencesAppliedCount` is greater than zero.
11. Continue to AI contact-basis verification only after evidence enrichment changes evidence digests.

Do not run the send authority as part of this repair step.
