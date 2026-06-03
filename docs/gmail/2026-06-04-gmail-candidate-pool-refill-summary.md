# 2026-06-04 Gmail-ready候補プール補充サマリー

## 目的

2026-06-04分のGmail営業メール30件送信がGmail-ready候補不足でblockedになったため、公開メールアドレス確認済み候補を小分けバッチで補充し、日次outbox作成へ進められる状態にする。

本サマリーには、メールアドレス、営業先名、URL、本文全文、Google Sheets ID、Apps Script URL、秘密情報を記載しない。

## 補充結果

| 項目 | 件数 |
|---|---:|
| 補充バッチ数 | 3 |
| 採用件数 | 30 |
| 除外件数 | 1 |
| 最終totalReady | 30 |
| availableForNextSend | 30 |
| 90件までの不足数 | 60 |
| 2026-06-04 outbox30件 | 作成済み |
| Sheets貼り付け用TSV | 作成済み |

## 除外理由

| 理由 | 件数 |
|---|---:|
| 2026-06-03送信済み候補との重複 | 1 |
| メール形式不正 | 0 |
| バッチ内重複 | 0 |
| 不要案内文不足 | 0 |

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

今後は埼玉南部と近接エリアの公開メールアドレス付き候補も補充し、地域偏りを抑える。

## 検証結果

| 確認項目 | 結果 |
|---|---|
| 2026-06-03送信済み重複 | 0 |
| 同一メール重複 | 0 |
| 同一dedupeKey重複 | 0 |
| メール形式不正 | 0 |
| 配信停止/不要案内文 | 30件確認 |
| outbox件数 | 30 |
| TSV行数 | ヘッダー1行 + 30件 |
| status=ready | 30 |
| sendDate=2026-06-04 | 30 |
| nextActionDate=2026-06-07 | 30 |
| sendBatchId=gmail-sales-2026-06-04 | 30 |

## 作成したGit管理禁止ファイル

- `data/gmail/candidates/2026-06-04-gmail-ready-batch-01.json`
- `data/gmail/candidates/2026-06-04-gmail-ready-batch-02.json`
- `data/gmail/candidates/2026-06-04-gmail-ready-batch-03.json`
- `data/gmail/pool/gmail-ready-candidate-pool.json`
- `data/gmail/outbox/2026-06-04-gmail-sales-outbox-30.json`
- `data/gmail/outbox/2026-06-04-gmail-sales-sheets-ready.json`
- `data/gmail/outbox/2026-06-04-gmail-sales-sheets-ready.tsv`

これらはメールアドレスまたは営業先情報を含むため、Gitに追加しない。

## 次アクション

1. 人間が `data/gmail/outbox/2026-06-04-gmail-sales-sheets-ready.tsv` をGoogle Sheetsの「Gmail送信対象」タブへ貼り付ける。
2. Apps Scriptで `runPreflightCheckOnly()` を実行する。
3. `readyCount=30`、`blockedReason=""`、`safeToSend` の状態を確認する。
4. 本番送信または自動トリガー有効化は、人間が別途判断する。

## 実行していないこと

- Gmail本番送信
- Gmail自動返信実送信
- Apps Scriptトリガー有効化
- Google Sheets送信済み更新
- Instagram投稿/DM/コメント/フォロー/いいね
