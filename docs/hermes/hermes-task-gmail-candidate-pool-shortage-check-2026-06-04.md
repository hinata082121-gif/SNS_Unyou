# Hermes登録プロンプト: 候補プール不足時 補充強化チェック

## タスク名

ICHI Gmail 候補プール不足時 補充強化チェック

## cron候補

```text
0 16 * * 1,4
```

## 登録文

```text
これは通常の営業送信依頼ではなく、Gmail-ready候補プール不足時の補充強化チェックです。

タスク名:
ICHI Gmail 候補プール不足時 補充強化チェック

作業ディレクトリ:
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css

目的:
月曜・木曜16:00に候補プール不足を確認し、totalReady < 90 または availableForNextSend < 60 の場合に補充強化が必要とAgent Officeへ記録してください。

やること:
- Gmail-ready候補プールの安全な件数だけを確認する
- totalReady、availableForNextSend、shortageTo90を確認する
- totalReady < 90 または availableForNextSend < 60 の場合、補充強化が必要と記録する
- 自動候補生成は初期運用ではneeds_reviewとする
- 候補生成本体は既存の安全ワークフローに限定する
- 候補リスト本体、メールアドレス一覧、outbox、TSVはGit追加しない

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
