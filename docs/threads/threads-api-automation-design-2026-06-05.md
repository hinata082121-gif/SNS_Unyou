# Threads API自動化設計 2026-06-05

## 前提

Threads投稿は公式API、または正式に許可された投稿経路を前提にする。
Computer Useやブラウザ操作でログイン・投稿・スクレイピングは行わない。

## 環境変数

値はドキュメントやGitに書かない。

- `THREADS_ACCESS_TOKEN`
- `THREADS_USER_ID`
- `THREADS_PUBLISH_ENABLED`
- `THREADS_DRY_RUN`
- `THREADS_DEFAULT_TIMEZONE`

## 投稿フロー

1. 投稿予定JSON/Markdownを読む
2. 投稿文を検証する
3. 禁止表現を検査する
4. 重複投稿を検査する
5. `THREADS_DRY_RUN` と `THREADS_PUBLISH_ENABLED` を確認する
6. 条件を満たす場合だけ投稿する
7. Agent Statusへ成功、失敗、blockedを記録する

## 初期運用

API接続が未設定の場合は投稿をblockedにし、投稿文だけ生成する。
初期値は安全側にする。

- `THREADS_DRY_RUN=true`
- `THREADS_PUBLISH_ENABLED=false`

完全自動化へ移行するのは、API設定、投稿先確認、dry-run検証、Agent Office反映が完了した後に限る。

## Hermes登録済みタスク

- 毎日11:00: `2c6a2309255f` / `0 11 * * *` / 次回 `2026-06-06T11:00:00+09:00`
- 毎日19:00: `d02c609665e8` / `0 19 * * *` / 次回 `2026-06-06T19:00:00+09:00`
- 金曜20:00: `807bcd30473d` / `0 20 * * 5` / 次回 `2026-06-12T20:00:00+09:00`

Agent OfficeのThreads運用タブでは、`postPrepared`、`postValidated`、`posted`、`blockedReason`、`publishEnabled`、`dryRun`、`autoReplyEnabled=false`、`autoLikeEnabled=false`、`autoFollowEnabled=false` を安全なmetricsとして確認する。
全体管理タブではThreadsの `blocked`、`needs_review`、`stale` も横断表示する。

## 安全検査

- 1投稿500文字以内を基本にする
- 同一文面の連投は禁止
- 個人情報や顧客情報を入れない
- 誇大表現、成果保証、断定的な売上表現を避ける
- URLと絵文字は必要最低限にする

## 禁止事項

- 自動返信
- 自動いいね
- 自動フォロー
- トークン表示
- APIレスポンスの秘密情報保存
- 無断転載
- 本文丸コピー

## 週次分析

毎週金曜20:00に、公開情報の安全な範囲でバズ投稿の構造を分析する。
分析結果は `docs/threads/weekly-analysis/` に保存し、Agent Statusは安全な件数とnextActionだけを記録する。
