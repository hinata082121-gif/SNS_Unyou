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

### 3部門タブ

`/agent-office` は、以下3部門をタブで切り替えて確認できるようにします。

1. Gmail運用
   - Gmail送信
   - 返信確認
   - 候補プール
   - outbox
   - Preflight
   - Gmail営業メール改善
2. Threads運用
   - 11:00投稿
   - 19:00投稿
   - 投稿成功/失敗
   - 投稿予定
   - 週次バズ分析
   - 投稿文改善
   - Threads API接続状態
   - blocked/needs_review
3. 全体管理
   - 重要アラート横断
   - 今日の自動化状況
   - stale/blocked/needs_review
   - Gmail/Threads両方の次アクション
   - 反映監査

Threads運用タブは `threads_post`、`threads_daily_post`、`threads_weekly_analysis`、`threads_growth`、`threads_automation` を表示対象にします。
全体管理タブではGmail/Threads/Instagram/市場分析/監視を横断し、`blocked`、`failed`、`needs_review`、`stale` を優先表示します。

Threadsタブから投稿、返信、いいね、フォロー、API設定変更は実行しません。
アクセストークン、投稿先ID、APIキー、APIレスポンスの秘密情報は表示しません。

Threads運用3タスクはHermesへ登録済みです。

- 11:00ノウハウ投稿: `2c6a2309255f`、cron `0 11 * * *`、次回 `2026-06-06T11:00:00+09:00`
- 19:00共感・導線投稿: `d02c609665e8`、cron `0 19 * * *`、次回 `2026-06-06T19:00:00+09:00`
- 金曜20:00バズ投稿分析: `807bcd30473d`、cron `0 20 * * 5`、次回 `2026-06-12T20:00:00+09:00`

Threads運用タブでは、`postPrepared`、`postValidated`、`posted`、`blockedReason`、`publishEnabled`、`dryRun`、`autoReplyEnabled=false`、`autoLikeEnabled=false`、`autoFollowEnabled=false` を確認します。
全体管理タブでは、Threadsの `blocked`、`needs_review`、`stale` もGmailと同じ重要アラートとして横断表示します。
API未設定時は投稿せず `blocked` でよく、初日から完全自動化する場合も `THREADS_PUBLISH_ENABLED=true` と `THREADS_DRY_RUN=false` の設定確認を必須にします。

2026-06-11にThreads APIのテキスト投稿フローを実装し、ローカルスタブ停止理由 `api_publish_not_implemented_in_local_stub` は解消済みです。
Agent Officeでは `threads-api-publish-implementation-2026-06-11` を表示し、以下の安全な状態だけを確認します。

- localStubRemoved: true
- textPostApiImplemented: true
- imagePostApiImplemented: false
- videoPostApiImplemented: false
- autoReplyEnabled: false
- autoLikeEnabled: false
- autoFollowEnabled: false
- livePostExecutedByCodex: false

初回本番投稿は、人間がPowerShellの一時環境変数で1件だけ実施します。
投稿ID、アクセストークン、User ID、APIレスポンス全文は表示しません。

2026-06-12の11時未投稿は、Threads APIではなくHermes provider/model設定エラーで `npm run threads:post:11` へ到達していなかったことが原因です。
Agent Officeでは `threads-hermes-provider-reset-2026-06-12` を表示し、以下を安全な状態だけで確認します。

- originalError: `Unknown provider 'openai'`
- providerDependencyRemovedOrFixed: true
- noAgentMode: true
- new11JobId: `6fbea6039fcf`
- new19JobId: `ee568dbda7ab`
- newWeeklyJobId: `96bd94126b9d`
- gatewayRunning: true
- livePostExecutedByThisRun: false

Windowsログイン時の自動起動はUAC付きの `hermes gateway install` 完了が必要です。

2026-06-11時点で、Threadsスクリプトは `.env.local` を自動読み込みできるようになりました。
Agent Officeでは `threads-api-env-check-2026-06-08` を表示し、以下の安全な状態だけを確認します。

