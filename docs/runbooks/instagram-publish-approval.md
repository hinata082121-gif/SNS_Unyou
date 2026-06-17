# Instagram Publish Approval Runbook

## 目的

人間承認なしの本番投稿を防ぐ。

## 承認コマンド

npm run instagram:post:approve -- --id <post-id>

## 承認で変わる項目

- approvalStatus=approved
- publishStatus=ready
- approvedAt
- approvedBy=human
- approvalChecksum

## 再承認が必要な変更

- caption
- hashtags
- media.items
- publicUrl
- crossPost.text
- crossPost.mediaMode

## 本番前preflight

npm run instagram:publish:preflight -- --id <post-id>

safeToPublish=falseの場合は公開しない。

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
