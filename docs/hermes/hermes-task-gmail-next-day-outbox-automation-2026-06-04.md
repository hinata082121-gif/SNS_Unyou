# Hermes登録プロンプト: 翌日outbox30件自動準備

## タスク名

ICHI Gmail 毎日17:20 翌日outbox30件自動準備

## cron候補

```text
20 17 * * *
```

## 登録文

```text
これは通常の営業送信依頼ではなく、翌日分Gmail outbox準備タスクです。

タスク名:
ICHI Gmail 毎日17:20 翌日outbox30件自動準備

作業ディレクトリ:
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css

目的:
翌日分のGmail営業送信に向けて、availableForNextSendが30件以上ある場合に翌日分outbox30件を準備し、Agent Officeへ安全な状態だけを記録してください。

やること:
- Gmail-ready候補プールの安全な件数だけを確認する
- availableForNextSend >= 30 の場合、翌日分outbox30件を既存の安全なワークフローで作成する
- 前日送信済み候補、過去送信済み候補、既存outbox、既存sendBatchIdとの重複検査を必ず行う
- duplicateCount > 0 の場合はoutbox作成成功にせず、statusをblockedにする
- 既存outboxが前日送信済み候補と一致する場合は使用禁止にし、safeToSend=falseをAgent Officeへ反映する
- PreflightやAgent Statusでbatch_already_sentを検出した場合は既存batchIdを再利用しない
- batch_already_sent時は `gmail-sales-YYYY-MM-DD-r2` のような新batchIdを発行し、old TSVを使用禁止にする
- outbox生成時に本文の `\n` / `\r\n` エスケープを実改行へ正規化し、件名内の改行エスケープはスペースへ正規化する
- TSVでは貼り付け都合でセル内改行が `\n` 表現になってもよいが、Apps Script送信直前に実改行へ復元されることをAgent Statusに記録する
- Preflight診断で `escapedNewlineBodyCount` と `escapedNewlineSubjectCount` を確認し、本文全文は表示しない
- 新規候補が30件未満の場合はblockedとし、不足数とnextActionを明記する
- 翌日分Agent Status JSONを作成する
- Sheets反映が自動化できる場合は安全な既存経路のみ使用する
- Sheets反映できない場合はneeds_reviewとして、何が必要かnextActionに明記する
- data/gmail/本体、outbox、TSV、メールアドレス一覧はGit追加しない

禁止事項:
- Gmail送信しない
- 自動返信しない
- Apps Scriptトリガー操作しない
- Google Sheets送信済み更新しない
- Instagram操作しない
- 本番メールテンプレート差し替えしない
- data/gmail/本体をGit追加しない
- data/prospects/をGit追加しない
- docs/reports/sales/をGit追加しない
- tmp/をGit追加しない
- .env/.env.localを読まない、表示しない、Git追加しない
- メールアドレス、営業先名、返信本文、Gmailスレッド全文、秘密情報を表示・コミットしない
- git add . を使わない

完了時:
- npm run agent:status:validate
- npm run agent:status:render
- npm run agent:office:render
- npm run lint
- npm run build
- 安全なdocsとAgent Status JSONのみ個別git add
```
