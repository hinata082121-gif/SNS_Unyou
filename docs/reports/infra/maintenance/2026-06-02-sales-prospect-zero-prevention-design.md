# 営業候補0件防止設計レポート

## 実行日時

2026-06-02 13:40:52 +09:00

## 背景

2026-06-02の12:00営業候補生成で、ジョブ自体は成功したものの候補数0件のレポートが出力された。その後の12:30補完チェックも、ファイル存在を中心に判定したため0件を解消できなかった。

## 2026-06-02に発生した問題

- 候補0件なのにジョブ成功扱いになった
- ファイルが存在するだけで補完チェックが完了扱いになった
- 条件に完全一致する候補がない場合に探索が止まった
- フォロワー数や業種条件が厳しすぎて候補が出なかった
- 同じ地域・同じ業種に探索が偏り、候補不足になった
- 緊急時の探索拡張ルールが不足していた

## 旧設計の問題点

- 日次候補生成の成功条件がファイル保存中心だった
- A/B候補数を必ず確認するルールが弱かった
- 8件未満、0件、10件未満の判定が明確ではなかった
- CSV未設置時の緊急補完方針が不十分だった
- フォロワー数不明候補をB候補として扱う条件が補完フローに十分接続されていなかった

## 新しい成功条件

- 目標はA/B候補10件
- 最低でもA/B候補8件以上を実用候補として出力する
- 8件未満の場合は `候補不足` として補完対象にする
- 0件の場合は `失敗/未達` として扱う
- ファイル存在だけでは完了扱いにしない
- レポート本文またはJSON内の候補件数を必ず確認する

## 候補数別の判定

- 0件: 失敗/未達。`emergency_refill_mode` で最低8件、目標10件を再探索する
- 1〜7件: 候補不足。探索Tierを広げて補完する
- 8〜9件: 実用可。ただし補完候補を追加で探す
- 10件以上: 完了。ただしA/B候補のみ、重複なし、営業禁止なしを確認する

## 探索Tier設計

通常探索で10件に満たない場合は、以下の探索Tierを順に広げる。

1. Tier 1: 業種拡張
2. Tier 2: エリア拡張
3. Tier 3: フォロワー条件の近似許容
4. Tier 4: 近接条件の候補

## 業種拡張ルール

通常探索では、パーソナルジム、ピラティス、ヨガ、ペットサロン、トリミングサロン、フォトスタジオ、写真館、整骨院、鍼灸院、リラクゼーション、工務店、リフォーム、外構、インテリア/整理収納、学習塾、習い事教室、ダンススクール、音楽教室、パーソナルカラー/骨格診断、ブライダル関連小規模事業者、美容室、ネイル/アイラッシュ、整体、カフェ/小規模飲食店を対象にする。

不足時は、ボディケア、小規模エステ、サウナ/温浴、スポーツスクール、キッズスクール、料理教室、花屋、雑貨店、セレクトショップ、ベーカリー、テイクアウト専門店、小規模宿泊、地域密着施工会社、採用に困っていそうな中小企業を追加する。ただし、予約、問い合わせ、来店、体験申込、採用、施工事例、信頼形成、人柄訴求にInstagram運用が直結しやすいものに限定する。

## エリア拡張ルール

通常探索の第1優先エリアは、足立区、荒川区、豊島区、練馬区、和光、朝霞、草加、越谷、中野区、杉並区、世田谷区、江東区、墨田区、台東区、文京区とする。

不足時は、さいたま市全域、川越、所沢、志木、新座、ふじみ野、三郷、八潮、春日部、松戸、柏、市川、船橋、浦安、千葉市、横浜市北部、川崎市、東京23区全域へ広げる。既存候補が多い川口、蕨、戸田、赤羽、北区、板橋区は重複がない場合のみ使う。

## フォロワー条件の近似許容

フォロワー数不明でも、Instagram URLあり、小規模事業者らしい、改善余地あり、5,000人以上と断定できない候補はB候補として許容する。

この場合は以下のように記録する。

- `instagramFollowers`: `null`
- `followerSegment`: `unknown`
- `fitScore`: `B`
- `instagramSalesPriority`: `B`
- `fitReason`: `フォロワー数未確認のためB。人間検収で5,000人未満確認が必要`

