# Agent Status Prompt Footer

このフッターは、Codex/Hermes Agent向けプロンプトの末尾に必ず付ける共通ルールです。

## 必須ルール

作業開始時・主要フェーズ完了時・失敗時・終了時に、`scripts/agent-status/update.mjs` を使って `data/agent-status/tasks/` にタスク状態を記録してください。

作業完了後は以下を実行してください。

```bash
npm run agent:status:validate
npm run agent:status:render
```

これにより `tmp/agent-dashboard.html` を更新してください。

## 記録する状態

利用可能なstatusは以下です。

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

## 推奨ステータス

- 作業開始: `running`
- 検証中: `checking`
- 完了: `success`
- 一部完了: `partial`
- 人間確認待ち: `needs_review`
- 外部要因で停止: `blocked`
- 失敗: `failed`
- 対象外/未実行: `skipped`
- 同期完了: `synced`

## 進捗更新例

作業開始時:

```bash
node scripts/agent-status/update.mjs --id "<task-id>" --agent "Codex" --avatar codex-engineer --title "<作業名>" --status running --phase "作業開始" --progress 5 --summary "<作業概要>"
```

主要フェーズ完了時:

```bash
node scripts/agent-status/update.mjs --id "<task-id>" --status checking --phase "lint/build検証中" --progress 70 --summary "実装完了。検証を実行中。"
```

失敗時:

```bash
node scripts/agent-status/update.mjs --id "<task-id>" --status blocked --phase "build失敗" --progress 60 --summary "npm run build が失敗。commit/pushは未実施。" --next "依存復旧または修正が必要"
```

完了時:

```bash
node scripts/agent-status/update.mjs --id "<task-id>" --status success --phase "完了" --progress 100 --summary "検証・commit・push完了。" --next "人間確認"
```

## 営業候補タスクの判定

営業候補生成タスクでは以下を守ってください。

- 候補10件: `success`
- 候補8〜9件: `partial`
- 候補1〜7件: `needs_review`
- 候補0件: `blocked`
- ファイルが存在するだけでは `success` にしない
- 候補件数を必ず確認する
- C/除外候補を営業対象に混ぜない

## 禁止事項

status JSON、notes、summary、artifacts、HTMLに以下を絶対に入れないでください。

- SECRET_TOKEN
- SHEETS_SECRET_TOKEN
- SHEETS_WEBHOOK_URL
- APIキー
- OAuth URL
- 認証コード
- Gmail app password
- Cookie
- Authorization
- Bearer token
- SNSログイン情報
- 口座情報
- 登録番号
- 個人情報
- 顧客の非公開情報

## 作業後に必ず実行

```bash
npm run agent:status:validate
npm run agent:status:render
```

## HTML確認

生成物:

```text
tmp/agent-dashboard.html
```

これはローカル確認用です。
公開サイト/Next.js UI/Vercel本番には出さないでください。
