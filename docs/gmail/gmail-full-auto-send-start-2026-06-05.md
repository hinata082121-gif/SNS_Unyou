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

## 日次sendDate/sendBatchIdローテーション

通常運用では、Apps Scriptの12:00送信チェックはJST当日を `SEND_DATE` として扱い、`SEND_BATCH_ID` は原則 `gmail-sales-YYYY-MM-DD` を使う。
17:20の翌日outbox準備タスクはJST翌日を対象にする。

2026-06-05の緊急r2 batchは6/5専用であり、6/6以降へ持ち越さない。
Preflight診断で `expectedSendDate` が当日と一致しない場合、または `staleSendDate=true` / `staleBatchId=true` が出る場合は送信を停止し、当日または翌日分のoutboxとbatchIdを作り直す。

`batch_already_sent` が出た場合は、同一batchIdの再利用や送信済み行のready戻しを行わない。
新しい日付または新しいbatchIdのoutboxを準備し、Preflightで `readyCount=30` / `blockedReason=""` を確認するまで本番送信を有効にしない。

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

## 完全自動化に必要な追加監視

完全自動送信を安定させるには、送信そのものだけでなく、翌日outbox準備とAgent Office反映監査が必要です。

- 毎日17:20の翌日outbox30件自動準備で、翌日分outboxとAgent Status JSONを準備する
- 毎日17:30の返信確認実行・記録で、replyCheckExecutedとneedsHumanEmailCheckを明確化する
- 毎日18:30のAgent Office反映監査で、当日タスクの未反映、stale候補、blocked、needs_reviewを検知する
- 月木16:00の候補プール不足時チェックで、totalReady<90またはavailableForNextSend<60を補充強化対象にする

追加4タスクはHermesへ登録済みです。
17:20翌日outbox準備は `4e4ed67216e3`、17:30返信確認実行・記録は `ee8473f970ff`、18:30反映監査は `1365e7b16899`、月木16:00候補プール不足時チェックは `758eef276079` です。

2026-06-05分は、17:20翌日outbox準備タスクの初回実行前に12:00自動送信があるため、一回限りの事前準備としてoutbox30件とSheets貼り付け用TSVを作成しました。
しかし緊急確認で、2026-06-05分outboxが2026-06-04送信済み候補と30件すべて重複していたため、旧outbox/TSVは使用禁止です。
公開メール確認済み候補を緊急補充し、過去送信済み候補と重複ゼロの新outbox30件とSheets貼り付け用TSVを再作成しました。
Agent Officeには `tomorrowOutboxReady=true`、`tomorrowOutboxCount=30`、`duplicateWithPreviousBatch=false`、`duplicateWithPastSent=false`、`duplicateCount=0`、`sheetPasted=false`、`preflightRequired=true` として表示します。
旧6/5 TSVがSheetsに入っている場合は、送信前に必ず新TSVへ差し替えます。

Preflightで `batch_already_sent` が出た場合は、同じbatchIdを再利用しません。
旧batchIdを使用禁止にし、`gmail-sales-YYYY-MM-DD-r2` のような新batchIdでoutbox/TSVを再作成します。
2026-06-05では `gmail-sales-2026-06-05` が使用済み扱いになったため、`gmail-sales-2026-06-05-r2` でr2 outbox/TSVを作成済みです。
Google Sheetsの送信対象行とApps Script側のSEND_BATCH_IDまたは対応プロパティをr2に合わせ、Preflightで `readyCount=30` と `blockedReason=""` を確認してから送信可否を判断します。

## no_ready_rowsが残る場合の確認

`batch_already_sent` が解消した後も `readyCount=0` / `no_ready_rows` が出る場合は、送信ではなくSheets行のready判定不一致として扱います。

優先確認項目は以下です。

- Gmail送信対象シートに正しいr2 TSVが貼り付けられている
- 1行目のヘッダーがApps Scriptの想定列名と一致している
- `status` が全行 `ready`
- `sendDate` が全行 `2026-06-05`
- `sendBatchId` が全行 `gmail-sales-2026-06-05-r2`
- Apps ScriptのScript Propertiesで `SEND_DATE=2026-06-05`
- Apps ScriptのScript Propertiesで `SEND_BATCH_ID=gmail-sales-2026-06-05-r2`
- `subject` / `body` が全行空でない
- `body` に不要案内が含まれる
- `sentStatus`、`replyStatus`、`unsubscribe`、`doNotContact` が送信除外値になっていない

