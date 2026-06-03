# 2026-06-04 Gmail outbox準備サマリー

## 目的

2026-06-04分のGmail営業メール30件送信用に、Google Sheetsの「Gmail送信対象」タブへ貼り付けられるTSVを準備する。

## 準備結果

結果: `blocked`

ローカル既存データから再利用可能なGmail-ready候補が0件だったため、2026-06-04分のoutbox30件とSheets貼り付け用TSVは作成しない。

## 件数

| 項目 | 件数 |
|---|---:|
| 目標送信件数 | 30 |
| 既存候補からの再利用可能件数 | 0 |
| 追加収集採用件数 | 0 |
| 最終ready件数 | 0 |
| 不足数 | 30 |
| outbox30件作成 | 0 |
| Sheets貼り付け用TSV作成 | 0 |

## sendDate / sendBatchId / nextActionDate

30件未達のため、送信対象ファイルは作成していない。

作成できた場合の予定値:

- sendDate: `2026-06-04`
- sendBatchId: `gmail-sales-2026-06-04`
- nextActionDate: `2026-06-07`

## 業態内訳

30件未達のため、採用業態内訳はなし。

## 地域傾向

30件未達のため、採用地域傾向はなし。

## 除外理由

- 2026-06-03送信済み候補と重複
- メールアドレスなし
- Web追加収集を時間超過で中止

## 検証結果

- 2026-06-03送信済み候補との重複を除外
- 既存メール付き候補は全件、2026-06-03送信済みと重複
- 推測メールアドレスは使用していない
- 問い合わせフォームのみ、Instagram URLのみの候補は採用していない

## Google Sheetsへの貼り付け手順

今回はTSVを作成していないため、Google Sheetsへ貼り付けるものはない。

30件確定後の手順:

1. `data/gmail/outbox/2026-06-04-gmail-sales-sheets-ready.tsv` を作成する
2. TSV全文をコピーする
3. Google Sheetsの「Gmail送信対象」タブを開く
4. A1セルから貼り付ける
5. 30件 + ヘッダーが入ったことを確認する
6. Apps Scriptで `runPreflightCheckOnly()` を実行する
7. readyCount=30 / blockedReason="" を確認する
8. 自動トリガー有効化はその後に判断する

## 実行していないこと

- Gmail本番送信
- Gmail自動返信実送信
- `runDailyGmailSalesSend()` の実行
- `runScheduledDailySend()` の実行
- `setupDailyAutoSendTriggers()` の実行
- Google Sheets送信済み更新
- Instagram投稿/DM/コメント/フォロー/いいね

