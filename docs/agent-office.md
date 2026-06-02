# Agent Office

## 目的

Agent Officeは、Codex/Hermes Agentの作業状態をローカルで確認するための「ゲーム風AI社員オフィス / 自動化ビジネス司令室」です。
既存の `tmp/agent-dashboard.html` を置き換えず、別画面として `tmp/agent-office.html` を生成します。

## Phase 1: ローカルHTML

現時点では、Node.js標準機能だけで `data/agent-status/tasks/*.json` を読み込み、静的HTMLを生成します。
外部CSS、外部JS、外部画像、CDNは使いません。

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

## 登場キャラクター

- Hermes / 営業担当: 営業候補・営業進行管理
- Sheets Clerk / 記録担当: Google Sheets記録係
- Git Keeper / Git管理: Git/GitHub管理係
- ミオ / 秘書: 今日のまとめ、次アクション、注意アラートを話し言葉で整理
- あなた / 判断担当: 返信確認、DM可否判断、Sheets目視確認、Git操作判断

## 秘書ミオの役割

ミオは最新のagent-status JSONとGit状態をもとに、今日の状況を短く案内します。
たとえば、Sheets更新完了、2026-06-05の返信確認、未追跡の営業リスト系ファイル、`git add .` 禁止などを表示します。

## 運用注意

- `git add .` は使わない
- `data/prospects/` は営業リスト系ファイルを含むためGitに追加しない
- `docs/reports/sales/` は実在店舗名、Instagram情報、DM文面を含む可能性があるためGitに追加しない
- `tmp/agent-office.html` と `tmp/agent-dashboard.html` は生成物のためGitに追加しない
- 追加DM、営業候補再生成、Google Sheets再送信は行わない
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
