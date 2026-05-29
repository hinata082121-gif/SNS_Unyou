# デプロイ前レビュー用プロンプト

## 出力

`docs/reports/infra/deployments/YYYY-MM-DD-deployment-readiness-review.md`

## 確認

- 変更ファイル
- docsのみか
- LP/UI変更ありか
- lint
- build
- check:sales-env
- 秘密情報混入
- 未追跡ファイル
- push可否
- Vercel確認項目

## ルール

実運用ファイルを勝手にコミットしない。秘密情報の値を表示しない。

