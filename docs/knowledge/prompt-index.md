# Hermesプロンプト索引

## 営業・リサーチ

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `scheduled-daily-sales-candidates.md` | 毎朝の営業候補整理 | 既存JSON、リサーチ、Web補助 | `docs/reports/sales/daily/` | 登録済み | 送信/Sheets更新禁止 |
| `scheduled-research-refill-mon-wed.md` | 月水の新規候補リサーチ | 対象地域/業態 | `data/prospects/` | 登録済み | 投入は人間許可後 |
| `expanded-area-research-rules.md` | 拡大地域リサーチ基準 | 地域条件 | 参照用 | 手動/補助 | 架空URL禁止 |
| `weekly-prospect-refill.md` | 旧週次候補補充 | 地域/業態 | `data/prospects/` | 必要時 | 現行ルール優先 |
| `daily-sales-prep.md` | 日次営業準備 | 候補リスト | local/レポート | 手動 | 送信禁止 |
| `daily-sales-review.md` | 日次営業レビュー | 当日進捗 | local/レポート | 手動 | ステータス自動更新禁止 |
| `prospect-json-rules.md` | 候補JSON作成ルール | 候補情報 | `data/prospects/*.json` | 参照用 | プルダウン値厳守 |

## マーケティング・自社SNS

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `weekly-market-competitor-analysis.md` | 週次市場/競合分析 | 公開情報 | `docs/reports/marketing/` | 登録済み | 出典必須、推測禁止 |
| `self-sns-monthly-calendar-builder.md` | 自社SNS月間カレンダー | 月テーマ、営業状況 | `docs/reports/pr/calendars/` | 将来案 | 自動投稿禁止 |
| `self-sns-post-idea-builder.md` | 自社SNS投稿案 | テーマ、チャネル | `docs/reports/pr/posts/` | 手動 | 架空実績禁止 |
| `short-video-script-builder.md` | 短尺動画台本 | テーマ、尺 | `docs/reports/pr/scripts/` | 将来案 | 動画投稿禁止 |
| `pr-weekly-content-review.md` | 自社SNS週次レビュー | 投稿案、反応 | `docs/reports/pr/reviews/` | 将来案 | 反応推測禁止 |
| `social-profile-improvement.md` | 自社SNSプロフィール改善 | 現状プロフィール | `docs/reports/pr/` | 手動 | 外部操作禁止 |
| `case-study-draft-builder.md` | 事例/サンプル改善例作成 | 掲載許可、実績情報 | `docs/reports/pr/posts/` | 手動 | 無許可実績禁止 |

## 商談・提案・無料SNS診断

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `daily-reply-and-deal-review.md` | 返信/商談レビュー | 返信状況 | local/レポート | 将来案 | 自動返信禁止 |
| `free-sns-audit-report.md` | 無料SNS診断作成 | 店舗URL/SNS | `docs/reports/audits/` | 手動 | 公開情報のみ |
| `proposal-builder.md` | 提案書下書き | 診断、商談メモ | `docs/reports/proposals/` | 手動 | 成果保証禁止 |
| `discovery-call-prep.md` | 商談準備 | 店舗情報 | local/レポート | 手動 | 断定禁止 |
| `objection-response-builder.md` | 反論対応文面 | 反応内容 | local/レポート | 手動 | 強引な追客禁止 |

## 納品・制作

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `client-onboarding-prep.md` | 受注後準備 | 契約情報、商談メモ | `docs/reports/delivery/` | 手動 | 権限/素材は人間確認 |
| `monthly-content-calendar-builder.md` | 月間投稿カレンダー | 店舗情報、投稿本数 | `docs/reports/content-calendars/` | 手動 | 医療/美容表現注意 |
| `post-brief-builder.md` | 投稿企画書 | 投稿テーマ | `docs/reports/delivery/` | 手動 | クライアント確認前提 |
| `caption-builder.md` | キャプション案 | テーマ、CTA | local/レポート | 手動 | 成果保証禁止 |
| `monthly-report-builder.md` | 月次レポート | 投稿/数値データ | `docs/reports/monthly-reports/` | 手動 | 未取得は未取得 |
| `weekly-client-operation-review.md` | 週次運用レビュー | 契約中クライアント状況 | `docs/reports/delivery/` | 将来案 | 自動連絡禁止 |

