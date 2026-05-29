# ICHI Social 部門マップ

| 部門 | 役割 | 主要ファイル | Hermesプロンプト | 自動化済み/将来案 | 人間が行うこと | 他部門との接続 |
|---|---|---|---|---|---|---|
| 営業部門 | 候補作成、検収、手動送信準備 | `data/prospects/`, `docs/sales/` | `scheduled-daily-sales-candidates.md`, `scheduled-research-refill-mon-wed.md` | 毎朝候補作成、月水リサーチ | 検収、送信、ステータス更新 | 商談、KPI |
| マーケティング部門 | 市場/競合分析、訴求改善 | `docs/hermes-weekly-marketing-analysis.md`, `docs/reports/marketing/` | `weekly-market-competitor-analysis.md` | 金曜週次分析 | 改善採用判断 | 営業、KPI、LP改善 |
| 商談・提案部門 | 返信対応、診断、提案 | `docs/deals/`, `docs/reports/audits/`, `docs/reports/proposals/` | `daily-reply-and-deal-review.md`, `proposal-builder.md` | 毎日返信レビュー案 | 返信、商談、提案送付 | 法務請求、納品 |
| 納品・制作部門 | 受注後の運用、投稿、レポート | `docs/delivery/`, `docs/reports/content-calendars/`, `docs/reports/monthly-reports/` | `weekly-client-operation-review.md`, `monthly-report-builder.md` | 週次運用レビュー案 | 投稿確認、クライアント連絡 | KPI、法務請求 |
| 法務・契約・請求部門 | 申込、契約、請求、支払い管理 | `docs/admin/`, `docs/reports/admin/` | `agreement-prep.md`, `invoice-builder.md`, `billing-review.md` | 月次請求レビュー案 | 契約判断、請求送付、入金確認 | 商談、納品、KPI |
| KPI・経営管理部門 | 数値、売上、リスク管理 | `docs/management/`, `data/management/` | `weekly-kpi-review.md`, `monthly-management-report.md` | 週次/月次レビュー案 | 数値入力、意思決定 | 全部門 |
| 全体統括部門 | 優先順位、ボトルネック、意思決定 | `docs/executive/`, `docs/reports/executive/` | `daily-executive-briefing.md`, `weekly-executive-review.md` | 将来案 | 最終判断 | 全部門 |

## 接続の基本

営業で発生した候補は商談へ、商談で受注見込みになった案件は法務・請求へ、受注後は納品へ、各部門の件数と停滞はKPI・経営管理へ反映する。全体統括部門はその接続漏れを確認する。
