# Instagram Automated Publishing Runbook

## 目的

画像、カルーセル、Reelsの投稿をAPIで公開できるようにする。ただし初期状態ではdry-runとblockedを既定にし、人間承認なしでは本番公開しない。

## 実装スクリプト

- npm run instagram:api:readiness
- npm run threads:api:readiness
- npm run instagram:post:prepare -- --id <post-id>
- npm run instagram:post:validate -- --id <post-id>
- npm run instagram:post:approve -- --id <post-id>
- npm run instagram:publish:preflight -- --id <post-id>
- npm run instagram:publish:dry-run -- --id <post-id>
- npm run instagram:publish -- --id <post-id>
- npm run instagram:publish:verify -- --id <post-id>

## 公開条件

- approvalStatus=approved
- publishStatus=ready
- approvalChecksumが現在のcaption/media/crossPostと一致
- media validation成功
- public URLがHTTPS、認証不要、secret queryなし、localhost/private IPではない
- idempotency履歴に同一postのpublished=trueがない
- publish window内
- INSTAGRAM_PUBLISH_ENABLED=true
- INSTAGRAM_DRY_RUN=false
- format別feature flagがtrue
- readiness scriptがblocked理由なし

## 対応フォーマット

- image: supported in client
- carousel: supported in client, 2〜10 itemで検証
- reel: supported in client, video item必須

## 未対応・needs_review

- Storiesは今回実装対象外。
- Product tagging、comments、DM、Insights自動取得は今回実装対象外。
- Graph APIのアカウント固有制限はMeta App設定後に確認する。

## 二重投稿防止

- data/instagram/publishing/publish-history.json を確認する。
- published=trueの同一idがある場合はblocked。
- 既存1〜6件目はpublished_manual / autoPublishEligible=falseとして記録済み。

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。


## rollback

- feature flagをfalseへ戻す。
- publishStatusをblockedまたはneeds_human_reviewへ戻す。
- Windows/Hermesの本番publishタスクは登録前なら登録しない。登録後なら停止手順に従う。
