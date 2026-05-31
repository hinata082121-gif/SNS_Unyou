# 目的別ナビゲーション

| やりたいこと | 最初に見るファイル | 次に見るファイル | 使うHermesプロンプト | 出力先 | 人間が判断すること |
|---|---|---|---|---|---|
| 今日送る営業候補を見たい | `docs/reports/sales/daily/` | `docs/sales/daily-sales-candidates-output.md` | `scheduled-daily-sales-candidates.md` | `docs/reports/sales/daily/` | 送信可否 |
| 新しい候補をリサーチしたい | `docs/sales-targeting-rules.md` | `docs/knowledge/task-index.md` | `scheduled-research-refill-mon-wed.md` | `data/prospects/` | スプシ投入可否 |
| スプシに候補を投入したい | `docs/sheets-webhook-usage.md` | `data/prospects/prospects.template.json` | なし | Google Sheets | 実行可否 |
| 返信が来た | `docs/deals/reply-workflow.md` | `docs/cs/client-success-flow.md` | `daily-reply-and-deal-review.md` | 任意 | 返信文送付 |
| 無料SNS診断を作りたい | `docs/deals/free-sns-audit-flow.md` | `docs/deals/free-sns-audit-template.md` | `free-sns-audit-report.md` | `docs/reports/audits/` | 診断送付 |
| 商談準備をしたい | `docs/deals/discovery-call-script.md` | `docs/deals/deal-stage-rules.md` | `discovery-call-prep.md` | 任意 | 商談実施 |
| 提案書を作りたい | `docs/deals/proposal-template.md` | `docs/quality/pre-proposal-checklist.md` | `proposal-builder.md` | `docs/reports/proposals/` | 提案送付 |
| 受注した | `docs/deals/first-client-onboarding-bridge.md` | `docs/admin/legal-and-billing-overview.md` | `contract-before-start-check.md` | `docs/reports/admin/checklists/` | 着手可否 |
| 請求書を作りたい | `docs/admin/invoice-template.md` | `docs/admin/billing-checklist.md` | `invoice-builder.md` | `docs/reports/admin/invoices/` | 請求送付 |
| 投稿カレンダーを作りたい | `docs/delivery/monthly-content-calendar-template.md` | `docs/delivery/content-strategy-template.md` | `monthly-content-calendar-builder.md` | `docs/reports/content-calendars/` | クライアント確認 |
| 月次レポートを作りたい | `docs/delivery/monthly-report-template.md` | `docs/cs/monthly-success-review.md` | `monthly-report-builder.md` | `docs/reports/monthly-reports/` | 送付/継続提案 |
| 解約リスクを見たい | `docs/cs/churn-risk-rules.md` | `docs/cs/client-health-score.md` | `churn-risk-review.md` | `docs/reports/cs/monthly/` | 対応方針 |
| 自社SNS投稿案を作りたい | `docs/pr/post-idea-bank.md` | `docs/pr/content-review-checklist.md` | `self-sns-post-idea-builder.md` | `docs/reports/pr/posts/` | 公開可否 |
| 投稿前チェックをしたい | `docs/quality/pre-publication-checklist.md` | `docs/pr/content-review-checklist.md` | `pr-content-quality-review.md` | `docs/reports/quality/reviews/` | 投稿可否 |
| 秘密情報混入を見たい | `docs/quality/confidential-info-rules.md` | `docs/knowledge/untracked-files-policy.md` | `confidential-info-scan.md` | `docs/reports/quality/audits/` | 公開/コミット可否 |
| KPIを確認したい | `docs/management/kpi-definitions.md` | `data/management/kpi-input-template.md` | `weekly-kpi-review.md` | `docs/reports/management/weekly/` | 数値入力 |
| 全体の優先順位を見たい | `docs/executive/priority-matrix.md` | `docs/executive/ceo-dashboard-template.md` | `priority-planner.md` | `docs/reports/executive/daily/` | 実行順 |
| Hermesのスケジュールタスクを確認したい | `docs/hermes-scheduled-automation.md` | `docs/knowledge/task-index.md` | `document-finder.md` | 任意 | 登録/変更判断 |
| Hermes cronが動かない | `docs/infra/hermes-cron-monitoring.md` | `docs/infra/wsl2-windows-operations.md` | `hermes-cron-health-check.md` | `docs/reports/infra/health-checks/` | 手動実行/設定変更 |
| 9:00営業候補が作られない | `docs/infra/hermes-cron-monitoring.md` | `docs/knowledge/troubleshooting-index.md` | `infra-incident-triage.md` | `docs/reports/infra/incidents/` | 補完実行 |
| Sheets投入に失敗した | `docs/infra/google-sheets-webhook.md` | `docs/infra/apps-script-webhook-rules.md` | `sheets-webhook-health-check.md` | `docs/reports/infra/health-checks/` | 再送信可否 |
| Vercel buildが失敗した | `docs/infra/vercel-deployment.md` | `docs/infra/deployment-checklist.md` | `vercel-deployment-review.md` | `docs/reports/infra/deployments/` | rollback/修正 |
| Git pushが失敗した | `docs/infra/github-workflow.md` | `docs/knowledge/troubleshooting-index.md` | `infra-incident-triage.md` | `docs/reports/infra/incidents/` | 再認証/再push |
| SECRET_TOKEN漏えいが疑われる | `docs/infra/secrets-management.md` | `docs/quality/confidential-info-rules.md` | `secrets-and-env-review.md` | `docs/reports/infra/health-checks/` | ローテーション |
| Webhook URLを再発行した | `docs/infra/apps-script-webhook-rules.md` | `docs/infra/environment-variables.md` | `sheets-webhook-health-check.md` | `docs/reports/infra/health-checks/` | env更新 |
| 未追跡ファイルをどう扱うか迷った | `docs/knowledge/untracked-files-policy.md` | `docs/infra/github-workflow.md` | `document-finder.md` | 任意 | コミット可否 |
| 本番公開前にチェックしたい | `docs/infra/deployment-checklist.md` | `docs/infra/production-readiness-checklist.md` | `deployment-readiness-review.md` | `docs/reports/infra/deployments/` | デプロイ可否 |
| プラン内容を確認したい | `docs/product/plan-definition.md` | `docs/product/plan-comparison-table.md` | `document-finder.md` | 任意 | 提案可否 |
| 提案するプランを選びたい | `docs/product/proposal-matching-rules.md` | `docs/product/target-customer.md` | `proposal-plan-matcher.md` | `docs/reports/product/packages/` | 推奨プラン確定 |
| 見積/提案書の価格と範囲を確認したい | `docs/product/pricing-rules.md` | `docs/product/service-scope.md` | `pricing-scope-check.md` | `docs/reports/product/reviews/` | 金額/範囲確定 |
| 初期設計費無料キャンペーンの扱いを確認したい | `docs/product/initial-setup-fee-rules.md` | `docs/product/campaign-rules.md` | `pricing-scope-check.md` | `docs/reports/product/reviews/` | 適用可否 |
| 業態別の提案文言を作りたい | `docs/product/industry-package-rules.md` | `docs/product/use-case-packages.md` | `industry-package-builder.md` | `docs/reports/product/packages/` | 文言採用 |
| LPに載せる商品説明文案を作りたい | `docs/product/lp-copy-draft.md` | `docs/product/service-positioning.md` | `lp-copy-for-offer-builder.md` | `docs/reports/product/lp-copy/` | LP反映可否 |
| アップセル/ダウンセルを検討したい | `docs/product/upsell-path.md` | `docs/product/downsell-retention-rules.md` | `upsell-path-review.md` | `docs/reports/product/reviews/` | 提案可否 |
| 商品改善案を整理したい | `docs/product/product-improvement-rules.md` | `docs/product/product-feedback-log.md` | `monthly-product-improvement-review.md` | `docs/reports/product/reviews/` | 改善採用 |
| 外注を検討したい | `docs/outsourcing/overview.md` | `docs/outsourcing/role-definitions.md` | `document-finder.md` | 任意 | 外注開始可否 |
| 外注できる業務を確認したい | `docs/outsourcing/task-scope-rules.md` | `docs/outsourcing/client-info-sharing-rules.md` | `outsourcing-risk-check.md` | `docs/reports/outsourcing/risks/` | 依頼可否 |
| 外注タスクブリーフを作りたい | `docs/outsourcing/task-brief-template.md` | `docs/outsourcing/quality-checklist.md` | `outsourcing-task-brief-builder.md` | `docs/reports/outsourcing/briefs/` | 送付可否 |
| 外注候補者を評価したい | `docs/outsourcing/hiring-criteria.md` | `docs/outsourcing/interview-questions.md` | `vendor-candidate-review.md` | `docs/reports/outsourcing/vendors/` | 採用可否 |
| トライアル課題を作りたい | `docs/outsourcing/trial-task-template.md` | `docs/outsourcing/hiring-criteria.md` | `recruiting-copy-builder.md` | `docs/reports/outsourcing/vendors/` | 課題実施可否 |
| 外注成果物をレビューしたい | `docs/outsourcing/quality-checklist.md` | `docs/quality/ai-output-review-rules.md` | `vendor-quality-review.md` | `docs/reports/outsourcing/reviews/` | 採用/差し戻し |
| 外注リスクを確認したい | `docs/outsourcing/outsourcing-risk-notes.md` | `docs/outsourcing/confidentiality-rules.md` | `outsourcing-risk-check.md` | `docs/reports/outsourcing/risks/` | 依頼停止/継続 |
| 外注先を終了したい | `docs/outsourcing/offboarding-checklist.md` | `docs/outsourcing/payment-and-invoice-rules.md` | `vendor-quality-review.md` | `docs/reports/outsourcing/reviews/` | 終了/再依頼可否 |
| AI出力の品質を評価したい | `docs/ai-ops/output-evaluation-scorecard.md` | `docs/quality/ai-output-review-rules.md` | `ai-output-evaluation.md` | `docs/reports/ai-ops/evaluations/` | 採用/差し戻し |
| プロンプトを改善したい | `docs/ai-ops/prompt-design-rules.md` | `docs/ai-ops/prompt-versioning-rules.md` | `ai-ops-prompt-review.md` | `docs/reports/ai-ops/reviews/` | 改訂可否 |
| プロンプト変更後の回帰テストをしたい | `docs/ai-ops/test-case-library.md` | `docs/ai-ops/prompt-evaluation-framework.md` | `prompt-regression-test.md` | `docs/reports/ai-ops/evaluations/` | 本番反映可否 |
| AIが失敗した原因を分析したい | `docs/ai-ops/failure-analysis-rules.md` | `docs/ai-ops/ai-ops-risk-notes.md` | `ai-failure-analysis.md` | `docs/reports/ai-ops/failures/` | 修正方針 |
| どのモデル/ツールを使うべきか判断したい | `docs/ai-ops/model-usage-policy.md` | `docs/ai-ops/agent-routing-rules.md` | `model-selection-review.md` | `docs/reports/ai-ops/reviews/` | モデル変更 |
| quota/credit不足が起きた | `docs/ai-ops/cost-and-quota-management.md` | `docs/ai-ops/model-fallback-rules.md` | `ai-cost-quota-review.md` | `docs/reports/ai-ops/costs/` | 課金/頻度判断 |
| AIに渡すコンテキストを整理したい | `docs/ai-ops/context-management-rules.md` | `docs/ai-ops/memory-and-history-rules.md` | `context-quality-review.md` | `docs/reports/ai-ops/reviews/` | 参照情報確定 |
| AI自動化の範囲を見直したい | `docs/ai-ops/human-in-the-loop-rules.md` | `docs/quality/no-automation-boundary.md` | `monthly-ai-ops-improvement-review.md` | `docs/reports/ai-ops/improvements/` | 自動化範囲変更 |
| Instagram中心で営業候補を探したい | `docs/sales-targeting-rules.md` | `hermes/prompts/instagram-sales-list-builder.md` | `instagram-sales-list-builder.md` | `data/prospects/`, `docs/reports/sales/research/` | 候補採否/Sheets投入/手動DM |
| フォロワー2,000人未満の店舗を抽出したい | `docs/sales-targeting-rules.md` | `docs/sales/daily-sales-candidates-output.md` | `instagram-sales-list-builder.md` | `docs/reports/sales/research/` | フォロワー数確認/A判定 |
| Instagram営業候補をスプシ投入前に確認したい | `hermes/prompts/instagram-prospect-scoring-review.md` | `docs/infra/google-sheets-webhook.md` | `instagram-prospect-scoring-review.md` | `docs/reports/sales/research/` | 投入可否/除外判断 |
| 自社SNS投稿を週1本作りたい | `docs/pr/self-sns-strategy.md` | `docs/pr/monthly-pr-calendar-template.md` | `weekly-self-content-builder.md` | `docs/reports/pr/content/` | 水曜の手動投稿 |
| 自社SNS投稿を週2本作りたい | `docs/pr/self-sns-strategy.md` | `hermes/prompts/self-content-post-ready-builder.md` | `weekly-self-content-builder.md`, `self-content-post-ready-builder.md` | `docs/reports/pr/content/` | 金曜の告知投稿 |
| 手動投稿用のInstagramキャプションを作りたい | `hermes/prompts/self-content-post-ready-builder.md` | `docs/pr/content-review-checklist.md` | `self-content-post-ready-builder.md` | `docs/reports/pr/content/` | 投稿前チェック/手動投稿 |
| 無料SNS診断の告知投稿を作りたい | `docs/pr/post-idea-bank.md` | `docs/pr/self-sns-strategy.md` | `self-content-post-ready-builder.md` | `docs/reports/pr/content/` | 告知表現/投稿日/CTA |
