# Gmail翌日outbox準備（2026-06-08対象）

- 実行日: 2026-06-07
- 翌日対象日: 2026-06-08
- nextActionDate: 2026-06-15

## 安全集計

- poolTotal: 65
- statusAvailableCount: 60
- availableChecked: 60
- excludedHistoricalCount: 30
- availableForNextSend: 30
- requiredOutboxCount: 30
- shortage: 0

メールアドレス、営業先名、本文、スレッド全文、秘密情報はこの要約に含めていない。

## 実行結果

- 既存ワークフロー: `npm run gmail:outbox:select -- --date 2026-06-08 --next-action-date 2026-06-15`
- tomorrowOutboxReady: true
- tomorrowOutboxCount: 30
- sheetsReadyCreated: true
- sheetsReadyCount: 30
- Sheet反映: 未実施（安全な既存経路を確認できなかったため needs_review）

outbox本体およびSheets取り込み用ファイルは `data/gmail/outbox/` 配下に作成済み。これらはGit追加対象外。

## 禁止事項の遵守

- Gmail送信なし
- `runDailyGmailSalesSend()` 実行なし
- 自動返信なし
- Apps Scriptトリガー作成・削除・変更なし
- Google Sheets送信済み更新なし
- Instagram投稿/DM/コメント/フォロー/いいねなし
- 本番メールテンプレート自動差し替えなし
- `data/gmail/` 本体、`data/prospects/`、`docs/reports/sales/`、`tmp/` はGit追加しない
- `.env` / `.env.local` は読んでいない
- APIキー、トークン、Sheet ID、Apps Script URL、Webhook URLは表示していない
- メールアドレス、営業先名、返信本文、Gmailスレッド全文は表示・保存・コミットしていない
- `git add .` は使わない

## 次アクション

2026-06-08 12:00の自動送信前に、作成済みoutbox30件を安全なSheet反映経路で取り込む。安全経路が確認できない場合は人間が手動で反映し、送信前チェックのみ実施する。
