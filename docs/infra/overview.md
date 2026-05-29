# ツール/インフラ管理部門 概要

## 目的

ICHI SocialのGitHub、Vercel、Hermes Agent、WSL2、Google Sheets、Google Apps Script Webhook、環境変数、ログ、バックアップ、障害対応を標準化し、運用トラブルを減らす。

## 管理対象

- GitHub: ソースコード、docs、promptsの管理
- Vercel: LPの本番/Previewデプロイ
- Hermes Agent: 定期タスク、レポート作成、営業/分析/監査補助
- WSL2: Hermes実行環境
- Google Sheets: 営業候補管理
- Google Apps Script Webhook: 見込み客JSON投入口
- 環境変数: `SHEETS_WEBHOOK_URL`, `SHEETS_SECRET_TOKEN`, Vercel環境変数
- ログ: Hermes、Gateway、cron、npm、Vercel、Webhook response
- バックアップ: GitHub、Sheets、Apps Script、Hermes jobs、reports、data

## Hermesに任せること

- インフラ状態の確認レポート
- cron実行状況の整理
- デプロイ前後チェックリストの下書き
- Sheets Webhookの確認ポイント整理
- 秘密情報/環境変数レビュー
- 障害トリアージ、初動案、再発防止案

## 人間が判断すること

- 環境変数の設定/変更
- Vercel/GitHub/Apps Script/Hermesの実設定変更
- Webhook URLやSECRET_TOKENの再発行
- スケジュールタスクの登録/削除
- 実運用ファイルのコミット可否
- 障害時の復旧方針

## 自動化しないこと

秘密情報の表示/保存、環境変数変更、Vercel/GitHub Secrets変更、Apps Scriptデプロイ、Webhook再発行、SECRET_TOKENローテーション、未追跡ファイル削除、実運用レポートコミット、営業送信、SNS投稿、請求送付、契約判断、法務/税務判断、クライアント連絡。

## 他部門との接続

営業部門のSheets投入、ナレッジ管理部門のトラブル索引、品質管理部門の秘密情報レビュー、全体統括部門のリスク判断を支える基盤部門です。

