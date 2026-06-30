# Gmail Evidence Replenishment Queue Repair

Date: 2026-07-01

This note documents P0.3.8 and P0.3.9, the repairs for the evidence replenishment queue being read as empty or physically present but unjoinable before grounded source discovery.

## Problem

Previous production runs showed 66 candidates written to `Gmail_Evidence_Replenishment_Queue`, but the later grounded discovery run reported:

- `replenishmentQueueCount=0`
- `eligibleDiscoveryTargetCount=0`
- `sourceReferencesAppliedCount=0`
- `recommendedNextAction=ready_for_ai_verification`

That state is inconsistent. No source references had been applied and no new evidence existed, so AI verification was not actually ready.

## Fix

The repair separates physical queue diagnostics from eligible discovery targets.

Added read-only inspector:

- `inspectGmailSalesEvidenceReplenishmentQueueStatus`

It reports only aggregate and non-identifying values:

- queue sheet resolution
- header/schema validity
- physical row count
- parsed row count
- normalized status counts
- failure reason counts
- join-key presence counts
- Review `needs_more_evidence` rebuild eligibility
- recommended next action

It does not output company names, emails, URLs, candidate tokens, source row keys, review IDs, lead hashes, or evidence text.

P0.3.9 adds a second distinction: a raw `candidateToken` is not treated as a resolvable join key unless it maps uniquely to current Review data. Legacy rows that have only raw candidate tokens are considered functionally broken even when the queue has 66 physical rows.

Additional aggregate diagnostics:

- raw candidate token row count
- stable join key row count
- resolvable candidate token row count
- resolvable join key row count
- unresolvable candidate token row count
- canonical rebuild required row count

## Sheet Resolution

Queue sheet resolution now checks:

1. canonical name `Gmail_Evidence_Replenishment_Queue`
2. known legacy aliases
3. trim/case/space normalization
4. header signature match

Unrelated sheets are rejected unless their headers match the replenishment queue signature.

## Schema Migration

Old P0.3.5 queue rows are preserved. Missing headers are appended in place and the migration is idempotent.

Allowed new fields are non-identifying:

- source row key hash
- review ID hash
- lead ID hash
- source row digest
- public identity presence
- public identity digest
- join status/reason
- last eligibility check timestamp
- queue schema version

The queue never stores company names, brand names, emails, phone numbers, URL values, or person names.

## Status Normalization

Legacy pending statuses are normalized to `source_discovery_pending`:

- blank status with failure reason
- `queued`
- `pending`
- `evidence_missing`
- `source_missing`
- `needs_source`

Terminal statuses are not searched again:

- `source_discovered`
- `completed`
- `applied`
- `applied_ai`
- `blocked`
- `solicitation_restricted`
- `stale`
- `rejected`

Unknown statuses are retained but excluded as `unknown`.

## Auto Rebuild

When the queue is missing, physically empty, or has no eligible rows while Review contains `needs_more_evidence` rows, grounded discovery rebuilds the queue automatically from Review and Source.

P0.3.9 also rebuilds when rows physically exist but have no resolvable stable join keys. In that case the repair replaces legacy token-only rows with canonical rows instead of appending duplicates.

Rebuild rows are deduplicated by stable non-identifying keys only:

1. source row key
2. review ID
3. lead ID hash
4. source row digest

`candidateToken` alone is not a stable dedupe key for rebuilt queue rows.

Successful repair writes `queueSchemaVersion=evidence-replenishment-v2` and is idempotent. A later run should not append another 66 rows when the canonical rows already exist.

The user does not need to re-enter or edit the 66 rows manually.

## Recommended Actions

`ready_for_ai_verification` is no longer returned merely because the queue is empty.

Priority:

1. `repair_replenishment_queue`
2. `rebuild_replenishment_queue`
3. `repair_source_identity_join`
4. `run_source_discovery`
5. `run_evidence_enrichment`
6. `run_ai_verification`
7. `ready_for_daily_pipeline`
8. `replenish_with_new_candidates`

## Control Loop

The AI phase now runs conditionally:

1. refresh review queue
2. ensure/migrate/rebuild replenishment queue
3. run grounded source discovery
4. run evidence enrichment only if source references were applied
5. run AI verification only if enrichment changed evidence digests or produced AI-reevaluation candidates

No send safety gates are relaxed.

## Production Steps

1. Replace Apps Script `Code.gs` with the latest local version.
2. Save.
3. Run `setGmailSalesSafeRestPropertiesOnce`.
4. Run `inspectGmailSalesEvidenceReplenishmentQueueStatus`.
5. Confirm physical row count, schema state, and rebuild eligibility.
6. Run `inspectGmailSalesGroundedOfficialSourceDiscoveryStatus`.
7. Run `runGmailSalesGroundedOfficialSourceDiscoveryOnce` once.
8. Continue to official evidence enrichment only if source references were applied.
9. Continue to AI contact-basis verification only if evidence changed.

Do not directly run the send authority during this repair.
