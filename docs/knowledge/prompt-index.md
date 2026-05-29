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

