# Google Sheets Webhook運用ルール

## 目的

`scripts/sheets/send-prospects.mjs` からGoogle Apps Script Webhook経由で営業候補JSONをGoogle Sheetsへ追記する。

## 環境変数

- `SHEETS_WEBHOOK_URL`
- `SHEETS_SECRET_TOKEN`

実値はGitに書かない。

## payload

```json
{
  "token": "環境変数から取得",
  "rows": []
}
```

## スプレッドシート列

A 店名 / B 業態 / C 地域 / D 概要 / E 相性スコア / F スコア理由 / G 課題仮説 / H 問い合わせフォームURL / I 連絡手段 / J 出典URL / K 出典種別 / L ステータス / M 送信日 / N 反応 / O 次アクション日

Instagram営業を行う場合は、既存A〜O列を維持したままP列以降を追加する。

P Instagram URL / Q Instagramユーザー名 / R Instagramフォロワー数 / S フォロワー区分 / T 最終投稿確認日 / U Instagram運用課題 / V Instagram営業優先度 / W Instagram営業切り口 / X 手動DM文案 / Y 手動コメント案 / Z 自社コンテンツ提案余地

## プルダウン値

- 業態: 美容室 / ネイル/アイラッシュ / 整体 / カフェ・飲食
- 相性スコア: A / B / C
- 出典種別: SNS / 公式サイト / 予約フォーム / Instagram
- ステータス: 未検収 / 検収済 / 除外 / 送信済 / 返信あり / 商談化 / 反応なしクローズ
- フォロワー区分: under_500 / 500_999 / 1000_1999 / 2000_4999 / 5000_over / unknown
- Instagram営業優先度: A / B / C / 除外

## Instagram項目の扱い

- `scripts/sheets/send-prospects.mjs` は既存A〜OのJSONとInstagram項目つきJSONの両方を受け付ける
- Instagram関連フィールドがない場合、P〜Zは空欄として送る
- `instagramFollowers` が `null` の場合、R列は空欄にする
- フォロワー数は公開プロフィールで確認できる場合のみ記録し、推測で埋めない
- Instagram起点候補の出典種別は `Instagram` を使う
- Apps Script側でP〜Zヘッダーを追加し、必要な入力規則を設定した後に再デプロイする
- Webhook URLやSECRET_TOKENは変更しない。変更が必要な場合は人間が判断する

## テスト送信

`test-prospect.json` の再送信は人間確認後に行う。重複行が入る可能性があるため、Codex/Hermesが勝手に実行しない。

## エラー時

UnauthorizedはSECRET_TOKEN不一致の可能性。HTMLエラーはApps ScriptやSheets validationの可能性。実値をログに貼らない。
