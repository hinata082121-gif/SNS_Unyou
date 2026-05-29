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
