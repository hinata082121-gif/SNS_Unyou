# Agent Office

## 目的

Agent Officeは、Codex/Hermes Agentの作業状態をローカルで確認するための「ゲーム風AI社員オフィス / 自動化ビジネス司令室」です。
既存の `tmp/agent-dashboard.html` を置き換えず、別画面として `tmp/agent-office.html` を生成します。

## Phase 1: ローカルHTML

現時点では、Node.js標準機能だけで `data/agent-status/tasks/*.json` を読み込み、静的HTMLを生成します。
外部CSS、外部JS、外部画像、CDNは使いません。

### v0.2: 人型キャラクターが働く事務所風UI

v0.2では、アイコンカード中心の表示から、レトロゲーム風の事務所/司令室UIへ変更しました。
画面中央に壁、床タイル、机、PCモニター、書類棚、観葉植物、ホワイトボードを置き、Hermes、Sheets Clerk、Git Keeper、ミオ、あなたがCSS製の人型キャラクターとして働いている状態を表示します。

ステータスに応じた見た目:

- `success`: 緑ランプ、落ち着いた完了状態
- `running` / `checking`: タイピング中の腕アニメーション、モニター点滅
- `blocked` / `failed`: 赤/橙ランプ、警告マーク
- `needs_review` / `waiting_human`: あなたの確認ボードとミオの案内を強調
- `queued` / `pending` / `skipped`: 待機状態

アニメーションはCSSのみで実装し、`prefers-reduced-motion` に対応しています。

生成コマンド:

```bash
npm run agent:office:render
```

出力:

```text
tmp/agent-office.html
```

PowerShellで開く例:

```powershell
start .\tmp\agent-office.html
```

## Phase 2: ローカルWebアプリ化

将来的にはNext.jsまたはローカル専用Webアプリとして、タスク更新、フィルタ、日次サマリー、Git状態確認をより操作しやすくします。
ただし、公開サイトやVercel本番には内部運用情報を表示しません。

## Phase 2.5: Vercel確認ページ

出先のスマホから進捗だけを確認するため、Next.jsアプリ内に `/agent-office` を追加しました。
このページは `data/agent-status/tasks/*.json` の安全な要約だけを読み込み、`data/gmail/`、`data/prospects/`、`docs/reports/sales/`、`tmp/` は読み込みません。

Vercel本番では、環境変数 `AGENT_OFFICE_ACCESS_KEY` とURLの `?key=...` が一致する場合だけダッシュボードを表示します。
環境変数が未設定の本番環境ではロック画面を表示します。開発環境では、環境変数が未設定の場合に限り表示できます。

公開ページの役割:

- Hermes、Codex、Apps Script、Gmail営業、Instagram運用の進捗をスマホで確認する
- `status`、`phase`、`progress`、`nextAction`、安全なmetrics要約を表示する
- 人間確認が必要なタスクを上位に表示する
- Gmail送信、Instagram操作、Google Sheets更新は実行しない

表示禁止:

- 営業先名、メールアドレス、送信先URL
- Gmail送信対象リスト、outbox、candidate pool本体
- Google Sheets ID、Apps Script URL、Webhook URL、APIキー、トークン
- `.env` / `.env.local` の値

### 自動業務後の更新

Phase 1では、Git push連動で `/agent-office` を更新します。
Gmail送信、Gmail営業リスト更新、Hermes監視、金曜市場分析、Instagram運用が完了したら、対応する `data/agent-status/tasks/*.json` と安全なsummary docsだけを更新し、個別にGit追加してpushします。
Vercelの自動デプロイ後、スマホの `/agent-office` に反映されます。

表示優先順位:

1. `failed`
2. `blocked`
3. `needs_review`
4. `running`
5. `scheduled`
6. `success`

テンプレートJSONは `template-*` として保存しますが、公開ページとローカルHTMLには表示しません。

自動業務カテゴリ:

- `gmail_send`: 日次Gmail送信
- `gmail_list_refresh`: Gmail-ready候補補充
- `hermes_monitoring`: Hermes監視
- `market_analysis`: 金曜市場分析
- `instagram`: 自社Instagram運用
- `dashboard`: Agent Office本体

## Phase 3: VS Code Webview拡張

最終的にはVS Code Webview拡張として、Codex/Hermes作業中に同じ画面で進捗を確認できるようにします。
この段階でも営業送信、SNS投稿、Google Sheets投入、認証情報表示は行いません。
今回のv0.2ではVS Code拡張化は行わず、ローカルHTML版の完成度向上に留めています。

## 登場キャラクター

