# Instagram営業候補抽出プロンプト

## 目的

Instagram起点で、地域密着型の小規模店舗・中小規模事業者の営業候補を抽出し、フォロワー5,000人未満を基本条件に営業候補JSONとリサーチレポートを作る。

フォロワー2,000人以下は引き続き有望だが必須条件ではない。フォロワー数不明でも、Instagram URLがあり改善余地が明確な場合はB候補としてよい。5,000人以上が確認できた場合は原則除外し、投稿停止・導線崩壊・採用課題が明確な場合のみC候補として参考記録に留める。

大量スクレイピング、不自然な自動取得、Instagramログイン、DM送信、コメント投稿、フォロー、いいねは行わない。公開プロフィールを人間検収できる形で整理する。

## 出力

```text
data/prospects/YYYY-MM-DD-instagram-prospects.json
docs/reports/sales/research/YYYY-MM-DD-instagram-sales-list.md
```

## 対象業態

第1優先:

- パーソナルジム
- ピラティススタジオ
- ヨガスタジオ
- ペットサロン
- トリミングサロン
- フォトスタジオ
- 写真館
- 整骨院
- 鍼灸院
- リラクゼーションサロン

第2優先:

- 工務店
- リフォーム会社
- 外構業者
- インテリア/整理収納
- 学習塾
- 習い事教室
- ダンススクール
- 音楽教室
- パーソナルカラー/骨格診断
- ブライダル関連小規模事業者

継続対象:

- 美容室
- ネイルサロン
- アイラッシュサロン
- 整体
- カフェ
- 小規模飲食店

対象外または後回し:

- 医療機関、歯科、美容医療、不動産、士業、BtoB製造業、金融/保険、投資関連、採用代行/マーケティング会社、SNS運用代行会社

## 対象エリア

第1優先:

- 足立区
- 荒川区
- 豊島区
- 練馬区
- 和光
- 朝霞
- 草加
- 越谷
- 中野区
- 杉並区
- 世田谷区
- 江東区
- 墨田区
- 台東区
- 文京区

第2優先:

- 埼玉南部の駅近エリア
- 東京23区内の小規模店舗密集エリア
- 住宅地近接の地域密着型商圏

優先度を下げる:

- 川口
- 蕨
- 戸田
- 赤羽
- 北区
- 板橋区

## 選出条件

- Instagramアカウントがある
- フォロワー5,000人未満を営業対象にする
- 店舗または事業単独アカウント
- 小規模店舗/中小規模事業者らしい
- 投稿設計、プロフィール、固定投稿、ハイライト、予約/問い合わせ導線、実績訴求に改善余地がある
- 予約、問い合わせ、来店、体験申込、採用、資料請求などの導線がある
- 営業禁止/DM禁止/問い合わせ禁止の明記がない
- 中小企業全般へ無制限に広げず、Instagram運用が売上・予約・問い合わせ・採用・信頼形成に直結しやすい業種に限定する

## A/B/C判定

- A: フォロワー5,000人未満を公開情報で確認済み、Instagram URLあり、単独アカウント、改善余地が明確、既存候補と重複なし
- B: Instagram URLあり、フォロワー数未確認または5,000人未満の可能性が高いが数値未確認、改善余地あり、既存候補と重複なし
- C/除外: 5,000人以上、運用が強い、チェーン/FC/本部、大手、同業、営業禁止、実態不明、既存候補と重複

## 重複除外

候補生成前に必ず以下を照合する。

- Google Sheets CSVまたはSheets読み取り結果
- 既存JSON
- 既存レポート
- 暫定/正式重複除外台帳
- Instagram URL
- Instagramユーザー名
- 出典URL
- 店名+地域
- 店名のみの近似一致

ステータスが `未検収`、`検収済`、`除外`、`送信済`、`返信あり`、`商談化`、`反応なしクローズ`、`未送信` のものは再出力禁止。スプシに存在する店舗は原則すべて再出力しない。

