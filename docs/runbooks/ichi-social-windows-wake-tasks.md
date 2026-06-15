# ICHI Social Windows Wake Tasks Runbook

## 目的

ICHI SocialのThreads投稿、Gmail営業準備、Sheet同期、監視、KPI集計を、Windows Task Schedulerの `WakeToRun` でスリープ復帰実行できる構成にする。

Apps ScriptのGmail本送信はクラウド側で実行する。Windows側はGmail本送信を実行しない。

## 実行基盤

- 主実行基盤: Windows Task Scheduler `\ICHI-Social\`
- 補助/履歴: Hermes cronは削除せず保持
- Gmail本送信: Apps Script側
- ローカル処理: Threads投稿、Gmail outbox準備、Sheet同期、監視、KPI

## 登録済みタスク

| タスク | 時刻 | 役割 |
|---|---:|---|
| `ICHI-Threads-Plan-1050` | 毎日10:50 | 当日11時投稿計画確認 |
| `ICHI-Threads-Post-1100` | 毎日11:00 | Threads 11時投稿 |
| `ICHI-Threads-Verify-1110` | 毎日11:10 | Threads 11時投稿結果確認 |
| `ICHI-Threads-Plan-1850` | 毎日18:50 | 当日19時投稿計画確認 |
| `ICHI-Threads-Post-1900` | 毎日19:00 | Threads 19時投稿 |
| `ICHI-Threads-Verify-1910` | 毎日19:10 | Threads 19時投稿結果確認 |
| `ICHI-Threads-Weekly-Friday-2000` | 金曜20:00 | Threads/KPI週間分析 |
| `ICHI-Gmail-Candidates-1030` | 毎日10:30 | 候補不足確認 |
| `ICHI-Gmail-ReadyCheck-1125` | 毎日11:25 | 当日outbox/Sheet準備確認 |
| `ICHI-Gmail-PreflightMonitor-1135` | 毎日11:35 | Preflight結果監視 |
| `ICHI-Gmail-SendResult-1210` | 毎日12:10 | Gmail送信結果監視 |
| `ICHI-Gmail-KPI-1230` | 毎日12:30 | KPI集計 |
| `ICHI-Gmail-PrepareTomorrow-1720` | 毎日17:20 | 翌日outbox生成・Sheet同期 |
| `ICHI-Gmail-TomorrowCheck-1730` | 毎日17:30 | 翌日準備結果確認 |

全時刻指定タスクは以下を標準設定にする。

- `WakeToRun=true`
- `StartWhenAvailable=true`
- `RunOnlyIfNetworkAvailable=true`
- `MultipleInstancesPolicy=IgnoreNew`
- AC/DCバッテリー時も開始を許可
- タスク別に実行期限を設定
- 実行ログは `%LOCALAPPDATA%\ICHI-Social\scheduled-task-logs`

## Gateway

既存の `Hermes_Gateway` タスクは保持する。今回の通常権限では `ICHI-Hermes-Gateway-Startup` と `ICHI-Hermes-Gateway-Logon` の登録がWindowsに拒否されたため、Gatewayの起動時/ログオン時タスクは管理者権限で登録する。

手動対応:

```powershell
cd "C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css"
.\scripts\windows\register-ichi-social-wake-tasks.ps1
```

管理者権限でも拒否される場合は、既存 `Hermes_Gateway` を確認し、単一起動になっていることを確認する。Gatewayを手動とサービスで二重起動しない。

## 電源設定

Wake timerはAC/DCとも有効であることを `scripts/windows/check-wake-configuration.ps1` で確認する。

必要時のみ管理者PowerShellで実行:

```powershell
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /SETACTIVE SCHEME_CURRENT
```

注意:

- バッテリー消費が増える
- 電源OFF状態では実行不可
- 蓋閉じ状態の復帰は機種依存
- 休止状態からの復帰可否はハードウェア/UEFI依存

## 二重実行防止

`scripts/windows/run-scheduled-task.ps1` がタスク名ごとのロックファイルを作成する。

- 同一タスクが実行中なら新規起動をskip
- 古すぎるロックだけ安全に解除
- Task Scheduler側も `IgnoreNew`
- Threadsは既存投稿状態を既存スクリプト側で確認
- Gmail本送信コマンドはランナー側で拒否

## 安全ログ

ログに残すもの:

- taskName
- startedAt / finishedAt
- durationMs
- exitCode
- ok / timedOut / skipped
- stdout/stderrの短いサニタイズ済みプレビュー

ログに残さないもの:

- メールアドレス
- 営業先名
- Gmail本文
- Threads投稿本文
- Google Sheet ID
- URL型の秘密情報
- 認証値

## Wake Test

CodexはPCを自動でスリープさせない。手動で以下を実行する。

```powershell
cd "C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css"
.\scripts\windows\test-ichi-social-wake-tasks.ps1 -MinutesFromNow 5
```

手順:

1. 出力された予定時刻を確認する
2. 予定時刻の前に手動でPCをスリープする
3. 予定時刻後に復帰したか確認する
4. `%LOCALAPPDATA%\ICHI-Social\scheduled-task-logs\ichi-wake-test-result.json` を確認する
5. 成功後、必要なら `ICHI-Wake-Test` を削除する

## 検証コマンド

```powershell
.\scripts\windows\show-ichi-social-wake-task-status.ps1
.\scripts\windows\check-wake-configuration.ps1
npm run automation:health:wake -- --date 2026-06-16
npm run agent:status:validate
npm run agent:status:render
npm run agent:office:render
npm run lint
npm run build
```

## 禁止事項

- Windows側からGmail本送信を実行しない
- Apps ScriptとWindowsで同じGmail送信を二重実行しない
- テスト中にThreads本番投稿をしない
- `git add .` を使わない
- `data/gmail/`、`data/prospects/`、`data/threads/`生成物、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` をGit追加しない
