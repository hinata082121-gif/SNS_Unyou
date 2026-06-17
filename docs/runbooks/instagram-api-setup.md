# Instagram API Setup Runbook

## 目的

ICHI SocialのInstagram API投稿を本番運用へ進める前に、Meta App、Professional account、権限、公開メディアURLを確認する。

## 公式仕様確認結果

### confirmed_supported

- Instagram Professional account向けの画像投稿。
- カルーセル投稿はmedia containerとchildrenの流れで公開可能。
- Reels投稿はvideo media containerとpublishの流れで公開可能。
- container status pollingとmedia_publishが必要。
- Threads APIはテキスト、画像、動画、カルーセル投稿に対応する公式ドキュメントがある。

### permission_required

- Instagram: content publishing系permission、基本プロフィール参照permission。
- Facebook Login経由ではFacebook Page接続とPages系permissionの確認が必要。
- Threads: threads_basic、threads_content_publish。

### app_review_required

- 本番ユーザーに対するcontent publish権限。
- insights、コメント、メッセージ等を扱う場合は追加review。

### account_configuration_required

- Instagram BusinessまたはCreatorなどProfessional account。
- Facebook Login経由の場合はFacebook PageとInstagramの接続。
- Meta Developer AppのDevelopment/Live mode確認。
- token lifetimeと更新手順の確認。

### unknown_needs_review

- 現在のMeta App審査状態。
- 現在のtoken期限。
- 現在のPage接続状態。
- 現在のInstagram User ID / Threads User ID取得状況。

## 必要な環境変数名

実値はこのファイルに書かない。

- INSTAGRAM_PUBLISH_ENABLED
- INSTAGRAM_DRY_RUN
- INSTAGRAM_IMAGE_PUBLISH_ENABLED
- INSTAGRAM_CAROUSEL_PUBLISH_ENABLED
- INSTAGRAM_REELS_PUBLISH_ENABLED
- INSTAGRAM_GRAPH_API_VERSION
- INSTAGRAM_GRAPH_BASE_URL
- INSTAGRAM_USER_ID
- INSTAGRAM_FACEBOOK_PAGE_ID
- INSTAGRAM_ACCESS_TOKEN
- INSTAGRAM_APP_ID
- INSTAGRAM_APP_SECRET
- INSTAGRAM_PUBLIC_MEDIA_BASE_URL
- THREADS_PUBLISH_ENABLED
- THREADS_DRY_RUN
- THREADS_MEDIA_PUBLISH_ENABLED
- THREADS_IMAGE_PUBLISH_ENABLED
- THREADS_VIDEO_PUBLISH_ENABLED
- THREADS_CAROUSEL_PUBLISH_ENABLED
- THREADS_API_VERSION
- THREADS_USER_ID
- THREADS_ACCESS_TOKEN
- THREADS_APP_ID
- THREADS_APP_SECRET
- THREADS_PUBLIC_MEDIA_BASE_URL

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。


## 次に人間が確認すること

1. Instagram accountがProfessional accountか確認する。
2. Facebook Login経由にする場合はFacebook Page接続を確認する。
3. Meta Developer AppのLive modeとApp Review状態を確認する。
4. 必要permissionを申請し、承認状態を確認する。
5. Vercel等の公開URLから画像・動画が認証なしで取得できることを確認する。
