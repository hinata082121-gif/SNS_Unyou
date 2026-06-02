# Codex Prompt Rules

## 目的

Codexへ渡すプロンプトの標準ルールをまとめる。

## 必須

- Codex向けプロンプトの末尾には `docs/ops/agent-status-prompt-footer.md` の内容を付ける
- 実装/検証/commit/pushの進捗をAgent Operations Dashboardへ反映する
- 作業完了後に `npm run agent:status:validate` と `npm run agent:status:render` を実行する
- `tmp/agent-dashboard.html` はローカル確認用であり公開しない

## 禁止

- SECRET_TOKEN、Webhook URL、APIキー、認証情報をstatus JSONに入れない
- `.env` を変更しない
- Google Sheets投入や営業送信を、明示指示なしに実行しない
- 未追跡ファイルを勝手に削除しない
- `git clean` / `git reset --hard` を実行しない