## 法務・請求

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `agreement-prep.md` | 契約書たたき台 | 申込条件 | `docs/reports/admin/agreements/` | 手動 | 専門家確認前提 |
| `application-form-builder.md` | 申込書下書き | 申込内容 | `docs/reports/admin/agreements/` | 手動 | 個人情報注意 |
| `invoice-builder.md` | 請求書下書き | 金額、請求対象 | `docs/reports/admin/invoices/` | 手動 | 自動送付禁止 |
| `billing-review.md` | 請求レビュー | 契約/入金状況 | `docs/reports/admin/checklists/` | 将来案 | 入金確認は人間 |
| `legal-risk-check.md` | 法務リスク確認 | 提案/投稿/契約 | `docs/reports/admin/checklists/` | 手動 | 法務判断はしない |
| `contract-before-start-check.md` | 着手前チェック | 申込/支払い/権限 | `docs/reports/admin/checklists/` | 手動 | 着手判断は人間 |

## KPI・経営管理・全体統括

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `weekly-kpi-review.md` | 週次KPIレビュー | KPI入力、各レポート | `docs/reports/management/weekly/` | 将来案 | 未入力は推測しない |
| `monthly-management-report.md` | 月次経営レポート | KPI/売上/納品 | `docs/reports/management/monthly/` | 将来案 | 自動請求禁止 |
| `sales-funnel-analyzer.md` | 営業ファネル分析 | 手動集計値 | `docs/reports/management/kpi/` | 手動 | ステータス自動更新禁止 |
| `revenue-forecast-builder.md` | 売上予測 | 商談/受注確度 | `docs/reports/management/kpi/` | 手動 | 推測値は分離 |
| `operation-risk-review.md` | 運用リスク確認 | 各部門状況 | `docs/reports/management/kpi/` | 手動 | 判断は人間 |
| `business-decision-review.md` | 意思決定候補整理 | KPI/市場/納品 | `docs/reports/management/kpi/` | 手動 | 自動決定禁止 |
| `daily-executive-briefing.md` | 日次全体ブリーフィング | 各部門レポート | `docs/reports/executive/daily/` | 将来案 | 自動連絡禁止 |
| `weekly-executive-review.md` | 週次全体レビュー | 各部門レポート | `docs/reports/executive/weekly/` | 将来案 | 人間判断明記 |
| `monthly-executive-review.md` | 月次全体レビュー | 各部門レポート | `docs/reports/executive/monthly/` | 将来案 | 法務/税務判断禁止 |
| `bottleneck-analyzer.md` | ボトルネック分析 | 各部門状況 | `docs/reports/executive/daily/` | 手動 | 自動修正禁止 |
| `priority-planner.md` | 優先順位整理 | タスク状況 | `docs/reports/executive/daily/` | 手動 | 最終判断は人間 |
| `cross-department-review.md` | 部門横断レビュー | 各部門状況 | `docs/reports/executive/weekly/` | 手動 | 接続漏れ確認 |

## 品質管理・カスタマーサクセス・ナレッジ

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `ai-output-quality-review.md` | AI生成物レビュー | 対象ファイル | `docs/reports/quality/reviews/` | 手動 | 公開/送信は人間 |
| `pre-send-sales-review.md` | 営業送信前レビュー | 候補/文面 | `docs/reports/quality/reviews/` | 将来案 | 送信禁止 |
| `proposal-quality-review.md` | 提案/診断レビュー | 診断/提案/見積 | `docs/reports/quality/reviews/` | 手動 | 料金/表現確認 |
| `contract-billing-risk-review.md` | 契約/請求レビュー | 契約/請求下書き | `docs/reports/quality/reviews/` | 手動 | 専門家確認要否 |
| `pr-content-quality-review.md` | 自社SNS公開前レビュー | 投稿案/台本 | `docs/reports/quality/reviews/` | 将来案 | 自動投稿禁止 |
| `weekly-ai-ops-audit.md` | 週次AI監査 | 各レポート | `docs/reports/quality/audits/` | 将来案 | 自動修正禁止 |
| `confidential-info-scan.md` | 秘密情報スキャン | 対象ファイル/ディレクトリ | `docs/reports/quality/audits/` | 手動 | 値は再表示しない |
| `factuality-check.md` | 事実確認 | 候補/提案/投稿 | `docs/reports/quality/reviews/` | 手動 | 推測と事実を分離 |
| `client-7-day-check.md` | 7日目CSチェック | クライアント状況 | `docs/reports/cs/checks/` | 将来案 | 自動連絡禁止 |
| `client-14-day-check.md` | 14日目CSチェック | 進行/修正状況 | `docs/reports/cs/checks/` | 将来案 | 人間確認前提 |
| `client-30-day-check.md` | 30日目CSチェック | 初月結果 | `docs/reports/cs/checks/` | 将来案 | 成果保証禁止 |
| `monthly-client-success-review.md` | 月次CSレビュー | 月次レポート等 | `docs/reports/cs/monthly/` | 将来案 | 連絡は人間 |
| `churn-risk-review.md` | 解約リスク確認 | 状況/フィードバック | `docs/reports/cs/monthly/` | 手動 | 責めない表現 |
| `client-feedback-summary.md` | フィードバック要約 | 連絡内容 | `docs/reports/cs/feedback/` | 手動 | 個人情報注意 |
| `renewal-proposal-builder.md` | 継続提案下書き | 月次レビュー | `docs/reports/cs/renewal/` | 手動 | 自動送信禁止 |
| `upsell-proposal-builder.md` | アップセル下書き | 課題/プラン | `docs/reports/cs/renewal/` | 手動 | 押し売り禁止 |
| `client-success-weekly-review.md` | 週次CSレビュー | 契約中クライアント状況 | `docs/reports/cs/` | 将来案 | 契約変更禁止 |
| `knowledge-index-builder.md` | ナレッジ索引作成 | docs/prompts/reports/data | `docs/reports/knowledge/indexes/` | 将来案 | 未追跡ファイルを編集しない |
| `document-finder.md` | 目的別ファイル案内 | やりたいこと | local/レポート | 手動 | 推測で実行しない |
| `operation-runbook-builder.md` | 運用手順書作成 | 作業名/参照ファイル | `docs/reports/knowledge/` | 手動 | 禁止事項明記 |
| `weekly-knowledge-review.md` | 週次ナレッジレビュー | 追加/更新ファイル | `docs/reports/knowledge/reviews/` | 将来案 | 自動コミット禁止 |
| `outdated-docs-review.md` | 古いドキュメント確認 | docs全体 | `docs/reports/knowledge/reviews/` | 手動/将来案 | 自動削除禁止 |
| `troubleshooting-helper.md` | トラブル対応支援 | エラー/ログ | `docs/reports/knowledge/troubleshooting/` | 手動 | 秘密情報を再表示しない |
| `next-action-router.md` | 次アクション振り分け | 現状/困りごと | local/レポート | 手動 | 最終判断は人間 |