- apiConfiguredAfterEnvLoad: true
- publishEnabled: false
- dryRun: true
- published: false
- autoReplyEnabled: false
- autoLikeEnabled: false
- autoFollowEnabled: false

アクセストークン、User ID、App Secret、Client Secret、APIレスポンスの秘密情報は表示しません。
現在はpublish disabled / dry-runのため、11:00/19:00の検証でも投稿は行いません。

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
- `sales_growth`: Gmail/Threads KPI改善
- `instagram`: 自社Instagram運用
- `dashboard`: Agent Office本体

## ICHI Social KPI改善表示

Agent Officeでは、Gmail営業とThreads発信を売上KPIへ接続する `ichi-social-kpi-growth-plan-2026-06-12` を表示します。

表示する安全な項目:

- 30日/60日/90日の返信率、ポジティブ返信率、商談化、初売上KPI
- Gmail copyVariant A/Bの割り当て状態
- copyVariantがTSV/Sheet列ではなくローカルメタデータのみであること
- KPI記録/集計スクリプトの追加状態
- Threads 11:00ノウハウ投稿案と19:00共感投稿案の数
- 次に人間が承認すべき改善案

表示しない項目:

- メールアドレス
- 営業先名
- 返信本文
- Gmailスレッド全文
- outbox/TSV本文
- APIキー、トークン、Webhook URL、Sheet ID

初期運用では、改善案は `needs_review` として表示し、本番Gmailテンプレート差し替えやThreads投稿の自動反映は行いません。

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

営業メール改善・反応率分析は、`data/agent-status/tasks/gmail-weekly-email-improvement-2026-06-06.json` で確認します。
毎週金曜18:00に、17:00の市場・競合分析結果と直近7日間のGmail営業結果をもとに、翌週の件名、本文、CTA、訴求軸の改善案を作成します。
Agent Officeと `/agent-office` では、改善案が作成済みか、承認待ちか、適用済みか、blockedか、次回適用予定があるか、直近7日間の安全な集計値だけを表示します。
メールアドレス、営業先名、返信本文、Gmailスレッド全文、送信ログ本体、秘密情報は表示しません。
初期運用では改善案は `needs_review` とし、本番テンプレートへの反映は人間承認後に限定します。

Agent Office反映監査は、`data/agent-status/tasks/agent-office-reflection-audit-2026-06-04.json` で確認します。
すべての自動化施策は、実行後にAgent Status JSONへ安全な件数、状態、nextActionを記録します。
Apps Script単体実行は直接Agent Officeへ反映しないため、Hermes監視タスクが記録を担当します。
Hermes監視タスクが失敗した場合に備え、毎日18:30の反映監査タスクで未反映、古い更新、stale候補を検知します。
`/agent-office` には `success` / `blocked` / `needs_review` / stale候補、最終更新時刻、次アクション、安全な件数だけを表示します。
メールアドレス、営業先名、返信本文、Gmailスレッド全文、Sheet ID、Apps Script URL、Webhook URL、APIキー、トークンは表示しません。

Gmail自動化ギャップ修正は、`data/agent-status/tasks/gmail-automation-gap-fix-2026-06-04.json` で確認します。
Agent Officeでは、`tomorrowOutboxReady`、`replyCheckExecuted`、`reflectionAuditStatus`、`candidatePoolShortage`、`automationGapStatus` を安全な件数・状態として表示します。
翌日outbox30件準備、返信確認実行・記録、反映監査、候補プール不足時チェックを追加タスクとして扱い、人間作業として残っている箇所を `needs_review` で明確化します。
Gmail送信、自動返信、Apps Scriptトリガー操作、Google Sheets送信済み更新、Instagram操作はAgent Officeから実行しません。

