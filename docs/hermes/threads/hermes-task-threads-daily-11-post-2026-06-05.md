# Hermes登録プロンプト: ICHI Threads 毎日11時 ノウハウ投稿

## タスク名

ICHI Threads 毎日11時 ノウハウ投稿

## cron

`0 11 * * *`

## 作業ディレクトリ

`C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css`

## 有効ツール

- file
- terminal
- web

## タスク内容

- 当日11:00用のThreads投稿文を取得または生成する
- 投稿前に文字数、禁止表現、重複、個人情報混入を検査する
- `THREADS_PUBLISH_ENABLED=true` かつ `THREADS_DRY_RUN=false` の場合のみ、公式APIまたは正式に許可された投稿経路で投稿する
- API未設定なら投稿せず `blocked` としてAgent Statusへ記録する
- 投稿結果を `data/agent-status/tasks/` へ安全な件数と状態だけで記録する
- 自動返信、自動いいね、自動フォローは行わない

## 禁止事項

- トークン、APIキー、Client Secret、App Secretを表示しない
- `.env` / `.env.local` を読まない、表示しない、Git追加しない
- Gmail送信しない
- Google Sheets更新しない
- Instagram操作しない
- Threads自動返信/いいね/フォローをしない
- `data/gmail/`、`data/prospects/`、`docs/reports/sales/`、`tmp/` をGit追加しない
- `git add .` を使わない

## 完了時

- `npm run threads:post:validate`
- `npm run agent:status:validate`
- `npm run agent:office:render`
- 安全なAgent Statusとsummaryだけを個別にGit追加する
