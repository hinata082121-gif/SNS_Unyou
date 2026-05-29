# バックアップ/復旧ルール

## バックアップ対象

- GitHub repository
- Google Sheets
- Apps Script
- Hermes jobs
- Hermes memory/config
- `docs/reports`
- `data/prospects`
- `.env` local valuesの保管方法

## Gitに入れないもの

`.env` 実値、APIキー、Webhook URL実値、SECRET_TOKEN、口座情報、顧客個人情報。

## 復旧順序

1. GitHub repositoryを復元
2. Vercelを再連携/再デプロイ
3. Google SheetsとApps Scriptを確認
4. ローカル/WSL2環境を復旧
5. Hermes jobsを再登録
6. 環境変数を人間が再設定

## 障害別メモ

- PC故障: GitHubとクラウド資産から復旧
- WSL2破損: Hermes再インストール、jobs再登録
- Webhook再発行: env更新、旧URL無効化
- Vercel再デプロイ: GitHub pushまたはVercel rollback

