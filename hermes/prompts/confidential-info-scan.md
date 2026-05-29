# 秘密情報スキャン用プロンプト

## 目的

指定ファイルまたは指定ディレクトリに、秘密情報・認証情報・口座情報・登録番号・個人情報が混入していないか確認する。

## 出力

`docs/reports/quality/audits/YYYY-MM-DD-confidential-info-scan.md`

## 注意

- 秘密情報を見つけても値をそのまま再表示しない
- マスキングする
- どの種類の情報が疑われるかだけを書く
- 緊急度を出す
- Level 4相当の場合はインシデント記録を提案する

## チェック対象

- SECRET_TOKEN
- Webhook URL
- APIキー
- OAuth URL
- 認証コード
- SNSログイン情報
- 口座情報
- 登録番号
- 個人情報
