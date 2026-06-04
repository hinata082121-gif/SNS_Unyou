# Hermes登録プロンプト: Gmail週次営業メール改善

## タスク名

ICHI Gmail 金曜18時 営業メール改善・反応率分析

## スケジュール

毎週金曜18:00

cron候補:

```text
0 18 * * 5
```

## 作業ディレクトリ

```text
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css
```

## 有効ツール

- file
- terminal
- web

## 登録文

```text
これは通常の営業送信依頼ではなく、Hermes Agentの週次営業メール改善・反応率分析タスクです。

タスク名:
ICHI Gmail 金曜18時 営業メール改善・反応率分析

スケジュール:
毎週金曜18:00

目的:
毎週金曜17:00の市場・競合分析結果と、直近7日間のGmail営業結果を確認し、翌週の営業メールの件名、本文、CTA、訴求軸を改善するための提案を作成してください。

作業ディレクトリ:
C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css

確認すること:
- 毎週金曜17:00の市場・競合分析結果
- 直近7日間のGmail営業結果
- 送信数
- 返信数
- 有望返信数
- 断り返信数
- 配信停止数
- 業種別反応
- 件名別反応
- 本文テンプレート別反応
- Agent Office上のblocked/needs_review

作成するもの:
- 翌週用の件名A/B案
- 翌週用の本文A/B案
- 業種別の訴求改善案
- 無料SNS診断への導線改善案
- 有料ミニ改善パックへ自然につながるCTA改善案
- docs/gmail/weekly-email-improvements/ 配下のMarkdown改善案
- data/agent-status/tasks/ 配下のAgent Office用JSON

Agent Office表示:
- 改善案はneeds_reviewとして表示する
- 人間承認後のみ翌週テンプレートへ反映する
- 本番テンプレートは自動差し替えしない

禁止事項:
- Gmail送信しない
- 自動返信しない
- Apps Scriptトリガー操作しない
- Google Sheets送信済み更新しない
- Instagram投稿/DM/コメント/フォロー/いいねをしない
- 営業候補生成しない
- 本番テンプレート自動差し替えをしない
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
- commit/pushする場合は、安全確認後に個別add

commit message候補:
chore: add weekly gmail email improvement task
```
