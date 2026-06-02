# Agent Operations Dashboard

## 目的

Codex/Hermes Agentの作業状態を、ローカルHTMLで一覧確認できるようにする。日次営業候補生成、補完チェック、0件インシデント、lint/build、commit/push、Sheets投入前検収などの状態を、人間が短時間で把握するためのMVPとする。

## 背景

ICHI Socialでは、cron未実行、12:00ジョブ成功だが候補0件、補完チェック未達、Codex/Hermesのローカル状態差分、build失敗、push認証問題、重複候補出力などが発生している。タスク状態を共通JSONに残し、Codex/Hermesどちらからでも更新できる運用にする。

## 対象エージェント

- Codex: 実装、lint/build、commit/push、ドキュメント更新
- Hermes Agent: cron、営業候補生成、補完チェック、レポート作成
- System/Ops: インシデント、依存復旧、Git同期、Sheets投入前検収

## ステータスJSON設計

保存先:

```text
data/agent-status/tasks/
```

主な項目:

- `id`: タスクID
- `agent`: `Codex`, `Hermes`, `System`, `Human`
- `avatar`: AIアバター種別
- `title`: 表示タイトル
- `category`: `sales`, `ops`, `infra`, `sheets`, `pr` など
- `status`: 許可されたステータス
- `phase`: 現在フェーズ
- `progress`: 0〜100
- `summary`: 秘密情報を含まない要約
- `artifacts`: 関連ファイルの相対パス
- `metrics`: 件数などの任意指標
- `nextAction`: 次にやること
- `safeToAct`: 人間が次アクションしてよいか
- `notes`: 安全確認や補足

## AIアバター一覧

| avatar | 表示名 | 役割 | 表示 |
|---|---|---|---|
| `codex-engineer` | Codex Engineer | 実装、lint/build、commit/push | 🧑‍💻 |
| `hermes-scheduler` | Hermes Scheduler | cron、定期実行、補完チェック | 🕰️ |
| `sales-scout` | Sales Scout | 営業候補探索、重複除外、候補不足検知 | 🔎 |
| `sheets-clerk` | Sheets Clerk | Google Sheets投入、upsert、列整合性 | 📊 |
| `ops-monitor` | Ops Monitor | インシデント、依存復旧、Git同期、0件防止 | 🛡️ |
| `pr-writer` | PR Writer | 自社SNS、投稿案、広報コンテンツ | 📣 |

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

## 使い方

初期サンプル生成:

```bash
node scripts/agent-status/seed.mjs
```

タスク更新:

```bash
node scripts/agent-status/update.mjs --id daily-sales-2026-06-02 --agent Hermes --avatar sales-scout --title "本日分営業候補10件作成" --status blocked --phase "候補不足" --progress 35 --summary "12:00ジョブは実行済みだが候補0件" --artifact docs/reports/sales/daily/2026-06-02-daily-sales-candidates.md --next "緊急補完モードで候補10件を再生成"
```

検証:

```bash
node scripts/agent-status/validate.mjs
```

HTML生成:

```bash
node scripts/agent-status/render-dashboard.mjs
```

出力:

```text
tmp/agent-dashboard.html
```

## Codexでの使い方

- 作業開始時に `running` を記録する
- lint/build成功時に `phase` と `progress` を更新する
- commit/push成功時に `success` へ更新する
- build失敗時は `blocked` または `failed` へ更新する
- push認証問題は `blocked` として記録し、HTTPS pushなどの対応結果をnotesに残す

## Hermesでの使い方

- cron開始時に `running`
- 候補10件なら `success`
- 候補8〜9件なら `partial`
- 候補1〜7件なら `needs_review`
- 候補0件なら `blocked`
- 12:30/14:00補完チェックではファイル存在だけでなく候補数を見る
- Google Sheets投入なし、営業送信なしをnotesに残す

## 12:00/12:30/14:00営業タスクでの使い方

- 12:00営業候補生成: `sales-scout`
- 12:30補完チェック: `hermes-scheduler` または `ops-monitor`
- 14:00再補完チェック: `ops-monitor`
- 候補数、A候補数、B候補数、C/除外候補数、使用した探索Tierをmetricsに残す

## 0件出力時の扱い

候補0件は `success` にしない。必ず `blocked` とし、`nextAction` に `emergency_refill_mode` での再生成または人間検収を記録する。

## 秘密情報を入れないルール

status JSONとdashboard HTMLには、秘密情報、Webhook URL実値、APIキー、認証情報、Cookie、SNSログイン情報、口座情報、登録番号、実顧客の詳細情報を入れない。

`update.mjs` と `validate.mjs` は秘密情報らしき文字列を軽く検出し、保存または検証を止める。

## ローカルHTMLの生成方法

```bash
npm run agent:status:render
```

生成された `tmp/agent-dashboard.html` をブラウザで開く。`tmp/` は生成物としてgit管理しない。

## 公開サイトに出さない理由

内部運用状況、インシデント、営業候補件数、Git同期状態などは公開情報ではない。Vercel本番やNext.js公開ページには表示しない。

## 将来拡張

- Codex hooks連動
- Hermes cron実行結果の自動取り込み
- GitHub Actions結果の取り込み
- Next.jsのローカル限定管理画面
- AIアバター画像生成
- 日次/週次の運用サマリー生成
