# デプロイ前後チェックリスト

## デプロイ前

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run check:sales-env`
- [ ] 秘密情報チェック
- [ ] 未追跡ファイル確認
- [ ] LP/UI変更有無確認
- [ ] docsのみ変更か確認
- [ ] 送信系スクリプトを実行していない
- [ ] `scripts/sheets/send-prospects.mjs` を人間許可なしに実行していない

## デプロイ後

- [ ] Vercel build成功
- [ ] Production URL表示
- [ ] 主要ページ表示
- [ ] `/robots.txt` 確認
- [ ] `/sitemap.xml` 確認
- [ ] GA4確認
- [ ] 重大エラーなし

