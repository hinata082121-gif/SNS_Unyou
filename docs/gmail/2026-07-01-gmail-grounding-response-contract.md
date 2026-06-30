# Gmail Grounding Response Contract

Date: 2026-07-01

This note documents P0.3.11 for Gemini Grounding response parsing.

## Problem

Grounded Discovery successfully received HTTP 2xx responses for candidate requests, but no citation URLs were applied. HTTP success alone does not prove that Google Search grounding ran, that a model output existed, or that `url_citation` annotations were present.

The previous generic `source_not_found` classification was too broad for this state.

## Request Contract

Grounding requests use the Gemini Interactions endpoint with:

- API key in `x-goog-api-key`
- `tools=[{ type: "google_search" }]`
- `store=false`
- no `previous_interaction_id`
- one stateless request per candidate

Prompts ask the model to use Google Search and cite official-site claims. They do not require JSON-only output and do not include invalid legacy source URLs, emails, private contact data, or raw candidate text.

## Response Parser

The parser reads Interactions `steps` and reports aggregate-safe counts:

- `google_search_call`
- `google_search_result`
- `model_output`
- text content blocks
- annotation types
- `url_citation` annotations

It accepts both snake_case and camelCase citation ranges.

Only URLs from `url_citation` annotations are considered. URLs in body text, JSON strings, search suggestions, or unannotated model output are not adopted.

## Result Classification

The run now separates:

- HTTP success
- response JSON parse
- Google Search tool invocation
- executed query count
- model output presence
- annotation presence
- accepted citation URLs

`source_not_found_after_grounded_search` is only used after a grounded response was parsed and citation handling completed. Tool-not-invoked, missing model output, missing annotations, parse errors, and unsupported response shapes are tracked separately.

## Contract Probe

`testGmailSalesGroundingResponseContractOnce` performs one non-candidate probe using a fixed public topic. It does not update Sheets, candidates, Gmail, drafts, or triggers.

The probe is valid only when HTTP succeeds, JSON parses, Google Search call/result steps exist, model output text exists, and at least one `url_citation` is present.

Grounded Discovery is blocked until a valid probe summary exists.

## Safety

Raw response JSON, prompt text, query text, citation URLs, company names, emails, and API keys are not stored in logs or summaries. The system stores counts and hashes/digests only where needed.
