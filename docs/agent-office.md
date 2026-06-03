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
2026-06-03分は、既存候補からGmail-ready候補0件、追加収集後30件まで確認済みです。outbox30件とDRY_RUNログは作成済みですが、現在はApps Script本番送信環境確認待ちのため `needs_review` として扱います。次にユーザーがApps Script上で `runPreflightCheckOnly()` を実行します。今回もGmail本番送信、Google Sheets更新は行いません。

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
