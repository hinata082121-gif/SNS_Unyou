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
