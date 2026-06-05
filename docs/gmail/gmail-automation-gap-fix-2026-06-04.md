# Gmail自動化ギャップ修正設計 2026-06-04

## 目的

Hermesの本日確認で判明したGmail営業30件/日運用の未自動化箇所を整理し、翌日outbox準備、返信確認結果記録、Agent Office反映監査、候補プール不足時補充チェックを自動化タスクとして追加する。

この設計は、Gmail送信、自動返信、Apps Scriptトリガー操作、Google Sheets送信済み更新、Instagram操作を行わない。Agent Officeには安全な件数、状態、nextActionだけを反映する。

## Hermes確認結果から判明した未自動化箇所

### Gmail営業候補プール更新

- status: blocked
- 新規追加: 3件
- totalReady: 33件
- availableForNextSend: 33件
- 推奨90件まで不足: 57件
- 最低30件は維持しているが、推奨90件には不足

### 2026-06-04分outbox準備

- status: needs_review
- readyCount: 30
- outboxCreated: true
- sheetsReadyTsvCreated: true
- sheetPasted: false
- preflightPassed: false
- 人間によるTSV貼り付け・Preflight確認が必要という表示が残っている

### 17:00返信確認・翌日準備チェック

- status: blocked
- replyCheckResultKnown: false
- replyCheckExecuted: false
- availableForNextSend: 33
- tomorrowOutboxReady: false
- tomorrowOutboxCount: 0
- blockedReason: reply check結果不明、翌日outbox30件未作成

### Agent Office反映監査

- 毎日18:30の反映監査タスク設計は追加済み
- Hermes実登録タスクとして `1365e7b16899` を登録済み
- Agent Office未反映そのものを検知する運用を開始できる状態

## 修正方針

- 毎日17:20に翌日outbox30件自動準備を行う
- 毎日17:30に返信確認実行・記録を行う
- 毎日18:30にAgent Office反映監査・未反映検知を行う
- 月木16:00に候補プール不足時の補充強化チェックを行う
- すべてのタスクは安全なAgent Status JSONとsummary docsのみをGit対象にする
- `data/gmail/` 本体、outbox、候補プール、送信ログ、メールアドレス一覧はGit追加しない

## 新規追加するHermesタスク一覧

| タスク名 | cron候補 | 役割 |
|---|---:|---|
| ICHI Gmail 毎日17:20 翌日outbox30件自動準備 | `20 17 * * *` | 登録済み。ジョブID: `4e4ed67216e3`。availableForNextSendが30件以上なら翌日分outbox30件を作成し、Agent Status JSONを作る。Sheets反映できない場合はneeds_reviewとして明確化する。 |
| ICHI Gmail 毎日17:30 返信確認実行・記録 | `30 17 * * *` | 登録済み。ジョブID: `ee8473f970ff`。Apps Scriptの返信確認結果、または安全なAgent Statusから返信確認状態を確認し、replyCheckExecutedとneedsHumanEmailCheckをAgent Officeへ反映する。 |
| ICHI Agent Office 毎日18:30 反映監査・未反映検知 | `30 18 * * *` | 登録済み。ジョブID: `1365e7b16899`。当日実行予定だった自動化タスクのAgent Status更新有無、missing/stale/blocked/needs_reviewを検知する。 |
| ICHI Gmail 候補プール不足時 補充強化チェック | `0 16 * * 1,4` | 登録済み。ジョブID: `758eef276079`。totalReadyが90件未満、またはavailableForNextSendが60件未満の場合に補充強化が必要と記録する。 |

## 2026-06-05分の一回限り事前準備

17:20の翌日outbox自動準備タスクは初回実行が2026-06-05 17:20であり、2026-06-05 12:00のGmail自動送信には間に合わない。
そのため、2026-06-05分だけは既存の安全なローカルワークフローでoutbox30件とSheets貼り付け用TSVを事前準備した。

ただし緊急確認で、2026-06-05分outbox30件は2026-06-04送信済み候補と30件すべて重複していた。
旧2026-06-05 outbox/TSVは使用禁止とし、`invalid-duplicate` 扱いにした。
その後、公開メール確認済み候補を緊急補充し、過去送信済み候補と重複ゼロの新2026-06-05 outbox30件とSheets貼り付け用TSVを再作成した。

Agent Officeには、`tomorrowOutboxReady=true`、`tomorrowOutboxCount=30`、`duplicateWithPreviousBatch=false`、`duplicateWithPastSent=false`、`duplicateCount=0`、`sheetPasted=false`、`preflightRequired=true` の安全な状態だけを記録する。
outbox本体、TSV本文、メールアドレス、営業先名はGitに追加しない。

