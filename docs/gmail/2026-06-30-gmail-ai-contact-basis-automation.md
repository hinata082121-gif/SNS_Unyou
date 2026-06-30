# Gmail AI Contact Basis Automation

Date: 2026-06-30

This note documents the local implementation for automated contact-basis verification. It does not enable production Gmail sending, production Sheets writes, Apps Script execution, triggers, or Script Properties changes by itself.

## Architecture

- Scheduler controller remains `runGmailSalesProductionControlLoop`.
- Send authority remains `runGmailSalesDailyAutomationTrigger`.
- `runScheduledDailySend` remains monitor-only.
- `MailApp.sendEmail` remains a single call site.
- AI contact-basis verification runs in the production control loop during the `ai_verification` phase from 06:30 to 07:30, before daily prepare.

The AI verification phase runs the repair pipeline in this order:

1. refresh contact-basis review queue
2. discover missing official source references with Gemini Google Search grounding
3. enrich official evidence from verified source references
4. run AI contact-basis verification

## Public Functions

- `installGmailSalesAiVerificationConfigurationOnce`
  - Requires `LIVE_SEND_ENABLED=false` and `AUTO_SEND_ENABLED=false`.
  - Installs safe default Script Properties only.
  - Adds AI audit columns to the source and review sheets when missing.
  - Does not configure API keys, enable AI, send Gmail, or modify triggers.

- `inspectGmailSalesAiContactBasisStatus`
  - Read-only status inspector.
  - Reports aggregate counts and configuration presence only.
  - Does not output email addresses, business names, URLs, message content, API keys, or hashes.

- `inspectGmailSalesGroundedOfficialSourceDiscoveryStatus`
  - Read-only grounded discovery status inspector.
  - Reports queue counts, configuration presence, last-run counts, budget state, and recommended next action.
  - Does not output raw URLs, business names, emails, prompts, API keys, citation bodies, or hashes.

- `runGmailSalesGroundedOfficialSourceDiscoveryOnce`
  - Requires safe-rest and Gemini provider configuration.
  - Processes source-missing replenishment queue rows.
  - Calls Gemini with Google Search grounding and accepts only citation-derived official URLs.
  - Writes source-reference metadata and aggregate-safe audit fields only.
  - Does not send Gmail, create drafts, modify triggers, or change send authority.

- `runGmailSalesAiContactBasisVerificationOnce`
  - Requires safe-rest and `GMAIL_SALES_AI_ENABLED=true`.
  - Applies deterministic approvals for explicit opt-in and existing-relationship evidence.
  - Routes deterministic `ai_required` rows into the AI provider dispatch queue.
  - Writes only contact-basis fields and AI audit fields.
  - Updates the review queue with `approved_ai` / `applied_ai` or `needs_more_evidence`.
  - Rolls back source writes when read-back validation fails.

## Provider Abstraction

Supported provider names:

- `disabled`
- `mock`
- `gemini`
- `openai`

`mock` is for tests and safe dry validation. It auto-approves only when `GMAIL_SALES_AI_MOCK_AUTO_APPROVAL_ENABLED=true`. External providers require an API key and are fail-closed unless explicitly configured.

## Data Minimization

AI payloads include only policy and minimized public evidence metadata:

- temporary candidate token
- policy version
- prompt version
- source row digest
- source type
- source reference presence
- official-domain/source-reference verification booleans
- public business channel classification
- opt-in, relationship, suppression, opt-out, history, and delivery-state booleans
- sanitized public evidence snippets
- deterministic reason codes
- evidence presence booleans
- suggested basis type
- suggestion reason code
- evidence digest
- opt-out availability

AI payloads do not include raw email addresses, names, business names, URLs, URL query strings, subjects, message bodies, API keys, setup tokens, Sheet IDs, Script IDs, or raw source rows.

Sanitized public evidence snippets are capped and have email addresses, phone numbers, and URLs masked before dispatch. If a row has no usable public evidence, the provider is not called and the row remains `needs_more_evidence`.

## Auto-Approval Conditions

Deterministic approval is allowed for:

- `explicit_opt_in` when explicit opt-in evidence exists.
- `existing_relationship` when existing-relationship evidence exists.

AI approval is allowed for:

- `valid_business_contact_exception`
- confidence greater than or equal to `0.95`
- matching source and evidence digests
- no risk flags
- no human-review requirement
- source reference present and verified
- official business channel evidence
- public business channel classification
- opt-out available
- no suppression, do-not-contact, unsubscribe, sent-history, reply-history, delivery-unknown, guessed-contact, or private-personal-contact flags
- provider evidence quote supported by the dispatched sanitized evidence

All other cases are routed to human exception review.

## P0.3.4 AI_REQUIRED Routing Repair

The 2026-06-30 production issue was not an AI provider configuration problem. The provider was enabled and configured, but deterministic rows with `ai_required` were treated as terminal review failures instead of being sent to Gemini.

