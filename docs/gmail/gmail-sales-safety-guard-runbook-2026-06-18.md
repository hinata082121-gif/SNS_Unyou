# Gmail営業送信 Safety Guard Runbook - 2026-06-18

## 目的

Gmail営業メールの重複送信、誤宛名、古いTSV再利用、時間外送信を防ぐ。

## 送信前に必ず満たす条件

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`
- `AUTO_SEND_ENABLED=true`
- `DAILY_SEND_LIMIT=30`
- `REQUIRE_EXACT_READY_COUNT=true`
- `REQUIRE_UNIQUE_BATCH=true`
- `REQUIRE_OPT_OUT_TEXT=true`
- `REQUIRE_EXPLICIT_BATCH_APPROVAL=true`
- 許可時間窓内であること
  - `ALLOWED_SEND_START_HOUR=11`
  - `ALLOWED_SEND_START_MINUTE=55`
  - `ALLOWED_SEND_END_HOUR=12`
  - `ALLOWED_SEND_END_MINUTE=15`
- `APPROVED_BATCH_ID` が当日の `sendBatchId` と一致する。
- `APPROVED_BATCH_CHECKSUM` が当日Sheetの30 ready行から計算される承認チェックサムと一致する。
- `APPROVAL_EXPIRES_AT` が現在時刻より未来である。

## 送信直前ガード

Apps Scriptは送信直前に以下を検査する。

- 許可時間窓外なら `outside_allowed_send_window` で停止
- 明示承認がなければ `explicit_batch_approval_required` で停止
- ready行数が30件でなければ停止
- 同一batchが送信済みなら停止
- 件名/本文が空なら停止
- オプトアウト文がなければ停止
- 禁止表現があれば停止
- 本文に行データの営業先名が含まれなければ停止
- 未展開プレースホルダーが残っていれば停止

## 安全な承認チェックサム

承認チェックサムは、行番号、宛先、営業先名、件名を不可逆ハッシュ化した候補セットから作る。

チェックサム自体は秘密情報ではないが、古いTSVや別候補セットの送信を防ぐため、毎回当日のSheet状態から確認して設定する。

送信せずに当日の承認チェックサムだけを確認する関数:

```text
runBatchApprovalChecksumPreviewOnly()
```

この関数は `approvalChecksum`、`sendBatchId`、`readyCount`、`targetCount` だけを安全ログへ出し、Gmail送信やGoogle Sheets更新は行わない。

## 事故時の分類

- 時間外に送信された行は `sent_outside_allowed_window`
- 重複候補に送信された行は `duplicate_recipient`
- 宛名と本文が一致しない行は `mispersonalized`
- 監査未完了の行は `needs_human_review`

これらは、人間確認が終わるまで営業送信完了数に含めない。

## Gmail Sent suppression ledger

Gmail Sent実体を最優先の送信済み事実として取り込むため、Apps Scriptで以下を実行する。

```text
runSentHistoryIncidentAuditOnly()
```

この関数はGmail送信、自動返信、Google Sheets更新、トリガー操作を行わない。
対象件名の送信済みメールを2026-06-11 00:00 JST以降で監査し、宛先・営業先・本文をログに出さず、再送禁止用のハッシュ台帳をScript Propertiesへ保存する。

6月11日以降に一度でも送った宛先は、誤送信であっても `suppressed=true` / `futureEligible=false` とする。

## ローカル監査コマンド

以下はGmail送信・Google Sheets更新を行わず、件数とハッシュだけを記録する。

```powershell
npm run gmail:sales:safety:test
npm run gmail:sales:forensic:audit
npm run gmail:recovery:prepare-noon
```

## Git管理禁止

- `data/gmail/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`
- `.env`
- `.env.local`
- outbox本体
- TSV本文
- メールアドレス入りファイル
- 営業先一覧
- Gmail返信本文
- Gmailスレッド全文
