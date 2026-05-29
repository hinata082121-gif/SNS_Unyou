# 依存関係メンテナンスレビュープロンプト

## 出力

`docs/reports/infra/maintenance/YYYY-MM-DD-dependency-maintenance-review.md`

## 確認

- `package.json`
- lockfile
- outdatedの可能性
- security注意
- updateすべきか
- updateしない方がよいもの
- build/lint確認
- 人間判断

## ルール

major updateは別作業に分ける。自動更新や自動pushはしない。

