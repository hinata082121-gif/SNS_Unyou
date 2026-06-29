# Gmail Production Schema Bootstrap

Date: 2026-06-29

## Purpose

This note covers the P0.1 production bootstrap needed before the 2026-06-30 daily sales restart.

The bootstrap fixes two infrastructure blockers:

- `GMAIL_SHEET_READY_TAB_NAME` was missing.
- Contact-basis columns were missing from production Sheet schema.

It also separates configured daily send capacity from the current manifest:

- `configuredMaxDailySendCount` comes from `GMAIL_SALES_MAX_DAILY_SEND_COUNT`.
- `currentManifestMaxSendCount` comes from `APPROVED_SEND_MANIFEST_JSON.maxSendCount`.
- A stale one-row manifest can show `currentManifestMaxSendCount=1` before daily prepare. That is not the configured daily capacity.

## Readiness Layers

`deploymentReady` means code, required Properties, Sheet schema, suppression/history access, timezone, and trigger configuration are ready.

`operationalCandidateReady` means deployment is ready and at least 30 source candidates have approved contact basis and remain eligible for daily prepare.

Daily prepare must require both:

1. `deploymentReady=true`
2. `operationalCandidateReady=true`

## Canonical Properties

Use these canonical Properties for daily count configuration:

- `GMAIL_SALES_EXPECTED_DAILY_COUNT=30`
- `GMAIL_SALES_MAX_DAILY_SEND_COUNT=30`

Do not use `GMAIL_SEND_MAX_SEND_COUNT` as the daily capacity setting. It can be narrower for runtime or recovery flows and must not make deployment readiness report max 1.

## Contact Basis Schema

Required logical fields:

- `contactBasisType`
- `contactBasisRecordedAt`
- `sourceType`
- `sourceReferenceHash`
- `optOutAvailable`
- `lastVerifiedAt`
- `suppressionCheckedAt`
- `historyCheckedAt`

Allowed `contactBasisType` values:

- `existing_relationship`
- `explicit_opt_in`
- `valid_business_contact_exception`
- `manual_legal_reviewed`

Blocked or non-sendable values:

- `needs_review`
- `unknown`
- `guessed`
- `scraped_without_basis`
- `private_personal_contact`

The bootstrap does not mass-convert unknown rows into `manual_legal_reviewed`. Rows without a defensible basis remain excluded from selection.

## Bootstrap Function

Run `installGmailSalesProductionSchemaOnce` only after safe rest:

- `AUTO_SEND_ENABLED=false`
- `LIVE_SEND_ENABLED=false`

The function:

- Resolves the existing ready/outbox tab.
- Sets `GMAIL_SHEET_READY_TAB_NAME` when missing.
- Adds missing contact-basis/send-state headers to the end of existing sheets.
- Sets canonical daily count Properties.
- Creates an internal schema backup sheet.
- Re-runs schema, coverage, and deployment diagnostics.
- Sends no Gmail and creates no triggers.

## Rollback

The installer writes headers only after creating a schema backup. If header read-back fails, it restores the previous header row and reports blocked status.

Rows marked `needs_review`, `guessed`, or `private_personal_contact` must not be sent until reviewed and explicitly updated with an allowed basis and supporting metadata.

## 2026-06-30 Pre-Sales Checklist

1. Replace Apps Script `Code.gs` with the latest local version and save.
2. Run `setGmailSalesSafeRestPropertiesOnce` once.
3. Run `installGmailSalesProductionSchemaOnce` once.
4. Run `inspectGmailSalesProductionSchema`.
5. Run `inspectGmailSalesContactBasisCoverage`.
6. Run `inspectGmailSalesDeploymentReadiness`.
7. Confirm `deploymentReady=true`.
8. Confirm `operationalCandidateReady=true`.
9. Confirm `configuredMaxDailySendCount=30`.
10. If `currentManifestMaxSendCount=1`, confirm it is only the stale pre-prepare manifest value.
11. Run `inspectGmailSalesProductionTriggers`.
12. Confirm one `runGmailSalesProductionControlLoop` trigger and zero old send triggers.
13. Do not run the send authority directly.
14. Let the next control loop execute daily prepare.
