# 週次KPIレビュー用プロンプト

## 目的

毎週日曜18:00に、ICHI Socialの営業・商談・売上・納品・改善KPIを整理する。

## 入力として参照するもの

- `data/management/kpi-input-template.md` または人間が入力したKPI値
- `docs/reports/sales/daily/*.md`
- `docs/reports/sales/research/*.md`
- `docs/reports/marketing/*.md`
- `docs/reports/proposals/*.md`
- `docs/reports/admin/*.md`
- `docs/reports/delivery/*.md`
- `docs/reports/monthly-reports/*.md`

## 出力

`docs/reports/management/weekly/YYYY-MM-DD-weekly-kpi-review.md`

## 含める内容

1. 今週の要約
2. 営業KPI
3. 商談KPI
4. 売上見込み
5. 業態別/地域別の傾向
6. ボトルネック
7. 改善案
8. 翌週の重点地域
9. 翌週の重点業態
10. 翌週のアクション
11. 人間が判断すべきこと

## 重要ルール

- 不明な数値は推測しない
- 未入力は未入力と書く
- 営業送信は行わない
- スプレッドシート更新は行わない
- 請求送付は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報は表示しない
- 価格変更や契約判断は人間に委ねる
