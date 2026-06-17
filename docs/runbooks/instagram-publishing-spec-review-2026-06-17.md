# Instagram / Threads Meta API Spec Review 2026-06-17

## 一次資料

- Meta for Developers: Instagram Platform Content Publishing
- Meta for Developers: IG User Media reference
- Meta for Developers: Instagram content publishing limit reference
- Meta for Developers: Threads API Create Posts
- Meta for Developers: Threads API Posts

## 分類

### confirmed_supported

- Instagram image publishing
- Instagram carousel publishing
- Instagram Reels publishing
- Instagram media container creation
- Instagram media_publish
- Instagram container status polling
- Threads text/image/video/carousel publishing per official Threads docs

### confirmed_unsupported

- このrepoからのInstagram profile編集、highlight作成、DM/コメント/フォロー/いいね自動操作は対象外。
- Threads profile編集と固定投稿操作はAPI自動化対象外として扱う。

### permission_required

- Instagram content publishing permission
- Instagram basic/business profile permission
- Facebook Login経由ではPage接続とPages permissions
- Threads threads_basic / threads_content_publish

### app_review_required

- 本番公開でcontent publishing permissionsを使う場合。

### account_configuration_required

- Instagram Professional account
- Meta Developer App
- Facebook Page connection when using Facebook Login
- Live mode / Development mode確認

### manual_configuration_required

- token発行と更新
- public media URLのVercel公開確認
- App Review申請

### unknown_needs_review

- 現在の@ichi_socialアカウント設定
- 現在のMeta App審査状態
- token lifetime
- Page接続状態

## 共通安全方針

- Instagram本番投稿は人間承認とfeature flagが揃うまで実行しない。
- Threads本番投稿は既存Threads運用と衝突しない場合のみ、別途承認後に行う。
- APIトークン、App ID、App Secret、User ID、Page IDの実値はdocs、ログ、Gitに残さない。
- APIレスポンス全文、caption全文、署名付きURL、Graph API URL全文をログ保存しない。
- Gmail送信、Google Sheets更新、DM、コメント、フォロー、いいねは行わない。
