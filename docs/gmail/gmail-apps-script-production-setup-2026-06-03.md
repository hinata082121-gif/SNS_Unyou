# Gmail Apps Script 本番送信環境セットアップ手順

## 目的

2026-06-03分のGmail営業メール30件送信について、Apps Script側で本番送信前の接続確認を行える状態にする。

本手順は送信環境の準備とPreflight確認用であり、まだ本番送信は行わない。

## 現在の状態

- outbox30件: 確定済み
- DRY_RUN: 30件で成功済み
- Gmail本番送信: 未実行
- Google Sheets更新: 未実行
- Agent status: `needs_review`

## Apps Scriptに反映するファイル

- `apps-script/gmail-sales-automation/Code.gs`
- `apps-script/gmail-sales-automation/appsscript.json`

## Apps Script画面でユーザーが行う作業

1. Apps Scriptプロジェクトを開く。
2. `Code.gs` の内容を貼り付ける。
3. `appsscript.json` の内容をマニフェストに反映する。
4. Script Propertiesを設定する。
5. `setupGmailSalesAutomation()` を実行してラベル作成を確認する。
6. `runPreflightCheckOnly()` を実行する。
7. ログに安全な要約だけが出ることを確認する。
8. 問題がなければ、本番送信ONの判断へ進む。

## Script Propertiesに設定する項目

値はここに書かず、Apps Script画面でユーザーが手入力する。

| Key | 用途 |
|---|---|
| `SHEET_ID` | 送信対象と送信結果を管理するGoogle Sheets |
| `SHEET_NAME` | 送信対象シート名 |
| `DRY_RUN` | 送信せず確認のみ行うか |
| `LIVE_SEND_ENABLED` | 本番送信を許可するか |
| `DAILY_SEND_LIMIT` | 1日の送信上限。最大30 |
| `FROM_NAME` | Gmail送信時の表示名 |
| `REPLY_SIGNATURE` | 署名 |
| `OUTBOX_SOURCE_MODE` | outbox相当データの取得方式 |
| `SEND_DATE` | 送信日 |
| `NEXT_ACTION_DATE` | 次アクション日 |
| `LOG_SHEET_NAME` | ログ記録先シート名 |

## 初回確認

初回は必ず以下の状態で確認する。

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`
- `DAILY_SEND_LIMIT=30`

この状態で `runPreflightCheckOnly()` を実行しても、Gmail送信とGoogle Sheets更新は行われない。

## runPreflightCheckOnly() の確認項目

ログには以下のみ表示する。

- dryRun
- liveSendEnabled
- dailySendLimit
- remainingQuota
- targetCount
- readyCount
- blockedReason
- sheetConnected
- safeToSend

ログにメールアドレス、営業先名、シートID、本文全文、outbox全文は出さない。

## Gmail残クォータ確認

`runPreflightCheckOnly()` はGmail残クォータを確認する。

本番送信予定件数より残クォータが少ない場合は送信しない。

## Google Sheets列確認

送信前に以下の列または同等の管理項目を確認する。

- 宛先メール
- 店舗名/事業名
- 業態
- 地域
- 送信ステータス
- 返信ステータス
- 配信停止
- 送信禁止
- 送信日
- 次アクション日

送信済み、返信あり、配信停止、送信禁止は送信対象から除外する。

## ラベル作成確認

`setupGmailSalesAutomation()` により、Gmail側に営業管理用ラベルが作成されることを確認する。

初期状態ではトリガー作成はOFFにする。

## トリガー設定確認

トリガーを設定する場合は、人間確認後にApps Script画面で行う。

初回本番送信前は、手動実行で確認する。

## 本番送信ON前チェック

- outbox30件が確定している
- `runPreflightCheckOnly()` が問題なく完了している
- Gmail残クォータが足りている
- Google Sheets列が確認済み
- 配信停止/返信あり/送信禁止が除外されている
- メール本文に不要時の案内がある
- 成果保証表現がない
- ユーザーが本番送信を明示承認している

## 本番送信ONの手順

1. Script Propertiesで `DRY_RUN=false` にする。
2. Script Propertiesで `LIVE_SEND_ENABLED=true` にする。
3. `runDailyGmailSalesSend()` を手動実行する。
4. ログで成功件数、失敗件数を確認する。
5. 送信成功分だけGoogle Sheetsに送信済みを反映する。
6. 完了後、必要に応じて `LIVE_SEND_ENABLED=false` に戻す。

## 緊急停止手順

- Script Propertiesで `LIVE_SEND_ENABLED=false` に戻す。
- 必要に応じて `DRY_RUN=true` に戻す。
- トリガーを一時停止または削除する。
- 送信ログを確認し、送信成功件数だけを記録する。

## 送信後にSheets更新する流れ

`runDailyGmailSalesSend()` は、送信成功した行だけを送信済みとして更新する。

送信していない行、DRY_RUNのみの行、失敗した行は送信済みにしない。

## よくあるエラー

| エラー | 確認すること |
|---|---|
| `missing_sheet_config` | Script Propertiesに必要な設定があるか |
| `no_ready_rows` | 送信対象行が抽出できているか |
| `insufficient_gmail_quota` | Gmail残クォータが足りているか |
| `dry_run_enabled` | 本番送信時にDRY_RUNがfalseか |
| `live_send_disabled` | 本番送信時にLIVE_SEND_ENABLEDがtrueか |
| `outbox_validation_errors` | 重複、文面、除外条件に問題がないか |

## 秘密情報をGitに入れない注意

- Script Propertiesの実値をGitに書かない
- メールアドレス一覧をGitに入れない
- outbox本体をGitに入れない
- Gmail送信ログ本体をGitに入れない
- Apps Script URLや認証情報をGitに入れない
