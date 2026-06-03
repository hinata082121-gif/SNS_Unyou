# Agent Office 自動更新アーキテクチャ

## 目的

`/agent-office` を、Gmail送信、Gmail営業リスト更新、Hermes監視、金曜市場分析、Instagram運用の進捗確認ページとして継続更新できる状態にする。
人間は出先のスマホでページを確認し、正常、確認待ち、停止、失敗を判断できるようにする。

## 最終目標

- 自動業務の実行結果をAgent status JSONへ集約する
- 人間が見るべき内容だけを `/agent-office` に表示する
- Gmail送信やSNS操作はページから実行しない
- blocked / failed の場合は次アクションを明確にする
- Vercel公開URLからスマホで確認できる

## 役割分担

| 担当 | 役割 |
|---|---|
| 人間 | 本番送信の承認、失敗時判断、スマホ確認 |
| Hermes Agent | cron監視、候補補充結果確認、日次状態報告 |
| Apps Script | Gmail Preflight、送信、送信後チェックの実行基盤 |
| Codex/ローカルスクリプト | status JSON更新、docs更新、Git commit/push |
| Vercel | GitHub push後の公開ページ自動デプロイ |

## 更新方式

### Phase 1: Git push連動更新

今回採用する方式。

1. 自動業務が終了する
2. `data/agent-status/tasks/*.json` を更新する
3. 必要なsummary docsを更新する
4. 安全なファイルだけを個別にGit追加する
5. commit/pushする
6. Vercel自動デプロイ後、`/agent-office` に反映される

利点:

- 既存のGitHub/Vercel運用に乗せられる
- DBを増やさずに始められる
- 変更履歴が残る

制約:

- 即時リアルタイムではない
- push前のローカル状態は公開ページへ反映されない
- メール宛先入りファイルは絶対にGitへ入れない

### Phase 2: Deploy Hook連動更新

将来的に、status JSON更新後にVercel Deploy Hookを呼び出し、反映タイミングを明確化する。
ただし、Hook URLは秘密値として扱い、Gitやチャットに出さない。

### Phase 3: DB/API連動のリアルタイム更新

将来的に、Supabase、Vercel KVなどの外部DBまたは安全なAPIへstatusだけを保存し、ページをリアルタイム寄りにする。
この段階で正式ログイン、監査ログ、PWA、push通知を検討する。

## 自動業務後に更新するもの

- Gmail送信: `gmail-daily-sales-send-YYYY-MM-DD.json`
- Gmail営業リスト更新: `gmail-list-refresh-YYYY-MM-DD.json`
- Gmail候補プール: `gmail-ready-candidate-pool-YYYY-MM-DD.json`
- Hermes監視: `hermes-monitoring-YYYY-MM-DD.json`
- 金曜市場分析: `market-analysis-friday-YYYY-MM-DD.json`
- Instagram運用: `instagram-*` 系タスク

## 表示してよい情報

- status、phase、progress、priority
- 件数系metrics
- 最終実行時刻、次回実行予定
- blocked理由の安全な要約
- 人間が次にやること
- summary docsへの相対パス

## 表示禁止情報

- 営業先名
- メールアドレス
- 送信対象リスト本体
- outbox本体
- candidate pool本体
- 送信ログ本体
- Google SheetsやApps Scriptの識別値
- 外部サービス認証値
- Gmail本文全文

## 失敗時の記録

`failed` または `blocked` の場合は、以下を必ず残す。

- どの業務が止まったか
- 人間判断が必要か
- 再実行してよいか
- 再実行してはいけない操作
- 次に見るべきsummary docs

## 人間がスマホで見る項目

- 停止/失敗タスク
- 人間確認待ち
- 今日のGmail送信準備状況
- 候補プール残数
- Hermes監視結果
- 金曜市場分析の予定/完了状況

## 将来改善

- Vercel Deploy Hook
- Supabase/Vercel KV等の外部DB
- push通知
- PWA化
- 正式ログイン
- Agent別フィルタ