2026-06-04時点で、追加4タスクはHermesへ登録済みです。翌日outbox準備は `4e4ed67216e3`、返信確認実行・記録は `ee8473f970ff`、Agent Office反映監査は `1365e7b16899`、候補プール不足時補充強化チェックは `758eef276079` として扱います。
2026-06-05分は17:20タスクの初回実行前に12:00自動送信があるため、一回限りでoutbox30件とSheets貼り付け用TSVを事前準備しました。
ただし緊急確認で、2026-06-05分outboxが2026-06-04送信済み候補と30件すべて重複していたため、旧outbox/TSVは使用禁止です。
公開メール確認済み候補を緊急補充し、過去送信済み候補と重複ゼロの新outbox30件とSheets貼り付け用TSVを再作成しました。
`data/agent-status/tasks/gmail-next-day-outbox-2026-06-05.json` は `needs_review` として、Sheets差し替えとPreflight確認待ちを表示します。
`/agent-office` では `tomorrowOutboxReady=true`、`tomorrowOutboxCount=30`、`duplicateWithPreviousBatch=false`、`duplicateWithPastSent=false`、`duplicateCount=0`、`sheetPasted=false`、`preflightRequired=true` を表示します。
旧6/5 TSVがSheetsに入っている場合は、送信前に必ず新TSVへ差し替えます。
Preflightで `batch_already_sent` が出た場合は、`batchAlreadySentDetected`、`batchIdRotated`、`safeToSend`、`safeToSendAfterSheetUpdate` を確認対象にします。
2026-06-05は `gmail-sales-2026-06-05` を使用禁止にし、`gmail-sales-2026-06-05-r2` のr2 outbox/TSVへ差し替える運用です。

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
- 18:00 金曜: 営業メール改善・反応率分析
- 17:20 毎日: 翌日outbox30件自動準備
- 17:30 毎日: 返信確認実行・記録
- 18:30 毎日: Agent Office反映監査・未反映検知
- 16:00 月木: 候補プール不足時 補充強化チェック

追加4タスクは登録済みです。ジョブIDは順に `4e4ed67216e3`、`ee8473f970ff`、`1365e7b16899`、`758eef276079` です。

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

## 2026-06-05以降 Gmail完全自動送信開始準備

2026-06-03と2026-06-04の30件送信成功を受けて、2026-06-05以降は `data/agent-status/tasks/gmail-full-auto-send-start-2026-06-05.json` で完全自動送信開始準備を確認します。

- 初回の完全自動化開始前に人間がScript Propertiesを確認する
- Apps Scriptで `setupDailyAutoSendTriggers()` と `setupReplyCheckTriggers()` を人間が実行する
- failed/blockedが出た場合は自動送信を停止する
- 自動返信はOFFのままにする
- 初日は `/agent-office` を12:30、14:00、17:00に確認する

Agent Officeには自動送信の有効化状況、返信確認トリガーの有効化状況、次アクションだけを表示します。
メールアドレス、営業先名、送信ログ本体、返信本文、秘密情報は表示しません。

## 2026-06-05 r2 Preflight確認

2026-06-05分は `gmail-sales-2026-06-05` が使用済み扱いになったため、最終的に `gmail-sales-2026-06-05-r2-2026-06-05` にbatchIdをローテーションしました。
その後の診断とPreflightで `batch_already_sent`、`outbox_validation_errors`、`no_ready_rows` は解消し、送信前条件は成功済みです。

Agent Officeでは以下を確認対象にします。

- `batchAlreadySentResolved`
- `tsvReadyConditionChecked`
- `headerMatched`
- `statusValueMatched`
- `sendDateMatched`
- `sendBatchIdMatched`
- `subjectBodyPresent`
- `optOutPresent`
- `expectedReadyRowsAfterCorrectPaste`
- `safeToSend`
- `preflightDiagnosticsRequired`
- `diagnosticsFunctionAdded`
- `missingEmailCount`
- `missingSubjectCount`
- `missingBodyCount`
- `missingOptOutTextCount`
- `statusMismatchCount`
- `sendDateMismatchCount`
- `sendBatchIdMismatchCount`
- `duplicateInSheetCount`
- `excludedStatusCount`
- `validationErrorCount`
- `validationErrorRowNumbers`
- `validationErrorReasonCounts`
- `validationErrorReasonSamples`
- `replacementCandidateAvailable`
- `expectedReadyRowsAfterFix`
- `escapedNewlineBodyCount`
- `escapedNewlineSubjectCount`
- `bodyNormalizedCount`
- `subjectNormalizedCount`
- `expectedBodyWouldContainLiteralBackslashN`

