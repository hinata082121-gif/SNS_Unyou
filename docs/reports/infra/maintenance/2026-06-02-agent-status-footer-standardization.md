# Agent Status Prompt Footer 標準化レポート

## 実行日時

2026-06-02 14:24:52 +09:00

## 標準化の目的

今後のCodex/Hermes Agent作業で、開始、主要フェーズ、失敗、完了の状態をAgent Operations Dashboardへ必ず反映できるようにする。プロンプト末尾に共通フッターを付ける運用を標準化し、作業完了後のvalidate/renderまでを明示する。

## 作成した共通フッター

- `docs/ops/agent-status-prompt-footer.md`

共通フッターでは、`scripts/agent-status/update.mjs` によるstatus JSON更新、利用可能status、推奨ステータス、進捗更新例、営業候補タスクの判定、禁止情報、作業後のvalidate/render、ローカルHTML確認ルールを定義した。

## 更新したドキュメント

- `docs/ops/agent-operations-dashboard.md`
- `docs/hermes-scheduled-automation.md`
- `docs/knowledge/document-index.md`
- `docs/knowledge/prompt-index.md`
- `docs/knowledge/use-case-navigation.md`

## 更新したHermesプロンプト

- `hermes/prompts/scheduled-daily-sales-candidates.md`
- `hermes/prompts/scheduled-research-refill-mon-wed.md`
- `hermes/prompts/instagram-sales-list-builder.md`
- `hermes/prompts/instagram-prospect-scoring-review.md`
- `hermes/prompts/prospect-json-rules.md`

## Codex向け運用ルール

- `docs/ops/codex-prompt-rules.md`

Codex向けプロンプトの末尾にも `docs/ops/agent-status-prompt-footer.md` を付け、実装、検証、commit、pushの進捗をAgent Operations Dashboardへ反映するルールを追加した。

## 今後のプロンプト生成時の扱い

- Codex/Hermes向けプロンプト末尾にはAgent Status Prompt Footerを付ける
- 作業開始時に `running` を記録する
- 主要フェーズ完了時に `phase` / `progress` を更新する
- 失敗時は `blocked` または `failed` を記録する
- 人間確認待ちは `needs_review` を記録する
- 作業後に `npm run agent:status:validate` と `npm run agent:status:render` を実行する
- `tmp/agent-dashboard.html` はローカル確認専用とする

## validate結果

OK。

- `npm run agent:status:validate`
- 結果: `Validated 6 agent status task file(s).`

## render結果

OK。

- `npm run agent:status:render`
- 結果: `tmp/agent-dashboard.html` を生成
- 注意: ローカル確認専用であり、git管理対象にはしない

## lint結果

OK。

- `npm run lint`
- 結果: 成功

## build結果

OK。

- `npm run build`
- 結果: 成功

## 秘密情報混入チェック結果

OK。

`git diff -- . ':!package-lock.json'` に対して秘密情報混入チェックを実行した。
禁止語句のポリシー記述には反応したが、SECRET_TOKEN、Webhook URL、APIキー、OAuth URL、Cookie、認証情報、口座情報、登録番号などの実値は確認されなかった。

## 今回実行していないこと

- Google Sheets投入
- `scripts/sheets/send-prospects.mjs` 実行
- 営業メール送信
- Instagram DM送信
- Instagramコメント投稿
- Instagram自動投稿
- 自動フォロー/いいね
- 問い合わせフォーム送信
- Hermesタスク登録/削除/変更
- `.env` 変更
- GitHub Secrets変更
- Vercel環境変数変更
- `tmp/agent-dashboard.html` のgit add
- node_modules/.nextのgit add
- `git clean`
- `git reset --hard`
- 未追跡の営業JSON/レポート類の削除

## 秘密情報を表示していないこと

秘密情報、認証情報、Webhook URL実値、APIキー、Cookie、SNSログイン情報、口座情報、登録番号、個人情報、顧客の非公開情報は表示していない。
