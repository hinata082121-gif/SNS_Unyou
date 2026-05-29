# ナレッジ管理部門 概要

## 目的

ICHI Socialの `docs`、`hermes/prompts`、`docs/reports`、`data` の全体像を整理し、必要な資料、プロンプト、運用ルールを迷わず探せる状態にする。ナレッジ管理部門は、検索性、再利用性、更新しやすさを高めるための部門です。

## 管理対象

- `docs/`: 部門別の恒久ドキュメント、手順書、テンプレート、ルール
- `hermes/prompts/`: Hermes Agentに渡す作業プロンプト
- `docs/reports/`: Hermesや人間が作成する日次/週次/月次の実行結果
- `data/`: 営業候補JSON、KPI入力テンプレート、管理用入力ファイル

## 人間が見るもの

- 迷った時: `docs/knowledge/use-case-navigation.md`
- 今日の作業: `docs/knowledge/daily-operations-guide.md`
- 週次/月次作業: `docs/knowledge/weekly-operations-guide.md`, `docs/knowledge/monthly-operations-guide.md`
- ファイルの探し方: `docs/knowledge/document-index.md`, `docs/knowledge/department-to-file-map.md`
- トラブル時: `docs/knowledge/troubleshooting-index.md`

## Hermesが参照するもの

- 目的別の参照判断: `hermes/prompts/document-finder.md`
- 索引更新: `hermes/prompts/knowledge-index-builder.md`
- 運用手順書作成: `hermes/prompts/operation-runbook-builder.md`
- 週次レビュー: `hermes/prompts/weekly-knowledge-review.md`
- 古いドキュメント確認: `hermes/prompts/outdated-docs-review.md`
- トラブル支援: `hermes/prompts/troubleshooting-helper.md`
- 次アクション振り分け: `hermes/prompts/next-action-router.md`

## 更新ルール

- 新しい部門、プロンプト、レポート保存先を追加したら、索引系ドキュメントを更新する
- 価格、対象地域、スケジュール、禁止事項、サービス範囲が変わったら関連ドキュメントを横断確認する
- 古い内容はすぐ削除せず、使用停止、アーカイブ候補、更新待ちとして扱う

## 自動化しないこと

- 未追跡ファイルの自動削除
- 実運用レポートの自動コミット
- 秘密情報を含む可能性があるファイルの自動公開
- スケジュールタスクの勝手な登録/削除
- 営業送信、SNS投稿、請求送付、契約判断、価格変更、クライアント連絡
- APIキー、認証情報、口座情報、登録番号の保存

## 他部門との接続

ナレッジ管理部門は、営業、マーケティング、商談、納品、法務請求、KPI、全体統括、自社SNS、品質管理、カスタマーサクセスの各部門を横断する索引です。各部門で新しい運用が増えたら、ナレッジ管理に反映して「どこを見ればよいか」を更新します。