通常運用ではCSVまたは重複除外台帳がない場合は候補生成を停止する。緊急時のみ、人間が明示的に許可した場合に限り、CSV未参照の制約を明記して暫定台帳で継続する。

## 出力バランス

- 目標10件
- A候補を優先し、不足時はB候補を含めてよい
- C候補は営業対象に含めない
- 同一業種が10件中5件を超えないようにする
- 同一エリアが10件中5件を超えないようにする
- Instagram URL確認率100%を目指す
- フォロワー数確認率は無理に100%にしない
- フォロワー数を推測しない

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
- `followerSegment` は `under_2000`, `under_5000`, `over_5000`, `unknown`
- `instagramSalesPriority` は `A`, `B`, `C`
- `manualDmDraft` は人間が手動送信するための下書き
- `manualCommentDraft` も人間が判断するための下書き。コメント営業は原則推奨しない

## 業種別営業切り口

- パーソナルジム/ピラティス/ヨガ: 体験予約導線、Before/After、お客様の声、講師の人柄、初回体験訴求
- ペットサロン/トリミング: 施術後写真、地域の飼い主向け発信、予約導線、季節キャンペーン、紹介投稿
- フォトスタジオ/写真館: 撮影事例、七五三/成人式/家族写真、予約導線、お客様の声、ハイライト整理
- 整骨院/鍼灸/リラクゼーション: 症状別投稿、初回予約導線、先生/スタッフの人柄、信頼形成。医療効果は断定しない
- 工務店/リフォーム/外構: 施工事例、Before/After、相談導線、地域密着の信頼形成、お客様の声
- 学習塾/習い事教室: 教室の雰囲気、講師紹介、保護者向け安心材料、体験申込導線、生徒実績
- 美容室/ネイル/アイラッシュ: 施術事例、メニュー/価格/所要時間、予約導線、スタッフの人柄
- カフェ/小規模飲食店: メニュー、季節商品、店内雰囲気、営業時間/場所/イベント告知

## 重要ルール

- Google Sheets投入はしない
- `scripts/sheets/send-prospects.mjs` は実行しない
- 営業送信、Instagram DM、コメント、フォロー、いいね、フォーム送信は行わない
- Instagramログイン情報、Cookie、APIキー、SECRET_TOKEN、Webhook URLは扱わない
- 架空URL、架空情報、フォロワー数の推測は使わない

## 0件防止の成功条件

Instagram営業候補抽出では、候補0件を成功扱いしない。JSONまたはMarkdownレポートが作成されても、A/B候補数が0件なら `失敗/未達` として記録し、`emergency_refill_mode` に切り替える。

- 目標: A/B候補10件
- 最低実用ライン: A/B候補8件以上
- 1〜7件: 候補不足として探索Tierを拡張する
- 8〜9件: 実用可だが補完候補を追加で探す
- 10件以上: 完了
- C/除外候補は営業候補JSONに含めず、レポートの参考記録に分ける

## 通常探索フェーズ

通常探索では、Instagramフォロワー5,000人未満、店舗/事業単独アカウント、Instagram URLあり、改善余地あり、既存候補と重複なし、営業禁止/DM不可/問い合わせ禁止なしの候補を優先する。

対象業種は、パーソナルジム、ピラティス、ヨガ、ペットサロン、トリミングサロン、フォトスタジオ、写真館、整骨院、鍼灸院、リラクゼーション、工務店、リフォーム、外構、インテリア/整理収納、学習塾、習い事教室、ダンススクール、音楽教室、パーソナルカラー/骨格診断、ブライダル関連小規模事業者、美容室、ネイル/アイラッシュ、整体、カフェ/小規模飲食店とする。

第1優先エリアは、足立区、荒川区、豊島区、練馬区、和光、朝霞、草加、越谷、中野区、杉並区、世田谷区、江東区、墨田区、台東区、文京区とする。第2優先は、埼玉南部、東京23区内の小規模店舗密集エリア、住宅地近接の地域密着型商圏とする。