- Hermes / 営業担当: 営業候補・営業進行管理
- Sheets Clerk / 記録担当: Google Sheets記録係
- Git Keeper / Git管理: Git/GitHub管理係
- ミオ / 秘書: 今日のまとめ、次アクション、注意アラートを話し言葉で整理
- あなた / 判断担当: 返信確認、DM可否判断、Sheets目視確認、Git操作判断

各キャラクターは、髪、顔、胴体、腕、脚、nameplateをCSSで構成しています。
Hermesは青系の営業担当、Sheets Clerkは緑系の記録担当、Git Keeperは紫/黒系のGit管理、ミオは明るい受付/秘書、あなたは確認ボード前の判断担当として表示します。

## 秘書ミオの役割

ミオは最新のagent-status JSONとGit状態をもとに、今日の状況を短く案内します。
たとえば、Sheets更新完了、2026-06-05の返信確認、未追跡の営業リスト系ファイル、`git add .` 禁止などを表示します。

## Instagram自社コンテンツ進捗

Agent Officeでは、営業DM運用とは別に、自社Instagramアカウント向けの投稿方針、投稿案、カレンダー、投稿済み記録の進捗も確認対象にします。

- 営業DM運用: 営業候補、DM送信、返信確認、Google Sheets反映を扱う
- 自社発信コンテンツ制作: ICHI Social自身の認知獲得、信頼形成、無料SNS診断への導線を扱う

自社発信コンテンツは、AIが原稿、構成、タイトル、ハッシュタグ、CTA案を作り、人間が確認して手動投稿します。
Agent Officeに表示する場合も、追加DM、予約投稿、自動投稿、SNSログイン操作は行いません。

初回投稿セットを制作した場合は、`data/agent-status/tasks/instagram-initial-post-set-2026-06-02.json` のように別タスクとして記録し、固定投稿、リール、キャプション、カレンダーの制作状況をAgent Officeで確認できるようにします。
この状態でも、投稿実行は人間確認後の手動操作に限定します。

投稿前レビューを行った場合は、`data/agent-status/tasks/instagram-pre-publish-review-2026-06-02.json` のように別タスクとして記録し、レビュー結果、Canva制作指示、投稿可否判断ボードをAgent Officeで確認します。
この段階でも、投稿実行や予約投稿は行いません。

Canva貼り付け用素材パックを作成した場合は、`data/agent-status/tasks/instagram-canva-materialization-2026-06-02.json` のように別タスクとして記録します。
Agent Officeでは、コピー素材、素材チェックリスト、スライド設計、制作順、人間用貼り付けボードの進捗を確認対象にします。
Canva自動公開、Instagram投稿、予約投稿は行いません。

Gmail営業メール自動化MVPを準備した場合は、`data/agent-status/tasks/gmail-sales-automation-mvp-2026-06-02.json` のように別タスクとして記録します。
Agent Officeでは、Gmail送信設計、返信分類、配信停止管理、重複送信防止、本番送信OFFの状態を確認対象にします。
初期状態では `DRY_RUN=true`、`LIVE_SEND_ENABLED=false` とし、実送信や自動返信実送信は行いません。

Gmail営業メール30件/日を実行対象にした場合は、`data/agent-status/tasks/gmail-daily-sales-send-YYYY-MM-DD.json` のように別タスクとして記録します。
候補作成が完了していても、メール宛先30件、DRY_RUN、重複/除外チェック、送信結果記録が完了していなければGmail送信は完了扱いにしません。
送信対象メールが不足している場合は `blocked` として表示し、人間が次に確認すべき内容をミオの案内やタスク一覧で確認できるようにします。
2026-06-03分は、Apps Script上でGmail営業メール30件送信が完了済みです。Agent Officeでは `success` として扱い、次は2026-06-06の返信確認・フォローアップ管理を表示します。二重送信防止のため `runDailyGmailSalesSend()` は再実行せず、送信後は `DRY_RUN=true` / `LIVE_SEND_ENABLED=false` へ戻す確認を人間タスクとして扱います。

2026-06-04以降は、`data/agent-status/tasks/gmail-full-auto-send-design-2026-06-03.json` でGmail営業メール30件/日の完全自動送信設計を確認対象にします。11:30 Preflight、12:00自動送信、12:30送信後確認、14:00失敗/不足確認をApps Script側で実行できる設計にしますが、本番トリガー有効化は人間確認後です。送信対象30件、Gmail残クォータ、sendBatchId未送信、配信停止/返信あり/送信禁止除外、本文の不要案内が揃わない場合は送信しません。

2026-06-04分のGmail送信対象準備は、`data/agent-status/tasks/gmail-outbox-2026-06-04.json` で確認します。ローカル既存データでは再利用可能候補が0件でしたが、Gmail-ready候補プールを3バッチ補充し、outbox30件とSheets貼り付け用TSVを作成済みです。現在は `needs_review` として、人間がGoogle Sheetsの「Gmail送信対象」タブへTSVを貼り付け、Apps Scriptの `runPreflightCheckOnly()` を実行する段階です。Gmail本番送信、自動返信、Google Sheets送信済み更新、自動トリガー有効化は行いません。

