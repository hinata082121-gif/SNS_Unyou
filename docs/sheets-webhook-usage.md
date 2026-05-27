# Google Sheets Webhook送信手順

## 1. 目的

ChatGPT / Codex / Hermes Agent で作成した見込み客JSONを、Google Apps Script Webhook経由でICHI Socialの営業スプレッドシートへ追記するためのローカル送信手順です。

送信前にローカルで列名とプルダウン値を検証し、不正な値がある場合はWebhookへ送信しません。

## 2. 必要な環境変数

Webhook URLと秘密トークンはコードへ直書きせず、実行するターミナルの環境変数として設定します。

```powershell
$env:SHEETS_WEBHOOK_URL="Apps ScriptのWebアプリURL"
$env:SHEETS_SECRET_TOKEN="秘密トークン"
```

`.env.example` は設定値のサンプルです。実際のURLやトークンはコミットしないでください。

## 3. PowerShellでの実行方法

```powershell
$env:SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxx/exec"
$env:SHEETS_SECRET_TOKEN="replace-with-your-secret-token"
node scripts/sheets/send-prospects.mjs data/prospects/test-prospect.json
```

## 4. テスト送信方法

まずは疎通確認用の1件だけを送信します。

```powershell
node scripts/sheets/send-prospects.mjs data/prospects/test-prospect.json
```

送信後、Googleスプレッドシートに「テスト店舗」が追加されていることを確認してください。確認後、不要であればシートからテスト行を削除します。

## 5. 複数件JSON送信方法

`data/prospects/prospects.template.json` をコピーして、`rows` 配列に複数の見込み客を追加します。

例:

```json
{
  "rows": [
    {
      "店名": "店舗A",
      "業態": "美容院",
      "地域": "東京都渋谷区",
      "概要": "駅近の小規模サロン",
      "相性スコア": "A",
      "スコア理由": "SNSでメニュー訴求しやすい",
      "課題仮説": "投稿頻度と予約導線の改善余地がある",
      "問い合わせフォームURL": "https://example.com/contact",
      "連絡手段": "問い合わせフォーム",
      "出典URL": "https://example.com",
      "出典種別": "公式サイト",
      "ステータス": "未検収",
      "送信日": "",
      "反応": "",
      "次アクション日": ""
    }
  ]
}
```

送信:

```powershell
node scripts/sheets/send-prospects.mjs data/prospects/your-prospects.json
```

## 6. プルダウン列の許可値

送信スクリプト側でも以下の値に制限しています。

| 列 | 許可値 |
| --- | --- |
| 業態 | 美容院 / ネイル/アイラッシュ / 整体 / カフェ・飲食 |
| 相性スコア | A / B / C |
| 出典種別 | SNS / 公式サイト / 予約フォーム |
| ステータス | 未検収 / 検収済 / 除外 / 送信済 / 返信あり / 商談化 / 反応なしクローズ |

ステータスが空欄の場合は、送信前に `未検収` が自動設定されます。

## 7. エラー時の確認ポイント

- Apps ScriptのWebアプリURLが `/exec` で終わっているか
- `SHEETS_SECRET_TOKEN` がApps Script側の `SECRET_TOKEN` と一致しているか
- Webアプリのアクセス権限が適切か
- シート1行目のヘッダー名が一致しているか
- プルダウン値が許可値と一致しているか
- Apps Scriptを修正した後に再デプロイしているか
- JSONに必須列がすべて含まれているか
- 余計な列名や表記揺れが含まれていないか
