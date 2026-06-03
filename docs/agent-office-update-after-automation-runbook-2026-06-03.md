# Agent Office 自動業務後更新Runbook

## 目的

自動業務が終わった後、`/agent-office` へ安全に反映するための共通手順を定義する。

## 共通手順

1. 実行結果を確認する
2. 個人情報や秘密値を含まないsummary docsを更新する
3. 対応する `data/agent-status/tasks/*.json` を更新する
4. `npm run agent:status:validate` を実行する
5. `npm run agent:status:render` と `npm run agent:office:render` を実行する
6. `npm run lint` と `npm run build` を実行する
7. 安全なファイルだけを個別にGit追加する
8. commit/pushする
9. Vercel自動デプロイ後、スマホで `/agent-office` を確認する

## Gmail送信後

更新対象:

- `data/agent-status/tasks/gmail-daily-sales-send-YYYY-MM-DD.json`
- `docs/gmail/YYYY-MM-DD-gmail-sales-send-summary.md`

記録すること:

- sentCount
- failedCount
- skippedCount
- Google Sheets反映状況
- 次回返信確認日

禁止:

- outbox本体をGit追加しない
- メール宛先をsummaryへ書かない
- 送信済みを二重記録しない

## Gmailリスト更新後

更新対象:

- `data/agent-status/tasks/gmail-list-refresh-YYYY-MM-DD.json`
- `docs/gmail/YYYY-MM-DD-gmail-candidate-summary.md`
- `docs/gmail/gmail-ready-candidate-pool-summary.md`

記録すること:

- adoptedCount
- excludedCount
- totalReady
- availableForNextSend
- shortageTo90

禁止:

- candidate pool本体をGit追加しない
- 営業先名やメール宛先を表示しない

## 金曜市場分析後

更新対象:

- `data/agent-status/tasks/market-analysis-friday-YYYY-MM-DD.json`
- `docs/market-analysis/YYYY-MM-DD-weekly-market-analysis-summary.md`

記録すること:

- reportCreated
- recommendationCount
- nextExperimentCount
- humanReviewRequired

## Hermes監視後

更新対象:

- `data/agent-status/tasks/hermes-monitoring-YYYY-MM-DD.json`
- 必要に応じて監視summary docs

記録すること:

- jobsChecked
- okCount
- blockedCount
- needsReviewCount
- lastRunAt
- nextRunAt

## Git追加してよいファイル

- `data/agent-status/tasks/*.json`
- `docs/gmail/*summary*.md`
- `docs/market-analysis/*.md`
- Agent Office関連docs
- 表示用コード

## Git追加禁止ファイル

- `data/gmail/outbox/`
- `data/gmail/logs/`
- `data/gmail/candidates/`
- `data/gmail/pool/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`
- `.env`
- `.env.local`
- メール宛先や営業先リスト本体

## commit message例

- `chore: update gmail send status`
- `chore: update gmail list refresh status`
- `chore: record friday market analysis status`
- `chore: update hermes monitoring status`

## スマホ確認ポイント

- 停止/失敗タスクがないか
- 人間確認待ちがあるか
- 今日のGmail送信が完了または承認待ちか
- 候補プールが不足していないか
- 次アクションが明確か
