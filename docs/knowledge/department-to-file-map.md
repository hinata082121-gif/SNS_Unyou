# 部門別ファイルマップ

## 営業部門

- 見るファイル: `docs/sales/`, `docs/sales-targeting-rules.md`, `data/prospects/`
- 作るファイル: `data/prospects/*.json`, `docs/reports/sales/daily/*.md`
- 使うプロンプト: `scheduled-daily-sales-candidates.md`, `scheduled-research-refill-mon-wed.md`
- 注意点: 営業送信、Sheets更新は人間が行う

## マーケティング部門

- 見るファイル: `docs/hermes-weekly-marketing-analysis.md`, `docs/sales-targeting-rules.md`
- 作るファイル: `docs/reports/marketing/*.md`
- 使うプロンプト: `weekly-market-competitor-analysis.md`
- 注意点: 競合情報は公開情報のみ、推測料金は書かない

## 商談・提案部門

- 見るファイル: `docs/deals/`
- 作るファイル: `docs/reports/audits/*.md`, `docs/reports/proposals/*.md`
- 使うプロンプト: `free-sns-audit-report.md`, `proposal-builder.md`
- 注意点: 診断/提案送付は人間確認後

## 納品・制作部門

- 見るファイル: `docs/delivery/`
- 作るファイル: `docs/reports/delivery/*.md`, `docs/reports/content-calendars/*.md`, `docs/reports/monthly-reports/*.md`
- 使うプロンプト: `monthly-content-calendar-builder.md`, `caption-builder.md`, `monthly-report-builder.md`
- 注意点: 投稿操作とクライアント連絡は自動化しない

## 法務・契約・請求部門

- 見るファイル: `docs/admin/`
- 作るファイル: `docs/reports/admin/agreements/*.md`, `docs/reports/admin/invoices/*.md`
- 使うプロンプト: `agreement-prep.md`, `invoice-builder.md`, `billing-review.md`
- 注意点: 法務/税務判断、請求送付、入金確認は人間が行う

## KPI・経営管理部門

- 見るファイル: `docs/management/`, `data/management/`
- 作るファイル: `docs/reports/management/**/*.md`
- 使うプロンプト: `weekly-kpi-review.md`, `revenue-forecast-builder.md`
- 注意点: 未入力値は推測しない

## 全体統括部門

- 見るファイル: `docs/executive/`
- 作るファイル: `docs/reports/executive/**/*.md`
- 使うプロンプト: `daily-executive-briefing.md`, `priority-planner.md`
- 注意点: 意思決定は人間が行う

## 自社SNS・広報部門

- 見るファイル: `docs/pr/`
- 作るファイル: `docs/reports/pr/**/*.md`
- 使うプロンプト: `self-sns-post-idea-builder.md`, `short-video-script-builder.md`
- 注意点: SNSへの自動投稿、架空実績作成はしない

## 品質管理・AI運用監査部門

- 見るファイル: `docs/quality/`
- 作るファイル: `docs/reports/quality/**/*.md`
- 使うプロンプト: `ai-output-quality-review.md`, `confidential-info-scan.md`
- 注意点: 自動修正後の自動公開/送信はしない

## カスタマーサクセス部門

- 見るファイル: `docs/cs/`
- 作るファイル: `docs/reports/cs/**/*.md`
- 使うプロンプト: `client-success-weekly-review.md`, `monthly-client-success-review.md`
- 注意点: クライアント連絡、契約変更、解約処理は自動化しない

## ナレッジ管理部門

- 見るファイル: `docs/knowledge/`
- 作るファイル: `docs/reports/knowledge/**/*.md`
- 使うプロンプト: `knowledge-index-builder.md`, `document-finder.md`
- 注意点: 未追跡ファイルの自動削除/コミットはしない

## ツール/インフラ管理部門

- 見るファイル: `docs/infra/`
- 作るファイル: `docs/reports/infra/**/*.md`
- 使うプロンプト: `infra-health-check.md`, `hermes-cron-health-check.md`, `infra-incident-triage.md`
- 関連レポート: `docs/reports/infra/health-checks/`, `docs/reports/infra/incidents/`, `docs/reports/infra/deployments/`, `docs/reports/infra/maintenance/`
- 注意点: 環境変数やSecretsの自動変更、Apps Script自動デプロイ、送信系スクリプト実行はしない

## 商品開発・パッケージ改善部門

- 見るファイル: `docs/product/`
- 作るファイル: `docs/reports/product/**/*.md`
- 使うプロンプト: `product-package-review.md`, `proposal-plan-matcher.md`, `pricing-scope-check.md`
- 関連レポート: `docs/reports/product/reviews/`, `docs/reports/product/feedback/`, `docs/reports/product/lp-copy/`, `docs/reports/product/packages/`
- 注意点: 価格変更、プラン変更、LP変更、契約/請求変更は人間が判断する
