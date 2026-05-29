# Google Apps Script Webhook運用ルール

## Apps Script側で確認すること

- `doPost` がpayloadを受け取れるか
- SECRET_TOKEN照合があるか
- headers/columnsがSheetsの1行目と一致しているか
- validationエラー時の返却内容
- deploy/redeploy済みか

## Web app URL更新時

Web app URLを再発行した場合は、ローカル環境変数を人間が更新する。URLの実値はGitに書かない。

## token mismatch時

SECRET_TOKEN不一致の可能性がある。値をチャットやdocsに貼らず、人間がApps Scriptとローカル設定を確認する。

## プルダウン不一致時

Sheets側の入力規則と `send-prospects.mjs` の許可値を確認する。業態は `美容室` を使う。

## Apps Script変更時

変更後は再デプロイし、テスト送信は人間確認後に1件だけ行う。

