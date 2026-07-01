# Gmail Grounding Model Failover

Date: 2026-07-01

This note records the local failover change for Gmail sales grounded source discovery. It intentionally omits URLs, prompts, raw responses, company names, email addresses, API keys, and candidate identifiers.

## Model Cascade

Grounded source discovery now prefers `GMAIL_SALES_GROUNDING_MODEL_CASCADE_JSON`.

Default cascade:

```text
gemini-3.5-flash
gemini-2.5-flash
gemini-2.5-flash-lite
gemini-2.0-flash
```

The legacy single model property remains as a fallback input, but discovery uses the cascade first.

## Behavior

- Each candidate is processed statelessly.
- Requests keep `store=false`.
- API keys remain in the `x-goog-api-key` header only.
- Retryable provider or response-contract failures fail over to the next model.
- Citation safety and identity rejections remain non-bypassable and are not converted to source-not-found.
- Non-2xx provider responses are not parsed as normal responses.
- Model health state stores only non-secret metadata such as failure category, timestamps, cooldown, parser version, and validator version.
- A new read/write probe function validates the cascade without candidate data:
  - `testGmailSalesGroundingModelFailoverOnce`

## Emergency Readiness

Added a read-only inspector for the 2026-07-02 recovery target:

```text
inspectGmailSalesTomorrowEmergencyReadiness
```

It reports whether the system is ready for full target, degraded nonzero operation, continued emergency preparation, or blocked due to no legally eligible candidates.
