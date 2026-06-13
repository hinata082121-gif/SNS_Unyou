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
6. 条件を満たす場合だけMeta Threads APIへ投稿する
7. Agent Statusへ成功、失敗、blockedを記録する

## テキスト投稿API実装

2026-06-11に `api_publish_not_implemented_in_local_stub` を解消し、テキスト投稿のみ公式Threads APIの2段階フローへ接続した。

実装済み:

- `POST /{threads-user-id}/threads`
  - `media_type=TEXT`
  - `text` は投稿計画から取得
- `POST /{threads-user-id}/threads_publish`
  - 1段階目のcreation idをpublishする

本番投稿条件:

- `THREADS_PUBLISH_ENABLED=true`
- `THREADS_DRY_RUN=false`
- `THREADS_ACCESS_TOKEN` configured
- `THREADS_USER_ID` configured

`THREADS_API_VERSION` があれば利用し、なければ `v1.0` を使う。
`THREADS_GRAPH_BASE_URL` があれば利用し、なければ `https://graph.threads.net` を使う。

未実装/禁止:

- 画像投稿
- 動画投稿
- カルーセル投稿
- 返信
- 引用
- 予約投稿
- 自動返信
- 自動いいね
- 自動フォロー

dry-run時はAPIコールしない。
APIレスポンス全文、アクセストークン、User ID、App Secret、Client Secretはログ、Agent Status、docs、Gitに残さない。
成功時も投稿IDの有無と安全なハッシュだけを記録する。

## 初期運用

API接続が未設定の場合は投稿をblockedにし、投稿文だけ生成する。
初期値は安全側にする。

- `THREADS_DRY_RUN=true`
- `THREADS_PUBLISH_ENABLED=false`

完全自動化へ移行するのは、API設定、投稿先確認、dry-run検証、Agent Office反映が完了した後に限る。

## .env.local 自動読み込み

Hermes Agentの定期実行でもThreads API設定を参照できるように、Threadsスクリプトは起動時にプロジェクトルートの `.env` と `.env.local` を読み込む。
既存の環境変数がある場合はそれを優先し、ファイル内の値で不用意に上書きしない。

読み込む値の有無だけを判定し、アクセストークン、User ID、App Secret、Client Secretなどの値はログ、Agent Status、docs、Gitに出さない。

2026-06-11時点の確認結果:

- apiConfigured: true
- publishEnabled: false
- dryRun: true
- 11:00 slot: published=false
- 19:00 slot: published=false
- blockedReason: publish_disabled

現在は投稿許可が無効でdry-run状態のため、Threads投稿は行わない。
本番投稿へ進める場合は、人間確認後に `THREADS_PUBLISH_ENABLED=true` と `THREADS_DRY_RUN=false` を設定する。

追加確認:

- `THREADS_PUBLISH_ENABLED=true` / `THREADS_DRY_RUN=true` では `threads_dry_run` で停止する
- `api_publish_not_implemented_in_local_stub` は出ない
- Codex作業中の実投稿は行っていない

## Hermes provider/model障害と再セットアップ

2026-06-12の11時投稿は、Threads APIではなくHermes側のprovider/model設定エラーで停止した。
エラーは `Unknown provider 'openai'` で、投稿スクリプトへ到達していなかった。

Threads投稿はAI推論不要のため、Hermes cronはno-agentのスクリプト実行方式へ再作成する。

- 11時投稿: `6fbea6039fcf` / `ichi_threads_post_11.py` / `npm run threads:post:11`
- 19時投稿: `ee568dbda7ab` / `ichi_threads_post_19.py` / `npm run threads:post:19`
- 金曜20時分析: `96bd94126b9d` / `ichi_threads_weekly_analyze.py` / `npm run threads:weekly:analyze`

安全テストでは一時環境変数 `THREADS_PUBLISH_ENABLED=false`、`THREADS_DRY_RUN=true` を指定し、投稿なしでコマンド到達を確認する。
本番投稿は次回Hermes自動実行後にThreads画面とAgent Officeで確認する。
Windowsログイン時の自動起動は、UAC付きで `hermes gateway install` を完了する必要がある。

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

## 週次分析とKPI改善

毎週金曜20:00に、公開情報の安全な範囲でバズ投稿の構造を分析する。
分析結果は `docs/threads/weekly-analysis/` に保存し、Agent Statusは安全な件数とnextActionだけを記録する。

2026-06-12以降は、Threads分析をGmail営業KPI改善にも接続する。
11:00投稿はノウハウ/権威づけ、19:00投稿は共感/DM導線に役割を固定し、7日分の投稿案をローテーションする。
金曜20:00レビューでは、`npm run sales:kpi:summary` の安全な件数とThreads投稿状態を確認し、翌週の件名、本文、CTA、無料SNS診断導線、Threads投稿テーマの改善案を作る。

改善案は `needs_review` として扱い、本番メールテンプレートやThreads投稿への自動反映はしない。
Gmail送信、Threads投稿、自動返信、自動いいね、自動フォロー、Google Sheets更新は行わない。

## 2026-06-13 post_date_not_found対策

2026-06-13の11時投稿は、Hermes cron、no-agentスクリプト、`.env.local` 読み込み、Threads API設定までは正常だった。
停止原因は当日分の投稿計画が存在しない `post_date_not_found` だった。

対策:

- `threads:post:11` / `threads:post:19` の実行時に、当日分JSON計画を自動確認する
- 当日分がない場合は、投稿処理の前に `create-daily-post-plan.mjs` 相当で当日分を生成する
- `threads:plan:ensure:rolling` でAsia/Tokyo基準の今日、翌日、翌々日の3日分を保証する
- 既存計画がある日は上書きしない
- 投稿時は `data/threads/post-plans/YYYY-MM-DD.json` を優先し、固定Markdown計画に依存しない
- published済みログがある同日同slotは再投稿しない

ログには、計画生成有無、slot、日付、公開許可、dry-run、API設定有無、投稿準備/検証状態、blockedReasonだけを残す。
投稿本文、アクセストークン、User ID、APIレスポンス全文は出さない。