最終Preflightでは以下を安全な件数だけで確認済みです。

- readyRows: 30
- readyCount: 30
- validationErrorCount: 0
- statusMismatchCount: 0
- sendBatchIdMismatchCount: 0
- duplicateInSheetCount: 0
- previouslySentCount: 0
- sheetConnected: true
- blockedReason: 空

2026-06-05分は送信済みのため、同じr2 TSVや同じsendBatchIdで再送信しません。
送信後にGoogle Sheets側の対象行が `sent` へ更新され、ready行ではなくなる場合があります。
この場合の `readyRows=0` や `statusMismatchCount=30` は、送信後状態として正常な可能性があるため、送信前Preflight失敗と混同しません。

`outbox_validation_errors` が出る場合は、Apps Scriptへ最新Code.gsを反映して `runPreflightDiagnosticsOnly()` を実行します。
Agent Officeには原因別件数だけを反映し、メールアドレス、営業先名、件名全文、本文全文、返信本文、Gmailスレッド全文、Sheet ID、Apps Script URL、秘密情報は表示しません。

`readyRows=29`、`validationErrorCount=1` のように1件だけ落ちた場合、Agent Officeには行番号とreason codeだけを表示対象にします。
該当行の候補名、宛先、本文は表示しません。
修正または差し替え後は `expectedReadyRowsAfterFix=30` として、再貼り付けとPreflight再実行をnextActionに残します。

## Gmail本文改行エスケープ修正の表示

2026-06-05送信後に、本文中の `\n` が文字列として表示される問題を確認しました。
Agent Officeでは `gmail-body-newline-fix-2026-06-05` を表示し、本文正規化、件名正規化、Preflight診断拡張が反映済みかを確認します。

表示するのは件数と状態のみです。
本文全文、宛先、営業先名、返信本文、Gmailスレッド全文は表示しません。

本文/件名正規化と診断拡張は実装済みとして `success` 表示にします。
次回以降も `escapedNewlineBodyCount`、`bodyNormalizedCount`、`expectedBodyWouldContainLiteralBackslashN` などの安全な件数だけを確認します。

## 2026-06-05 Gmail営業30件送信チェック

2026-06-05分のGmail営業メールは、r2 outboxと `sendBatchId=gmail-sales-2026-06-05-r2-2026-06-05` で30件送信完了済みです。

Agent Officeと `/agent-office` では、`data/agent-status/tasks/gmail-daily-sales-send-2026-06-05.json` を表示対象にします。

安全な表示項目:

- Preflight: success
- readyCount: 30
- targetSendCount: 30
- remainingQuota: 100
- sheetConnected: true
- 送信実行: 完了
- processed: 30
- sentCount: 30
- failed: 0
- skipped: 0
- nextAction: 再送信せず、送信後確認、返信確認、翌日準備、反映監査へ進む

同一sendBatchIdでの再送信、Google Sheets送信済み二重更新、自動返信、Apps Scriptトリガー操作は行いません。

## Gmail stale batch停止表示

2026-06-07の診断で、通常日次運用が2026-06-05用のsendDate/sendBatchIdを参照していたため、6/6・6/7の送信停止をAgent Officeで表示します。

表示する安全な項目:

- `currentDiagnosisDate`
- `expectedSendDateAtDiagnosis`
- `expectedSendBatchIdAtDiagnosis`
- `staleSendDate`
- `staleBatchId`
- `readyCount`
- `blockedReason`
- `safeToSend`
- `shouldResendOldBatch`
- `nextAction`

