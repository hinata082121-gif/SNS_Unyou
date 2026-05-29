# Google Sheets Webhookヘルスチェックプロンプト

## 出力

`docs/reports/infra/health-checks/YYYY-MM-DD-sheets-webhook-health-check.md`

## 確認

- 環境変数が設定されているか
- ただし実値は表示しない
- `npm run check:sales-env` 結果
- `scripts/sheets/send-prospects.mjs` の存在
- template JSON
- `test-prospect` 再送信は人間確認が必要
- 最近の投入結果
- よくあるエラー
- 対応案

## 重要

人間の明示許可なしに `send-prospects.mjs` を実行しない。

