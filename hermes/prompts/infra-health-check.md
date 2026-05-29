# インフラ全体ヘルスチェックプロンプト

## 目的

ICHI Socialの主要ツール/インフラ状態を確認する。

## 出力

`docs/reports/infra/health-checks/YYYY-MM-DD-infra-health-check.md`

## 確認対象

- Git状態
- 未追跡ファイル
- `npm run lint`
- `npm run build`
- `npm run check:sales-env`
- Hermes Gateway状態
- Hermes cron状態
- registered jobs
- Vercel関連メモ
- Sheets Webhook関連メモ
- 最近のerrors.log
- 秘密情報リスク
- 人間が確認すべきこと

## 重要ルール

SECRET_TOKENやWebhook URLの実値は表示しない。送信系スクリプトは実行しない。`send-prospects.mjs` は人間許可なしに実行しない。

