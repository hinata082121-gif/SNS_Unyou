# 2026-06-04 Gmail outbox準備サマリー

## 目的

2026-06-04分のGmail営業メール30件送信用に、Google Sheetsの「Gmail送信対象」タブへ貼り付けられるTSVを準備する。

## 準備結果

結果: `needs_review`

ローカル既存データから再利用可能なGmail-ready候補は0件だったが、候補プール補充バッチを3件実行し、2026-06-04分のoutbox30件とSheets貼り付け用TSVを作成した。

## 件数

| 項目 | 件数 |
|---|---:|
| 目標送信件数 | 30 |
| 既存候補からの再利用可能件数 | 0 |
| 追加収集採用件数 | 30 |
| 最終ready件数 | 30 |
| 不足数 | 0 |
| outbox30件作成 | 1 |
| Sheets貼り付け用TSV作成 | 1 |

## sendDate / sendBatchId / nextActionDate

- sendDate: `2026-06-04`
- sendBatchId: `gmail-sales-2026-06-04`
- nextActionDate: `2026-06-07`

## 業態内訳

| 業態 | 件数 |
|---|---:|
| 整体 | 4 |
| 整骨院 | 5 |
| 美容室 | 6 |
| ネイルサロン | 4 |
| ペットサロン | 1 |
| パーソナルジム | 3 |
| ピラティス | 2 |
| ヨガスタジオ | 1 |
| フォトスタジオ | 2 |
| リフォーム会社 | 1 |
| カフェ・飲食 | 1 |

## 地域傾向

東京都内中心。

## 除外理由

- 2026-06-03送信済み候補と重複
- メールアドレスなし
- Web追加収集を時間超過で中止
- 補充バッチ内で2026-06-03送信済み重複を1件除外

## 検証結果

- 2026-06-03送信済み候補との重複を除外
- 既存メール付き候補は全件、2026-06-03送信済みと重複
- 推測メールアドレスは使用していない
- 問い合わせフォームのみ、Instagram URLのみの候補は採用していない
- outbox30件を作成
- Sheets貼り付け用TSVを作成
- TSVはヘッダー1行 + 30件
- `status=ready`、`sendDate=2026-06-04`、`sendBatchId=gmail-sales-2026-06-04` は30件確認
- 2026-06-03送信済み候補との重複は0件

## Google Sheetsへの貼り付け手順

1. `data/gmail/outbox/2026-06-04-gmail-sales-sheets-ready.tsv` を開く
2. TSV全文をコピーする
3. Google Sheetsの「Gmail送信対象」タブを開く
4. A1セルから貼り付ける
5. 30件 + ヘッダーが入ったことを確認する
6. Apps Scriptで `runPreflightCheckOnly()` を実行する
7. readyCount=30 / blockedReason="" を確認する
8. 自動トリガー有効化はその後に判断する

## 候補プール補充パイプライン

2026-06-04分は候補プール補充によりoutbox作成まで進行した。ただし推奨90件には60件不足しているため、以後も `docs/gmail/gmail-ready-candidate-pool-design-2026-06-03.md` と `docs/gmail/gmail-candidate-web-research-batch-plan-2026-06-03.md` に従い、5〜10件単位でGmail-ready候補を補充する。

outbox作成の再開条件:

- pool availableが30件以上
- 2026-06-03送信済み候補と重複なし
- 推測メールアドレスなし
- 問い合わせフォームのみ/Instagram URLのみ候補なし
- 配信停止/返信あり/送信禁止なし
- Sheets貼り付け用TSVを作れる列が揃っている

上記条件を満たしたが、今回はGmail本番送信、Google Sheets送信済み更新、自動トリガー有効化は行わない。次は人間がTSVをSheetsへ貼り付け、Apps ScriptのPreflightを確認する。

## 実行していないこと

- Gmail本番送信
- Gmail自動返信実送信
- `runDailyGmailSalesSend()` の実行
- `runScheduledDailySend()` の実行
- `setupDailyAutoSendTriggers()` の実行
- Google Sheets送信済み更新
- Instagram投稿/DM/コメント/フォロー/いいね
