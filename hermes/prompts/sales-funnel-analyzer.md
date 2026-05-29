# 営業ファネル分析プロンプト

## 入力

- 営業スプレッドシートの手動集計値
- daily sales reports
- research reports
- deal reports

## 出力

`docs/reports/management/kpi/YYYY-MM-DD-sales-funnel-analysis.md`

## 分析内容

- ステージ別件数
- 転換率
- 離脱ポイント
- 業態別傾向
- 地域別傾向
- 連絡手段別傾向
- 改善案

## ルール

- スプレッドシートを自動更新しない
- 送信やフォーム投稿を行わない
- 0件や未入力の項目はそのまま書く
- 推測で返信率や転換率を作らない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報を表示しない