Gmail送信用候補プールは、`data/agent-status/tasks/gmail-ready-candidate-pool-2026-06-03.json` で確認します。毎日30件送信を安定させるには、公開メールアドレス確認済み候補を常時プール化し、`available` が30件未満なら送信を `blocked`、60件未満なら補充対象として扱います。現在は最低30件に到達済みですが、推奨90件には60件不足しています。プール本体、outbox、TSV、メールアドレス一覧はGitに追加せず、Agent Officeには件数と次アクションだけを表示します。

2026-06-04の送信運用準備は、`data/agent-status/tasks/gmail-automation-readiness-2026-06-03.json` で確認します。2026-06-04分はoutbox30件、Sheets貼り付け、PreflightのreadyCount=30確認まで完了済みで、明日は手動承認つき送信を推奨します。Hermes Agentは監視・報告のみ、Apps Scriptは送信実行担当、Codexは記録・設計・Agent Office更新担当として分けます。完全自動トリガー有効化は2026-06-04の送信成功後に検討します。

Gmail返信確認は、`data/agent-status/tasks/gmail-reply-check-YYYY-MM-DD.json` で確認します。
Agent Officeでは、返信あり件数、未読返信件数、人間がGmail確認すべきか、最終確認時刻、次回確認予定、自動返信OFFだけを表示します。
返信本文、メールアドレス、営業先名、GmailスレッドURLは表示しません。
`needsHumanEmailCheck=true` または `unreadReplyCount>0` の場合は `needs_review` として上部に表示し、人間がGmailを確認します。
返信確認ジョブは送信も自動返信もしません。

Instagram初回投稿5件が人間の手で公開された場合は、`data/agent-status/tasks/instagram-initial-posts-published-2026-06-03.json` のように別タスクとして記録します。
Agent Officeでは、投稿済み件数、カルーセル/リール内訳、24時間後・72時間後・7日後の反応確認待ちを確認対象にします。
AI/Hermes/Codexは投稿操作を行わず、追加投稿、予約投稿、DM、コメントも行いません。

## 運用注意

- `git add .` は使わない
- `data/prospects/` は営業リスト系ファイルを含むためGitに追加しない
- `docs/reports/sales/` は実在店舗名、Instagram情報、DM文面を含む可能性があるためGitに追加しない
- `tmp/agent-office.html` と `tmp/agent-dashboard.html` は生成物のためGitに追加しない
- 追加DM、営業候補再生成、Google Sheets再送信は行わない
- 2026-06-05までは返信確認待ちとして扱い、追加営業は行わない
- Webhook URL、SECRET_TOKEN、APIキー、Cookie、SNSログイン情報をHTMLやstatus JSONに入れない

## 既存ダッシュボードとの関係

既存のAgent Operations Dashboardは以下で生成します。

```bash
npm run agent:status:render
```

Agent Officeは以下で生成します。

```bash
npm run agent:office:render
```

どちらもローカル確認専用です。

## 2026-06-03 Gmail営業自動運用cron反映

Agent Officeは、以下のHermes cron結果を安全な `data/agent-status/tasks/*.json` から表示します。

- 10:30 月木: Gmail-ready候補補充
- 12:00 毎日: Gmail30件送信チェック
- 12:30 毎日: 送信結果・返信確認
- 14:00 毎日: 失敗・不足リカバリ確認
- 17:00 毎日: 返信確認・翌日準備
- 17:00 金曜: 市場・競合分析

表示するのは件数、状態、blocked理由、nextActionのみです。メールアドレス一覧、営業先一覧、返信本文、送信ログ本体、秘密情報は表示しません。

## 2026-06-04 Gmail営業30件送信成功

2026-06-04分のGmail営業メールは、Apps Script上で `sendBatchId=gmail-sales-2026-06-04` として30件送信成功済みです。

- processed: 30
- sentCount: 30
- failedCount: 0
- skippedCount: 0
- `batch_marked_sent` 確認済み
- `daily_job_finished` 確認済み
- `live_send_reset_after_run` 確認済み

Agent Officeと `/agent-office` では、`data/agent-status/tasks/gmail-daily-sales-send-2026-06-04.json` を `success` として表示します。
次の確認予定は、12:30送信結果・返信確認チェック、14:00失敗・不足リカバリ確認、17:00返信確認・翌日準備チェックです。
同一 `sendBatchId` の再送信、Google Sheets送信済み二重更新、自動返信は行いません。
