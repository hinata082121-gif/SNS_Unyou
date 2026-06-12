# Hermes Task: ICHI Social 金曜20時 営業・Threads KPI改善レビュー

## タスク名

ICHI Social 金曜20時 営業・Threads KPI改善レビュー

## スケジュール

- 毎週金曜 20:00
- cron: `0 20 * * 5`
- 既存no-agent週次分析タスクに接続する

## 作業ディレクトリ

`C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css`

## 目的

Gmail営業とThreads投稿を、返信率、ポジティブ返信率、商談化、初売上の改善へ接続する。

## 実行内容

1. `npm run sales:kpi:summary` で安全な件数KPIを確認する。
2. 直近1週間のAgent Statusから、Gmail送信数、返信分類件数、商談化件数、Threads投稿状態を安全な件数だけ確認する。
3. Gmail copyVariant A/Bの反応差を件数で比較する。
4. Threads 11:00ノウハウ投稿と19:00共感投稿の反応傾向を確認する。
5. 翌週の件名、本文、CTA、無料SNS診断導線、Threads投稿テーマの改善案を作成する。
6. 改善案は `needs_review` とし、本番テンプレートへ自動反映しない。
7. Agent Status JSONを更新し、`/agent-office` で安全に確認できるようにする。

## 禁止事項

- Gmail送信しない
- Threads投稿しない
- 自動返信しない
- 自動いいね、自動フォローしない
- Google Sheetsを更新しない
- Apps Scriptトリガー操作をしない
- 本番メールテンプレートを自動差し替えしない
- `data/gmail/`、`data/threads/`、`data/prospects/`、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` をGit追加しない
- メールアドレス、営業先名、返信本文、Gmailスレッド全文、outbox本文、TSV本文、APIキー、トークン、Webhook URL、Sheet IDを表示・保存・コミットしない
- `git add .` を使わない

## 完了条件

- 安全なKPI要約がAgent Statusに記録されている
- 改善案が人間承認待ちとして記録されている
- `npm run agent:status:validate`
- `npm run agent:status:render`
- `npm run agent:office:render`
- `npm run lint`
- `npm run build`
