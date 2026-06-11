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
| 毎日 12:30 | `8613043c053f` | ICHI Gmail 12:30送信結果・Agent Office反映チェック | 12:00結果、安全設定復帰、Agent Status更新、Agent Office反映、検証、commit/pushを行い、返信確認へ引き継ぐ |
| 毎日 14:00 | `0305facfaef7` | ICHI Gmail 14時 失敗・不足リカバリ確認 | 未送信・失敗・候補不足・未反映をneeds_review/blocked化 |
| 毎日 17:00 | `5b20e0820c82` | ICHI Gmail 17時 返信確認・翌日準備チェック | 返信確認、翌日outbox/availableForNextSend、次アクション整理 |
| 毎日 17:20 | `4e4ed67216e3` | ICHI Gmail 毎日17:20 翌日outbox30件自動準備 | 翌日分outbox30件と安全なAgent Statusを準備 |
| 毎日 17:30 | `ee8473f970ff` | ICHI Gmail 毎日17:30 返信確認実行・記録 | 返信確認実行状態と人間確認要否を安全に記録 |
| 毎日 18:30 | `1365e7b16899` | ICHI Agent Office 毎日18:30 反映監査・未反映検知 | 当日タスクの未反映、stale、blocked、needs_reviewを監査 |
| 月・木 16:00 | `758eef276079` | ICHI Gmail 候補プール不足時 補充強化チェック | 候補プールが推奨数を下回る場合に補充強化をneeds_review化 |
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
- 12:30: 送信済み本文に `\n` が文字列として表示されていないか、可能な範囲で安全な件数だけ確認する
- 12:30: `npm run gmail:send-result:record` で当日送信結果をAgent Statusへ反映する
- 12:30: `agent:status:validate`、`agent:status:render`、`agent:office:render`、`lint`、`build` を実行する
- 12:30: 安全なAgent Status JSONとdocsだけを個別にGit追加し、commit/pushして `/agent-office` に反映する
- 14:00: failed/blocked、候補不足、Agent Office未反映を確認する
- 17:00: 返信確認、人間確認要否、翌日準備状況を確認する
- failed/blockedが出た場合は自動送信停止をnextActionに明記する
- 自動返信はOFFのまま扱う

## 日次監視の不足箇所と追加タスク

2026-06-04のHermes確認では、翌日outbox準備、返信確認結果記録、Agent Office反映監査、候補プール不足時チェックが未自動化箇所として残っていました。
同日中に4タスクはHermesへ登録済みになりました。

登録済みタスク:

- 17:20: `4e4ed67216e3` 翌日outbox30件自動準備。tomorrowOutboxReadyとtomorrowOutboxCountをAgent Officeへ反映する
- 17:30: `ee8473f970ff` 返信確認実行・記録。replyCheckExecutedとneedsHumanEmailCheckをAgent Officeへ反映する
- 18:30: `1365e7b16899` Agent Office反映監査。missing/stale/blocked/needs_reviewを検知する
- 月木16:00: `758eef276079` 候補プール不足時 補充強化チェック。totalReady<90またはavailableForNextSend<60をneeds_review化する

これらの追加タスクは、Gmail送信、自動返信、Apps Scriptトリガー操作、Google Sheets送信済み更新、Instagram操作を行いません。

注意: 17:20の翌日outbox自動準備タスクは初回実行が2026-06-05 17:20のため、2026-06-05 12:00のGmail自動送信には間に合いません。
2026-06-05分だけは、outbox30件とSheets貼り付け用TSVを事前準備しました。
しかし緊急確認で、2026-06-05分outboxが2026-06-04送信済み候補と30件すべて重複していたため、旧outbox/TSVは使用禁止です。
公開メール確認済み候補を緊急補充し、過去送信済み候補と重複ゼロの新outbox30件とSheets貼り付け用TSVを再作成しました。
Agent Officeには `tomorrowOutboxReady=true`、`duplicateWithPreviousBatch=false`、`duplicateWithPastSent=false`、`duplicateCount=0`、`sheetPasted=false`、`preflightRequired=true` として記録します。
旧6/5 TSVがSheetsに入っている場合は、送信前に必ず新TSVへ差し替え、Preflightで `readyCount=30` と `blockedReason=""` を確認します。

完全自動化開始前に人間がApps Scriptで確認する関数:

