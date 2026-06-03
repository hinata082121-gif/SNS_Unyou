# Gmail送信対象シート 列設計

## 目的

Gmail営業メール30件/日の完全自動送信で、Apps Scriptが安全に読み取れるGoogle Sheets列を標準化する。

## 列一覧

| 列名 | 必須 | 説明 |
|---|---|---|
| `prospectId` | 任意 | 候補ID |
| `name` | 必須 | 事業名。ログやGitには出さない |
| `businessType` | 必須 | 業態 |
| `area` | 必須 | 地域 |
| `email` | 条件必須 | 送信先メール |
| `contactEmail` | 条件必須 | `email` がない場合の送信先 |
| `publicSource` | 任意 | 公開確認元の種別 |
| `sourceUrl` | 任意 | 公開確認元URL。Git管理資料には出さない |
| `issueHypothesis` | 必須 | 課題仮説 |
| `salesAngle` | 必須 | 提案角度 |
| `subject` | 必須 | 件名 |
| `body` | 必須 | 本文 |
| `status` | 必須 | 送信前状態 |
| `sendDate` | 必須 | 送信予定日 |
| `nextActionDate` | 必須 | 次アクション日 |
| `dedupeKey` | 必須 | 重複判定キー |
| `sendBatchId` | 必須 | 日次送信バッチID |
| `sentAt` | 必須 | 送信日時。送信後に更新 |
| `sentBy` | 任意 | 送信実行元 |
| `sentStatus` | 必須 | 送信結果 |
| `errorMessage` | 任意 | エラー要約。秘密情報は書かない |
| `gmailThreadId` | 任意 | Gmailスレッド識別用。Git管理資料には出さない |
| `gmailMessageId` | 任意 | Gmailメッセージ識別用。Git管理資料には出さない |
| `replyStatus` | 必須 | 返信状態 |
| `replyDetectedAt` | 任意 | 返信検知日時 |
| `unreadReplyCount` | 任意 | 未読返信件数 |
| `replyCount` | 任意 | 返信件数 |
| `lastReplyCheckedAt` | 任意 | 返信確認日時 |
| `needsHumanEmailCheck` | 任意 | 人間がGmail確認すべきか |
| `humanHandledAt` | 任意 | 人間対応日時 |
| `humanHandledStatus` | 任意 | 人間対応結果 |
| `replyCheckNotes` | 任意 | 返信確認の安全な要約 |
| `unsubscribe` | 必須 | 配信停止フラグ |
| `doNotContact` | 必須 | 送信禁止フラグ |
| `lastCheckedAt` | 任意 | 最終確認日時 |
| `notes` | 任意 | 個人情報や秘密情報を避けたメモ |

## 自動送信対象になる条件

- `status=ready`
- `sendDate` が当日
- `sendBatchId=gmail-sales-YYYY-MM-DD`
- `email` または `contactEmail` がある
- `subject` と `body` が空でない
- `body` に配信停止/不要案内がある
- `sentStatus` が空
- `replyStatus` が空または `unreplied`
- `unsubscribe` が空または `false`
- `doNotContact` が空または `false`
- `dedupeKey` が重複していない

## 自動送信対象から除外される条件

- メールアドレスなし
- メール形式が不正
- `status` が `ready` 以外
- `sendDate` が当日ではない
- `sendBatchId` が当日形式ではない
- `sentStatus` が `sent` または `送信済`
- `replyStatus` が `replied` または `返信あり`
- `unsubscribe=true`
- `doNotContact=true`
- 同一メールアドレス重複
- 同一事業者重複
- 件名または本文欠落
- 配信停止/不要案内欠落

## statusの種類

| 値 | 意味 |
|---|---|
| `ready` | 送信対象 |
| `sent` | 送信済み |
| `needs_review` | 人間確認待ち |
| `blocked` | 送信停止 |
| `excluded` | 除外 |

## sentStatusの種類

| 値 | 意味 |
|---|---|
| 空欄 | 未送信 |
| `送信済` | 送信成功 |
| `needs_review` | 送信失敗または確認待ち |
| `skipped` | 送信対象外 |

## replyStatusの種類

| 値 | 意味 |
|---|---|
| 空欄 | 未返信 |
| `replied` | 返信あり |
| `interested` | 興味あり |
| `request_info` | 資料希望 |
| `not_interested` | 不要 |
| `unsubscribe` | 配信停止 |
| `bounce` | バウンス |
| `complaint` | クレーム |
| `needs_human` | 人間確認 |
| `none` | 返信なし |
| `unread_reply` | 未読返信あり |
| `needs_human_review` | 返信あり・人間確認待ち |
| `handled` | 対応済み |
| `ignored` | 対応不要 |
| `unknown` | 確認不能 |

## needsHumanEmailCheckの種類

| 値 | 意味 |
|---|---|
| `true` | 人間がGmail確認すべき |
| `false` | 現時点では確認不要 |

## 返信確認で保存しない列

- `replyBody`
- `rawEmail`
- `sourceMessage`
- `fullThreadText`

## sendBatchIdの形式

```text
gmail-sales-YYYY-MM-DD
```

同じ `sendBatchId` は一度だけ送信する。送信成功後はScript Propertiesに送信済みバッチとして記録する。

## Google Sheets貼り付け時の注意

- メールアドレス一覧はGitに追加しない
- outbox本体は `data/gmail/outbox/` に置き、Git管理しない
- 1日分は `ready` 30件ちょうどにする
- 同一メール、同一事業者、同一dedupeKeyを混ぜない
- フォームURLのみ、Instagram URLのみの候補はGmail送信用にしない

## 送信後に更新される列

- `status`: `sent`
- `sentStatus`: `送信済`
- `sentAt`: 送信日時
- `sentBy`: `Apps Script`
- `lastCheckedAt`: 更新日時
- 失敗時は `sentStatus=needs_review` と `errorMessage` を記録

## 返信確認後に更新される列

- `replyStatus`
- `replyDetectedAt`
- `unreadReplyCount`
- `replyCount`
- `lastReplyCheckedAt`
- `needsHumanEmailCheck`
- `replyCheckNotes`
