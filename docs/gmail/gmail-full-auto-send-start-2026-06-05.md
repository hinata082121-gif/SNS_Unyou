# Gmail完全自動送信開始Runbook 2026-06-05

## 目的

2026-06-05以降、Gmail営業メール30件/日の完全自動送信へ移行するための最終手順を整理する。

このRunbookは、2026-06-03と2026-06-04にApps Script上で30件送信が成功した実績を前提にする。ただし、安全条件を満たさない日は送信しない。

## 到達点

- 2026-06-03: Gmail営業30件送信成功
- 2026-06-04: Gmail営業30件送信成功
- 直近成功バッチ: `gmail-sales-2026-06-04`
- 2026-06-04 processed: 30
- 2026-06-04 failed: 0
- 2026-06-04 skipped: 0
- `live_send_reset_after_run` 確認済み
- Agent Officeと `/agent-office` へ安全な件数・状態・nextActionのみ反映済み

## 完全自動送信へ移行する条件

- 当日分のGoogle Sheets「Gmail送信対象」にready行が30件ちょうどある
- sendDateが当日である
- sendBatchIdが当日分で、過去に送信済みではない
- Gmail残クォータが30件以上ある
- 配信停止、返信あり、送信禁止、重複が混入していない
- subject/bodyが全行に存在する
- bodyに配信停止/不要案内が含まれる
- `/agent-office` にblocked/failedの重要アラートが出ていない
- 人間が初回自動化開始を承認している

## Apps Scriptで有効化する関数

人間がApps Script画面で明示的に実行する。

- `setupDailyAutoSendTriggers()`
  - 11:30 Preflight
  - 12:00 自動送信
  - 12:30 送信後確認
  - 14:00 失敗・不足確認
- `setupReplyCheckTriggers()`
  - 09:00 返信確認
  - 12:30 返信確認
  - 17:00 返信確認

このリポジトリ作業中には、上記関数を実行しない。

## 緊急停止関数

異常時は人間がApps Script画面で以下を実行する。

- `removeDailyAutoSendTriggers()`
- `removeReplyCheckTriggers()`

あわせてScript Propertiesを安全側へ戻す。

## Script Properties設定

開始前:

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`
- `AUTO_SEND_ENABLED=false`
- `DAILY_SEND_LIMIT=30`

完全自動化開始時:

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- `AUTO_SEND_ENABLED=true`
- `AUTO_RESET_LIVE_SEND_AFTER_RUN=true`
- `DAILY_SEND_LIMIT=30`
- `REQUIRE_EXACT_READY_COUNT=true`
- `REQUIRE_OPT_OUT_TEXT=true`
- `REQUIRE_UNIQUE_BATCH=true`
- `MAX_FAILURES_BEFORE_STOP=1`

送信後:

- `LIVE_SEND_ENABLED=false` へ自動復帰する
- 初期運用では `AUTO_SEND_ENABLED=false` へ戻す設計を推奨する
- 毎日完全自動にする場合でも、朝のPreflightと候補プール確認後に `AUTO_SEND_ENABLED=true` へ切り替える運用を推奨する

## 送信前条件

- `runScheduledPreflight()` または `runPreflightCheckOnly()` の安全要約でreadyCount=30を確認する
- blockedReasonが空である
- remainingQuotaが30以上である
- sheetConnectedがtrueである
- 当日sendBatchIdが未送信である

## 送信後の自動リセット

Apps Script側では `resetLiveSendAfterRun_()` により、送信成功時も失敗時も本番送信許可をOFFへ戻す設計にする。

確認項目:

- `live_send_reset_after_run` が記録されている
- `LIVE_SEND_ENABLED=false`
- `AUTO_SEND_ENABLED=false`
- 同一sendBatchIdが再送信対象になっていない

## Hermes監視との関係

Hermesは監視・確認・記録担当とする。

- 毎日12:00: Gmail30件送信チェック
- 毎日12:30: 送信結果・返信確認チェック
- 毎日14:00: 失敗・不足リカバリ確認
- 毎日17:00: 返信確認・翌日準備チェック
- 月木10:30: Gmail営業リスト更新
- 金曜17:00: 市場・競合分析

Hermesはメール本文、返信本文、宛先、営業先名、秘密情報を表示しない。

## /agent-office確認項目

人間は出先のスマホで以下を見る。

- Gmail送信status
- processed / sentCount / failedCount / skippedCount
- blockedReason
- replyCheck status
- unreadReplyCount
- needsHumanEmailCheck
- availableForNextSend
- nextAction

## 異常時の停止条件

- readyCountが30ではない
- failedCountが1以上
- `live_send_reset_after_run` が確認できない
- 同一sendBatchIdが送信済みに見える
- 返信確認でneedsHumanEmailCheck=trueになった
- 候補プールavailableが30件未満になった
- `/agent-office` にblocked/failedが出ている

上記のいずれかがあれば自動送信を止め、緊急停止関数を実行する。

## 朝に確認すること

- 当日outbox30件がSheetsへ入っている
- Preflightが通っている
- 候補プールが最低30件以上ある
- `/agent-office` にblocked/failedがない

## 夕方に確認すること

- 送信結果がsuccessになっている
- failedCountが0である
- 返信確認で人間確認が必要かどうか
- 翌日分候補とoutbox準備状況
- 自動返信がOFFのままである

## 禁止事項

- このRunbook作成中にGmail送信しない
- 自動返信しない
- Apps Scriptトリガーをローカル作業から有効化しない
- Google Sheets送信済み更新を二重実行しない
- Instagram操作を行わない
- 宛先一覧、営業先一覧、本文、返信本文、秘密情報をGitに入れない