## 探索Tier

10件に満たない場合は、以下の探索Tierを順番に実行する。

### Tier 1: 業種拡張

整体以外のボディケア、小規模エステ、小規模サウナ/温浴関連、スポーツスクール、キッズスクール、料理教室、花屋、雑貨店、セレクトショップ、ベーカリー、テイクアウト専門店、小規模ホテル/民泊/ゲストハウス、地域密着の施工会社、採用に困っていそうな中小企業を追加する。ただし、予約、問い合わせ、来店、体験申込、採用、施工事例、信頼形成、人柄訴求にInstagramが直結しやすいものに限定する。

### Tier 2: エリア拡張

さいたま市全域、川越、所沢、志木、新座、ふじみ野、三郷、八潮、春日部、松戸、柏、市川、船橋、浦安、千葉市、横浜市北部、川崎市、東京23区全域へ広げる。既存候補が多い川口、蕨、戸田、赤羽、北区、板橋区は重複がない場合のみ使う。

### Tier 3: フォロワー条件の近似許容

フォロワー数不明でも、Instagram URLあり、小規模事業者らしい、投稿改善余地が明確、代表者/店舗単独アカウントらしい、5,000人以上と断定できない候補はB候補として許容する。この場合は `instagramFollowers: null`、`followerSegment: "unknown"`、`fitScore: "B"`、`instagramSalesPriority: "B"` とし、`fitReason` に `フォロワー数未確認のためB。人間検収で5,000人未満確認が必要` と書く。

### Tier 4: 近接条件の候補

Instagram運用が弱い、投稿頻度が低い、プロフィール導線が弱い、ハイライト整理不足、予約/問い合わせ導線が弱い、投稿素材はあるが設計されていない、地域密着型で営業対象として自然な候補をB候補として許容する。

## emergency_refill_mode

A/B候補が0件の場合は `emergency_refill_mode` を有効にする。

- CSVがなくても中止しない
- `CSV未設置のため完全照合未実施` と明記する
- ローカルJSON、レポート、台帳で最大限重複除外する
- Web検索で対象業種と対象エリアを広げる
- フォロワー数不明はB候補として許容する
- 最低8件、目標10件を出力する
- 既存候補と重複する疑いがあるものは出力しない
- Google Sheets投入、営業送信、Instagram DM、コメント、フォーム送信は行わない

## 出力ファイル

通常候補:

- `data/prospects/YYYY-MM-DD-instagram-prospects.json`
- `docs/reports/sales/daily/YYYY-MM-DD-instagram-sales-candidates.md`

緊急補完候補:

- `data/prospects/YYYY-MM-DD-instagram-prospects-emergency-10.json`
- `docs/reports/sales/daily/YYYY-MM-DD-instagram-emergency-sales-candidates.md`

0件インシデント:

- `docs/reports/infra/incidents/YYYY-MM-DD-sales-candidate-zero-output-incident.md`

## レポート必須項目

候補数、A候補数、B候補数、C/除外候補数、フォロワー5,000人未満確認済み件数、フォロワー数不明件数、Instagram URL確認率、重複除外件数、使用した探索Tier、候補不足の有無、候補不足時に試した拡張条件、CSV有無、Sheets投入していないこと、営業送信していないこと、人間検収で確認すべきことを必ず書く。

## Agent Operations Dashboard更新

作業開始時に `scripts/agent-status/update.mjs` で `running` を記録する。候補10件以上は `success`、8〜9件は `partial`、1〜7件は `needs_review`、0件は `blocked` にする。

metricsには `targetCount`、`actualCount`、`aCandidates`、`bCandidates`、`excludedCandidates` を可能な範囲で記録する。notesには `Google Sheets投入なし`、`営業送信なし` を残す。秘密情報はstatus JSONに入れない。
