# Hermes Agent運用ルール

## 役割

Hermesは営業候補整理、市場分析、レビュー、監査、ナレッジ整理などのレポート作成を担当する。外部送信や実設定変更は行わない。

## 基本操作

- CLI起動: `hermes`
- Gateway起動: `hermes gateway`
- Gateway install: `hermes gateway install`
- cron scheduler: Hermes CLI上で登録
- registered jobs確認: Hermes CLIで確認

## ログ確認

Gateway logs、cron logs、errors.log、local出力を確認する。秘密情報が含まれる場合は値を再表示しない。

## quota/credit不足

モデルquotaやcredit不足時は、時間を置く、モデルを切り替える、人間が課金/設定を確認する。

## 自動化禁止範囲

営業送信、SNS DM、問い合わせフォーム送信、SNS投稿、請求送付、契約判断、価格変更、環境変数変更、Secrets変更は行わない。

## WSL2で動かすこと

HermesはWSL2上で動かす想定。Windowsスリープや再起動後はGateway/cron状態を確認する。

