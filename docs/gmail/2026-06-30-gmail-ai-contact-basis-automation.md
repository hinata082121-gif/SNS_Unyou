# Gmail AI Contact Basis Automation

Date: 2026-06-30

This note documents the local implementation for automated contact-basis verification. It does not enable production Gmail sending, production Sheets writes, Apps Script execution, triggers, or Script Properties changes by itself.

## Architecture

- Scheduler controller remains `runGmailSalesProductionControlLoop`.
- Send authority remains `runGmailSalesDailyAutomationTrigger`.
- `runScheduledDailySend` remains monitor-only.
- `MailApp.sendEmail` remains a single call site.
- AI contact-basis verification runs in the production control loop during the `ai_verification` phase from 06:30 to 07:30, before daily prepare.

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

- `runGmailSalesAiContactBasisVerificationOnce`
  - Requires safe-rest and `GMAIL_SALES_AI_ENABLED=true`.
  - Applies deterministic approvals for explicit opt-in and existing-relationship evidence.
  - Uses AI only for business-contact-exception evidence that cannot be deterministically approved.
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

AI payloads include only policy and evidence metadata:

- policy version
- prompt version
- source row digest
- source type
- source reference hash
- source reference presence
- evidence presence booleans
- suggested basis type
- suggestion reason code
- domain hash
- evidence digest
- opt-out availability
- personal-email flag

AI payloads do not include raw email addresses, names, business names, URLs, subjects, or message bodies.

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
- business-contact evidence present
- source reference present
- non-personal email domain classification

All other cases are routed to human exception review.

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