- `setupDailyAutoSendTriggers()`
- `setupReplyCheckTriggers()`

緊急停止時に人間が実行する関数:

- `removeDailyAutoSendTriggers()`
- `removeReplyCheckTriggers()`

Hermesはトリガーを勝手に有効化せず、`/agent-office` に安全な件数、状態、nextActionのみを反映します。

## 週次営業メール改善監視

日次の送信・返信監視に加えて、毎週金曜18:00に営業メール改善・反応率分析を行う方針です。

- 金曜17:00の市場・競合分析結果を確認する
- 直近7日間のGmail営業結果を安全な件数だけで集計する
- 翌週の件名、本文、CTA、訴求軸の改善案を作成する
- 改善案は `needs_review` としてAgent Officeに表示する
- 本番テンプレートへの反映は人間承認後に限定する
- 自動返信、本番送信、Apps Scriptトリガー操作、本番テンプレート自動差し替えは行わない

表示するのは反応率や件数、改善案の状態、nextActionのみです。メールアドレス、営業先名、返信本文、Gmailスレッド全文、秘密情報は表示しません。

## 本文改行エスケープ監視

2026-06-05送信後に、本文内の改行エスケープが文字列として表示される問題を確認しました。
Hermesは次回以降、送信前Preflight診断で `escapedNewlineBodyCount`、`escapedNewlineSubjectCount`、`bodyNormalizedCount`、`subjectNormalizedCount` を確認します。

- `escapedNewlineBodyCount` が0でない場合でも、Apps Script送信直前の正規化が入っていることを確認する
- `expectedBodyWouldContainLiteralBackslashN=false` を確認する
- 本文全文、宛先、営業先名は表示しない
- 問題が残る場合は `needs_review` としてAgent Officeへ反映する

## 2026-06-05送信後の監視整理

2026-06-05分は `gmail-sales-2026-06-05-r2-2026-06-05` でPreflight成功後に30件送信完了済みです。
Hermesは古いPreflight blockedや診断待ちを残さず、Agent Statusを送信済み・再送信禁止の状態へ更新します。

送信前に確認済みの安全な件数:

- readyRows=30
- readyCount=30
- validationErrorCount=0
- sendBatchIdMismatchCount=0
- duplicateInSheetCount=0
- previouslySentCount=0
- blockedReason=""

送信後はGoogle Sheets側で対象行が `sent` へ変わるため、readyRows=0やstatusMismatchCount=30が出ても、送信後状態として正常な場合があります。
Hermesはこの状態を送信前Preflight失敗として扱わず、再送信禁止、返信確認、翌日準備、反映監査をnextActionにします。

## 12:30 Agent Office自動反映フロー

明日以降、12:30の送信結果確認タスクは確認だけで終わらせず、Agent Office反映まで進めます。

標準コマンド:

```powershell
npm run gmail:send-result:record -- --date YYYY-MM-DD --send-batch-id gmail-sales-YYYY-MM-DD --processed 30 --failed 0 --batch-marked-sent true --live-send-reset-after-run true
npm run agent:status:validate
npm run agent:status:render
npm run agent:office:render
npm run lint
npm run build
```

その後、安全なファイルだけを個別に `git add` し、commit/pushします。

12:30タスクではGmail本番送信、`runDailyGmailSalesSend()`、Google Sheets更新、Apps Scriptトリガー操作、自動返信、Threads投稿、Instagram操作を行いません。
送信済み行をreadyへ戻さず、同一sendBatchIdの再送信は禁止します。

## 2026-06-07 stale batch停止監視

2026-06-07のApps Script診断では、通常日次運用が2026-06-05の緊急r2 batchを参照したままになっており、6/6・6/7の送信停止が確認されました。

Hermesは以下を監視します。

- 12:00送信チェックはJST当日を使っているか
- 17:20翌日outbox準備はJST翌日を使っているか
- 6/5の緊急r2 batchが6/6以降へ持ち越されていないか
- `staleSendDate` / `staleBatchId` がtrueの場合にblocked化されているか
- `batch_already_sent` が出た場合に再送ではなく新日付outbox準備がnextActionになっているか
- Apps Script診断ログの `dryRun` / `liveSendEnabled` / `autoSendEnabled` がAgent Officeの表示と一致しているか

