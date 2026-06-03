# 2026-06-03 Gmail outbox Google Sheets投入用サマリー

## 目的

Apps Scriptの `runPreflightCheckOnly()` が `sheetConnected=true` だが `readyCount=0` になったため、ローカルのGmail outbox30件を、Apps Scriptが読み取れるGoogle Sheets貼り付け形式へ整形する。

## readyCount=0 の原因推定

Google Sheetsへの接続自体は成功しているため、原因はシート側のデータ構造にある可能性が高い。

想定される原因:

- 対象タブが空
- 1行目ヘッダーがCode.gsの想定列名と合っていない
- メール宛先列が `宛先メール` または `email` として認識されていない
- `status` / `sentStatus` / `送信ステータス` が送信対象として解釈できる値になっていない
- 送信対象行がGoogle Sheetsにまだ貼り付けられていない

## Apps Scriptが期待する主な列名

Code.gsは以下の列名を参照する。

- `宛先メール`
- `email`
- `店舗名`
- `name`
- `送信ステータス`
- `返信ステータス`
- `配信停止`
- `送信禁止`
- `sentStatus`
- `replyStatus`

## 作成したTSVの列名

Google Sheets貼り付け用TSVには、Apps Scriptが読み取れるように日本語列名と英字列名を併記した。

- `prospectId`
- `店舗名`
- `name`
- `業態`
- `businessType`
- `地域`
- `area`
- `宛先メール`
- `email`
- `contactEmail`
- `publicSource`
- `sourceUrl`
- `issueHypothesis`
- `salesAngle`
- `subject`
- `body`
- `status`
- `sendDate`
- `nextActionDate`
- `送信ステータス`
- `返信ステータス`
- `配信停止`
- `送信禁止`
- `sentStatus`
- `replyStatus`
- `dedupeKey`
- `hasOptOutText`
- `noGuaranteedResults`

## 作成したGit管理外ファイル

- `data/gmail/outbox/2026-06-03-gmail-sales-sheets-ready.tsv`
- `data/gmail/outbox/2026-06-03-gmail-sales-sheets-ready.json`

これらはメールアドレス、営業先情報、本文を含むためGit追加しない。

## 検証結果

| 項目 | 結果 |
|---|---:|
| TSV行数 | 31 |
| ヘッダー行 | 1 |
| データ行 | 30 |
| status=ready件数 | 30 |
| sendDate=2026-06-03件数 | 30 |
| nextActionDate=2026-06-06件数 | 30 |
| メール重複 | 0 |
| subject欠落 | 0 |
| body欠落 | 0 |
| 不要案内あり | 30 |

## Google Sheetsへの貼り付け手順

1. Google SheetsでApps Scriptが参照している送信対象タブを開く。
2. 既存ヘッダーと競合しないよう、空のタブまたは新規タブで作業する。
3. `data/gmail/outbox/2026-06-03-gmail-sales-sheets-ready.tsv` をローカルで開く。
4. 1行目ヘッダーから30件分の行までをコピーする。
5. Google SheetsのA1セルに貼り付ける。
6. `SHEET_NAME` が貼り付けたタブ名と一致しているかApps Script側で確認する。
7. Apps Scriptで `runPreflightCheckOnly()` を再実行する。
8. `readyCount=30` になることを確認する。

## 注意

- この作業ではGmail本番送信を行わない。
- Google Sheetsを送信済みに更新しない。
- `readyCount=30` を確認しても、本番送信はユーザー承認後に行う。
- TSV/JSON本体は営業先情報を含むためGit管理しない。
