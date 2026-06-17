# Threads Instagram導線・メディア投稿基盤 2026-06-17

## 目的

Threads投稿を、単発投稿ではなくICHI Socialのプロフィール、固定投稿、Instagram保存コンテンツへ自然につながる運用へ拡張する。

今回の実装は以下に限定する。

- ブランド設定をGit管理できる安全な設定として追加
- Instagram CTAの挿入ルールを追加
- 投稿プランJSONへ任意の `media` フィールドを追加
- メディア検証基盤を追加
- 画像投稿のThreads API接続をfeature flagで追加
- 動画/カルーセルは初期運用では無効化

## 調査した既存構成

- 投稿プラン: `data/threads/post-plans/YYYY-MM-DD.json`
- 既存スキーマ: `date`, `posts[]`, `time`, `theme`, `text`, `cta`, `slotRole`
- 投稿作成: `scripts/threads/create-daily-post-plan.mjs`
- 3日分保証: `scripts/threads/ensure-rolling-post-plans.mjs`
- 投稿検証: `scripts/threads/validate-thread-posts.mjs`
- 投稿実行: `scripts/threads/publish-scheduled-thread.mjs`
- 成功/blocked記録: `data/threads/published/YYYY-MM-DD-slot.json`
- Windows Task: 10:50/18:50計画確認、11:00/19:00投稿、11:10/19:10確認
- Hermes cron: 既存no-agentジョブを保持

## 公式仕様確認

Meta公式Threads API/Postman collection/fbsamplesを一次資料として確認した。

- テキスト、画像、動画、カルーセル投稿はThreads APIの投稿フォルダに存在する
- 投稿はメディアコンテナ作成後に `threads_publish` する2段階
- 画像は `media_type=IMAGE`, `image_url`, `alt_text`
- 動画は `media_type=VIDEO`, `video_url`, `alt_text`
- カルーセルは子アイテムを `is_carousel_item=true` で作成し、親コンテナに `media_type=CAROUSEL` と `children` を渡す
- 画像/動画URLはMeta側が取得するため、公開サーバー上のURLが必要

参照元:

- Meta for Developers: Threads API posts
- Meta公式Postman collection: Threads API / Posting
- GitHub `fbsamples/threads_api`: Postman collection examples

プロフィール編集と投稿固定は、今回確認したThreads API投稿仕様・Postman collectionでは正式な自動操作として扱わない。
そのためプロフィール更新と固定投稿は手動Runbookで運用する。

## 投稿プランJSONの拡張

後方互換で `media` を任意追加する。

```json
{
  "date": "YYYY-MM-DD",
  "posts": [
    {
      "time": "19:00",
      "theme": "プロフィール改善",
      "text": "Threads単体でも完結する本文",
      "cta": "",
      "slotRole": "empathy_dm_guidance",
      "media": {
        "type": "none",
        "items": []
      }
    }
  ]
}
```

対応する `media.type`:

- `none`
- `image`
- `video`
- `carousel`

初期運用で本番公開できるのは `none` と、feature flagを有効化した `image` のみ。
`video` と `carousel` は公式仕様上の存在を確認済みだが、処理待機、失敗時リトライ、実メディア検証を本番運用で未確認のため無効化する。

## Instagram誘導ルール

Instagram handle/profile URLが未設定の場合:

- 架空handleを入れない
- Instagram CTAを自動挿入しない
- 通常のThreads本文生成は継続する
- validation上はInstagram CTAが含まれた場合のみneeds_review相当で落とす

CTA方針:

- 11時投稿はノウハウ/権威づけを優先し、Instagram CTAを原則入れない
- 19時投稿だけInstagram CTAを許可する
- CTA比率は25〜40%程度
- 同一CTAの連続使用は禁止
- Threads本文だけでも価値が完結すること

CTAテンプレート:

- 図解版はInstagramにまとめています。
- 保存用チェックリストはInstagramで公開しています。
- 実際の整理例はプロフィールのInstagramから確認できます。
- 画像で見返したい方向けにInstagramにも掲載しています。

## メディア検証

`scripts/threads/lib/media-validation.mjs` で検証する。

検査項目:

- HTTPS URLのみ許可
- `localhost`, private IP, metadata IPを拒否
- `file://` とローカルパスを拒否
- URL内のtoken/signature/key系クエリを拒否
- 画像は `.jpg`, `.jpeg`, `.png`
- 動画は `.mp4`, `.mov`
- altText必須
- carouselは2〜10件
- network検証時はHEAD/GETで取得可否とContent-Typeを確認
- リダイレクトは最大3回

失敗時:

- テキストだけへ自動フォールバックしない
- 投稿はblocked/needs_reviewにする
- ログにはURLや本文を残さず、件数とエラー種別だけを残す

## Feature Flags

値は `.env.local` などで管理し、Gitには入れない。

- `THREADS_MEDIA_PUBLISH_ENABLED`
- `THREADS_IMAGE_PUBLISH_ENABLED`
- `THREADS_VIDEO_PUBLISH_ENABLED`
- `THREADS_CAROUSEL_PUBLISH_ENABLED`

初期推奨:

- media: false
- image: false
- video: false
- carousel: false

画像本番テスト時だけ、人間確認後にmedia/imageを有効化する。

## Vercelメディア公開

MVPでは `public/threads-media/` 配下に静的画像を配置し、Vercel公開URLからHTTPSで配信する。

本番投稿前に確認すること:

- Vercel本番URLでHTTP 200
- Content-Typeが画像
- 署名URLや期限付きURLではない
- ローカルURLではない
- デプロイ前のURLを使わない

## Hermes/Windows Taskへの影響

既存の11時/19時投稿コマンドは維持する。

- 10:50/18:50: `threads:plan:ensure:rolling` と `threads:plan:validate`
- 11:00/19:00: `threads:post:11` / `threads:post:19`
- 11:10/19:10: `threads:post:validate` とhealth check

メディアなし投稿は従来通り動く。
メディア検証失敗時は公開せず、safe logに件数だけ残す。

## ロールバック

問題が起きた場合:

1. `THREADS_MEDIA_PUBLISH_ENABLED=false`
2. `THREADS_IMAGE_PUBLISH_ENABLED=false`
3. 投稿プランの `media.type` を `none` にする
4. `npm run threads:plan:validate`
5. `npm run threads:post:11` / `threads:post:19` はdry-runで確認

Gmail、Windows WakeToRun、Hermes Gateway設定は変更しない。
