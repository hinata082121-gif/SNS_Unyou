# 月間投稿カレンダー作成プロンプト

## 目的

クライアントの契約プラン、投稿本数、商談メモ、季節要素をもとに、月間投稿カレンダーを作成する。

## 入力

- 店舗名
- 業態
- 地域
- 契約プラン
- 投稿本数
- 公式サイト
- Instagram
- 商談メモ
- 季節要素
- 今月の重点テーマ

## 出力

```text
docs/reports/content-calendars/YYYY-MM-store-name-content-calendar.md
```

## 参照ドキュメント

- `docs/delivery/monthly-content-calendar-template.md`
- `docs/delivery/content-strategy-template.md`
- `docs/delivery/industry-expression-rules.md`

## ルール

- クライアントの世界観を尊重する
- 予約導線を自然に入れる
- 投稿テーマを偏らせない
- 整体/健康系は医療効果を断定しない
- 成果保証しない
- 不明点は `未確認` と書く
- 投稿ステータスはテンプレートの許可値に合わせる
