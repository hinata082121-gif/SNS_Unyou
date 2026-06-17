# Instagramコンテンツ運用Runbook

## 目的

ICHI SocialのInstagramを、Threadsとは役割を分けて運用する。
Threadsは短い気づきと会話、Instagramは図解、保存、比較、チェックリストを担当する。

## 正式アカウント

- handle: `@ichi_social`
- profile URL: `https://www.instagram.com/ichi_social/`

## 初期運用方針

- 本番投稿は人間が承認して手動で行う
- 自動投稿、予約投稿、DM、コメント、フォロー、いいねは行わない
- 実績、顧客事例、レビューを作らない
- 成果保証、煽り、不安を過度に強める表現を使わない
- 投稿はInstagram単体でも価値が成立する形にする
- Threadsへ展開する場合も、Instagramだけに価値を閉じ込めない

## 投稿制作フロー

1. `config/instagram/brand.json` を確認する
2. `data/instagram/drafts/initial-12-posts-2026-06-17.json` のdraftを確認する
3. `npm run instagram:content:validate` を実行する
4. `docs/content/instagram-design-specs.md` を見てCanvaまたは画像生成で素材化する
5. 人間がデザイン、本文、CTA、ハッシュタグを確認する
6. 必要に応じてThreads展開文を調整する
7. 人間がInstagramアプリまたは正式な管理画面で投稿する
8. 投稿後は安全なKPIだけをAgent Officeに記録する

## Hermes連携方針

今回、Hermes/Windows Task Schedulerの新規登録は行わない。
将来タスク案は以下に留める。

- 08:30 content readiness
- 09:00 publish preparation
- 12:30 result check
- 18:00 next content preparation

Hermesが担当してよいこと:

- 投稿企画生成
- caption検証
- 禁止表現検証
- 重複テーマ検証
- メディア存在確認
- 投稿予定確認
- 投稿後結果確認
- KPI記録
- Agent Office更新

Hermesが行わないこと:

- Instagram本番投稿
- 予約投稿
- DM/コメント/フォロー/いいね
- パスワード入力
- 非公式ブラウザ操作
- Gmail送信
- Google Sheets本番更新

## Git管理

Git追加してよいもの:

- `config/instagram/*.json`
- `data/instagram/drafts/*.json` の安全な自社draft
- `data/instagram/reels/*.json` の安全な企画
- `scripts/instagram/*.mjs`
- `docs/runbooks/instagram-*.md`
- `docs/content/instagram-*.md`
- Agent Statusの安全なJSON

Git追加しないもの:

- `.env`
- `.env.local`
- 認証値
- 実投稿ログ
- 顧客情報
- Gmail営業データ
- `data/gmail/`
- `data/prospects/`
- `docs/reports/sales/`
- `tmp/`

## 投稿開始前チェック

- 12投稿すべてdraftである
- captionが空でない
- altTextが空でない
- 禁止表現がない
- `@ichi_social` とURLが正式値である
- Canva/画像素材が人間確認済み
- API投稿を使う場合はMeta公式要件を満たす
- 本番投稿許可を人間が明示している