Observed failure shape:

- `aiEvaluatedCount=0`
- `payloadFields=[]`
- `aiNeedsReviewCount=66`
- `rejectionReasonCounts.ai_required=66`
- `eligibleAfterBasisCheckCount=0`

Correct routing:

- deterministic approved evidence is applied by rules
- deterministic blocked evidence remains blocked
- deterministic `ai_required` is an intermediate state
- `ai_required` rows build minimized public evidence payloads
- valid payloads are batched to the configured provider
- validated high-confidence results become `approved_ai` / `applied_ai`
- insufficient or invalid results become `needs_more_evidence`

`ai_required` is not counted as a rejection reason after this repair.

## Misrouted Row Requeue

`runGmailSalesAiContactBasisVerificationOnce` now repairs only the previous erroneous signature before dispatch:

- `reviewDecision=needs_more_evidence`
- `applyStatus=needs_more_evidence` or non-applied
- reason metadata contains `ai_required`
- no AI provider/model/evaluation timestamp/confidence/evidence digest is present
- not applied or auto-approved
- current source row digest still matches
- source contact basis has not already been applied

Requeued rows keep stable identifiers:

- `reviewId`
- `sourceRowKey`
- `leadIdHash`
- `sourceRowDigest`
- source/evidence fields
- priority fields

Protected rows are skipped:

- `applied`
- `applied_ai`
- `aiAutoApproved=true`
- rejected rows
- source-applied rows
- source digest mismatches
- stale rows

The two stale approved rows from the production snapshot are not automatically approved or reflected into source. They remain stale/refresh candidates and do not block the 66-row AI retry.

## Gemini Batch Dispatch

AI dispatch uses the provider abstraction and batches candidate payloads. Default batch size is:

- `GMAIL_SALES_AI_BATCH_SIZE=8`

For 66 candidates this is at most 9 provider requests. Candidate-level counts and request-level counts are separate:

- `aiBatchRequestCount` counts provider requests
- `aiProviderCandidateResponseCount` counts candidate results returned by the provider
- `aiEvaluatedCount` counts candidates with valid provider responses

Gemini is called with the API key in a request header, not in the URL query string.

## Structured Output Validation

Provider output is accepted only when each candidate result passes all gates:

- `candidateToken` matches one request candidate
- duplicate or unknown candidate tokens are rejected
- classification is allowlisted
- confidence is at least the configured threshold
- risk flags are empty
- `requiresHumanReview=false`
- evidence digest matches the request
- source row digest matches the request
- evidence quote is supported by the dispatched sanitized evidence
- source reference, public business channel, opt-out, suppression, history, and delivery flags still pass

One invalid candidate response does not discard the whole batch. Invalid candidates remain `needs_more_evidence`; valid candidates in the same batch can still be applied.

## Apply Error Semantics

`needs_more_evidence` is not an apply error. It means the row did not satisfy the automatic approval gates.

`applyErrorCount` is reserved for actual processing failures:

- rollback failure
- write failure
- read-back failure
- stale source apply failure
- provider/internal processing error
- invalid response error

Old `suspicious_bulk_approval_pattern` metadata is cleared only for rows that match the safe reset/requeue signatures.

## Bulk Handling

Manual bulk approvals with identical approval metadata are still blocked. AI-applied rows are not blocked by the manual bulk pattern when they use the AI reviewer label and unique evidence digests.

## Apps Script Deployment Steps

1. Replace Apps Script `Code.gs` with the latest local `apps-script/gmail-sales-automation/Code.gs`.
2. Save the Apps Script project.
3. Run `setGmailSalesSafeRestPropertiesOnce`.
4. Run `installGmailSalesAiVerificationConfigurationOnce`.
5. Set the provider, model, and API key Script Properties manually.
6. Set `GMAIL_SALES_AI_ENABLED=true` only after confirming safe-rest remains active.
7. Run `runGmailSalesAiContactBasisVerificationOnce`.
8. Run `inspectGmailSalesAiContactBasisStatus`.
9. Review only exception rows that remain `needs_more_evidence`.
10. Let `runGmailSalesProductionControlLoop` handle the normal next phase.

Do not manually execute Gmail send functions as part of this setup.

## P0.3.1 Review Schema Repair

The production failure on 2026-06-30 was caused by a data validation rule being present on the header row of `Gmail_Contact_Basis_Review`.

Failing cell:

- `Q1`

Failing column:

- `approvedBasisType`

The dropdown on `Q2` and below is normal. The header cell `Q1` must contain the literal header `approvedBasisType`, so row 1 must not have a data validation rule. The same rule applies to the other review dropdown columns:

