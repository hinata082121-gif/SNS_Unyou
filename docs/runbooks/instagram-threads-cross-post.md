# Instagram Threads Cross-post Runbook

## 目的

Instagram投稿成功後に、Threads用短文を安全に準備し、既存Threads運用と衝突しない場合だけ連動投稿へ進める。

## 初期タイミング案

- Instagram公開: 12:00 JST
- Instagram結果確認: 12:10 JST
- Threads連動準備: 17:40 JST
- Threads連動投稿: 19:00 JST
- Threads結果確認: 19:10 JST

## 連動条件

- Instagram側publishStatus=published
- Threads crossPost.enabled=true
- Threads crossPost.approvalStatus=approved
- Threads crossPost.publishStatus=ready
- 既存Threads 19時投稿と衝突しない
- mediaModeがnone以外の場合はThreads media feature flagがtrue

## 失敗時

Instagram成功、Threads失敗の場合でもInstagram投稿は削除しない。Threadsのみretry対象にする。

## CTA比率

- 19時枠で条件付き許可。
- CTA比率は25〜40%を目安にする。
- 同じCTA文言の連続を避ける。
- 11時枠は原則CTAなし。

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
