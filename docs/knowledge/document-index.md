# 主要ドキュメント索引

| 部門 | 目的 | 主要ディレクトリ | 主要ファイル | 使うタイミング | 関連Hermesプロンプト | レポート保存先 |
|---|---|---|---|---|---|---|
| 営業部門 | 候補作成、検収、手動送信準備 | `docs/sales/`, `data/prospects/` | `docs/sales/daily-sales-candidates-output.md`, `docs/sales-targeting-rules.md` | 営業候補を作る/送る前 | `scheduled-daily-sales-candidates.md`, `scheduled-research-refill-mon-wed.md` | `docs/reports/sales/` |
| マーケティング部門 | 市場/競合分析、訴求改善 | `docs/` | `docs/hermes-weekly-marketing-analysis.md` | 週次の市場分析 | `weekly-market-competitor-analysis.md` | `docs/reports/marketing/` |
| 商談・提案部門 | 返信対応、診断、提案 | `docs/deals/` | `reply-workflow.md`, `free-sns-audit-flow.md`, `proposal-template.md` | 返信あり、商談化、提案前 | `daily-reply-and-deal-review.md`, `proposal-builder.md` | `docs/reports/audits/`, `docs/reports/proposals/` |
| 納品・制作部門 | 受注後の運用、投稿、レポート | `docs/delivery/` | `onboarding-flow.md`, `monthly-content-calendar-template.md`, `monthly-report-template.md` | 受注後、月次運用 | `monthly-content-calendar-builder.md`, `monthly-report-builder.md` | `docs/reports/delivery/`, `docs/reports/monthly-reports/` |
| 法務・契約・請求部門 | 申込、契約、請求、支払い管理 | `docs/admin/` | `service-agreement-template.md`, `invoice-template.md`, `payment-rules.md` | 契約/請求前 | `agreement-prep.md`, `invoice-builder.md` | `docs/reports/admin/` |
| KPI・経営管理部門 | 数値、売上、リスク管理 | `docs/management/`, `data/management/` | `kpi-definitions.md`, `weekly-business-review.md`, `revenue-forecast-template.md` | 週次/月次レビュー | `weekly-kpi-review.md`, `monthly-management-report.md` | `docs/reports/management/` |
| 全体統括部門 | 優先順位、ボトルネック、意思決定 | `docs/executive/` | `department-map.md`, `ceo-dashboard-template.md`, `operating-rhythm.md` | 日次/週次/月次の全体確認 | `daily-executive-briefing.md`, `priority-planner.md` | `docs/reports/executive/` |
| 自社SNS・広報部門 | 自社発信、信頼形成、営業補助 | `docs/pr/` | `brand-message.md`, `self-sns-strategy.md`, `post-idea-bank.md` | 自社SNS投稿案作成 | `self-sns-post-idea-builder.md`, `short-video-script-builder.md` | `docs/reports/pr/` |
| 品質管理・AI運用監査部門 | AI生成物、表現、秘密情報、自動化境界の確認 | `docs/quality/` | `ai-output-review-rules.md`, `confidential-info-rules.md`, `no-automation-boundary.md` | 送付/公開前、週次監査 | `ai-output-quality-review.md`, `confidential-info-scan.md` | `docs/reports/quality/` |
| カスタマーサクセス部門 | 初月フォロー、継続提案、解約リスク検知 | `docs/cs/` | `client-success-flow.md`, `client-health-score.md`, `churn-risk-rules.md` | 受注後、月次レビュー | `client-success-weekly-review.md`, `monthly-client-success-review.md` | `docs/reports/cs/` |
| ナレッジ管理部門 | 索引、運用ガイド、トラブル支援 | `docs/knowledge/` | `document-index.md`, `use-case-navigation.md`, `troubleshooting-index.md` | 迷った時、棚卸し時 | `document-finder.md`, `weekly-knowledge-review.md` | `docs/reports/knowledge/` |
| ツール/インフラ管理部門 | GitHub/Vercel/Hermes/Sheets/WSL2/環境変数/障害対応 | `docs/infra/` | `tool-inventory.md`, `environment-variables.md`, `incident-response.md` | デプロイ、障害、環境確認時 | `infra-health-check.md`, `infra-incident-triage.md` | `docs/reports/infra/` |
| 商品開発・パッケージ改善部門 | プラン、価格、作業範囲、オプション、商品改善 | `docs/product/` | `plan-definition.md`, `pricing-rules.md`, `proposal-matching-rules.md` | 提案、見積、商品改善時 | `product-package-review.md`, `pricing-scope-check.md` | `docs/reports/product/` |
| 外注・採用管理部門 | 外注範囲、採用基準、品質、秘密情報、支払い確認 | `docs/outsourcing/` | `role-definitions.md`, `task-scope-rules.md`, `quality-checklist.md` | 外注検討、依頼前、成果物レビュー時 | `outsourcing-task-brief-builder.md`, `vendor-quality-review.md` | `docs/reports/outsourcing/` |
