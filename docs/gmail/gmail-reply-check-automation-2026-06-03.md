# Gmail返信確認 自動化設計

## 目的

Gmail営業メール送信後の返信有無を自動確認し、出先のスマホで `/agent-office` を見れば、今メール確認が必要か判断できるようにする。

## 人間が出先で確認すべきこと

- 未読返信があるか
- 対応が必要な返信があるか
- Gmailを今開く必要があるか
- 自動送信や自動返信が動いていないか

## 返信確認の対象

- `sentStatus=sent` または `sentStatus=送信済` の行
- `sentAt` 以降に返信がある可能性があるスレッド
- `replyStatus=handled` の行は対応済みとして扱う

## Gmail送信後に必要な記録項目

- `sentAt`
- `sentStatus`
- `gmailThreadId`
- `gmailMessageId`
- `replyStatus`
- `replyDetectedAt`
- `unreadReplyCount`
- `replyCount`
- `lastReplyCheckedAt`
- `needsHumanEmailCheck`
- `humanHandledAt`
- `humanHandledStatus`
- `replyCheckNotes`

## replyStatus設計

| 値 | 意味 |
|---|---|
| `none` | 返信なし |
| `replied` | 返信あり |
| `unread_reply` | 未読返信あり |
| `needs_human_review` | 人間確認が必要 |
| `handled` | 対応済み |
| `ignored` | 対応不要 |
| `bounced` | バウンス |
| `unknown` | 確認不能 |

## 区分

- 未読返信: `unreadReplyCount > 0`
- 既読返信: `replyCount > 0` かつ `unreadReplyCount=0`
- 対応済み: `humanHandledAt` または `humanHandledStatus=handled`
- 対応不要: `replyStatus=ignored`

## /agent-office に表示する情報

- 返信あり件数
- 未読返信件数
- 人間確認が必要か
- 最終返信確認時刻
- 次回返信確認予定
- 自動返信OFF

## /agent-office に表示しない情報

- 返信本文
- Gmail本文全文
- メールアドレス
- 営業先名
- GmailスレッドURL
- 検索クエリ全文

## 自動返信しない方針

返信確認ジョブは、返信有無の集計とSheet上の安全なstatus更新だけを行う。
自動返信は行わない。
返信がある場合は `needsHumanEmailCheck=true` とし、人間がGmailを確認する。

## 返信本文を保存しない方針

Apps Scriptは分類のためにGmail上の本文を一時的に読むことがあるが、本文全文をSheet、Logger、Git、Agent statusへ保存しない。

## 返信確認スケジュール

- 09:00: 前日送信分の返信確認
- 12:30: 当日送信後の初回確認
- 17:00: 当日まとめ前の確認

## 判定条件

| 状態 | 条件 |
|---|---|
| `success` | 返信なし、または対応済みのみ |
| `needs_review` | 未読返信、既読未対応返信、バウンス、確認不能 |
| `blocked` | Sheet接続失敗、Gmail検索失敗が継続 |
| `failed` | スクリプト実行自体が失敗 |

## 将来改善

- Gmail threadId保存
- Gmailラベル連携
- 対応済み管理
- 安全な通知連携
- 返信分類の精度改善