`shouldResendOldBatch=false` を明示し、送信済み行をreadyへ戻さず、新しい日付のoutbox/Preflightへ進むことを表示します。
Apps Script診断ログの `dryRun`、`liveSendEnabled`、`autoSendEnabled` は、/agent-office上の送信可否判断の基準として扱います。

## 2026-06-08 Gmail通常再開準備表示

2026-06-08用のoutbox30件とSheets貼り付け用TSVは準備済みです。
`/agent-office` では `gmail-next-day-outbox-2026-06-08` を表示し、以下の安全な状態だけを確認します。

- sendDate: `2026-06-08`
- sendBatchId: `gmail-sales-2026-06-08`
- selectedCount: 30
- duplicateCount: 0
- sheetsReadyTsvCreated: true
- sheetPasted: false
- preflightPassed: false
- gmailSendExecuted: false

残作業は、人間が6/8用TSVをGmail送信対象シートへ貼り付け、`runPreflightDiagnosticsOnly()` と `runPreflightCheckOnly()` でreadyCount=30、blockedReason空を確認することです。
outbox本体、TSV本文、メールアドレス、営業先名、本文全文は表示しません。

## 2026-06-08 Gmail送信成功表示

2026-06-08分のGmail営業30件送信はscheduled実行で成功済みです。
Agent Officeと `/agent-office` では `gmail-daily-sales-send-2026-06-08` をsuccessとして表示します。

安全な表示項目:

- sendBatchId: `gmail-sales-2026-06-08`
- processed: 30
- sentCount: 30
- failedCount: 0
- batchMarkedSent: true
- liveSendResetAfterRun: true
- staleBatchIssueResolved: true
- newlineIssueResolved: true
- safeToSendAgain: false

6/5固定batch問題は復旧完了、本文のリテラル `\n` 表示問題も解消済みとして扱います。
6/8分は再送信禁止です。送信済み行をreadyへ戻さず、6/9以降の日次ローテーション、翌日outbox準備、返信確認、反映監査を確認します。

## 2026-06-09 翌日outbox自動準備表示

17:20翌日outbox準備フローは、JST翌日を対象にして日次batchIdを生成します。
2026-06-08の点検では、2026-06-09分として `sendDate=2026-06-09`、`sendBatchId=gmail-sales-2026-06-09` を正常に解決できました。

安全な表示項目:

- autoSelectEnabled: true
- expectedBatchId: `gmail-sales-2026-06-09`
- selectedCountActual: 5
- selectedCountTarget: 30
- shortage: 25
- duplicateCount: 0
- duplicateGuardEnabled: true
- excludesPastSent: true
- autoSheetSyncEnabled: false
- manualPasteRequired: true

過去送信済み候補を除外した結果、30件に届かないため2026-06-09分は `blocked` として表示します。
Sheet自動反映は安全なGmail送信対象シート更新経路が未確認のため、`autoSheetSyncEnabled=false` とし、outbox30件が作成できた場合でもSheet投入とPreflightは `needs_review` で人間確認対象にします。
outbox本体、TSV本文、メールアドレス、営業先名、本文全文は表示しません。

その後、Gmail-ready候補を補充し、2026-06-09分はselectedCount=30まで復旧しました。
`/agent-office` では `gmail-next-day-outbox-2026-06-09` を `needs_review` として表示し、Sheet貼付とPreflight確認待ちを次アクションにします。

復旧後の安全な表示項目:

- selectedCount: 30
- shortage: 0
- duplicateCount: 0
- duplicateWithPreviousBatch: false
- duplicateWithPastSent: false
- sheetsReadyTsvCreated: true
- sheetSynced: false
- manualPasteRequired: true
- preflightPassed: false

6/9用TSVは生成済みですが、Google Sheets本体はCodexから直接更新しません。
人間がTSVをGmail送信対象シートへ貼り付け、`runPreflightDiagnosticsOnly()` と `runPreflightCheckOnly()` でreadyCount=30、blockedReason空を確認します。

