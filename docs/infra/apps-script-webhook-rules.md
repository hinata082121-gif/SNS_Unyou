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

## Instagram営業列を追加する場合

既存A〜O列は維持し、P〜Zに以下のヘッダーを追加する。

- P: Instagram URL
- Q: Instagramユーザー名
- R: Instagramフォロワー数
- S: フォロワー区分
- T: 最終投稿確認日
- U: Instagram運用課題
- V: Instagram営業優先度
- W: Instagram営業切り口
- X: 手動DM文案
- Y: 手動コメント案
- Z: 自社コンテンツ提案余地

入力規則を設定する場合は以下に合わせる。

- フォロワー区分: `under_500`, `500_999`, `1000_1999`, `2000_4999`, `5000_over`, `unknown`
- Instagram営業優先度: `A`, `B`, `C`, `除外`
- 出典種別: 既存の `SNS`, `公式サイト`, `予約フォーム` に `Instagram` を追加

Apps Scriptがヘッダー名から列を解決している場合は、P〜Zのヘッダー名がJSON送信側と完全一致しているか確認する。列番号固定で処理している場合は、P〜Zを追記してもA〜Oの処理が壊れないように修正する。

Apps Scriptを修正した後は、必ずWebアプリを再デプロイする。Codex/HermesはApps Scriptの自動デプロイ、Webhook URL変更、SECRET_TOKEN変更を行わない。

## Apps Script変更時

変更後は再デプロイし、テスト送信は人間確認後に1件だけ行う。
