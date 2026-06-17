# Instagram初期12投稿

## 前提

- handle: `@ichi_social`
- profile URL: `https://www.instagram.com/ichi_social/`
- 全件draft
- 本番投稿なし
- 画像制作前の構成案
- 詳細なslide/caption/Threads展開文は `data/instagram/drafts/initial-12-posts-2026-06-17.json` を正とする

## 12投稿一覧

| No | id | title | pillar | format | slides | status |
|---|---|---|---|---|---:|---|
| 1 | `instagram-2026-06-17-01` | ICHI Socialとは | ブランド紹介 | carousel | 6 | draft |
| 2 | `instagram-2026-06-17-02` | SNSプロフィールで最初に確認したい3項目 | プロフィール改善 | carousel | 5 | draft |
| 3 | `instagram-2026-06-17-03` | プロフィールを見ても内容が伝わらない原因 | プロフィール改善 | carousel | 6 | draft |
| 4 | `instagram-2026-06-17-04` | 固定投稿に入れるべき3つの内容 | 固定投稿・ハイライト整理 | carousel | 5 | draft |
| 5 | `instagram-2026-06-17-05` | 予約方法が分かりにくいアカウントの特徴 | 予約・問い合わせ導線 | carousel | 6 | draft |
| 6 | `instagram-2026-06-17-06` | 投稿ネタがなくなる本当の原因 | 投稿ネタ・継続方法 | carousel | 5 | draft |
| 7 | `instagram-2026-06-17-07` | 毎日投稿より先に整えたいこと | 投稿ネタ・継続方法 | carousel | 5 | draft |
| 8 | `instagram-2026-06-17-08` | SNS運用が続かないときの確認項目 | 投稿ネタ・継続方法 | carousel | 6 | draft |
| 9 | `instagram-2026-06-17-09` | 小規模店舗向けSNS基本チェックリスト | 小規模店舗向けSNSチェックリスト | carousel | 6 | draft |
| 10 | `instagram-2026-06-17-10` | 投稿・ハイライト・プロフィールの役割分担 | 固定投稿・ハイライト整理 | carousel | 5 | draft |
| 11 | `instagram-2026-06-17-11` | 無料SNS整理診断で確認すること | サービス・無料診断案内 | carousel | 6 | draft |
| 12 | `instagram-2026-06-17-12` | 保存して見返すSNS整理メモ | 小規模店舗向けSNSチェックリスト | carousel | 5 | draft |

## 投稿比率

- 保存型ノウハウ: 約40%
- 共感・悩み整理: 約25%
- チェックリスト: 約20%
- サービス・無料診断案内: 約10%
- ブランド紹介: 約5%

## 運用ルール

- 営業投稿を連続させない
- 同じテーマを短期間で繰り返さない
- Threadsと完全な重複本文にしない
- Threadsでは要点、Instagramでは図解と保存用の詳細を出す
- 無料診断案内は自然なCTAに留める
- 実績がないものを実績として書かない

## 投稿前チェック

```bash
npm run instagram:content:validate
npm run instagram:media:validate
```

本番投稿は、画像制作、人間レビュー、プロフィール導線確認後に別途判断する。

## 初回公開3投稿の制作確定版

初回公開では、既存12本draftのうち以下3本を採用し、制作確定版として別ファイルに分離しました。

1. ICHI Socialとは
2. SNSプロフィールで最初に確認したい3項目
3. 無料SNS整理診断で確認すること

制作確定版データ: data/instagram/production-ready/initial-launch-3-posts-2026-06-17.json
Canvaコピー: docs/content/instagram-launch-3-canva-copy.md
プレビュー: docs/content/instagram-launch-3-preview.md

既存12本draftは全面書き換えせず、初回公開3本だけを個別にレビューできる状態にしています。