## Gmail送信後の自動反映方針

明日以降、毎日12:30のGmail送信結果確認タスクは、Agent Officeへの反映まで自動で行います。

表示までの流れ:

1. 12:00送信タスクの安全な結果メタ情報を確認する
2. `processed`、`failedCount`、`sendBatchId`、`batchMarkedSent`、`liveSendResetAfterRun` をAgent Status JSONへ記録する
3. outbox/recovery/preflight関連タスクを送信成功またはneeds_reviewへ解決更新する
4. `agent:status:validate`、`agent:status:render`、`agent:office:render`、`lint`、`build` を実行する
5. 安全なAgent Status JSONとdocsだけを個別にGit追加し、commit/pushする
6. Vercelの `/agent-office` に当日送信結果を反映する

12:30タスクはGmail再送信、Google Sheets直接更新、Apps Scriptトリガー操作、自動返信、Threads投稿、Instagram操作を行いません。
`data/gmail/`、`data/prospects/`、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` はGit追加しません。

## 2026-06-09〜2026-06-11 Gmail送信停止原因

2026-06-09、2026-06-10、2026-06-11のGmail営業送信は0件でした。
2026-06-11のPreflight診断では、日付/batchIdローテーションは正常で、`expectedSendDate=2026-06-11`、`expectedSendBatchId=gmail-sales-2026-06-11`、`staleSendDate=false`、`staleBatchId=false` でした。

主因は、Gmail送信対象シートに当日分ready行30件が存在しないことです。
`manualPasteRequired=true` が残っている限り完全自動化ではありません。

Agent Officeでは `gmail-send-stopped-no-ready-rows-2026-06-11` を `blocked` として表示し、以下を安全な件数だけで確認します。

- sentOn20260609: 0
- sentOn20260610: 0
- sentOn20260611: 0
- readyRows: 0
- blockedReason: `no_ready_rows,exact_ready_count_not_met`
- sheetConnected: true
- staleSendDate: false
- staleBatchId: false

2026-06-11用outbox30件とTSVは作成済みですが、Google Sheets本体はCodexから直接更新していません。
6/11送信可否は、人間がTSVをGmail送信対象シートへ反映し、`runPreflightDiagnosticsOnly()` と `runPreflightCheckOnly()` でreadyCount=30、blockedReason空を確認してから判断します。
6/9・6/10の後追い再送は行いません。

## Gmail送信対象Sheet自動反映

Agent Officeでは、17:20タスクのSheet反映状態を安全な件数と真偽値だけで表示します。

表示する項目:

- sheetAutoSyncImplemented
- syncEnabledDefault
- syncDryRunDefault
- productionSyncRequiresFlags
- sendDate
- sendBatchId
- rowCount
- sheetSynced
- manualPasteRequired
- readyRowsVerified
- blockedReason

表示しない項目:

- メールアドレス
- 営業先名
- 本文全文
- 返信本文
- Gmailスレッド全文
- Sheet ID
- Apps Script URL
- Webhook URL
- APIキー
- トークン

本番Sheet同期は、環境変数 `GMAIL_SHEET_SYNC_ENABLED=true` と `GMAIL_SHEET_SYNC_DRY_RUN=false` が明示され、Webhook URLと同期トークンが設定されている場合だけ行う。
デフォルトは同期無効かつdry-runで、`sheetSynced=false`、`manualPasteRequired=true` として表示する。
Apps Script Web App受信口を使う場合は、`Code.gs` をscript.google.comへ手動反映してから有効化する。

2026-06-11にGmail系Nodeスクリプトへ `.env.local` 自動読み込みを追加した。
Agent Officeでは `gmail-sheet-env-load-check-2026-06-11` を表示し、同期設定が読み込まれて `blockedReason=sheet_sync_dry_run` になったことを安全な状態だけで確認する。
この確認ではGmail送信、Google Sheets本番更新、Apps Scriptトリガー操作は行っていない。
