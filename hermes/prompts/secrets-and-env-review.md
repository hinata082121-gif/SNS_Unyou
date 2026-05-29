# 秘密情報/環境変数レビュー用プロンプト

## 出力

`docs/reports/infra/health-checks/YYYY-MM-DD-secrets-and-env-review.md`

## 確認

- `.env.example`
- `.env.hermes.example`
- docs
- reports
- data
- git diff
- git status
- 実値らしき情報の有無

## 重要

実値を見つけてもそのまま表示しない。マスキングし、緊急度と人間が行うローテーション判断を記載する。

