# Vercelデプロイ運用ルール

## 基本

GitHubへpushするとVercelが自動デプロイする想定。Production/Previewの違いを確認し、LP本番URLで表示を確認する。

## build失敗時

- Vercel deployment logs
- `npm run build`
- TypeScript/Next.jsエラー
- 環境変数不足

## デプロイ後確認

- Production URLが表示される
- `/privacy`, `/operator`, `/terms` が表示される
- `/sitemap.xml`, `/robots.txt` が表示される
- GA4通信確認
- 主要CTAのmailtoが壊れていない

## rollback方針

本番障害時はVercelのrollbackまたは前コミットへのrevertを人間が判断する。秘密情報混入時は通常rollbackだけでなくローテーションを検討する。

## 秘密情報

Vercel環境変数に実値を設定する場合も、docsやログに値を書かない。

