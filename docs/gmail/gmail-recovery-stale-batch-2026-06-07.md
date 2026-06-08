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

## 2026-06-08通常再開準備

2026-06-08用のoutbox30件とGoogle Sheets貼り付け用TSVを作成した。

安全な確認結果:

- sendDate: `2026-06-08`
- sendBatchId: `gmail-sales-2026-06-08`
- selectedCount: 30
- duplicateCount: 0
- duplicateWithPreviousBatch: false
- duplicateWithPastSent: false
- sheetsReadyTsvCreated: true
- validationErrorCount: 0
- expectedBodyWouldContainLiteralBackslashN: false

6/5固定batch問題は解消済みとして扱う。
残課題は、6/8用TSVを人間がGoogle SheetsのGmail送信対象へ貼り付け、Apps Scriptで `runPreflightDiagnosticsOnly()` と `runPreflightCheckOnly()` を実行すること。

送信前には必ず `expectedSendDate=2026-06-08`、`expectedSendBatchId=gmail-sales-2026-06-08`、`readyCount=30`、`blockedReason=""` を確認する。
Gmail本番送信はPreflight成功後、かつ送信許可のScript Propertiesが正しい場合だけ行う。

## 2026-06-08送信成功と復旧完了

2026-06-08 12:01頃のscheduled実行で、Gmail営業30件送信が成功した。

安全な記録:

- sendBatchId: `gmail-sales-2026-06-08`
- processed: 30
- failed: 0
- `batch_marked_sent` 確認済み
- `daily_job_finished` 確認済み
- `live_send_reset_after_run` 確認済み
- 本文のリテラル `\n` 表示問題は解消済み

これにより、2026-06-05固定batch問題からの復旧は完了とする。
2026-06-08分は送信済みのため、同一outbox、同一TSV、同一sendBatchIdで再送信しない。
6/9以降は日次sendDate/sendBatchIdローテーション、17:20翌日outbox準備、送信後確認、返信確認、Agent Office反映監査を継続監視する。

## 12:30送信結果反映の自動化

6/9以降は、12:30の送信結果確認タスクがAgent Office反映まで担当する。

- `npm run gmail:send-result:record` で日付別daily send result JSONを作成/更新する
- outbox、recovery、preflight関連Agent Statusを安全な件数だけで解決更新する
- `agent:status:validate`、`agent:status:render`、`agent:office:render`、`lint`、`build` を実行する
- 安全なAgent Status JSONとdocsだけを個別にGit追加する
- commit/pushして `/agent-office` に反映する

このフローではGmail送信、Google Sheets直接更新、Apps Scriptトリガー操作、自動返信、Threads投稿、Instagram操作を行わない。
送信済み行をreadyへ戻さず、同一sendBatchIdでの再送信も行わない。