## ツール/インフラ管理

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `infra-health-check.md` | インフラ全体ヘルスチェック | Git/npm/Hermes/Vercel/Sheets状態 | `docs/reports/infra/health-checks/` | 将来案 | send-prospects実行禁止 |
| `hermes-cron-health-check.md` | Hermes cron監視 | Gateway/cron/jobs/logs | `docs/reports/infra/health-checks/` | 将来案 | job登録/削除禁止 |
| `deployment-readiness-review.md` | デプロイ前確認 | 変更差分、lint/build | `docs/reports/infra/deployments/` | 手動 | 実運用ファイルを勝手にコミットしない |
| `vercel-deployment-review.md` | Vercelデプロイ後確認 | push/deployment状態 | `docs/reports/infra/deployments/` | 手動 | env実値表示禁止 |
| `sheets-webhook-health-check.md` | Sheets Webhook確認 | env状態、JSON、スクリプト | `docs/reports/infra/health-checks/` | 手動 | test再送信は人間許可 |
| `secrets-and-env-review.md` | 秘密情報/環境変数レビュー | docs/reports/data/diff/status | `docs/reports/infra/health-checks/` | 将来案 | 実値はマスキング |
| `infra-incident-triage.md` | インフラ障害トリアージ | 障害内容、ログ | `docs/reports/infra/incidents/` | 手動 | 実設定変更禁止 |
| `dependency-maintenance-review.md` | 依存関係レビュー | package/lockfile | `docs/reports/infra/maintenance/` | 手動 | 自動update禁止 |
| `backup-review.md` | バックアップレビュー | GitHub/Sheets/Apps Script/Hermes jobs | `docs/reports/infra/maintenance/` | 手動 | 秘密情報そのものを保存しない |

## 商品開発・パッケージ改善

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `product-package-review.md` | 商品パッケージレビュー | プラン/営業/商談/CS反応 | `docs/reports/product/reviews/` | 将来案 | 価格/LP自動変更禁止 |
| `proposal-plan-matcher.md` | 商談内容から推奨プラン選定 | 店舗情報/課題/予算 | `docs/reports/product/packages/` | 手動 | 人間確認前提 |
| `pricing-scope-check.md` | 価格/作業範囲チェック | 提案/見積/契約/請求 | `docs/reports/product/reviews/` | 手動 | 請求金額自動変更禁止 |
| `lp-copy-for-offer-builder.md` | LP反映候補コピー作成 | 商品設計 | `docs/reports/product/lp-copy/` | 手動 | LP自動変更禁止 |
| `product-feedback-summary.md` | 商品フィードバック要約 | 営業/商談/CS反応 | `docs/reports/product/feedback/` | 手動 | 推測で判断しない |
| `monthly-product-improvement-review.md` | 月次商品改善レビュー | 営業/商談/受注/CS/KPI | `docs/reports/product/reviews/` | 将来案 | 価格変更は人間 |
| `industry-package-builder.md` | 業態別パッケージ作成 | 業態/課題/反応 | `docs/reports/product/packages/` | 手動 | 表現注意 |
| `upsell-path-review.md` | アップセル導線レビュー | CS/月次/課題 | `docs/reports/product/reviews/` | 手動 | 自動送信禁止 |

