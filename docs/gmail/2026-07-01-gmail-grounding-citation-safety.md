# Gmail Grounding Citation Safety

Date: 2026-07-01

This note records the local Code.gs change for grounded official-source discovery citation handling. It intentionally omits citation URLs, prompt bodies, API keys, company names, and response payloads.

## Changes

- Grounding parser version is now `grounded-source-parser-v3`.
- Citation URL processing is split into explicit stages:
  - annotation detection
  - URL presence
  - citation index validation
  - URL syntax normalization
  - duplicate removal
  - safety classification
  - identity validation
  - final acceptance
- Safety-rejected citations are classified separately from source-not-found outcomes.
- Provider non-2xx responses are classified as provider errors and are not sent through the normal Gemini response parser.
- Queue status normalization now recognizes grounding and citation failure statuses written by the run.
- A read/write probe function was added for the citation acceptance contract:
  - `testGmailSalesGroundingCitationAcceptanceContractOnce`
- Request accounting fields were added for daily grounding prompt usage and remaining discovery capacity.

## Safety

- `MailApp.sendEmail` remains at one call site.
- Citation safety tests do not call production Gemini.
- The probe payload uses `store: false`.
- No Gmail send, draft creation, production Sheet update, trigger change, or Apps Script production execution was performed by the local tests.

## Validation

Added package script:

```text
npm run gmail:sales:grounding-citation-safety:test
```

This test covers citation URL normalization, safety rejection categories, duplicate handling, provider error classification, and the citation acceptance probe side-effect boundary.
