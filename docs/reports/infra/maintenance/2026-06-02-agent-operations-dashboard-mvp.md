# Agent Operations Dashboard MVP 導入レポート

## 実行日時

2026-06-02 14:08:52 +09:00

## 導入理由

Codex/Hermes Agentのタスク状態、営業候補0件、補完チェック、依存復旧、Git同期、lint/build、commit/pushを人間がすぐ確認できるようにするため、ローカルHTML生成型のMVPを導入した。

## 実装した機能

- タスク状態JSONの作成/更新
- タスクJSONのスキーマ検証
- 初期サンプルタスク生成
- ローカルHTMLダッシュボード生成
- blocked/failed/needs_reviewの上部強調
- AIアバター表示
- 進捗バー、metrics、artifacts、notes表示
- 秘密情報らしき文字列の簡易検出

## 作成したファイル

- `scripts/agent-status/update.mjs`
- `scripts/agent-status/render-dashboard.mjs`
- `scripts/agent-status/seed.mjs`
- `scripts/agent-status/validate.mjs`
- `data/agent-status/archive/.gitkeep`
- `docs/ops/agent-operations-dashboard.md`
- `docs/reports/infra/maintenance/2026-06-02-agent-operations-dashboard-mvp.md`

## 更新したファイル

- `.gitignore`
- `package.json`
- `docs/hermes-scheduled-automation.md`
- `docs/knowledge/document-index.md`
- `docs/knowledge/prompt-index.md`
- `docs/knowledge/use-case-navigation.md`
- `hermes/prompts/scheduled-daily-sales-candidates.md`
- `hermes/prompts/scheduled-research-refill-mon-wed.md`
- `hermes/prompts/instagram-sales-list-builder.md`
- `hermes/prompts/instagram-prospect-scoring-review.md`
- `hermes/prompts/prospect-json-rules.md`

## AIアバター一覧

- `codex-engineer`: Codex Engineer / 🧑‍💻
- `hermes-scheduler`: Hermes Scheduler / 🕰️
- `sales-scout`: Sales Scout / 🔎
- `sheets-clerk`: Sheets Clerk / 📊
- `ops-monitor`: Ops Monitor / 🛡️
- `pr-writer`: PR Writer / 📣

## ステータス一覧

- `queued`
- `running`
- `checking`
- `success`
- `partial`
- `blocked`
- `failed`
- `skipped`
- `needs_review`
- `synced`

## サンプルタスク

seedで以下を生成する。

- 5,000人未満ルール変更
- 公開問い合わせメール変更
- 2026-06-02 12:00営業候補生成
- 0件防止設計
- Sheets投入

## ローカルHTML出力先

```text
tmp/agent-dashboard.html
```

## Codexでの使い方

作業開始時に `running`、lint/build成功時に `checking` または進捗更新、commit/push成功時に `success`、build失敗時に `blocked` または `failed` を記録する。

## Hermesでの使い方

cron開始時に `running`、候補10件なら `success`、候補8〜9件なら `partial`、候補1〜7件なら `needs_review`、候補0件なら `blocked` として記録する。

## 12:00/12:30/14:00営業タスクとの連携

12:00営業候補生成、12:30補完チェック、14:00再補完チェックで、候補数、A/B/C件数、探索Tier、0件時の `emergency_refill_mode` 要否をmetricsやsummaryに残す。

## 0件出力時の扱い

候補0件は `success` にしない。`blocked` とし、`nextAction` に緊急補完モードまたは人間検収を記録する。

## セキュリティ確認

- status JSONに秘密情報を入れない
- dashboard HTMLに秘密情報を出さない
- `tmp/agent-dashboard.html` はgit管理しない
- `.env` は変更しない
- Google Sheets投入はしない
- 営業送信、DM、コメント、投稿はしない

## 秘密情報混入チェック結果

確認済み。差分内では方針文中の秘密情報キーワードにのみ反応し、実値らしき情報は検出されていない。

## lint/build結果

- `node scripts/agent-status/validate.mjs`: OK
- `node scripts/agent-status/render-dashboard.mjs`: OK
- `npm run agent:status:validate`: OK
- `npm run agent:status:render`: OK
- `npm run lint`: OK
- `npm run build`: OK

## 今回実行していないこと

- Google Sheets投入
- `scripts/sheets/send-prospects.mjs` 実行
- 営業メール送信
- Instagram DM送信
- Instagramコメント投稿
- Instagram自動投稿
- 自動フォロー/いいね
- 問い合わせフォーム送信
- Hermesタスク登録/削除/変更
- `.env` 変更
- GitHub Secrets変更
- Vercel環境変数変更
- Next.js公開ページへの内部ダッシュボード追加

## 今後の拡張案

- Codex hooks連動
- Hermes cron実行結果の自動取り込み
- GitHub Actions結果の取り込み
- Next.jsのローカル限定管理画面
- AIアバター画像生成
- 日次/週次の運用サマリー生成
