# Gmail stale batch recovery 2026-06-07

## 目的

2026-06-05の緊急r2 batchがApps Scriptの通常日次設定に残り、2026-06-06と2026-06-07のGmail営業30件送信が停止した事象を整理し、古いbatchを再送せずに2026-06-08以降の自動送信へ戻す。

## インシデント

- 2026-06-05: Gmail営業30件送信済み
- 2026-06-06: 送信なし
- 2026-06-07: 送信なし
- 2026-06-07時点のApps Script診断では、期待sendDateが2026-06-05のまま残っていた
- 同じsendBatchIdは送信済み扱いのため、Preflightは `batch_already_sent` を返した
- readyCountは0で、safeToSendはfalse

## 原因

2026-06-05の緊急対応で使ったr2 batchIdが通常日次運用へ残り、日付ごとの `sendDate` / `sendBatchId` ローテーションが効かなかった。

通常運用では以下を満たす必要がある。

- 12:00送信チェックはJST当日を使う
- 17:20翌日outbox準備はJST翌日を使う
- sendBatchIdは原則 `gmail-sales-YYYY-MM-DD`
- 6/5の緊急r2 batchを6/6以降へ持ち越さない

## 禁止事項

- 2026-06-05送信済み行をreadyへ戻さない
- 2026-06-05のsendBatchIdを再利用しない
- 古いbatchを再送しない
- Google Sheetsを送信済みから未送信へ戻さない
- Gmail送信、自動返信、Apps Scriptトリガー操作を復旧作業中に行わない

## 復旧手順

1. Apps Scriptへ日次ローテーション対応済みCode.gsを反映する
2. 2026-06-08分のoutbox30件を準備する
3. Google SheetsのGmail送信対象へ2026-06-08分TSVを反映する
4. Apps Scriptで `runPreflightDiagnosticsOnly()` を実行する
5. 診断で `currentJstDate`、`expectedSendDate`、`expectedSendBatchId`、`sendDateSource`、`sendBatchIdSource` を確認する
6. `runPreflightCheckOnly()` を実行し、readyCount=30、blockedReason空、sheetConnected=trueを確認する
7. 送信は12:00の通常窓、または人間の明示承認がある場合だけ行う

## Agent Office確認項目

`/agent-office` では以下の安全な項目だけを見る。

- staleSendDate
- staleBatchId
- expectedSendDate
- expectedSendBatchId
- readyCount
- blockedReason
- safeToSend
- shouldResendOldBatch
- nextAction

メールアドレス、営業先名、本文全文、返信本文、Gmailスレッド全文、Sheet ID、Apps Script URL、トークンは表示しない。
