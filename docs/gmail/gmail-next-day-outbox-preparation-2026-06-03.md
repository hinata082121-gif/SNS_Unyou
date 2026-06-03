# Gmail翌日outbox準備フロー

## 目的

毎日30件Gmail営業送信を止めないため、前日または当日朝に送信対象30件を準備する。

当日の12:00に候補不足で止まらないよう、11:30 Preflightより前にGoogle SheetsのGmail送信対象シートへ30件を配置する。

## なぜ前日/朝準備が必要か

2026-06-03は、候補作成自体は完了していたが、Gmail送信用メールアドレス付き候補が不足し、送信準備に追加対応が必要だった。

今後は、候補作成と送信実行を分ける。

- 候補作成: 営業先候補を作る
- Gmail送信準備: メール宛先付き30件を確定する
- Gmail送信: 安全条件を満たす場合のみ送る

## Gmail送信用候補の採用条件

- 公開メールアドレスが確認できる
- 推測メールアドレスではない
- メール形式が妥当
- 事業名、業態、地域がある
- 課題仮説または提案角度がある
- 件名と本文を作成済み
- 配信停止/不要案内が本文にある
- 送信済み、返信あり、配信停止、送信禁止ではない
- 同一メールアドレス、同一事業者、同一dedupeKeyが重複していない

## 30件不足時の扱い

30件に満たない場合は送信しない。

- 1〜29件: `blocked`
- 0件: `blocked`
- 31件以上: `blocked`

不足分を無理に問い合わせフォーム候補やInstagramのみ候補で埋めない。

## outbox作成手順

1. 既存候補から未送信、未除外、メール宛先ありを抽出
2. 送信済み、返信あり、配信停止、送信禁止を除外
3. 重複メール、重複事業者、重複dedupeKeyを除外
4. 30件ちょうどを選定
5. `sendBatchId=gmail-sales-YYYY-MM-DD` を付与
6. `status=ready` を設定
7. `sendDate` と `nextActionDate` を設定
8. subject/bodyを作成
9. Google Sheets貼り付け用TSVを作る

## Sheets投入手順

1. TSVをGoogle SheetsのGmail送信対象シートへ貼り付ける
2. ヘッダーが `docs/gmail/gmail-send-target-sheet-schema-2026-06-03.md` と一致しているか確認
3. `ready` が30件ちょうどか確認
4. `sendDate` が当日か確認
5. `sendBatchId` が当日形式か確認
6. `runScheduledPreflight()` または `runPreflightCheckOnly()` を実行

## Preflight前チェック

- readyCount=30
- Gmail残クォータ30以上
- 配信停止/返信あり/送信禁止0件
- 重複0件
- subject/body欠落0件
- 配信停止/不要案内欠落0件
- sendBatchId未送信

## 候補不足時のblocked処理

候補不足の場合、以下を記録する。

- ready件数
- 不足数
- 除外理由
- 追加収集が必要な業態/地域
- 次に人間が判断すべきこと

不足時は自動送信しない。

## 毎日30件送信マストタスクとの関係

30件送信はマストタスクだが、安全条件を満たさない場合は送信しない。

マストタスクの意味は、毎日30件を安全に送るための準備、Preflight、送信、記録を必ず確認すること。

## Git管理禁止ファイル

以下はGitに追加しない。

- `data/gmail/outbox/`
- `data/gmail/logs/`
- `data/prospects/`
- `docs/reports/sales/`
- メールアドレス一覧
- 営業先一覧
- Google Sheets IDや秘密情報を含むファイル

## Agent Officeへの記録方針

- 30件準備済み: `needs_review` または送信前 `checking`
- 送信成功: `success`
- 候補不足: `blocked`
- 送信失敗: `needs_review`
- 自動送信トリガー有効化待ち: `needs_review`

