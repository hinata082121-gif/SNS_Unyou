# Vercelデプロイ後確認プロンプト

## 出力

`docs/reports/infra/deployments/YYYY-MM-DD-vercel-deployment-review.md`

## 確認

- GitHub push状態
- Vercel deployment状態
- Production URL確認項目
- build error有無
- 環境変数の注意
- robots/sitemap確認
- 主要ページ確認
- 人間が確認すること

## ルール

Vercel環境変数の実値を表示しない。rollbackやenv変更は人間判断にする。

