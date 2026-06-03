# Agent Status 共通スキーマ

## 目的

Gmail送信、Gmail営業リスト更新、Hermes監視、金曜市場分析、Instagram運用、Agent Office更新を同じ形式で記録し、`/agent-office` で安全に表示できるようにする。

## 必須フィールド

| フィールド | 内容 |
|---|---|
| `id` | タスクID。日付つきで一意にする |
| `agent` | `Codex` / `Hermes` / `System` / `Human` |
| `avatar` | 既存avatar定義のいずれか |
| `title` | 表示名 |
| `category` | 業務カテゴリ |
| `status` | 状態 |
| `phase` | 現在フェーズ |
| `progress` | 0から100の整数 |
| `priority` | high / medium / low など |
| `createdAt` | 作成日時 |
| `updatedAt` | 更新日時 |
| `summary` | 安全な要約 |
| `metrics` | 安全な件数/真偽値/短い状態 |
| `nextAction` | 人間または次ジョブが行うこと |
| `safeToAct` | 次アクションに進めるか |
| `notes` | 安全な注意事項 |
| `artifacts` | 安全な相対パス |

## status候補

- `scheduled`
- `running`
- `success`
- `needs_review`
- `blocked`
- `failed`

既存互換として `queued`、`checking`、`partial`、`skipped`、`synced` も検証スクリプト上は扱える。
`/agent-office` では `queued` と `synced` は `scheduled` として表示する。

## category候補

- `gmail_send`
- `gmail_list_refresh`
- `market_analysis`
- `instagram`
- `hermes_monitoring`
- `dashboard`
- `system`

既存互換として `sales`、`content`、`ops` なども表示できる。

## metricsに入れてよいもの

- `count`
- `sentCount`
- `failedCount`
- `skippedCount`
- `readyCount`
- `availableForNextSend`
- `blockedReason`
- `lastRunAt`
- `nextRunAt`
- `humanApprovalRequired`
- `autoSendEnabled`
- `sheetConnected`
- `preflightPassed`
- `deployed`
- `mobileReady`

## metricsに入れてはいけないもの

- メール宛先
- 受信者名
- 営業先名
- 担当者名
- 参照元URL
- シート識別値
- スクリプト識別値
- 外部通知URL
- 外部サービス認証値
- Gmail本文全文

## 更新ルール

自動業務が完了したら、該当する日付別JSONを更新する。
テンプレートは `template-*` として保存し、実行時にコピーして日付別タスクへ変換する。
`template-*` は `/agent-office` では表示しない。

## 安全ルール

- 個人情報を入れない
- 秘密値を入れない
- outboxやcandidate pool本体へのパスは、必要最小限のsummary docsだけにする
- 成功していない送信を `success` にしない
- blocked/failedの場合は `nextAction` を具体化する
