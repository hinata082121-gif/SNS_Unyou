# 環境変数管理ルール

## 対象

- `SHEETS_WEBHOOK_URL`
- `SHEETS_SECRET_TOKEN`
- Vercel環境変数
- 将来的なAPIキー
- ローカル `.env`
- WSL2側のshell環境変数

## 基本ルール

- 実値をGitにコミットしない
- `.env.example` と `.env.hermes.example` にはダミー値のみを書く
- エラー報告時にも実値を貼らない
- CodexやHermesレポートに実値を出さない
- スクリーンショットやログにも実値が写らないようにする

## ローカル確認

- PowerShell: `$env:NAME`
- WSL2: `echo $NAME`
- チェック: `npm run check:sales-env`

## Vercel確認方針

Vercel環境変数はVercel管理画面で人間が確認する。Codex/Hermesは必要な変数名と確認項目の整理までに留める。

## ローテーションが必要なケース

- Gitに混入した疑い
- 外部共有した疑い
- 不審なWebhook実行
- 退職/外注終了など権限変更

## 漏えい疑い時の初動

値を再表示せず、影響範囲を整理し、該当token/URL/keyの無効化または再発行を人間が判断する。

