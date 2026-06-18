# Gmail安全通常営業再開 Runbook - 2026-06-19

## 目的

重大な重複送信事故後、Gmail営業を新規かつ未送信の候補だけで安全に再開する。

このRunbookにはメールアドレス、営業先名、本文、返信本文、Gmailスレッド情報、Sheet ID、Apps Script URL、トークンを記載しない。

## 通常準備コマンド

```powershell
npm run gmail:sales:prepare-safe -- --date 2026-06-19
```

このコマンドはGmail送信、Google Sheets更新、Apps Scriptトリガー操作を行わない。

## 必須条件

- Gmail Sent由来suppression ledgerが取得済み
- Google Sheets送信履歴の安全ハッシュが取得済み
- ローカルoutbox履歴が読める
- 候補プールがfresh
- パーソナライズ検証が全件成功
- duplicateCountが0
- private previewが作成済み
- 人間承認待ちである

いずれかを満たさない場合はblockedとし、outboxを作成しない。

## 2026-06-19現在の判定

- status: blocked
- sourceFresh: false
- suppressionLedgerLoaded: false
- gmailSentHistoryLoaded: false
- sheetHistoryLoaded: false
- localHistoryLoaded: true
- selectedCount: 0
- outboxCreated: false

## 次の人間作業

Apps Scriptへ最新 `Code.gs` を反映し、`exportSentSuppressionLedgerSafeOnly()` を実行して、返却されたhash-only ledgerを `tmp/gmail-incident/suppression-ledger-safe.json` に保存する。
