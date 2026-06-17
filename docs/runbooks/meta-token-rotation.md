# Meta Token Rotation Runbook

## 目的

Instagram/Threadsのtoken期限切れによる投稿失敗を防ぐ。実値は記録しない。

## 確認項目

- token種別
- 期限
- App mode
- App Review状態
- 必要permission
- 更新担当者

## 記録してよいもの

- tokenConfigured true/false
- expiresSoon true/false
- lastCheckedAt
- blockedReason

## 記録禁止

- token実値
- App Secret実値
- User ID実値
- Page ID実値
- APIレスポンス全文

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
