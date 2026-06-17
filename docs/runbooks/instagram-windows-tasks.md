# Instagram Windows Tasks Runbook

## 方針

今回のcommitではWindows Task Schedulerへ実登録しない。既存Threads/Gmailタスクを壊さず、dry-run登録候補だけを文書化する。

## 登録候補

- ICHI-Instagram-Prepare-1130
- ICHI-Instagram-Readiness-1140
- ICHI-Instagram-Publish-1200
- ICHI-Instagram-Verify-1210
- ICHI-Instagram-ThreadsPrepare-1740

## 推奨設定

- WakeToRun=True
- StartWhenAvailable=True
- RunOnlyIfNetworkAvailable=True
- MultipleInstances=IgnoreNew
- WorkingDirectoryはリポジトリルート
- 共通run-scheduled-task.ps1を使用

## 既存Threads 19時タスクとの関係

Threads 19:00/19:10は既存タスクへの統合を優先する。重複slotがある場合はneeds_reviewにする。

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