## 0件時の緊急補完モード

`emergency_refill_mode` では、CSVがなくても中止しない。ただし `CSV未設置のため完全照合未実施` と明記する。

- ローカルJSON、既存レポート、台帳で最大限重複除外する
- Web検索で対象業種と対象エリアを広げる
- フォロワー数不明はB候補として許容する
- 最低8件、目標10件を出力する
- 既存候補と重複する疑いがあるものは出力しない
- Google Sheets投入、営業送信、Instagram DM、コメント、フォーム送信は行わない

## 12:30/14:00補完チェックの新判定

12:30 / 14:00補完チェックでは、以下を確認する。

- 当日JSONが存在するか
- 当日レポートが存在するか
- 候補件数が何件か
- A候補数/B候補数/C除外候補数
- 候補数が8件以上か
- 0件の場合は失敗扱いになっているか
- A/B候補のみが営業候補JSONに入っているか
- C/除外候補が混入していないか
- 重複候補がないか
- 使用した探索Tier
- `emergency_refill_mode` の要否

## 出力ファイル設計

通常候補:

- `data/prospects/YYYY-MM-DD-instagram-prospects.json`
- `docs/reports/sales/daily/YYYY-MM-DD-instagram-sales-candidates.md`

緊急補完候補:

- `data/prospects/YYYY-MM-DD-instagram-prospects-emergency-10.json`
- `docs/reports/sales/daily/YYYY-MM-DD-instagram-emergency-sales-candidates.md`

インシデント:

- `docs/reports/infra/incidents/YYYY-MM-DD-sales-candidate-zero-output-incident.md`

## 人間検収で確認すべきこと

- フォロワー数不明B候補が5,000人未満に近いか
- Instagram URLが正しいか
- 店舗/事業単独アカウントか
- チェーン/FC/本部/同業ではないか
- 営業禁止、DM不可、問い合わせ禁止の記載がないか
- 既存候補と重複していないか
- 手動DM文案が自然か
- Google Sheets投入前に `未検収` として扱えるか

## 更新したファイル

- `docs/sales-targeting-rules.md`
- `data/prospects/prospects.template.json`
- `hermes/prompts/prospect-json-rules.md`
- `hermes/prompts/instagram-sales-list-builder.md`
- `hermes/prompts/instagram-prospect-scoring-review.md`
- `hermes/prompts/scheduled-daily-sales-candidates.md`
- `hermes/prompts/scheduled-research-refill-mon-wed.md`
- `docs/sales/daily-sales-candidates-output.md`
- `docs/hermes-scheduled-automation.md`
- `docs/quality/no-automation-boundary.md`
- `docs/infra/google-sheets-webhook.md`
- `docs/knowledge/document-index.md`
- `docs/knowledge/prompt-index.md`
- `docs/knowledge/task-index.md`
- `docs/knowledge/use-case-navigation.md`
- `docs/management/growth-experiment-log.md`
- `docs/management/kpi-definitions.md`

## 更新できなかったファイル

以下は存在しなかったため更新していない。

- `hermes/prompts/scheduled-sales-completion-check.md`
- `hermes/prompts/sales-candidate-refill-check.md`
- `hermes/prompts/daily-sales-candidates-builder.md`
- `hermes/prompts/sales-candidate-builder.md`

以下は未追跡の実運用インシデントレポートとして存在を確認したが、今回のコミット対象には含めない。

- `docs/reports/infra/incidents/2026-06-02-sales-candidate-zero-output-incident.md`

## 今回実行していないこと

- Google Sheets投入
- `scripts/sheets/send-prospects.mjs` 実行
- 営業メール送信
- Instagram DM送信
- Instagramコメント投稿
- Instagram自動投稿
- 自動フォロー/いいね
- 問い合わせフォーム送信
- Hermesタスク登録/削除/変更
- `.env` 変更
- GitHub Secrets変更
- Vercel環境変数変更

## 秘密情報を表示していないこと

秘密情報、認証情報、URL実値、APIキー、Cookie、Gmail app password、SNSログイン情報、口座情報、登録番号は表示・保存していない。
