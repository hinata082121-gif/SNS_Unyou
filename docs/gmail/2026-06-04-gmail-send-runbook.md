# 2026-06-04 Gmail営業30件送信 Runbook

## 目的

2026-06-04分のGmail営業メール30件送信を、手動承認つきで安全に実行するための手順を整理する。

このRunbookは送信実行前の確認用であり、この文書作成時点ではGmail本番送信、Gmail自動返信実送信、Google Sheets送信済み更新、Apps Script本番トリガー有効化は行わない。

## 現在の状態

- 2026-06-03分のGmail営業メール30件送信は成功済み
- 2026-06-04分のoutbox30件は作成済み
- 2026-06-04分のSheets貼り付け用TSVは作成済み
- Google Sheetsの「Gmail送信対象」タブへ2026-06-04分を貼り付け済み
- `runPreflightCheckOnly()` でreadyCount=30を確認済み
- 現在は明日送信待ち
- 明日分を今夜送信しない

確認済みPreflight:

| 項目 | 結果 |
|---|---|
| dryRun | true |
| liveSendEnabled | false |
| dailySendLimit | 30 |
| remainingQuota | 70 |
| targetCount | 30 |
| readyCount | 30 |
| blockedReason | 空 |
| sheetConnected | true |
| safeToSend | false |

`safeToSend=false` は、現時点で `DRY_RUN=true` / `LIVE_SEND_ENABLED=false` のため正常。

## 明日送信前に見るべき項目

- Google Sheetsの「Gmail送信対象」タブにready行が30件だけある
- sendDateが2026-06-04
- sendBatchIdが `gmail-sales-2026-06-04`
- 2026-06-03送信済み候補と重複していない
- 配信停止、返信あり、送信禁止、送信済みが混入していない
- Gmail残クォータが30以上
- 本文に不要案内がある
- Script Propertiesが送信直前まで安全状態である

## 送信直前手順

推奨時刻: 2026-06-04 11:45 JST

1. Apps Script画面で `runPreflightCheckOnly()` を実行する
2. 以下を確認する
   - readyCount=30
   - blockedReason=""
   - remainingQuota>=30
   - sheetConnected=true
3. 問題があれば送信しない
4. 問題がなければ人間が送信可否を最終判断する

## Script Properties変更手順

送信直前にのみ変更する。

送信前:

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- `DAILY_SEND_LIMIT=30`

2026-06-04は手動承認つき送信のため、完全自動トリガーは有効化しない。

## runPreflightCheckOnly()再実行

Script Properties変更前に必ず実行する。

ログに出してよいもの:

- dryRun
- liveSendEnabled
- dailySendLimit
- remainingQuota
- targetCount
- readyCount
- blockedReason
- sheetConnected
- safeToSend

ログに出してはいけないもの:

- メールアドレス
- 営業先名
- Google Sheets ID
- Apps Script URL
- 本文全文
- 認証情報

## runDailyGmailSalesSend()実行

以下がすべて満たされる場合のみ、人間が手動で実行する。

- readyCount=30
- blockedReason=""
- remainingQuota>=30
- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- sendBatchIdが当日分
- 同一sendBatchIdが未送信

実行後、ログで以下を確認する。

- processed=30
- failed=0
- dryRun=false
- liveSendEnabled=true

失敗が1件でもある場合は、再送信せずneeds_reviewとして扱う。

## 送信後に安全状態へ戻す手順

送信ログ確認後、すぐにScript Propertiesを戻す。

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`
- `AUTO_SEND_ENABLED=false`

送信後にもう一度 `runPreflightCheckOnly()` を実行する必要はない。二重送信防止のため、送信関数の再実行はしない。

## Google Sheets確認

送信成功後のみ確認する。

- 対象30行が送信済み扱いになっている
- sentAtが入っている
- sentStatusが成功扱い
- failed行がない
- 返信ステータスは未返信または空欄
- 次アクション日が2026-06-07

送信していない場合、Google Sheetsを送信済みに更新しない。

## Agent Office記録

送信成功後、Codexで以下を更新する。

- `data/agent-status/tasks/gmail-outbox-2026-06-04.json`
- 必要に応じて送信結果summary
- Agent Office HTML

成功時:

- status: success
- sentCount: 30
- failedCount: 0
- skippedCount: 0
- nextAction: 2026-06-07の返信確認/フォローアップ

失敗時:

- status: needs_reviewまたはblocked
- failedCountを記録
- 再送信せず人間確認へ回す

## 異常時の停止条件

以下のいずれかがあれば送信しない。

- readyCountが30ではない
- blockedReasonが空ではない
- remainingQuotaが30未満
- sheetConnected=false
- sendDate不一致
- sendBatchId不一致
- 同一sendBatchIdが送信済み
- 配信停止、返信あり、送信禁止が混入
- 本文の不要案内が欠落
- Script Propertiesを安全に戻せない
- 人間が送信承認しない

## Hermes Agentへ報告させる項目

Hermesは送信実行せず、以下を確認・報告する。

- Preflight結果
- readyCount
- blockedReason
- remainingQuota
- Sheets接続可否
- Agent Officeのstatus
- 送信結果の有無
- 次に人間がやること

## 人間が最終判断する項目

- 2026-06-04に送信するか
- `DRY_RUN=false` / `LIVE_SEND_ENABLED=true` へ切り替えるか
- `runDailyGmailSalesSend()` を実行するか
- 送信後に完全自動トリガーへ移行するか
- 候補プールが60件未満の状態で翌日以降も自動化を進めるか
