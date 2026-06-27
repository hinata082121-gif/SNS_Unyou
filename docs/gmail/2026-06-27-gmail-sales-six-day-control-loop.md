# Gmail Sales Six-Day Control Loop

Date: 2026-06-27

This runbook defines the ICHI Social Gmail sales restart policy and the Apps Script control loop shape. It does not contain recipient data, message bodies, Sheet IDs, Script IDs, trigger IDs, tokens, or secrets.

## Operational Policy

- 2026-06-28 is a one-time special restart sales day.
- From 2026-06-29, normal sales days are Monday through Saturday.
- From 2026-07-05, Sundays send zero sales emails.
- The first normal weekly reporting period is 2026-06-29 through 2026-07-04.
- The first weekly report day is 2026-07-05.
- There is no catch-up sending for missed days.
- The daily send cap remains exactly 30 and must never be exceeded.

## Control Loop

Scheduler controller:

- `runGmailSalesProductionControlLoop`
- Expected trigger interval: 30 minutes

Send authority:

- `runGmailSalesDailyAutomationTrigger`
- `MailApp.sendEmail` must remain in one call site only.

The control loop selects one phase based on the current JST date and time:

- 07:30-09:45: `prepareGmailSalesDailyBatchForTodayOnce`
- 10:00-11:30: `runGmailSalesDailyEnableWhenReady`
- 11:45-12:45: `runGmailSalesDailyAutomationTrigger`
- 13:00-15:00: `runGmailSalesDailyPostSendAudit`
- Sundays from 2026-07-05, 08:30-11:30: `runGmailSalesWeeklyReportAndOptimization`

`runScheduledDailySend` is monitor-only and must not call the send executor.

## Daily Gates

Daily preparation must keep these constraints:

- Use the current JST date only.
- Re-check suppression, sent history, replies, unsubscribe, do-not-contact, delivery unknown, invalid content, and duplicates.
- Select exactly 30 candidates for send.
- Keep reserve candidates separate from the send manifest.
- Do not use stale daily output as automatic approval.
- Do not send email during prepare or enable.

Readiness is checked by `inspectGmailSalesDailyReadiness`.

Enablement is allowed only when readiness passes. On failure, the safe rest state is:

- `AUTOMATION_MASTER_ENABLED=true`
- `AUTO_SEND_ENABLED=false`
- `LIVE_SEND_ENABLED=false`

Post-send audit returns the same safe rest state after the send window.

## Weekly Optimization

`runGmailSalesWeeklyReportAndOptimization` runs only on Sundays from 2026-07-05.

The report period is the previous Monday through Saturday. The 2026-06-28 restart day is a bootstrap reference and is not mixed into the first normal weekly comparison.

Strategy updates are handled by:

- `buildGmailSalesWeeklyOptimizationPlan_`
- `applyGmailSalesWeeklyOptimizationPlan_`

Allowed strategy dimensions include segment weights, source type weights, subject/body/CTA variant weights, personalization mix, and candidate ordering. Safety gates, suppression, opt-out text, send limits, send windows, secret handling, and duplicate prevention are never relaxed.

If sample size is insufficient or safety indicators are poor, the strategy remains unchanged or rolls back to the previous safe config.

## Recovery Rules

- `DELIVERY_UNKNOWN` rows are not resent automatically.
- `FAILED_BEFORE_SEND` rows are not resent automatically.
- Failure recovery checks are audit-only unless a future human-approved recovery path explicitly allows a specific action.
- Sunday sales sending remains blocked except for 2026-06-28.

## Properties And Triggers

Use `setGmailSalesSafeRestPropertiesOnce` to set safe rest flags without deleting other properties.

Use `inspectGmailSalesProductionProperties` to verify property state without printing secret values.

Use `installGmailSalesProductionTriggersOnce` to replace known Gmail sales triggers with one control loop trigger. It must not touch unrelated triggers and must not send email.

Use `inspectGmailSalesProductionTriggers` to verify the control loop trigger count and old send trigger absence without printing trigger IDs.

## Manual Recovery

Use `inspectGmailSalesCurrentOperationalStatus` for a read-only status check.

Use `runGmailSalesProductionControlLoopManualSafe` only when the scheduled control loop missed the current phase. It runs the same phase logic and keeps all idempotency and safety checks.

Do not repeatedly call the direct send function.

## Data Handling

Do not store real recipient data, email bodies, private URLs, Sheet IDs, Script IDs, tokens, or secrets in Git. Logs and reports should use counts, booleans, dates, reason codes, rates, and non-sensitive status values.
