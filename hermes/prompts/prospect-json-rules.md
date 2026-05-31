# 見込み客JSON作成ルール

Hermes AgentがICHI Socialの営業スプレッドシート投入用JSONを作るときは、このルールに従うこと。

## JSON形式

```json
{
  "rows": []
}
```

`rows` には、以下の列をすべて持つオブジェクトを入れる。

## 列定義

- 店名
- 業態
- 地域
- 概要
- 相性スコア
- スコア理由
- 課題仮説
- 問い合わせフォームURL
- 連絡手段
- 出典URL
- 出典種別
- ステータス
- 送信日
- 反応
- 次アクション日
- Instagram URL
- Instagramユーザー名
- Instagramフォロワー数
- フォロワー区分
- 最終投稿確認日
- Instagram運用課題
- Instagram営業優先度
- Instagram営業切り口
- 手動DM文案
- 手動コメント案
- 自社コンテンツ提案余地

## プルダウン値

業態:

- 美容室
- ネイル/アイラッシュ
- 整体
- カフェ・飲食

相性スコア:

- A
- B
- C

出典種別:

- SNS
- 公式サイト
- 予約フォーム
- Instagram

ステータス:

- 未検収
- 検収済
- 除外
- 送信済
- 返信あり
- 商談化
- 反応なしクローズ

フォロワー区分:

- under_500
- 500_999
- 1000_1999
- 2000_4999
- 5000_over
- unknown

Instagram営業優先度:

- A
- B
- C
- 除外

## Instagram項目の英語キー

Instagram営業候補JSONでは、以下の英語キーも使用できます。`scripts/sheets/send-prospects.mjs` は既存A〜O列の日本語キーと英語キーをGoogle Sheets列へ変換します。

- `instagramUrl`
- `instagramUsername`
- `instagramFollowers`
- `followerSegment`
- `instagramLastPostCheckedAt`
- `instagramIssueHypothesis`
- `instagramSalesPriority`
- `instagramSalesAngle`
- `manualDmDraft`
- `manualCommentDraft`
- `selfContentOpportunity`

`instagramFollowers` は数値または `null` にします。確認できない場合は `null`、`followerSegment` は `unknown` にし、推測で埋めません。

## 初期投入時のルール

- 相性スコアはA中心にする
- ステータスは `未検収`
- 送信日、反応、次アクション日は空欄にする
- 問い合わせフォームURLが不明なら空欄にする
- 連絡手段は `未確認` でよい
- 架空URLや架空実績は入れない
- 出典URLには実際に確認した公開ページを入れる
- 出典種別は公開情報の種類に応じて選ぶ
- Instagram起点候補は出典種別を `Instagram` にする
- 営業不可と明記された問い合わせフォームは候補から除外する
- 同一店舗や同一URLの重複を避ける
- 出典URLが一覧ページしかない候補は除外する
- 実在確認が弱い候補は除外する

## ターゲティングルール

- 個人店・小規模店舗・単独店舗を優先する
- 店舗単独の公式サイトまたはInstagramがある候補を優先する
- Instagramアカウントが確認でき、フォロワー数2,000人未満の小規模店舗を優先する
- フォロワー数2,000〜5,000人程度はB候補として扱う
- フォロワー数5,000人以上で既に運用が強い候補はCまたは除外にする
- Instagram運用課題、営業切り口、手動DM文案、手動コメント案を記録する
- 問い合わせフォーム、メール、Instagram DM、LINE、電話などの連絡導線が確認できる候補を優先する
- チェーン、FC、多店舗ブランド、本部運営色が強い店舗は除外または後回しにする
- ブランド全体・他地域店舗込みの総合SNSしかない店舗は除外する
- 営業不可、DM不可、問い合わせ不可の記載がある候補は除外する
- ICHI Socialの営業入口は「無料簡易SNS診断」にする
- 架空の実績、導入社数、成果保証表現は使わない

## 対象地域

- 川口市
- 蕨市
- 戸田市
- さいたま市南区
- さいたま市浦和区
- 東京都北区
- 東京都板橋区
- 赤羽
- 足立区
- 荒川区
- 豊島区
- 練馬区
- 和光
- 朝霞
- 草加
- 越谷

将来的な拡張候補:

- 足立区
- 荒川区
- 練馬区
- 豊島区
- さいたま市中央区
