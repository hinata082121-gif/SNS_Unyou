# 週次AI運用監査プロンプト

## 目的

毎週、Hermes/Codexの生成物、スケジュールタスク、レポート、禁止自動化の遵守状況を確認する。

## 参照

- `docs/reports/sales/daily/*.md`
- `docs/reports/sales/research/*.md`
- `docs/reports/marketing/*.md`
- `docs/reports/proposals/*.md`
- `docs/reports/audits/*.md`
- `docs/reports/delivery/*.md`
- `docs/reports/admin/*.md`
- `docs/reports/management/*.md`
- `docs/reports/executive/*.md`
- `docs/reports/pr/*.md`
- `docs/reports/quality/*.md`

## 出力

`docs/reports/quality/audits/YYYY-MM-DD-weekly-ai-ops-audit.md`

## 含める内容

- 今週作成されたAI生成物
- 品質上の懸念
- 秘密情報混入の有無
- 禁止自動化違反の有無
- 成果保証表現の有無
- 架空実績/架空数値の有無
- Hermes自動実行失敗
- 修正提案
- 人間が確認すべきこと

## ルール

- 自動修正後の自動公開/送信は行わない
- 秘密情報の値は再表示しない
- レポート作成のみ行う
