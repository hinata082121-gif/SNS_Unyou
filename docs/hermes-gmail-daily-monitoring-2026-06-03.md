# Hermes Gmail日次監視設計

## 目的

Gmail営業メール30件/日運用について、Hermes Agentが送信実行ではなく監視・確認・報告を担うためのルールを定義する。

HermesはGmail本番送信、自動返信実送信、Google Sheets送信済み更新、Instagram操作を行わない。

## Hermes Agentの役割

- Gmail-ready候補プール残数を確認する
- 当日outbox30件の有無を確認する
- Preflight結果を確認する
- 送信結果を確認する
- blocked/needs_review/successをAgent Office向けに整理する
- 人間が次に行うべき作業を明確にする

## Hermesが実行しないこと

- Gmail本番送信
- Gmail自動返信実送信
- Apps Script本番トリガー有効化
- Google Sheets送信済み更新
- Instagram投稿/DM/コメント/フォロー/いいね
- 営業候補リストやメールアドレス一覧のGit追加
- 秘密情報、認証情報、URL実値の表示

## 毎日の監視スケジュール

| 時刻 | 確認内容 | Hermesの出力 |
|---|---|---|
| 09:00 | Gmail-ready候補プール残数 | available件数、補充要否 |
| 10:30 | 当日outbox30件 | outbox有無、TSV有無、blocked理由 |
| 11:30 | Preflight | readyCount、blockedReason、remainingQuota |
| 12:10 | 送信結果 | processed、failed、送信有無 |
| 12:30 | Sheets/Agent Office | 送信済み反映、status整合性 |
| 14:00 | 失敗/未送信/候補不足 | blocked/needs_review理由 |
| 17:00 | 翌日分候補プール | available残数、翌日準備の要否 |

## 報告形式

### success

```text
Gmail営業30件運用: success
- 対象日:
- processed:
- failed:
- skipped:
- Sheets更新:
- Agent Office:
- 次アクション:
```

### needs_review

```text
Gmail営業30件運用: needs_review
- 対象日:
- 確認待ち理由:
- readyCount:
- blockedReason:
- 人間が確認すること:
- 送信実行有無:
```

### blocked

```text
Gmail営業30件運用: blocked
- 対象日:
- blocked理由:
- readyCount:
- 不足数:
- 除外理由:
- 次の補充/修正アクション:
```

## blocked時の扱い

以下の場合は送信しない。

- readyCountが30ではない
- blockedReasonが空ではない
- Gmail残クォータ不足
- outbox/TSV未作成
- Sheets未貼り付け
- 配信停止/返信あり/送信禁止混入
- sendBatchId重複
- 人間承認なし

## needs_review時の扱い

以下の場合は人間確認へ回す。

- readyCount=30だが本番送信前
- Preflightは通ったが人間承認待ち
- 送信後ログの確認待ち
- Sheets更新確認待ち
- 完全自動トリガー有効化判断待ち

## Hermes用プロンプト

```text
これは通常の営業送信依頼ではなく、Hermes AgentのGmail日次監視依頼です。

目的:
ICHI SocialのGmail営業メール30件/日運用について、当日の送信準備、Preflight、送信結果、候補プール残数、Agent Office statusを確認してください。

重要:
- Gmail本番送信は行わない
- Gmail自動返信実送信は行わない
- Apps Scriptトリガー有効化は行わない
- Google Sheetsを送信済みに更新しない
- Instagram投稿/DM/コメント/フォロー/いいねは行わない
- メールアドレス、営業先名、Google Sheets ID、Apps Script URL、秘密情報は表示しない
- data/gmail/outbox、data/gmail/candidates、data/gmail/pool、data/prospects、docs/reports/salesをGit追加しない

確認対象:
- data/agent-status/tasks/gmail-outbox-YYYY-MM-DD.json
- data/agent-status/tasks/gmail-ready-candidate-pool-2026-06-03.json
- docs/gmail/YYYY-MM-DD-gmail-outbox-preparation-summary.md
- docs/gmail/gmail-ready-candidate-pool-summary.md
- Apps ScriptのPreflight結果
- Agent Office表示

出力:
- status: success / needs_review / blocked
- readyCount
- blockedReason
- remainingQuota
- sentCount
- failedCount
- Sheets更新確認
- Agent Office整合性
- 人間が次に行うこと

候補不足、Preflight不一致、送信失敗、Sheets未更新がある場合は、successにせずblockedまたはneeds_reviewとして報告してください。
```

## 禁止事項

- Gmail本番送信しない
- 自動返信しない
- Instagram操作しない
- 営業候補リストをGit追加しない
- 秘密情報を出さない
- 送信済みでない行を送信済みにしない
