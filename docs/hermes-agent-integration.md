# Hermes Agent連携手順

## 1. 目的

ICHI Socialの営業管理をHermes Agentに連携するための手順書です。Hermes Agentで見込み客候補の作成、投入用JSONの作成、日次の営業準備、営業状況レビューを補助できる状態にします。

## 2. 前提

- ICHI Socialリポジトリが存在する
- Google Apps Script Webhookが設定済み
- `scripts/sheets/send-prospects.mjs` のテスト送信が成功済み
- Hermes AgentはWSL2上で動かす想定
- 営業メールやSNS DMの自動送信は行わない
- 送信前の最終確認と実送信は人間が行う

## 3. Hermes Agentのインストール概要

公式の流れは以下の想定です。正確な最新手順は、実行前にHermes Agentの公式ドキュメントを確認してください。

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
hermes setup
hermes
```

## 4. WSL2でのプロジェクトディレクトリ例

Windows側のプロジェクト:

```text
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css
```

WSL2側のパス例:

```text
/mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css
```

## 5. 環境変数設定例

Webhook URLと秘密トークンはGitHubにコミットせず、WSL2のシェルで設定します。

```bash
export SHEETS_WEBHOOK_URL="Apps Script WebアプリURL"
export SHEETS_SECRET_TOKEN="Apps Scriptに設定したSECRET_TOKEN"
```

## 6. 環境変数チェック

```bash
npm run check:sales-env
```

期待される出力:

```text
OK: SHEETS_WEBHOOK_URL is set.
OK: SHEETS_SECRET_TOKEN is set.
OK: Webhook URL looks valid.
Sales sheet environment is ready.
```

## 7. テスト送信

```bash
node scripts/sheets/send-prospects.mjs data/prospects/test-prospect.json
```

## 8. 本番JSON送信

```bash
node scripts/sheets/send-prospects.mjs data/prospects/YYYY-MM-DD-area-a.json
```

## 9. セキュリティ注意

- `SHEETS_SECRET_TOKEN` をGitHubにコミットしない
- Webhook URLを公開しない
- `.env` 系ファイルは `.gitignore` に入っているか確認する
- `.env.hermes.example` はサンプルであり、実際のURLやトークンは入れない
- GmailやSNS DMの完全自動送信は初期段階では行わない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易診断」を入口にする
