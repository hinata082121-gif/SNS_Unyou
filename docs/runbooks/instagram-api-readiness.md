# Instagram API Readiness

## 目的

将来Instagram投稿をAPI化する場合の前提を整理する。
今回の実装では本番投稿スクリプトを追加せず、readiness確認とdraft検証に限定する。

## 参照した一次情報

- Meta for Developers: Instagram Platform Content Publishing
- Meta for Developers: Instagram Platform Overview
- Meta Instagram API Postman Collection
- Meta for Developers: IG User Media reference

## 確認済みの大枠

Meta公式資料では、Instagram Professional Accountを対象に、画像、カルーセル、Reelsなどのコンテンツ公開がコンテナ作成とpublishの流れで提供されている。
Facebook Login経由では、Professional Instagram AccountとFacebook Page連携が前提になる。
Instagram Login経由でもBusiness/CreatorなどProfessional account向けで、利用する権限やアプリ状態の確認が必要になる。

## 分類

### confirmed_supported

- 画像投稿用のmedia container作成
- カルーセル投稿用のmedia container作成
- Reels投稿用のmedia container作成
- container status polling
- media publish
- Professional account向けのinsights取得

### permission_required

- `instagram_basic` または `instagram_business_basic`
- `instagram_content_publish` または `instagram_business_content_publish`
- Facebook Login経由では `pages_show_list` と `pages_read_engagement`
- コメントやメッセージを扱う場合は追加権限

### app_review_required

- production運用でのcontent publishing権限
- insights、コメント管理、メッセージ管理を使う場合の該当権限

### account_configuration_required

- Instagram Professional Account
- BusinessまたはCreator設定
- Facebook Login経由の場合はFacebook Page連携
- Meta Developer App
- Development mode/Live modeの確認
- token lifetimeの確認

### manual_only

- 今回のリポジトリからのプロフィール文変更
- bio link変更
- ハイライト作成
- 初回デザイン承認
- 本番投稿開始判断

### unknown_needs_review

- 現在の`@ichi_social`が満たしている権限状態
- 現在のMetaアプリ審査状態
- 現在のtoken期限
- Stories投稿のアカウント別可否
- API投稿後の実インサイト取得範囲

## メディア要件方針

API投稿に進む場合、メディアはMeta側から取得可能なHTTPS URLである必要がある。
ローカルファイル、localhost、private IP、期限付きURL、認証付きURLは使わない。

検証する項目:

- HTTPS URL
- public access
- Content-Type
- image dimensions
- aspect ratio
- file size
- carousel item count
- Reels動画形式
- duration
- codec
- redirect
- timeout
- private IP拒否
- localhost拒否
- file URL拒否
- signed URL拒否
- altText
- caption

## 実装方針

今回追加したスクリプト:

- `npm run instagram:content:validate`
- `npm run instagram:media:validate`
- `npm run instagram:api:readiness`

本番publishスクリプトは今回追加しない。
追加する場合も、既定はpublish無効、dry-run有効、人間承認必須にする。

## 禁止事項

- 非公式ブラウザ自動操作
- パスワード自動入力
- スクレイピング
- 投稿の無断自動公開
- DM/コメント/フォロー/いいねの自動操作
- 認証値やAPIレスポンス全文の保存
