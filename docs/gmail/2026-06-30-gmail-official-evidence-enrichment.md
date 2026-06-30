# Gmail Official Evidence Enrichment

Date: 2026-06-30

This note documents P0.3.5, the official-source evidence enrichment step for Gmail Sales contact-basis automation.

## Root Cause

Gemini routing and provider connectivity were working. The blocker was evidence quality:

- 51 candidates reached Gemini but returned insufficient evidence.
- 15 candidates had no payload-safe official evidence.
- No candidates satisfied the strict auto-approval gates.

The fix does not lower the confidence threshold, evidence gate, risk gate, suppression checks, history checks, or send safety. It enriches only from existing official source references.

## Function

`runGmailSalesOfficialEvidenceEnrichmentOnce`

The function:

- requires safe-rest
- takes a script lock
- reads source and review sheets
- targets only `needs_more_evidence` rows with `evidence_payload_missing` or `insufficient_evidence`
- excludes applied, `applied_ai`, rejected, stale, suppressed, unsubscribed, do-not-contact, already-sent, replied, delivery-unknown, guessed, and private-personal candidates
- fetches only saved official `sourceReference` URLs
- follows only same-domain page links found inside the fetched official page
- never guesses URL paths
- updates evidence only when the evidence package digest changes
- queues source-missing failures for replenishment
- stores aggregate enrichment summary for inspectors

## Web Fetch Safety

Allowed:

- `http` and `https`
- saved official source reference only
- same-domain redirects
- same-domain page links already present in fetched HTML
- HTML or text responses

Blocked:

- localhost
- private or reserved IPs
- URL shorteners
- unrelated redirect domains
- binary/PDF parsing
- URL guessing
- search result scraping
- private SNS or personal contact discovery

The normal logs use aggregate counts only. They do not include raw URLs, company names, email addresses, tokens, API keys, prompts, or response bodies.

## Evidence Extraction

The extractor looks for official business-contact signals:

- business inquiry labels
- corporate inquiry labels
- partnership labels
- advertising inquiry labels
- media or press labels
- service introduction or consultation labels
- contact form labels
- opt-out support indicators

It treats solicitation restrictions as blocking evidence, not as approval evidence.

Insufficient evidence includes:

- public email only
- `info@` style address only
- company domain only
- consumer support only
- recruiting-only contact
- complaint or emergency contact
- personal named contact
- sales-solicitation prohibition

## Digest Control

Each enriched candidate gets an evidence package digest. If the digest matches the last AI-evaluated digest, the candidate is not resent to Gemini. This prevents repeated charges for unchanged evidence.

Inspector-visible values include:

- `lastEvidenceEnrichmentAt`
- `evidenceEnrichmentTargetCount`
- `evidenceEnrichmentSucceededCount`
- `evidenceEnrichmentMissingCount`
- `officialPageFetchCount`
- `officialPageCacheHitCount`
- `officialBusinessChannelCount`
- `solicitationRestrictedCount`
- `evidenceDigestChangedCount`
- `aiReevaluationEligibleCount`
- `evidenceReplenishmentQueueCount`

## Replenishment Queue

Rows without usable official evidence are written to `Gmail_Evidence_Replenishment_Queue` using non-identifying metadata:

- candidate token
- failure reason code
- required evidence type
- existing source type
- source reference presence
- official domain presence
- replenishment eligibility
- queue timestamp
- status

This prepares future candidate replacement without asking a human to edit 66 rows manually.

## Production Steps

1. Replace Apps Script `Code.gs` with the latest local version.
2. Save.
3. Run `setGmailSalesSafeRestPropertiesOnce`.
4. Run `inspectGmailSalesAiProviderConfiguration`.
5. Confirm `configurationValid=true`.
6. Run `runGmailSalesOfficialEvidenceEnrichmentOnce` once.
7. Run `inspectGmailSalesAiContactBasisStatus`.
8. Confirm `evidenceDigestChangedCount` and `aiReevaluationEligibleCount`.
9. Run `runGmailSalesAiContactBasisVerificationOnce` once.
10. Run the contact-basis status, review queue, coverage, and deployment readiness inspectors.

Do not directly run the send authority during this repair.
