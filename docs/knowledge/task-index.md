# スケジュールタスク索引

## 登録済みタスク

| タスク | 頻度 | 目的 | 参照プロンプト | 出力先 | 登録状況 | 自動化しないこと |
|---|---|---|---|---|---|---|
| ICHI Social 毎朝営業候補10件作成 | 毎日9:00 | 当日候補整理 | `scheduled-daily-sales-candidates.md` | `docs/reports/sales/daily/` | 登録済み | 送信、Sheets更新 |
| ICHI Social 月水リサーチ・リスト更新 | 月水10:30 | 新規候補リサーチ | `scheduled-research-refill-mon-wed.md` | `data/prospects/` | 登録済み | 営業送信、自動投入 |
| ICHI Social 週次市場・競合分析 | 金曜17:00 | 市場/競合/改善分析 | `weekly-market-competitor-analysis.md` | `docs/reports/marketing/` | 登録済み | 外部送信、推測記載 |

## 登録済みまたは検討中のタスク

| タスク | 頻度 | 目的 | 参照プロンプト | 出力先 | 登録判断 |
|---|---|---|---|---|---|
| 返信・商談レビュー | 毎日18:30 | 返信あり/商談候補整理 | `daily-reply-and-deal-review.md` | 任意 | 返信が増えたら |
| 日次営業候補レポート補完チェック | 9:30/13:30 | 9:00レポート補完確認 | `scheduled-daily-sales-candidates.md` | `docs/reports/sales/daily/` | 9:00運用品質次第 |

## 将来タスク案

| タスク | 頻度 | 参照プロンプト | 出力先 | 登録条件 |
|---|---|---|---|---|
| 週次クライアント運用レビュー | 月曜11:30 | `weekly-client-operation-review.md` | `docs/reports/delivery/` | 契約クライアント発生後 |
| 月次請求レビュー | 毎月25日10:00 | `billing-review.md` | `docs/reports/admin/checklists/` | 請求対象発生後 |
| 週次KPIレビュー | 日曜18:00 | `weekly-kpi-review.md` | `docs/reports/management/weekly/` | KPI入力が安定後 |
| 月次経営レポート | 月末18:00 | `monthly-management-report.md` | `docs/reports/management/monthly/` | 実データ蓄積後 |
| 日次全体ブリーフィング | 毎日8:30 | `daily-executive-briefing.md` | `docs/reports/executive/daily/` | 9:00営業タスク安定後 |
| 週次全体レビュー | 日曜19:00 | `weekly-executive-review.md` | `docs/reports/executive/weekly/` | 週次KPI安定後 |
| 月次全体レビュー | 月末19:00 | `monthly-executive-review.md` | `docs/reports/executive/monthly/` | 月次経営レポート安定後 |
| 自社SNS月間カレンダー作成 | 毎月1日10:00 | `self-sns-monthly-calendar-builder.md` | `docs/reports/pr/calendars/` | 自社SNS運用開始時 |
| 自社SNS週次レビュー | 金曜18:00 | `pr-weekly-content-review.md` | `docs/reports/pr/reviews/` | 投稿実績蓄積後 |
| ショート動画台本作成 | 火曜15:00 | `short-video-script-builder.md` | `docs/reports/pr/scripts/` | 短尺運用開始時 |
| 週次AI運用監査 | 土曜10:00 | `weekly-ai-ops-audit.md` | `docs/reports/quality/audits/` | AI生成物増加後 |
| 営業送信前品質レビュー | 平日8:45 | `pre-send-sales-review.md` | `docs/reports/quality/reviews/` | 送信件数増加後 |
| 自社SNS公開前レビュー | 金曜16:30 | `pr-content-quality-review.md` | `docs/reports/quality/reviews/` | 自社SNS運用開始時 |
| 週次カスタマーサクセスレビュー | 木曜17:00 | `client-success-weekly-review.md` | `docs/reports/cs/` | 契約クライアント発生後 |
| 初月クライアントチェック | 平日16:00 | `client-7-day-check.md` など | `docs/reports/cs/checks/` | 初回受注後 |
| 月次継続提案レビュー | 毎月20日15:00 | `monthly-client-success-review.md` | `docs/reports/cs/` | 月次運用開始後 |
| 週次ナレッジレビュー | 日曜20:00 | `weekly-knowledge-review.md` | `docs/reports/knowledge/reviews/` | docs更新が増えたら |
| 月次ドキュメント棚卸し | 月末20:00 | `outdated-docs-review.md` | `docs/reports/knowledge/reviews/` | 部門運用が増えたら |
| トラブルシューティング支援 | 必要時 | `troubleshooting-helper.md` | `docs/reports/knowledge/troubleshooting/` | エラー発生時 |

