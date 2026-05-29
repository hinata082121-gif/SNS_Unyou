# 現在のICHI Social運用モデル

## 自動化済み

- 毎朝の営業候補作成
- 月水のリサーチ/リスト更新
- 週次市場・競合分析
- Webhook経由の営業候補投入スクリプト

## 半自動

- 営業候補JSON作成
- 無料SNS診断レポート下書き
- 提案書下書き
- 投稿カレンダー作成
- 月次レポート下書き
- 契約/請求書下書き
- KPI/経営レビュー下書き
- ナレッジ索引作成
- 目的別ファイル案内
- トラブルシューティング初動整理
- インフラヘルスチェック
- Hermes cron状態整理
- デプロイ前後チェック
- 商品パッケージレビュー
- 提案プラン選定
- 価格/作業範囲チェック
- 外注タスクブリーフ下書き
- 外注候補者/トライアル/品質レビュー下書き
- AIプロンプトレビュー
- AI出力評価/失敗分析
- モデル/コスト/クォータ見直し

## 手動

- 営業送信
- SNS DM
- 問い合わせフォーム送信
- スプレッドシート更新
- 契約判断
- 請求送付
- 入金確認
- 投稿操作
- クライアント連絡

## 意図的に自動化しないこと

- 外部送信
- 請求/入金処理
- 契約/法務判断
- 価格変更
- SNS権限操作
- 秘密情報入力

## 部門別ファイル

- 営業: `data/prospects/`, `docs/sales/`
- マーケティング: `docs/reports/marketing/`
- 商談: `docs/deals/`, `docs/reports/audits/`, `docs/reports/proposals/`
- 納品: `docs/delivery/`, `docs/reports/delivery/`
- 法務請求: `docs/admin/`, `docs/reports/admin/`
- KPI: `docs/management/`, `data/management/`
- 全体統括: `docs/executive/`, `docs/reports/executive/`
- ナレッジ管理: `docs/knowledge/`, `docs/reports/knowledge/`
- ツール/インフラ管理: `docs/infra/`, `docs/reports/infra/`
- 商品開発・パッケージ改善: `docs/product/`, `docs/reports/product/`
- 外注・採用管理: `docs/outsourcing/`, `docs/reports/outsourcing/`
- AI運用改善: `docs/ai-ops/`, `docs/reports/ai-ops/`

## ナレッジ管理で整備済みのこと

- 部門横断の索引: `docs/knowledge/document-index.md`
- Hermesプロンプト索引: `docs/knowledge/prompt-index.md`
- レポート保存先索引: `docs/knowledge/report-index.md`
- 目的別ナビゲーション: `docs/knowledge/use-case-navigation.md`
- 日次/週次/月次ガイド: `docs/knowledge/daily-operations-guide.md`, `weekly-operations-guide.md`, `monthly-operations-guide.md`
- 未追跡ファイル扱い: `docs/knowledge/untracked-files-policy.md`
- トラブルシューティング索引: `docs/knowledge/troubleshooting-index.md`

## ツール/インフラ管理で整備済みのこと

- Hermes/GitHub/Vercel/Sheets/Webhook/WSL2を支える部門: `docs/infra/overview.md`
- 9:00自動実行の安定性確認: `docs/infra/hermes-cron-monitoring.md`
- 秘密情報管理: `docs/infra/environment-variables.md`, `docs/infra/secrets-management.md`
- デプロイ確認: `docs/infra/deployment-checklist.md`, `docs/infra/vercel-deployment.md`
- 障害対応: `docs/infra/incident-response.md`
- バックアップ: `docs/infra/backup-and-recovery.md`

## 商品開発・パッケージ改善で整備済みのこと

- プラン/価格/作業範囲を支える部門: `docs/product/plan-definition.md`, `docs/product/pricing-rules.md`, `docs/product/service-scope.md`
- 営業/提案/納品/請求/CSの整合: `docs/product/proposal-matching-rules.md`, `docs/product/pricing-scope-check.md`
- LP反映候補コピー: `docs/product/lp-copy-draft.md`
- LP自体は自動変更しない

## 外注・採用管理で整備済みのこと

- クライアント増加時の制作負荷を支える部門: `docs/outsourcing/overview.md`
- 外注先に渡す情報を制限する部門: `docs/outsourcing/confidentiality-rules.md`, `docs/outsourcing/client-info-sharing-rules.md`
- 品質管理・法務・請求との接続: `docs/outsourcing/delivery-and-review-flow.md`, `docs/outsourcing/payment-and-invoice-rules.md`
- 外注は現時点では将来準備であり、募集、採用、契約、支払いは自動化しない

## AI運用改善で整備済みのこと

- Hermes/Codex/ChatGPTの使い分け: `docs/ai-ops/agent-routing-rules.md`
- プロンプト改善: `docs/ai-ops/prompt-design-rules.md`, `docs/ai-ops/prompt-versioning-rules.md`
- 失敗分析: `docs/ai-ops/failure-analysis-rules.md`
- モデル/コスト/クォータ管理: `docs/ai-ops/model-usage-policy.md`, `docs/ai-ops/cost-and-quota-management.md`
- 人間介在: `docs/ai-ops/human-in-the-loop-rules.md`
- 品質管理部門は生成物の送付/公開前チェック、AI運用改善部門はAIの使い方と改善サイクルを扱う

## 今日時点の運用上の弱点

- 実データが少ない
- 9:00営業候補タスクの出力品質を継続確認中
- KPI入力が手動
- 部門横断の接続漏れが起きやすい
- 初回受注後の実運用実績がまだ少ない

## 次に改善すべきこと

- 日次ブリーフィングで当日の優先順位を固定する
- 返信ありから診断/商談への接続を強化する
- KPI入力テンプレートを週次で埋める
- 受注後のオンボーディングを実案件で検証する
