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

## プルダウン値

- 業態: 美容室 / ネイル/アイラッシュ / 整体 / カフェ・飲食
- 相性スコア: A / B / C
- 出典種別: SNS / 公式サイト / 予約フォーム
- ステータス: 未検収 / 検収済 / 除外 / 送信済 / 返信あり / 商談化 / 反応なしクローズ

## テスト送信

`test-prospect.json` の再送信は人間確認後に行う。重複行が入る可能性があるため、Codex/Hermesが勝手に実行しない。

## エラー時

UnauthorizedはSECRET_TOKEN不一致の可能性。HTMLエラーはApps ScriptやSheets validationの可能性。実値をログに貼らない。

