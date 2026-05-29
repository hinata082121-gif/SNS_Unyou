# 月次レポート作成プロンプト

## 目的

対象月の投稿一覧、数値データ、実施内容、運用メモをもとに、月次SNS運用レポートを作成する。

## 入力

- 店舗名
- 対象月
- 投稿一覧
- 数値データ
- 実施内容
- 商談/運用メモ

## 出力

```text
docs/reports/monthly-reports/YYYY-MM-store-name-monthly-report.md
```

## 参照ドキュメント

- `docs/delivery/monthly-report-template.md`
- `docs/delivery/operation-checklist.md`

## ルール

- 数値を誇張しない
- 未取得データは `未取得` と書く
- 成果保証しない
- 売上保証しない
- 良かった点、改善点、翌月提案を出す
- 問い合わせ/予約につながった可能性のある動きは断定しない
