# Gmail Sales Automation MVP

## 目的

ICHI Socialの営業メールについて、毎日最大30件の送信候補処理、新着返信確認、返信分類、条件付き自動返信、配信停止管理、ログ記録を行うApps Script MVPです。

このリポジトリにはコードと運用資料のみを保存します。実際のGmail送信、Apps Script実行、Google Sheets再送信は行いません。

## 初期安全設定

初期状態は必ず以下にします。

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`
- `DAILY_SEND_LIMIT=30`

この状態では、送信予定ログだけを残し、実メール送信は行いません。

## セットアップ手順

1. Apps Scriptプロジェクトを作成する。
2. `Code.gs` を貼り付ける。
3. `appsscript.json` を反映する。
4. Script Propertiesを設定する。
5. `setupGmailSalesAutomation()` を確認用途で実行する。
6. `dailySalesEmailJob()` を `DRY_RUN=true` のままテストする。
7. 送信予定ログと除外判定を人間が確認する。
8. 人間判断後にだけ本番送信設定へ進む。

## Script Properties

| Key | 初期値/例 | 用途 |
|---|---|---|
| `SHEET_ID` | 人間が設定 | 送信対象シート |
| `SHEET_NAME` | `sales` | 送信対象タブ |
| `DRY_RUN` | `true` | 送信せず予定ログだけ残す |
| `LIVE_SEND_ENABLED` | `false` | 本番送信許可 |
| `AUTO_SEND_ENABLED` | `false` | 定期トリガーからの自動送信許可 |
| `AUTO_RESET_LIVE_SEND_AFTER_RUN` | `true` | 送信後に本番送信設定をOFFへ戻す |
| `DAILY_SEND_LIMIT` | `30` | 1日上限 |
| `PREFLIGHT_HOUR` | `11` | Preflight実行時刻 |
| `SEND_HOUR` | `12` | 自動送信実行時刻 |
| `POST_SEND_CHECK_HOUR` | `12` | 送信後確認時刻 |
| `SEND_BATCH_ID_PREFIX` | `gmail-sales` | 日次バッチID接頭辞 |
| `REQUIRE_EXACT_READY_COUNT` | `true` | ready行が30件ちょうどの場合のみ送信 |
| `REQUIRE_OPT_OUT_TEXT` | `true` | 配信停止/不要案内文を必須にする |
| `REQUIRE_UNIQUE_BATCH` | `true` | 同じsendBatchIdの二重送信を防ぐ |
| `MAX_FAILURES_BEFORE_STOP` | `1` | 失敗時に停止する閾値 |
| `FROM_NAME` | `ICHI Social` | 差出人名 |
| `REPLY_SIGNATURE` | 人間が設定 | 署名 |
| `CREATE_TRIGGERS` | `false` | トリガー作成許可 |

実値はGitに書かないでください。

## Gmailラベル一覧

- `ICHI/Sales/Sent`
- `ICHI/Sales/Replied`
- `ICHI/Sales/Interested`
- `ICHI/Sales/RequestInfo`
- `ICHI/Sales/NoThanks`
- `ICHI/Sales/Unsubscribe`
- `ICHI/Sales/Bounce`
- `ICHI/Sales/Complaint`
- `ICHI/Sales/AutoReply`
- `ICHI/Sales/NeedsHuman`
- `ICHI/Sales/Processed`
- `ICHI/Sales/DryRun`

## トリガー設定手順

初期は `CREATE_TRIGGERS=false` にしておきます。
人間確認後、必要な場合のみApps Script画面で以下を設定します。

- `dailySalesEmailJob`: 毎営業日または毎日1回
- `scanGmailRepliesJob`: 1時間ごと、または営業日中だけ

2026-06-04以降の30件/日完全自動化では、人間確認後に以下の関数を手動実行してトリガーを作成します。

- `setupDailyAutoSendTriggers()`: 11:30 Preflight、12:00送信、12:30送信後確認、14:00失敗確認のトリガーを作る
- `removeDailyAutoSendTriggers()`: 緊急停止時に自動送信関連トリガーを削除する

トリガー作成関数は、ユーザーがApps Script画面で明示実行した場合だけ動かします。
コードを貼り付けただけでは本番トリガーは有効化されません。

## DRY_RUNの使い方

`DRY_RUN=true` の場合、実送信せず「送信予定」としてログを残します。
最初の検証は必ずこの状態で行います。

## LIVE_SEND_ENABLEDの使い方

`LIVE_SEND_ENABLED=false` の場合、`DRY_RUN=false` でも送信しません。
本番送信には、人間が `LIVE_SEND_ENABLED=true` を設定する必要があります。

## 本番化手順

1. 送信対象が30件以内であることを確認する。
2. 配信停止、返信済み、送信禁止が除外されていることを確認する。
3. 文面、署名、配信停止案内を確認する。
4. `DRY_RUN=false` にする。
5. 人間判断で `LIVE_SEND_ENABLED=true` にする。

## 停止手順

- `LIVE_SEND_ENABLED=false` に戻す。
- 必要に応じて `DRY_RUN=true` に戻す。
- 定期実行トリガーを停止する。

## テスト手順

1. ダミー行だけのテストシートを使う。
2. `DRY_RUN=true`、`LIVE_SEND_ENABLED=false` を確認する。
3. `runPreflightCheckOnly()` を実行し、送信予定件数、残クォータ、Sheet接続を確認する。
4. `dailySalesEmailJob()` または `runDailyGmailSalesSend()` を実行し、送信予定ログを確認する。
5. 実送信が0件であることを確認する。
6. 返信分類はテスト用スレッドで確認する。

## 本番前Preflight

`runPreflightCheckOnly()` は、Apps Script画面から手動実行する本番前チェック専用関数です。

- Script Propertiesを確認する
- DRY_RUN / LIVE_SEND_ENABLED を確認する
- Gmail残クォータを確認する
- 送信対象件数を確認する
- Sheet接続を確認する
- 送信しない
- Google Sheetsを更新しない
- メールアドレスや本文全文をログに出さない

## 本番送信入口

本番送信は `runDailyGmailSalesSend()` から実行します。

この関数は以下を満たさない限り送信しません。

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- `DAILY_SEND_LIMIT<=30`
- Gmail残クォータが送信予定件数以上
- 送信対象が安全確認済み
- 配信停止、返信あり、送信禁止、重複が除外済み

条件を満たさない場合は、安全な要約ログだけを残して停止します。

定期トリガーから送信する場合は `runScheduledDailySend()` を使います。
この関数は `AUTO_SEND_ENABLED=true` も満たさない限り送信しません。
送信成功時も失敗時も、`AUTO_RESET_LIVE_SEND_AFTER_RUN=true` の場合は `LIVE_SEND_ENABLED=false` と `AUTO_SEND_ENABLED=false` へ戻します。

## 完全自動化用関数

- `runScheduledPreflight()`: 送信前の安全確認だけを行う。送信しない。
- `runScheduledDailySend()`: 安全条件を満たす場合だけ30件送信する。
- `runPostSendCheck()`: 送信済み件数、失敗件数、ready残りを要約する。
- `runFailureRecoveryCheck()`: 未送信、失敗、候補不足を確認し、自動再送信はしない。
- `buildSendBatchId_(date)`: `gmail-sales-YYYY-MM-DD` 形式のバッチIDを作る。
- `verifyBatchNotSent_(batchId)`: 同じバッチが送信済みでないか確認する。
- `markBatchSent_(batchId)`: 送信成功後にバッチ送信済みをScript Propertiesへ記録する。
- `resetLiveSendAfterRun_()`: 送信後に本番送信許可をOFFへ戻す。

## トラブルシュート

- 送信予定が0件: ステータス、配信停止、送信禁止、宛先列を確認する。
- 送信予定が30件を超えそう: `DAILY_SEND_LIMIT` とシート条件を確認する。
- 返信分類が不自然: `classifyReply_()` のキーワードを見直す。
- 自動返信が不要な分類に出そう: `maybeSendAutoReply_()` の許可分類を確認する。

## 誤送信防止

- 実値をGitに書かない。
- メールアドレス一覧をGitに入れない。
- 営業候補データをGitに入れない。
- 初回本番送信前に人間が必ず確認する。
- 配信停止希望には追加営業をしない。
