# ICHI Social Emergency Recovery Runbook

## 2026-06-15復旧方針

ThreadsとGmailは2026-06-12を最後に停止していた。
Gmail営業メールは2026-06-13、2026-06-14、2026-06-15分を遡ってまとめて送らない。
Gmailは2026-06-16から30件/日で再開する。
Threadsは2026-06-15 19:00枠から復旧する。

## 停止原因

Threads:

- Hermes cronの11時ジョブは発火していた
- no-agentスクリプトまで到達していた
- 失敗理由は `post_date_not_found`
- 19時ジョブはGateway停止によりcronが進まず、outputが残っていなかった

Gmail:

- Gmail関連Hermesジョブがjobs.jsonから消えていた
- PreflightではsendDate/sendBatchIdは正しかった
- Sheet上の30行がreadyではなく、readyRows=0、statusMismatchCount=30だった
- liveSendEnabled/autoSendEnabledはfalseで、送信許可はOFFだった

Gateway:

- API_SERVER_KEYがHermes `.env` に未設定だった
- Gatewayは手動単一起動で復旧した
- Windowsログイン時の自動起動は未完了

## 復旧済み

- API_SERVER_KEYを値非表示で生成し、Hermes `.env` に保存
- Gatewayを単一起動
- Threads 3ジョブを確認
- Gmail 6ジョブをno-agentで再登録
- Threadsローリング投稿計画を今日、翌日、翌々日で保証
- 2026-06-15 19時投稿はdry-runでpostPrepared/postValidatedを確認
- 2026-06-16 Gmail outbox30件を作成
- copyVariant A/Bは15件ずつ
- Sheet本番同期とGmail送信は未実行

## Windows自動起動

管理者権限またはUACが必要な場合は、ユーザーがPowerShellで以下を実行する。

```powershell
hermes gateway install
hermes gateway status
hermes cron status
```

手動GatewayとサービスGatewayを同時起動しない。
サービス化した場合は、手動起動中のGatewayを停止してからサービス側を起動する。

## Gmail再開手順

2026-06-16は以下を順に確認する。

1. `gmail-next-day-outbox-2026-06-16` がselectedCount=30であることを確認
2. Google Sheetsへの同期または手動反映を行う
3. Apps ScriptでPreflightを実行
4. readyRows=30、validationErrorCount=0、duplicateInSheetCount=0、previouslySentCount=0を確認
5. その日限りで送信許可を有効化
6. 12:00送信後、AUTO_RESET_LIVE_SEND_AFTER_RUNでOFFへ戻ることを確認

Codex作業中はGmail本番送信、Google Sheets本番更新、Apps Scriptトリガー操作を行わない。

## 禁止

- 6月13〜15のGmail未送信分をまとめて送らない
- Gmail送信件数を一時増枠しない
- Threads過去日分を遡って投稿しない
- メールアドレス、営業先名、Gmail本文、返信本文、Threads token、User ID、APIレスポンス全文、Sheet ID、Webhook URLを表示しない
- `data/gmail/`、`data/threads/`、`data/prospects/`、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` をGit追加しない
