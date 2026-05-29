# ICHI Social 部門マップ

| 部門 | 役割 | 主要ファイル | Hermesプロンプト | 自動化済み/将来案 | 人間が行うこと | 他部門との接続 |
|---|---|---|---|---|---|---|
| 営業部門 | 候補作成、検収、手動送信準備 | `data/prospects/`, `docs/sales/` | `scheduled-daily-sales-candidates.md`, `scheduled-research-refill-mon-wed.md` | 毎朝候補作成、月水リサーチ | 検収、送信、ステータス更新 | 商談、KPI |
| マーケティング部門 | 市場/競合分析、訴求改善 | `docs/hermes-weekly-marketing-analysis.md`, `docs/reports/marketing/` | `weekly-market-competitor-analysis.md` | 金曜週次分析 | 改善採用判断 | 営業、KPI、LP改善 |
| 自社SNS・広報部門 | 自社発信、信頼形成、営業補助コンテンツ | `docs/pr/`, `docs/reports/pr/` | `self-sns-monthly-calendar-builder.md`, `short-video-script-builder.md`, `pr-weekly-content-review.md` | 月間カレンダー/週次レビュー/動画台本は将来案 | 投稿可否判断、SNS投稿操作、実績掲載許可確認 | 営業、マーケティング、KPI |
| 品質管理・AI運用監査部門 | AI生成物の品質確認、秘密情報/表現/自動化境界の監査 | `docs/quality/`, `docs/reports/quality/` | `ai-output-quality-review.md`, `pre-send-sales-review.md`, `weekly-ai-ops-audit.md` | 週次AI監査/送信前レビュー/公開前レビューは将来案 | 送付/公開可否、インシデント対応、専門家確認要否 | 全部門 |
| 商談・提案部門 | 返信対応、診断、提案 | `docs/deals/`, `docs/reports/audits/`, `docs/reports/proposals/` | `daily-reply-and-deal-review.md`, `proposal-builder.md` | 毎日返信レビュー案 | 返信、商談、提案送付 | 法務請求、納品 |
| 納品・制作部門 | 受注後の運用、投稿、レポート | `docs/delivery/`, `docs/reports/content-calendars/`, `docs/reports/monthly-reports/` | `weekly-client-operation-review.md`, `monthly-report-builder.md` | 週次運用レビュー案 | 投稿確認、クライアント連絡 | KPI、法務請求 |
| カスタマーサクセス部門 | 初月フォロー、継続提案、解約リスク検知 | `docs/cs/`, `docs/reports/cs/` | `client-success-weekly-review.md`, `monthly-client-success-review.md`, `churn-risk-review.md` | 週次CS/初月チェック/月次継続レビューは将来案 | クライアント連絡、継続/解約/プラン変更判断 | 納品、KPI、法務請求 |
| ナレッジ管理部門 | 部門横断の索引、運用ガイド、トラブル支援 | `docs/knowledge/`, `docs/reports/knowledge/` | `knowledge-index-builder.md`, `document-finder.md`, `weekly-knowledge-review.md` | 週次ナレッジレビュー/月次棚卸し/トラブル支援は将来案 | 索引採用判断、未追跡ファイルの扱い、スケジュール変更判断 | 全部門 |
| 法務・契約・請求部門 | 申込、契約、請求、支払い管理 | `docs/admin/`, `docs/reports/admin/` | `agreement-prep.md`, `invoice-builder.md`, `billing-review.md` | 月次請求レビュー案 | 契約判断、請求送付、入金確認 | 商談、納品、KPI |
| KPI・経営管理部門 | 数値、売上、リスク管理 | `docs/management/`, `data/management/` | `weekly-kpi-review.md`, `monthly-management-report.md` | 週次/月次レビュー案 | 数値入力、意思決定 | 全部門 |
| 全体統括部門 | 優先順位、ボトルネック、意思決定 | `docs/executive/`, `docs/reports/executive/` | `daily-executive-briefing.md`, `weekly-executive-review.md` | 将来案 | 最終判断 | 全部門 |

## 接続の基本

営業で発生した候補は商談へ、商談で受注見込みになった案件は法務・請求へ、受注後は納品へ、各部門の件数と停滞はKPI・経営管理へ反映する。自社SNS・広報部門は、営業で使える信頼材料、無料SNS診断への導線、マーケティング分析から得た訴求を発信コンテンツへ変換する。全体統括部門はその接続漏れを確認する。

## 自社SNS・広報部門で自動化しないこと

- SNSへの自動投稿
- 外部SNSアカウント操作
- 営業メール送信
- SNS DM送信
- 問い合わせフォーム送信
- 架空実績作成
- 実績の無断掲載
- スクリーンショットの無断利用

## 品質管理・AI運用監査部門で自動化しないこと

- 外部送信
- SNS投稿
- 請求書送付
- 契約判断
- 価格変更
- 法務判断
- 税務判断
- 自動修正後の自動公開
- 自動修正後の自動送信

## カスタマーサクセス部門で自動化しないこと

- クライアントへの自動連絡
- 継続提案の自動送信
- アップセル提案の自動送信
- 解約処理
- 契約変更
- 価格変更
- 請求書送付
- 入金確認

## ナレッジ管理部門で自動化しないこと

- 未追跡ファイルの自動削除
- 実運用レポートの自動コミット
- 秘密情報を含む可能性があるファイルの自動公開
- スケジュールタスクの勝手な登録/削除
- 営業送信、SNS投稿、請求送付、契約判断、価格変更、クライアント連絡