## 外注・採用管理

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `outsourcing-task-brief-builder.md` | 外注タスクブリーフ作成 | タスク名/業務/納期/成果物 | `docs/reports/outsourcing/briefs/` | 手動 | 自動依頼禁止 |
| `vendor-candidate-review.md` | 外注候補者レビュー | 応募情報/ポートフォリオ | `docs/reports/outsourcing/vendors/` | 手動 | 自動採用禁止 |
| `trial-task-review.md` | トライアル課題レビュー | 成果物/評価基準 | `docs/reports/outsourcing/reviews/` | 手動 | 契約判断禁止 |
| `vendor-quality-review.md` | 外注先品質レビュー | 依頼内容/納期/品質 | `docs/reports/outsourcing/reviews/` | 手動 | 自動連絡禁止 |
| `outsourcing-risk-check.md` | 外注リスク確認 | 依頼内容/共有情報/条件 | `docs/reports/outsourcing/risks/` | 手動 | 秘密情報共有禁止 |
| `vendor-onboarding-prep.md` | 外注先オンボーディング準備 | ロール/初回タスク | `docs/reports/outsourcing/vendors/` | 手動 | ログイン情報共有禁止 |
| `monthly-vendor-review.md` | 月次外注先レビュー | 依頼件数/品質/コスト | `docs/reports/outsourcing/reviews/` | 将来案 | 自動支払い禁止 |
| `recruiting-copy-builder.md` | 外注募集文下書き | 募集ロール/条件 | `docs/reports/outsourcing/vendors/` | 手動 | 自動掲載禁止 |

## AI運用改善

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `ai-ops-prompt-review.md` | プロンプト品質レビュー | 対象プロンプト/用途 | `docs/reports/ai-ops/reviews/` | 手動 | 本番自動反映禁止 |
| `prompt-regression-test.md` | プロンプト回帰テスト | テストケース/期待出力 | `docs/reports/ai-ops/evaluations/` | 手動 | 人間判断前提 |
| `ai-output-evaluation.md` | AI出力評価 | 評価対象ファイル | `docs/reports/ai-ops/evaluations/` | 手動 | 外部送信禁止 |
| `ai-failure-analysis.md` | AI失敗分析 | 失敗内容/ログ | `docs/reports/ai-ops/failures/` | 手動 | 秘密情報再表示禁止 |
| `model-selection-review.md` | モデル選定レビュー | タスク種別/要件 | `docs/reports/ai-ops/reviews/` | 手動 | 自動モデル変更禁止 |
| `ai-cost-quota-review.md` | コスト/クォータレビュー | 利用状況メモ | `docs/reports/ai-ops/costs/` | 手動/将来案 | 推測料金禁止 |
| `context-quality-review.md` | コンテキスト品質レビュー | 前提/参照ファイル | `docs/reports/ai-ops/reviews/` | 手動 | 秘密情報入力禁止 |
| `monthly-ai-ops-improvement-review.md` | 月次AI運用改善レビュー | 各AI運用レポート | `docs/reports/ai-ops/improvements/` | 将来案 | 設定変更禁止 |

## Instagram営業・自社SNSコンテンツ

| ファイル | 目的 | 入力 | 出力先 | 自動化可否 | 人間確認/禁止事項 |
|---|---|---|---|---|---|
| `instagram-sales-list-builder.md` | Instagram起点でフォロワー5,000人未満の地域密着型候補を抽出 | 対象エリア/業態/公開Instagram情報 | `data/prospects/`, `docs/reports/sales/research/` | 将来案 | 自動DM/自動コメント/Sheets投入禁止 |
| `instagram-prospect-scoring-review.md` | Instagram営業候補のA/B/C/除外判定を確認 | 候補JSON/リサーチレポート | `docs/reports/sales/research/` | 手動 | フォロワー数推測禁止、5,000人以上は原則C/除外 |
| `weekly-self-content-builder.md` | 自社SNS投稿を週1〜2本分作成 | 自社SNS戦略/商品/営業ルール | `docs/reports/pr/content/` | 将来案 | 自動投稿禁止 |
| `self-content-post-ready-builder.md` | 単発の手動投稿用SNS原稿を作成 | 投稿テーマ/業態/CTA | `docs/reports/pr/content/` | 手動 | SNSログイン禁止 |
