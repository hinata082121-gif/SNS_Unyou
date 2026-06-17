# Instagram制作指示書

## 共通仕様

- canvas size: 1080 x 1350
- slide size: 4:5縦長
- export format: PNG
- filename: `assets/instagram/{postId}/slide-XX.png`
- 背景: 白ベース
- accent: 淡い青または水色
- heading: 濃紺
- body: 読みやすい濃いグレー
- 余白: 広め
- 1スライド1メッセージ
- スマホ表示で読める文字サイズ
- 写真素材に依存しない
- 線画またはフラットアイコン

## レイアウト

### 1枚目

- title area: 上部40%
- body area: 中央30%
- footer: 下部に `@ichi_social`
- page number: 右下
- visual style: 見出し優先、文字を詰め込みすぎない

### 2枚目以降

- heading: 上部
- body: 中央
- icon/illustration: 右下または背景に薄く配置
- footer: `ICHI Social / @ichi_social`
- page number: `2/6` のように表示

### 最終ページ

- 要点まとめ
- 保存推奨
- プロフィールまたは無料診断への自然な導線
- 成果保証や強い営業表現は入れない

## フォント階層

- H1: 大きく、太字
- H2: 中見出し
- Body: 2〜3行以内
- Caption補助: 小さめ

## アクセシビリティ

- 低コントラストを避ける
- 重要テキストを画像だけにしない
- alt textは各slideの `accessibilityText` を使う
- 色だけで意味を伝えない

## 投稿別制作参照

制作対象のslide構成、visualInstruction、iconSuggestion、alt textは以下を参照する。

```text
data/instagram/drafts/initial-12-posts-2026-06-17.json
```

## 禁止表現

- 絶対
- 必ず売上が上がる
- 集客保証
- 誰でも稼げる
- 放置で成功
- 過度に不安を煽る文言

## Canva/画像生成へ渡す時の注意

- 実在顧客名、営業先名、メールアドレスを入れない
- 架空レビューや架空実績を作らない
- スクリーンショット風にする場合も実在アカウントに見せない
- 投稿前に人間が本文、デザイン、CTAを確認する
