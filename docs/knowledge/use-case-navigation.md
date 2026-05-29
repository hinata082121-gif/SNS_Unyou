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
