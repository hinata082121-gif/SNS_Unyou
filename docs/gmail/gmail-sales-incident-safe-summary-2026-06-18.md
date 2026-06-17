# Gmail Sales Incident Safe Summary - 2026-06-18

This report contains safe counts and irreversible hashes only. It does not contain email addresses, business names, URLs, reply text, or email body text.

## Scope

- From date: 2026-06-11
- Outbox files audited: 5
- Rows audited from local outboxes: 150
- Actual Gmail Sent mailbox audited: no

## Findings

- Duplicate candidate identities across audited local outboxes: 120
- Repeated or overlapping outbox pairs: 10
- 2026-06-18 00:38-00:40 JST incident rows classified as outside allowed window: 30

## Operating Decision

The system must remain blocked for live Gmail send until a human confirms the Apps Script logs and Gmail Sent mailbox against this safe audit. The 2026-06-18 incident rows are not counted as completed valid sales sends unless they pass that review.

## Pair Findings

- 2026-06-11 -> 2026-06-12: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-11 -> 2026-06-16: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-11 -> 2026-06-17: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-11 -> 2026-06-18: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-12 -> 2026-06-16: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-12 -> 2026-06-17: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-12 -> 2026-06-18: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-16 -> 2026-06-17: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-16 -> 2026-06-18: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true
- 2026-06-17 -> 2026-06-18: overlap=30, exactRecipientSetMatch=true, exactContentSetMatch=true

## Safety

- Gmail send executed by this audit: false
- Google Sheets updated by this audit: false
- Apps Script triggers changed by this audit: false
- Private recipient data committed: false
