# Instagram Automation Rollback Runbook

## 緊急停止

1. INSTAGRAM_PUBLISH_ENABLED=false
2. INSTAGRAM_IMAGE_PUBLISH_ENABLED=false
3. INSTAGRAM_CAROUSEL_PUBLISH_ENABLED=false
4. INSTAGRAM_REELS_PUBLISH_ENABLED=false
5. THREADS_PUBLISH_ENABLED=false
6. THREADS_MEDIA_PUBLISH_ENABLED=false

## Agent Office反映

- status=blocked
- livePublishExecuted=false
- nextActionに人間確認事項を明記

## してはいけないこと

- 投稿削除を自動実行しない
- Threads retryを自動連打しない
- APIレスポンス全文を保存しない

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
