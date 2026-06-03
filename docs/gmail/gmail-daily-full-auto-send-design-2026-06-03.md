# Gmail営業メール30件/日 完全自動送信設計

## 目的

2026-06-04以降、Gmail営業メール30件/日をマストタスクとして運用できるようにする。

ただし、完全自動化でも安全条件を満たさない場合は送信しない。送信対象不足、Gmail残クォータ不足、重複、配信停止、返信あり、送信禁止、sendBatchId重複、Sheets更新失敗がある場合は `blocked` または `needs_review` として扱う。

## 現在の到達点

- 2026-06-03分はApps Script上で30件送信成功
- sentCount: 30
- failedCount: 0
- skippedCount: 0
- 送信後は安全状態へ戻す方針
- 現在のScript Propertiesは `DRY_RUN=true` / `LIVE_SEND_ENABLED=false` / `DAILY_SEND_LIMIT=30`

## 完全自動化の範囲

自動化すること:

- 11:30 Preflight
- 12:00 安全条件を満たす場合のみ30件送信
- 12:30 送信後確認
- 14:00 未送信/失敗/候補不足チェック
- 送信成功後のSheets更新
- sendBatchIdによる二重送信防止
- 送信後の `LIVE_SEND_ENABLED=false` / `AUTO_SEND_ENABLED=false` 復帰

自動化しないこと:

- 候補30件が不足した日の無理な送信
- 配信停止、返信あり、送信禁止先への送信
- 失敗分の自動再送信
- Gmail自動返信の本番送信
- Instagram投稿/DM/コメント
- 秘密情報の表示、保存、Git追加

## 毎日の処理フロー

| 時刻 | 処理 | 関数 | 送信有無 |
|---|---|---|---|
| 前日/当日朝 | Gmail送信用候補30件を準備 | ローカルまたは手動 | なし |
| 11:30 | Preflight | `runScheduledPreflight()` | なし |
| 12:00 | 自動送信 | `runScheduledDailySend()` | 条件達成時のみ |
| 12:30 | 送信後確認 | `runPostSendCheck()` | なし |
| 14:00 | 失敗/不足確認 | `runFailureRecoveryCheck()` | なし |
| 17:00 | 当日まとめ | Hermes/Agent Office | なし |

## Script Properties設計

| Key | 推奨値 | 目的 |
|---|---|---|
| `DRY_RUN` | `true` 初期値 | trueなら送信しない |
| `LIVE_SEND_ENABLED` | `false` 初期値 | trueで本番送信許可 |
| `AUTO_SEND_ENABLED` | `false` 初期値 | 定期トリガーからの自動送信許可 |
| `AUTO_RESET_LIVE_SEND_AFTER_RUN` | `true` | 送信後に本番送信設定をOFFへ戻す |
| `DAILY_SEND_LIMIT` | `30` | 1日の送信上限 |
| `PREFLIGHT_HOUR` | `11` | Preflight時刻 |
| `SEND_HOUR` | `12` | 送信時刻 |
| `POST_SEND_CHECK_HOUR` | `12` | 送信後確認時刻 |
| `SEND_BATCH_ID_PREFIX` | `gmail-sales` | バッチID接頭辞 |
| `REQUIRE_EXACT_READY_COUNT` | `true` | ready行が30件ちょうどの場合のみ送信 |
| `REQUIRE_OPT_OUT_TEXT` | `true` | 配信停止/不要案内必須 |
| `REQUIRE_UNIQUE_BATCH` | `true` | 同一バッチ再送信防止 |
| `MAX_FAILURES_BEFORE_STOP` | `1` | 1件失敗で停止 |

実値、Sheet ID、Apps Script URL、GmailトークンはGitに書かない。

## Sheets列設計

送信対象シートは `docs/gmail/gmail-send-target-sheet-schema-2026-06-03.md` に定義する。

必須列:

- `email` または `contactEmail`
- `subject`
- `body`
- `status`
- `sendDate`
- `nextActionDate`
- `dedupeKey`
- `sendBatchId`
- `sentAt`
- `sentStatus`
- `replyStatus`
- `unsubscribe`
- `doNotContact`

## sendBatchId設計

形式:

```text
gmail-sales-YYYY-MM-DD
```

例:

```text
gmail-sales-2026-06-04
```

同じ `sendBatchId` は一度しか送信しない。送信成功後はScript Propertiesへ送信済みバッチとして記録し、再実行時に `batch_already_sent` として停止する。

## 送信条件

すべて満たす場合のみ送信する。

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- `AUTO_SEND_ENABLED=true`
- `DAILY_SEND_LIMIT=30`
- `readyCount=30`
- `remainingQuota>=30`
- `sheetConnected=true`
- `blockedReason=""`
- `status=ready` の行が30件
- `sendDate` が当日
- 全行に `email` または `contactEmail` がある
- 全行に `subject` と `body` がある
- 全文に配信停止/不要案内がある
- 送信済み、返信あり、配信停止、送信禁止、重複が0件
- 全行が当日の `sendBatchId` を持つ
- 同じ `sendBatchId` が過去送信済みではない

## 安全停止条件

以下のいずれかに該当したら送信しない。

- readyCountが30未満または30超過
- Gmail残クォータ不足
- Sheet接続失敗
- 重複あり
- 配信停止、返信あり、送信禁止あり
- sendDate不一致
- subject/body欠落
- 配信停止案内欠落
- `AUTO_SEND_ENABLED=false`
- `LIVE_SEND_ENABLED=false`
- `DRY_RUN=true`
- 当日バッチが送信済み
- Sheets更新失敗
- LockService取得失敗
- その他検証エラー

## 送信後の自動安全復帰

`AUTO_RESET_LIVE_SEND_AFTER_RUN=true` の場合、送信成功時も失敗時も以下へ戻す。

- `LIVE_SEND_ENABLED=false`
- `AUTO_SEND_ENABLED=false`

これにより、同じ日の再実行や誤操作による二重送信を防ぐ。

## 失敗時の扱い

- 自動再送信はしない
- 失敗分は `needs_review` として記録
- 14:00に `runFailureRecoveryCheck()` で状態を確認
- Agent Officeでは `blocked` または `needs_review` として表示
- 人間が原因確認後、翌日以降の候補準備へ反映

## Agent Office連携

Agent Officeでは以下を表示する。

- 2026-06-03分は送信成功
- 2026-06-04以降は完全自動化設計済み
- 本番トリガー有効化は人間確認後
- 送信対象30件が揃わない日は送信しない
- 送信後は再送信防止状態へ戻す

## 緊急停止手順

1. Apps Script画面で `removeDailyAutoSendTriggers()` を実行
2. Script Propertiesを以下に戻す
   - `DRY_RUN=true`
   - `LIVE_SEND_ENABLED=false`
   - `AUTO_SEND_ENABLED=false`
3. Google Sheetsで当日バッチの状態を確認
4. Agent Officeへ `blocked` または `needs_review` として記録

## 本番化前チェックリスト

- [ ] 送信対象シートに30件だけ `ready` がある
- [ ] 全行の `sendDate` が当日
- [ ] 全行の `sendBatchId` が当日形式
- [ ] 同じバッチが過去送信済みではない
- [ ] 返信あり、配信停止、送信禁止が0件
- [ ] Gmail残クォータが30以上
- [ ] 本文に配信停止/不要案内がある
- [ ] `runScheduledPreflight()` が安全に通る
- [ ] 人間が本番トリガー有効化を承認した

