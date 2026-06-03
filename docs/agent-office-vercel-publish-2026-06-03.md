# Agent Office Vercel公開メモ

## 目的

ローカル生成物 `tmp/agent-office.html` とは別に、Next.jsアプリ内へ正式な進捗確認ページを追加し、Vercel公開URLからスマホで確認できるようにする。

## 公開ページ

- パス: `/agent-office`
- ページ名: ICHI Agent Office / AIアバター進捗確認室
- 用途: Hermes Agent、Codex、Apps Script、Gmail営業、Instagram運用の状態確認
- 操作範囲: 表示専用

## スマホ確認方法

1. GitHub mainへpushする。
2. Vercelの自動デプロイ完了を待つ。
3. Vercel環境変数 `AGENT_OFFICE_ACCESS_KEY` を設定する。
4. スマホで `https://<vercel-domain>/agent-office?key=<access-key>` を開く。
5. 表示されるステータス、次アクション、人間確認タスクを確認する。

## 簡易アクセスキー

- 環境変数名: `AGENT_OFFICE_ACCESS_KEY`
- URL形式: `/agent-office?key=...`
- 本番環境では、環境変数が未設定またはkey不一致の場合はロック画面を表示する。
- 開発環境では、環境変数が未設定の場合に限り表示を許可する。

この方式は個人運用向けの簡易保護であり、正式な認証ではない。URL共有、スクリーンショット共有、ブラウザ履歴の扱いに注意する。

## 表示してよい情報

- `data/agent-status/tasks/*.json` に記録された安全な進捗要約
- status、phase、progress、priority、updatedAt
- nextAction
- metricsの件数や真偽値などの安全な要約
- Agent Officeで確認すべき人間タスク

## 表示禁止情報

- 営業先名
- メールアドレス
- Gmail送信対象リスト本体
- outbox本体
- candidate pool本体
- Gmail本文全文
- Google Sheets ID
- Apps Script URL
- Webhook URL
- APIキー、トークン、認証情報
- `.env` / `.env.local` の値

## データ読み込み方針

公開ページは `data/agent-status/tasks/*.json` だけを読み込む。
`data/gmail/`、`data/prospects/`、`docs/reports/sales/`、`tmp/` は読み込まない。
表示前に秘密情報らしき文字列やメールアドレス形式の文字列はサニタイズする。

## Vercel設定

VercelのProject Settingsで以下を設定する。

| Name | 用途 |
|---|---|
| `AGENT_OFFICE_ACCESS_KEY` | `/agent-office?key=...` の照合に使う簡易アクセスキー |

実際の値はGit、ドキュメント、チャットに書かない。

## セキュリティ注意

- このページからGmail送信、Instagram操作、Google Sheets更新は実行できない。
- 内部運用情報のため、検索インデックス対象外にする。
- key付きURLを第三者へ共有しない。
- 将来的には正式ログインへ移行する。

## 将来改善

- Vercel Authenticationまたは正式ログイン
- スマホPWA化
- Hermes実行結果の安全な自動反映
- Agent Officeのリアルタイム更新
- Agent別フィルタと通知