- `P1` must be `reviewDecision` with no validation.
- `Q1` must be `approvedBasisType` with no validation.
- `S1` must be `optOutAvailable` with no validation.
- `applyStatus` header cell must have no validation.
- `P2` and below keep the review-decision dropdown.
- `Q2` and below keep the approved-basis dropdown.
- `S2` and below keep the `TRUE/FALSE` dropdown.
- `applyStatus` data rows keep the apply-status dropdown.

`ensureSheetHeaders_` now clears data validations only from row 1 before writing headers. It does not clear contents, formats, filters, frozen rows, data-row validations, or source candidates.

## Suspicious Bulk Approval Recovery

The review sheet may contain rows left by a previous manual bulk operation:

- `reviewDecision=approved`
- `approvedBasisType=existing_relationship`
- `optOutAvailable=TRUE`
- `reviewerLabel=operator_reviewed`
- `applyStatus=skipped_invalid`
- `applyErrorCode=suspicious_bulk_approval_pattern`
- `appliedAt` empty

`installGmailSalesAiVerificationConfigurationOnce` now repairs only rows that match the suspicious-bulk state and are still unapplied in the source sheet. Those rows are reset to AI-eligible pending state without requiring humans to edit every row manually.

Reset fields:

- `reviewDecision=pending`
- `approvedBasisType` blank
- `evidenceNotes` blank
- `optOutAvailable` blank
- `reviewerLabel` blank
- `reviewedAt` blank
- `applyStatus=pending`
- `applyErrorCode` blank
- `appliedAt` blank

Preserved fields include the review id, source row key, lead id hash, source digest, source references, evidence fields, suggestion fields, priority, and queue timestamp.

Protected rows are not reset:

- `applyStatus=applied`
- `applyStatus=applied_ai`
- `reviewDecision=rejected`
- valid `needs_more_evidence`
- `aiAutoApproved=true`
- rows with a unique AI evidence digest
- source digest mismatches
- missing source rows
- rows already reflected into source contact-basis fields

Before resetting rows, the installer creates an internal backup sheet with reset metadata. If read-back validation fails, the installer rolls the review rows back and blocks AI verification.

## Inspector Sequence

After deploying this repair:

1. Run `setGmailSalesSafeRestPropertiesOnce`.
2. Run `installGmailSalesAiVerificationConfigurationOnce`.
3. Confirm `status=pass`.
4. Confirm `headerValidationCountAfterRepair=0`.
5. Confirm `suspiciousBulkRowsReset` matches the suspicious unapplied rows.
6. Confirm `aiEligibleRowsAfterReset` is greater than zero.
7. Run `inspectGmailSalesContactBasisReviewSchema`.
8. Confirm `schemaValid=true`.
9. Confirm `headerValidationCount=0`.
10. Confirm `dataRowValidationConfigured=true`.
11. Run `inspectGmailSalesAiContactBasisStatus`.
12. Confirm `reviewHeaderValid=true`.
13. Confirm `aiConfigurationInstalled=true`.
14. Configure the provider, model, and API key manually in Script Properties.
15. Set `GMAIL_SALES_AI_ENABLED=true`.
16. Run `inspectGmailSalesAiContactBasisStatus` again.
17. Confirm AI enabled/provider/model/API key presence.
18. Run `runGmailSalesAiContactBasisVerificationOnce` once.
19. Run the coverage and deployment readiness inspectors.

Do not ask operators to manually edit the affected rows. Do not directly run send authority functions during this repair.

## P0.3.5 Official Evidence Enrichment

Gemini connectivity was confirmed by provider success counts, but no row was approved because the available evidence was still too weak:

- 51 rows returned insufficient evidence.
- 15 rows had missing payload-safe evidence.
- The confidence threshold and evidence gates remain unchanged.

`runGmailSalesOfficialEvidenceEnrichmentOnce` enriches only from saved official source references. It does not guess URLs, search the web, scrape unrelated directories, or use personal/social sources.

The control-loop AI phase now runs:

1. review queue refresh
2. official evidence enrichment
3. AI verification
4. coverage/readiness recalculation through existing inspectors

Enrichment writes only safe evidence metadata and sanitized public business-contact evidence. It updates source/review evidence digests so only changed evidence is resent to Gemini. Unchanged evidence is treated as a cache hit and is not resent.

Rows that still lack official evidence are written to `Gmail_Evidence_Replenishment_Queue` with non-identifying tokens and failure reason codes. Humans do not need to investigate or edit all 66 rows manually.

Inspector values now persist the last AI run and last enrichment run:

- `lastRunIdPresent`
- `lastAiEvaluatedCount`
- `lastAiBatchRequestCount`
- `providerConnectionAttempted`
- `providerConnectionSucceeded`
- `estimatedCostTodayYen`
- `lastEvidenceEnrichmentAt`
- `evidenceDigestChangedCount`
- `aiReevaluationEligibleCount`
- `evidenceReplenishmentQueueCount`

Inspector execution is read-only and does not reset these values to zero.
