# Hermes登録プロンプト: ICHI Threads 金曜20時 バズ投稿分析・投稿文改善

## タスク名

ICHI Threads 金曜20時 バズ投稿分析・投稿文改善

## cron

`0 20 * * 5`

## 作業ディレクトリ

`C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css`

## 有効ツール

- file
- terminal
- web

## タスク内容

- 直近1週間の自社Threads投稿結果を安全な件数だけで確認する
- 公開情報の範囲でバズ投稿傾向を収集する
- 投稿構造、冒頭文、CTA、問いかけ、テーマを分析する
- 翌週の投稿テーマ、CTA、文体改善案を作成する
- `docs/threads/weekly-analysis/` に安全なMarkdownレポートを作成する
- Agent Statusへ `needs_review` として記録する
- 自動返信、いいね、フォローは行わない
- 無断転載や本文丸コピーは行わない

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

- `npm run agent:status:validate`
- `npm run agent:status:render`
- `npm run agent:office:render`
- `npm run lint`
- `npm run build`
- 安全なdocsとAgent Status JSONだけを個別にGit追加する
