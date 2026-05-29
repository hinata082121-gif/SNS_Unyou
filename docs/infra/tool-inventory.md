# 使用ツール一覧

| ツール | 役割 | 使う場面 | 関連ファイル | 関連環境変数 | リスク | 人間が管理すること | Hermes/Codexに任せてよいこと |
|---|---|---|---|---|---|---|---|
| GitHub | ソース/ドキュメント管理 | commit/push/履歴確認 | `README.md`, `docs/` | GitHub Secrets将来 | 秘密情報混入、push失敗 | push、履歴管理 | 差分整理、チェック案 |
| Vercel | LP公開 | push後デプロイ | `src/app/`, `package.json` | Vercel env | build失敗、env不足 | env設定、rollback判断 | 確認項目整理 |
| Google Sheets | 営業候補管理 | 候補検収/送信管理 | `data/prospects/` | なし | 誤投入、入力規則違反 | シート管理 | JSON検証案 |
| Google Apps Script | Sheets Webhook | JSON追記 | `scripts/sheets/send-prospects.mjs` | Webhook/secret | token mismatch | deploy/redeploy | エラー整理 |
| Hermes Agent | 定期自動化 | 営業/分析/監査レポート | `hermes/prompts/` | 必要に応じて | missed run、quota不足 | job登録/削除 | レポート作成 |
| Codex | 実装/文書整備 | docs/code変更 | 全体 | なし | 誤コミット | 最終判断 | ファイル作成/検証 |
| WSL2 / Ubuntu | Hermes実行環境 | Gateway/cron | `docs/infra/` | shell env | スリープ/停止 | 起動/サービス確認 | 手順整理 |
| Windows PC | 作業端末 | Codex/PowerShell | ローカル全体 | PowerShell env | sleep/update | 電源管理 | 注意点整理 |
| npm / Node.js | build/lint/scripts | 検証 | `package.json` | なし | 依存不整合 | update判断 | lint/build実行 |
| ブラウザ | 表示確認 | LP/Sheets/Vercel確認 | なし | なし | キャッシュ | 目視確認 | チェックリスト |
| Google Analytics | アクセス解析 | 公開後確認 | `src/components` | `NEXT_PUBLIC_GA_ID` | 計測漏れ | GA設定 | 確認項目 |
| Search Console | SEO確認 | sitemap送信 | `src/app/sitemap.ts` | なし | 未登録 | 所有権/送信 | 手順整理 |
| Gmail | 問い合わせ | mailto対応 | LP CTA | なし | 誤送信 | 返信/管理 | 文面下書き |

