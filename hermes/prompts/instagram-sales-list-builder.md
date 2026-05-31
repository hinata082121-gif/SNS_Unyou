# Instagram営業候補抽出プロンプト

## 目的

Instagram起点で、小規模店舗の営業候補を抽出し、フォロワー数2,000人未満を中心に営業候補JSONとリサーチレポートを作る。

大量スクレイピング、不自然な自動取得、Instagramログイン、DM送信、コメント投稿、フォロー、いいねは行わない。公開プロフィールを人間検収できる形で整理する。

## 出力

```text
data/prospects/YYYY-MM-DD-instagram-prospects.json
docs/reports/sales/research/YYYY-MM-DD-instagram-sales-list.md
```

## 対象業態

- 美容室
- ネイル/アイラッシュ
- 整体
- カフェ・飲食

## 対象エリア

- 川口
- 蕨
- 戸田
- さいたま市南区
- さいたま市浦和区
- 赤羽
- 北区
- 板橋区
- 足立区
- 荒川区
- 豊島区
- 練馬区
- 和光
- 朝霞
- 草加
- 越谷

## 選出条件

- Instagramアカウントがある
- フォロワー2,000人未満を優先
- 店舗単独アカウント
- 小規模店舗/個人店らしい
- 投稿またはプロフィールに改善余地がある
- 予約導線、問い合わせ導線、DM可否などの連絡導線が確認できる
- 営業禁止/DM禁止/問い合わせ禁止の明記がない

## 除外条件

- チェーン/FC/大規模店
- 本部アカウント
- 採用専用アカウントのみ
- 同業/SNS運用会社/マーケ会社
- DM禁止/営業禁止/問い合わせ禁止の明記
- 実態不明
- フォロワー5,000以上で既に運用が強い
- フォロワー数を確認できないのに推測で記録すること

## JSON項目

- name
- businessType
- area
- summary
- fitScore
- fitReason
- issueHypothesis
- contactFormUrl
- contactMethod
- sourceUrl
- sourceType
- status
- sentDate
- response
- nextActionDate
- instagramUrl
- instagramUsername
- instagramFollowers
- followerSegment
- instagramLastPostCheckedAt
- instagramIssueHypothesis
- instagramSalesPriority
- instagramSalesAngle
- manualDmDraft
- manualCommentDraft
- selfContentOpportunity

## 値ルール

- `sourceType` は原則 `Instagram`
- `status` は `未検収`
- `instagramFollowers` は公開プロフィールで確認できる場合のみ数値
- フォロワー数が不明なら `instagramFollowers` は `null`、`followerSegment` は `unknown`
- `followerSegment` は `under_500`, `500_999`, `1000_1999`, `2000_4999`, `5000_over`, `unknown`
- `instagramSalesPriority` は `A`, `B`, `C`, `除外`
- `manualDmDraft` は人間が手動送信するための下書き
- `manualCommentDraft` も人間が判断するための下書き

## 重要ルール

- Google Sheets投入はしない
- `scripts/sheets/send-prospects.mjs` は実行しない
- 営業送信、Instagram DM、コメント、フォロー、いいね、フォーム送信は行わない
- Instagramログイン情報、Cookie、APIキー、SECRET_TOKEN、Webhook URLは扱わない
- 架空URL、架空情報、フォロワー数の推測は使わない
