# レポート保存先索引

| 保存先 | 保存するもの | ファイル名ルール | 作成タイミング | 確認者 | Git管理 | 注意 |
|---|---|---|---|---|---|---|
| `docs/reports/sales/` | 営業候補、リサーチ結果 | `YYYY-MM-DD-...md` | 日次/リサーチ時 | 人間 | 内容確認後 | 秘密情報禁止 |
| `docs/reports/marketing/` | 市場/競合分析 | `YYYY-MM-DD-weekly-market-analysis.md` | 金曜17:00 | 人間 | 可 | 出典URL必須 |
| `docs/reports/audits/` | 無料SNS診断 | `YYYY-MM-DD-store-name-audit.md` | 診断作成時 | 人間 | 個別判断 | 公開情報のみ |
| `docs/reports/proposals/` | 提案書 | `YYYY-MM-DD-store-name-proposal.md` | 提案前 | 人間 | 個別判断 | 送付前レビュー |
| `docs/reports/delivery/` | 納品準備、投稿企画 | `YYYY-MM-DD-store-name-...md` | 受注後 | 人間 | 個別判断 | クライアント情報注意 |
| `docs/reports/content-calendars/` | 月間投稿カレンダー | `YYYY-MM-store-name-content-calendar.md` | 月次 | 人間 | 個別判断 | 素材/権利注意 |
| `docs/reports/monthly-reports/` | クライアント月次レポート | `YYYY-MM-store-name-monthly-report.md` | 月末 | 人間 | 個別判断 | 未取得は未取得 |
| `docs/reports/admin/` | 契約/請求/チェックリスト | `YYYY-MM-DD-store-name-...md` | 契約/請求時 | 人間 | 原則慎重 | 口座/登録番号実値禁止 |
| `docs/reports/management/` | KPI、売上、リスク | `YYYY-MM-DD-...md` / `YYYY-MM-...md` | 週次/月次 | 人間 | 可 | 推測値を分離 |
| `docs/reports/executive/` | 全体レビュー、優先順位 | `YYYY-MM-DD-...md` | 日次/週次/月次 | 人間 | 可 | 意思決定は人間 |
| `docs/reports/pr/` | 自社SNS投稿案、台本、レビュー | `YYYY-MM-DD-...md` | 投稿案作成時 | 人間 | 可 | 架空実績禁止 |
| `docs/reports/quality/` | 品質レビュー、AI監査 | `YYYY-MM-DD-...md` | 送付/公開前、週次 | 人間 | 可 | 秘密情報はマスク |
| `docs/reports/cs/` | CSチェック、継続提案 | `YYYY-MM-DD-client-name-...md` | 7/14/30日、月次 | 人間 | 個別判断 | クライアント情報注意 |
| `docs/reports/knowledge/` | 索引、棚卸し、トラブル対応 | `YYYY-MM-DD-...md` | 週次/月次/必要時 | 人間 | 可 | 未追跡ファイルは勝手に編集しない |
| `docs/reports/infra/` | インフラヘルスチェック、障害対応、デプロイ確認、バックアップレビュー | `YYYY-MM-DD-...md` | 週次/月次/障害時 | 人間 | 可 | 秘密情報の実値は記載しない |

すべてのレポートに、`SECRET_TOKEN`、Webhook URLの実値、APIキー、認証情報、口座情報、登録番号、実クライアント個人情報を入れないでください。