候補プールは緊急補充後に `totalReady=65`、過去送信済み除外後の `availableForNextSend=35` まで改善したが、推奨90件には55件不足している。

## batch_already_sent発生時の対応

Preflightで `batch_already_sent` が出た場合、同一 `sendBatchId` は再利用しない。
旧batchIdは使用禁止にし、同じ候補セットを使う場合でも `gmail-sales-YYYY-MM-DD-r2` のように新しいbatchIdでoutbox/TSVを再作成する。

2026-06-05では `gmail-sales-2026-06-05` が使用済み扱いになったため、`gmail-sales-2026-06-05-r2` を発行した。
r2 outboxは過去送信済み候補との重複ゼロを確認済みで、Agent Officeには `batchAlreadySentDetected=true`、`batchIdRotated=true`、`safeToSendAfterSheetUpdate=pending` として記録する。

## r2後もreadyCount=0になる場合の対応

`batch_already_sent` が消えた後に `readyCount=0`、`blockedReason=no_ready_rows,exact_ready_count_not_met` が残る場合は、batchIdローテーション自体は成功しています。
この状態ではGmail送信を有効化せず、Sheet上の行がApps Scriptのready判定を満たしているかを確認します。

確認する項目は以下です。

- 正しいr2 TSVがGmail送信対象シートに貼られている
- ヘッダー列がApps Scriptの想定と一致している
- `status=ready`
- `sendDate=2026-06-05`
- `sendBatchId=gmail-sales-2026-06-05-r2`
- `subject` と `body` が空でない
- `body` に不要案内がある
- `unsubscribe`、`doNotContact`、`sentStatus`、`replyStatus` が送信除外値になっていない
- Apps Scriptの `SEND_DATE` と `SEND_BATCH_ID` がSheet側の値と一致している

2026-06-05 r2 TSVは、ローカル検証上は30件すべてready条件を満たしています。
`no_ready_rows` が続く場合は、Sheet差し替え未反映、貼り付け先タブ違い、ヘッダー崩れ、またはScript Propertiesの `SEND_BATCH_ID` 未設定を優先して確認します。

`outbox_validation_errors` が併発する場合は、Apps Scriptの `runPreflightDiagnosticsOnly()` を実行して、原因別件数だけを確認します。
診断ログには、宛先、営業先名、件名全文、本文全文、Sheet ID、URL、秘密情報を出しません。
確認対象は `status`、`sendDate`、`sendBatchId`、メール列の存在、件名/本文の空欄、不要案内、重複、送信除外ステータス、過去送信済み判定です。
診断結果をもとに、r2 TSVの再生成、Sheets貼り直し、Script Properties修正のどれを行うか判断します。

`readyRows=29`、`validationErrorCount=1` のように1件だけ落ちた場合は、`validationErrorRowNumbers` とreason codeだけを出します。
該当行のメールアドレス、営業先名、件名全文、本文全文は表示しません。
reason codeが `PROHIBITED_EXPRESSION`、`OPT_OUT_PATTERN_MISMATCH`、`REQUIRED_FIELD_WHITESPACE_ONLY` などの場合は、r2 TSVを安全表現へ修正して再貼り付けします。

## 既存タスクの補強方針

- 17:00返信確認・翌日準備チェックは、17:20 outbox準備と17:30返信確認の結果を前提にする
- 14:00リカバリ確認は、当日送信失敗だけでなく翌日準備の不足をnextActionに残す
- 月木10:30営業リスト更新は、90件維持に届かない場合に月木16:00補充強化チェックへ接続する
- 18:30反映監査は、Hermes監視タスクの失敗や未反映も検知する

## 安全設計

- Gmail送信しない
- 自動返信しない
- Apps Scriptトリガー操作しない
- Google Sheets送信済み更新しない
- Instagram操作しない
- 本番メールテンプレート差し替えしない
- 返信本文、宛先、営業先名、Gmailスレッド全文を表示しない
- Agent Officeには件数、状態、blocked理由、nextActionだけを出す

## Git追加禁止ファイル

- `data/gmail/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`
- `.env`
- `.env.local`
- メールアドレス入りファイル
- 営業先一覧
- Gmail返信本文
- Gmailスレッド全文
- 送信ログ本体
- outbox本体

## 秘密情報を扱わない方針

この設計とHermes登録プロンプトは、秘密情報、メールアドレス、営業先名、返信本文、Gmailスレッド全文を扱わない。必要な判断は、安全なAgent Status JSON、summary docs、件数メトリクスだけで行う。
