# Agent Office反映監査・未反映検知 2026-06-04

## 目的

Gmail自動送信、送信後確認、失敗・不足確認、返信確認、営業リスト更新、市場分析、営業メール改善などの自動化タスクが、実行後にAgent Officeと `/agent-office` へ安全に反映されているかを監査する。

## なぜ反映監査が必要か

Apps ScriptやHermesタスクが実行されても、`data/agent-status/tasks/*.json` が更新されなければ、出先のスマホで現在状態を判断できない。

送信自体が成功していてもAgent Officeに反映されない場合、人間は再送信や二重確認を誤って判断する可能性がある。逆に、Apps ScriptやHermesタスクが失敗した場合も、「反映されていない」こと自体をAgent Officeに表示できる必要がある。

## Apps Script実行とAgent Office反映の関係

- Apps ScriptはGmail送信、送信後確認、返信確認などの実行側
- Hermesは監視、確認、記録側
- Agent Officeと `/agent-office` は `data/agent-status/tasks/*.json` の安全な要約だけを表示する
- Apps Script単体の実行結果は、HermesまたはCodexがAgent Status JSONへ記録して初めてAgent Officeに反映される

## Hermesタスクが失敗した場合のリスク

- Gmail送信成功/失敗がAgent Officeに出ない
- blockedやneeds_reviewが人間に見えない
- 古いnextActionが残る
- 返信確認が必要か判断できない
- 候補不足や市場分析未実行が見落とされる

## 監査対象タスク一覧

- Gmail daily send
- Gmail post send check
- Gmail recovery check
- Gmail evening readiness check
- Gmail list refresh
- Market analysis Friday
- Gmail weekly email improvement
- Gmail full auto send start status

## 監査する項目

- 当日実行予定タスクのAgent Status JSONが存在するか
- `updatedAt` が期待時刻より古くないか
- `status` が `running` のまま長時間残っていないか
- `status` が `success` / `blocked` / `needs_review` / `failed` / `scheduled` のいずれかに整理されているか
- `nextAction` が空でないか
- blocked/needs_reviewが未対応のまま残っていないか
- `/agent-office` 表示に必要な安全メトリクスがあるか

## stale判定条件

Agent Statusの許可statusには `stale` がないため、監査結果では `needs_review` として表示し、`phase`、metrics、nextActionにstale理由を記録する。

stale扱いの例:

- 当日実行されるはずのタスクのAgent Status JSONが存在しない
- `updatedAt` が期待時刻より古い
- `status=running` のまま一定時間経過している
- 前回のnextActionが解消されていない
- success/blocked/needs_review/failed/scheduledのいずれにも整理されていない

## blocked判定条件

- 監査対象の重要タスクが複数欠落している
- Gmail送信結果が未反映で、再送信リスクがある
- 送信後の安全復帰確認が未反映
- Agent Status JSONが壊れていてvalidateできない
- 秘密情報やメールアドレスを含む危険な反映が検出された

## needs_review判定条件

- 反映漏れはあるが送信や個人情報リスクはない
- staleが1件以上ある
- blocked/failedタスクが残っている
- 人間確認が必要なnextActionが残っている

## /agent-officeに表示する内容

- 監査status
- stale候補件数
- missingReflectionCount
- blockedCount
- needsReviewCount
- lastAuditAt
- nextAction
- 監査対象タスク数

## /agent-officeに表示しない内容

- メールアドレス
- 営業先名
- 返信本文
- Gmailスレッド全文
- Sheet ID
- Apps Script URL
- Webhook URL
- APIキー
- トークン
- outbox本体
- candidate pool本体

## 緊急時の人間対応

- `/agent-office` でreflection auditがblockedの場合、当日のGmail再送信を止める
- Apps Script画面で送信済みバッチと安全設定を確認する
- Hermesの監視タスク結果を確認する
- 必要に応じてCodexでAgent Status JSONを安全に修正する
- 秘密情報や宛先一覧は共有しない

## Git追加禁止ファイル

- `data/gmail/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`
- `.env`
- `.env.local`
- メールアドレス入りファイル
- 営業先一覧
- Gmail返信本文
- Gmailスレッド全文
- 送信ログ本体
- outbox本体

## 秘密情報を扱わない方針

反映監査は安全なAgent Status JSONとsummary docsだけを対象にする。秘密情報、メールアドレス、営業先名、返信本文、Gmailスレッド全文、Apps Script URL、Sheet ID、Webhook URLは読まず、表示せず、Gitに追加しない。