送信済み行をreadyへ戻さず、古いsendBatchIdを再利用せず、2026-06-08分は新しい当日batchでPreflightを確認します。

## 2026-06-09翌日outbox準備の点検結果

17:20翌日outbox準備は、JST翌日の日付を使い、通常batchId `gmail-sales-YYYY-MM-DD` を生成する運用です。
2026-06-08の点検では、2026-06-09分として以下を確認しました。

- sendDate: `2026-06-09`
- sendBatchId: `gmail-sales-2026-06-09`
- selectedCount: 5
- targetCount: 30
- shortage: 25
- duplicateCount: 0
- duplicateWithPreviousBatch: false
- duplicateWithPastSent: false
- sheetsReadyTsvCreated: false
- sheetSynced: false

過去送信済み候補を除外した結果、30件未満のためoutbox/TSVは作成せず `blocked` とします。
Hermesは候補補充をnextActionにし、送信済み行をreadyへ戻したり、6/5/6/8の送信済みbatchを再利用したりしません。
安全なGoogle Sheets自動反映経路が確認できるまでは、Sheet投入は `manualPasteRequired=true` として扱い、Preflight前の人間確認対象にします。

同日中の候補補充後、2026-06-09分は30件選出とSheets貼り付け用TSV作成まで復旧しました。

- selectedCount: 30
- shortage: 0
- duplicateCount: 0
- duplicateWithPreviousBatch: false
- duplicateWithPastSent: false
- sheetsReadyTsvCreated: true
- sheetSynced: false
- manualPasteRequired: true

Hermesは6/9送信前に、TSV貼付済みか、`runPreflightDiagnosticsOnly()` と `runPreflightCheckOnly()` がreadyCount=30、blockedReason空を返すかを確認します。
Sheet未反映またはPreflight未実行なら送信可能扱いにしません。

## 2026-06-09〜2026-06-11未送信の原因

2026-06-09、2026-06-10、2026-06-11の送信は0件でした。
2026-06-11診断では、`currentJstDate`、`expectedSendDate`、`expectedSendBatchId` は正常で、`staleSendDate=false`、`staleBatchId=false` でした。

停止原因は、Gmail送信対象シートに当日分ready行30件がなかったことです。

- candidateRows: 0
- readyRows: 0
- statusMismatchCount: 30
- sendDateMismatchCount: 0
- sendBatchIdMismatchCount: 0
- validationErrorCount: 0
- blockedReason: `no_ready_rows,exact_ready_count_not_met`

17:20タスクがTSV作成までで止まり、Sheet反映が `manualPasteRequired=true` のままだと、翌日12:00の自動送信はready行不足でblockedになります。
今後の17:20タスクは、翌日outbox30件選出、Sheets-ready TSV作成、可能なら安全なSheet同期、Sheet同期後のPreflight診断またはreadyRows検証までを担当します。
Sheet同期が未設定の場合は `needs_review` とし、Gmail送信は行いません。

2026-06-11分はoutbox30件とTSVを作成済みです。
ただしGoogle Sheets本体はCodexから直接更新していないため、送信前にTSV反映とPreflight再実行が必要です。
6/9・6/10の後追い再送は行いません。

## 2026-06-11 Sheet自動反映監視

17:20の翌日outbox準備は、outbox/TSV作成だけでなく、Sheet反映のdry-runまたは本番同期結果まで確認します。

監視する安全な項目:

- sendDate
- sendBatchId
- selectedCount
- rowCount
- duplicateCount
- validationErrorCount
- sheetSynced
- manualPasteRequired
- readyRowsVerified
- blockedReason

本番同期は `GMAIL_SHEET_SYNC_ENABLED=true` かつ `GMAIL_SHEET_SYNC_DRY_RUN=false` の場合だけ許可します。
未設定またはdry-runの場合は `sheetSynced=false`、`manualPasteRequired=true` として、翌日12:00送信前に人間確認または本番同期有効化が必要な状態で表示します。

Apps Script Web App受信口を使う場合、`Code.gs` の変更はGitHub pushだけでは本番反映されません。
script.google.comへ手動反映し、Script Propertiesに同期トークンを設定してから本番同期を有効化します。
HermesはWebhook URL、トークン、Sheet ID、メールアドレス、営業先名、本文全文を表示しません。
