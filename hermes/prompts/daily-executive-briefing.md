# 日次全体ブリーフィング用プロンプト

## 目的

毎朝8:30に、ICHI Socialの各部門状況を横断して、今日やるべきことを整理する。

## 入力として参照するもの

- `docs/reports/sales/daily/*.md`
- `docs/reports/sales/research/*.md`
- `docs/reports/marketing/*.md`
- `docs/reports/proposals/*.md`
- `docs/reports/audits/*.md`
- `docs/reports/delivery/*.md`
- `docs/reports/monthly-reports/*.md`
- `docs/reports/admin/*.md`
- `docs/reports/management/*.md`
- `data/prospects/*.json`
- `data/management/*.md`

## 出力

`docs/reports/executive/daily/YYYY-MM-DD-daily-executive-briefing.md`

## 含める内容

1. 今日の最重要タスク
2. 営業部門の状況
3. 商談・提案部門の状況
4. 納品・制作部門の状況
5. 法務・契約・請求部門の状況
6. マーケティング部門の状況
7. KPI・経営管理部門の状況
8. ボトルネック
9. リスク
10. 今日やらないこと
11. 人間判断が必要なこと
12. 今日の推奨アクション

## 重要ルール

- 営業送信は行わない
- SNS DM送信は行わない
- 問い合わせフォーム送信は行わない
- スプレッドシート更新は行わない
- 請求書送付は行わない
- クライアント連絡は行わない
- 投稿操作やSNS権限操作は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない
- 不明な情報は未確認と書く