Code.gsは `SEND_BATCH_ID` が設定されている場合、その値を当日の期待batchIdとして優先します。
未設定の場合は `SEND_BATCH_ID_PREFIX` と `SEND_DATE` から `gmail-sales-YYYY-MM-DD` を組み立てます。
そのためr2運用では、Sheet側の `sendBatchId` とScript Propertiesの `SEND_BATCH_ID` を必ず一致させます。

## outbox_validation_errorsの安全診断

`outbox_validation_errors` が出た場合は、本文、宛先、営業先名を出さずに `runPreflightDiagnosticsOnly()` を実行して原因別件数だけ確認します。

診断で見る項目は以下です。

- `totalRows`
- `candidateRows`
- `readyRows`
- `missingEmailCount`
- `missingSubjectCount`
- `missingBodyCount`
- `missingOptOutTextCount`
- `statusMismatchCount`
- `sendDateMismatchCount`
- `sendBatchIdMismatchCount`
- `duplicateInSheetCount`
- `duplicateBusinessCount`
- `excludedStatusCount`
- `previouslySentCount`
- `validationErrorCount`
- `expectedSendDate`
- `expectedSendBatchId`
- `sheetConnected`

この診断関数はGmail送信、自動返信、Google Sheets送信済み更新を行いません。
原因別件数を確認したうえで、r2 TSV再生成、Sheets貼り直し、またはScript Properties修正のどれが必要か判断します。

## readyRows=29 / validationErrorCount=1の対応

`readyRows=29`、`validationErrorCount=1` のように1件だけ落ちている場合は、個人情報を出さずに行番号とreason codeだけで特定します。

- `validationErrorRowNumbers`: シート上の行番号のみ
- `validationErrorReasonCounts`: reason code別件数のみ
- `validationErrorReasonSamples`: reason code名のみ

出してよいreason codeは、`PROHIBITED_EXPRESSION`、`OPT_OUT_PATTERN_MISMATCH`、`MISSING_SUBJECT_OR_BODY`、`REQUIRED_FIELD_WHITESPACE_ONLY`、`DUPLICATE_EMAIL`、`DUPLICATE_BUSINESS`、`SEND_BATCH_ID_MISMATCH`、`UNKNOWN_VALIDATION_ERROR` などです。
該当行は、本文の安全表現修正または未送信候補への差し替えで対応します。
本文全文、宛先、営業先名は記録しません。

## 本文改行エスケープの正規化

2026-06-05送信後に、メール本文へ `\n` や `\n\n` が文字列として表示される問題を確認しました。
原因は、Sheets貼り付け用TSVではセル内改行を `\n` として保持する一方、Apps Script送信直前で実改行へ復元していなかったことです。

送信前の必須条件として以下を追加します。

- body内の `\\r\\n` と `\\n` は実改行へ変換する
- 実際の `\r\n` と `\r` は `\n` へ正規化する
- 3連続以上の改行は2連続までに整える
- 行末の余分な空白を削る
- subject内の改行と `\\n` はスペースへ変換する
- Preflight診断で `escapedNewlineBodyCount` と `escapedNewlineSubjectCount` を確認する
- 送信直前に `expectedBodyWouldContainLiteralBackslashN=false` であることを確認する

本文全文はAgent Officeやログに表示しません。

## 2026-06-05送信後のAgent Office反映

2026-06-05分は `gmail-sales-2026-06-05-r2-2026-06-05` でPreflight成功後に30件送信完了済みです。

送信前の安全確認では以下を満たしていました。

- readyRows=30
- readyCount=30
- validationErrorCount=0
- sendBatchIdMismatchCount=0
- statusMismatchCount=0
- duplicateInSheetCount=0
- previouslySentCount=0
- blockedReason=""

送信後に対象行が `sent` へ更新されると、再度Preflightした場合にready行が0件になったり、`statusMismatchCount=30` になる場合があります。
これは送信後状態として正常な可能性があるため、送信前のblockedと混同しません。
送信済み行を `ready` に戻して再送信することは禁止します。

明日分outboxが未作成、またはAgent Officeに反映されていない場合、翌日の自動送信は `blocked` として扱う。

## 禁止事項

- このRunbook作成中にGmail送信しない
- 自動返信しない
- Apps Scriptトリガーをローカル作業から有効化しない
- Google Sheets送信済み更新を二重実行しない
- Instagram操作を行わない
- 宛先一覧、営業先一覧、本文、返信本文、秘密情報をGitに入れない
