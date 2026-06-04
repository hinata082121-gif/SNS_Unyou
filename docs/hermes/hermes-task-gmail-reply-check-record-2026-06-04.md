# Hermes登録プロンプト: 返信確認実行・記録

## タスク名

ICHI Gmail 毎日17:30 返信確認実行・記録

## cron候補

```text
30 17 * * *
```

## 登録文

```text
これは通常の営業送信依頼ではなく、Gmail返信確認結果の記録タスクです。

タスク名:
ICHI Gmail 毎日17:30 返信確認実行・記録

作業ディレクトリ:
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css

目的:
返信確認状態を安全に記録し、replyCheckExecutedとneedsHumanEmailCheckをAgent Officeへ反映してください。

やること:
- Apps Scriptの返信確認結果、または既存の安全なAgent Statusから返信確認状態を確認する
- replyCheckExecuted=true/falseを明確化する
- needsHumanEmailCheckをAgent Officeへ反映する
- repliedCount、unreadReplyCount、handledReplyCountなど安全な件数だけを扱う
- 返信本文、営業先名、メールアドレスは表示しない

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
