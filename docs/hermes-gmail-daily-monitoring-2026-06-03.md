# Hermes Gmail日次監視設計

## 2026-06-03 現行版

Gmail営業メール30件/日運用について、Hermes AgentがPreflight確認、送信結果確認、返信確認、候補不足確認、Agent Office反映を担当するためのルールです。

Hermesは原則として監視・記録・安全確認を担当します。Gmail本番送信は、Apps Scriptの安全条件をすべて満たす場合のみ、リポジトリ内で定義済みの送信フローとして進めます。不確実性がある場合は送信せず `blocked` または `needs_review` として記録します。

## 絶対安全条件

送信フローへ進める条件:

- readyCount=30
- blockedReason=""
- remainingQuota>=30
- sheetConnected=true
- sendDateが当日
- 同一sendBatchIdが未送信
- 重複なし
- 配信停止なし
- 返信あり/送信禁止の除外済み
- subject/body欠落なし
- 配信停止/不要案内あり

送信後の必須確認:

- DRY_RUN=true
- LIVE_SEND_ENABLED=false
- AUTO_SEND_ENABLED=false

## 現行cronスケジュール

| 時刻 | ジョブID | タスク | 目的 |
|---|---|---|---|
| 月・木 10:30 | `eb1341568dbc` | ICHI Gmail 月木営業リスト更新 | Gmail-ready候補を最大200件補充し90件以上維持を目指す |
| 毎日 12:00 | `bbf132ad0f05` | ICHI Gmail 毎日12時 30件メール送信チェック | Preflightと送信可否、送信結果、Agent Office記録 |
| 毎日 12:30 | `8613043c053f` | ICHI Gmail 12:30送信結果・返信確認チェック | 12:00結果、返信確認、安全設定復帰、Agent Office反映を確認 |
| 毎日 14:00 | `0305facfaef7` | ICHI Gmail 14時 失敗・不足リカバリ確認 | 未送信・失敗・候補不足・未反映をneeds_review/blocked化 |
| 毎日 17:00 | `5b20e0820c82` | ICHI Gmail 17時 返信確認・翌日準備チェック | 返信確認、翌日outbox/availableForNextSend、次アクション整理 |
| 金曜 17:00 | `2be513dbe07f` | ICHI Social 金曜17時 市場・競合分析 | 市場・競合・営業改善・投稿テーマの週次分析 |

## Hermesが表示・保存しないもの

- メールアドレス一覧
- 営業先一覧
- 返信本文
- Gmailスレッド全文
- Sheet ID、Apps Script URL、Webhook URL
- APIキー、トークン、`.env` / `.env.local` の値

## Git追加禁止

- `data/gmail/outbox/`
- `data/gmail/logs/`
- `data/gmail/candidates/`
- `data/gmail/pool/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`
- `.env`
- `.env.local`

Git追加する場合は、安全なdocsと `data/agent-status/tasks/*.json` のみを個別に追加します。`git add .` は使いません。

## Agent Officeで見る項目

- `status`: success / needs_review / blocked / scheduled
- `readyCount`
- `remainingQuota`
- `blockedReason`
- `processed` / `failed` / `skipped`
- `repliedCount` / `unreadReplyCount` / `needsHumanEmailCheck`
- `availableForNextSend`
- `nextAction`
- 禁止操作が未実行であること

## 2026-06-04 初回自動運用結果

Apps Script上で2026-06-04分のGmail営業メール30件送信が成功しました。

- sendBatchId: `gmail-sales-2026-06-04`
- source: scheduled
- processed: 30
- sentCount: 30
- failedCount: 0
- skippedCount: 0
- `batch_marked_sent` 確認済み
- `daily_job_finished` 確認済み
- `live_send_reset_after_run` 確認済み

HermesとAgent Officeは、同一sendBatchIdの再送信を禁止し、次は12:30送信結果・返信確認、14:00失敗・不足確認、17:00返信確認・翌日準備確認へ進めます。
記録するのは件数、状態、nextActionのみです。メールアドレス、営業先名、本文、返信本文、Gmailスレッド全文、送信ログ本体、秘密情報は保存・表示しません。

## 2026-06-05以降の完全自動送信監視

2026-06-05以降に完全自動送信へ移行する場合、Hermesは送信実行ではなく監視・確認・記録を担当します。

- 12:30: processed、failed、skipped、live send resetの有無を確認する
- 14:00: failed/blocked、候補不足、Agent Office未反映を確認する
- 17:00: 返信確認、人間確認要否、翌日準備状況を確認する
- failed/blockedが出た場合は自動送信停止をnextActionに明記する
- 自動返信はOFFのまま扱う

完全自動化開始前に人間がApps Scriptで確認する関数:

- `setupDailyAutoSendTriggers()`
- `setupReplyCheckTriggers()`

緊急停止時に人間が実行する関数:

- `removeDailyAutoSendTriggers()`
- `removeReplyCheckTriggers()`

Hermesはトリガーを勝手に有効化せず、`/agent-office` に安全な件数、状態、nextActionのみを反映します。
