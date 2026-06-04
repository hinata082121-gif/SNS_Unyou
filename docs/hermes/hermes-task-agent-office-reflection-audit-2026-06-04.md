# Hermes登録プロンプト: Agent Office反映監査

## タスク名

ICHI Agent Office 毎日18:30 反映監査・未反映検知

## スケジュール

毎日18:30

cron候補:

```text
30 18 * * *
```

## workdir

```text
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css
```

## enabled_toolsets

- file
- terminal
- web

## 登録文

```text
これは通常の営業送信依頼ではなく、Hermes AgentのAgent Office反映監査タスクです。

タスク名:
ICHI Agent Office 毎日18:30 反映監査・未反映検知

スケジュール:
毎日18:30

目的:
当日実行予定だった自動化施策が、Agent Officeと/agent-officeに安全なAgent Status JSONとして反映されているか確認してください。未反映、古いupdatedAt、runningのまま、blocked未対応、needs_review未対応があれば、stale候補またはneeds_review/blockedとして安全に記録してください。

作業ディレクトリ:
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css

確認対象:
- Gmail自動送信
- Gmail 12:30送信結果・返信確認チェック
- Gmail 14時 失敗・不足リカバリ確認
- Gmail 17時 返信確認・翌日準備チェック
- Gmail営業リスト更新
- 市場・競合分析
- 営業メール改善・反応率分析
- Gmail完全自動送信開始状態

確認するファイル:
- data/agent-status/tasks/*.json
- docs/agent-office.md
- docs/hermes-scheduled-automation.md
- docs/hermes-gmail-daily-monitoring-2026-06-03.md

確認する項目:
- 当日実行予定タスクのAgent Status JSONが存在するか
- updatedAtが期待時刻より古くないか
- statusがrunningのまま長時間残っていないか
- blocked/needs_reviewが未対応のまま残っていないか
- nextActionが空でないか
- /agent-officeに表示してよい安全な件数・状態だけが記録されているか

作成するもの:
- data/agent-status/tasks/agent-office-reflection-audit-result-YYYY-MM-DD.json
- 必要に応じて docs/agent-office-reflection-audit-log/YYYY-MM-DD.md

Agent Office表示:
- stale候補件数
- missingReflectionCount
- blockedCount
- needsReviewCount
- lastAuditAt
- nextAction
- 監査対象タスク数

禁止事項:
- Gmail送信しない
- 自動返信しない
- Apps Scriptトリガー操作しない
- Google Sheets送信済み更新しない
- Instagram投稿/DM/コメント/フォロー/いいねをしない
- 営業候補生成しない
- 本番メールテンプレート差し替えをしない
- data/gmail/本体を読まない、表示しない、Git追加しない
- data/prospects/をGit追加しない
- docs/reports/sales/をGit追加しない
- tmp/をGit追加しない
- .env/.env.localを読まない、表示しない、Git追加しない
- メールアドレス、営業先名、返信本文、Gmailスレッド全文、秘密情報を表示・コミットしない
- git add . を使わない

完了時:
- npm run agent:status:validate
- npm run agent:status:render
- npm run agent:office:render
- npm run lint
- npm run build
- 安全なdocsとAgent Status JSONのみ個別git add
- commit/pushする場合は、安全確認後に個別add

commit message候補:
chore: add agent office reflection audit task
```
