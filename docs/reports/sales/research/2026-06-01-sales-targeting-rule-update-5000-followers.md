# 営業対象ルール変更レポート

## 実行日時

- 2026-06-01 19:50:16 JST (+0900)

## 変更理由

- 旧運用ではInstagramフォロワー2,000人以下を主な営業対象にしており、候補数を安定して確保しにくかった。
- ICHI Socialの営業対象を、Instagram運用が売上・予約・問い合わせ・採用・信頼形成に直結しやすい業種へ広げる必要がある。
- 一方で中小企業全般へ無差別に広げると、提案難易度や表現リスクが上がるため、業種とフォロワー条件を明文化した。

## 旧ルール

- フォロワー2,000人未満をA候補の中心にする。
- 2,000〜5,000人程度はB候補または条件付き候補として扱う。
- 対象業態は主に美容室、ネイル/アイラッシュ、整体、カフェ・飲食。
- 重複除外はあったが、候補生成前のCSV/台帳照合が一部プロンプトで明文化しきれていなかった。

## 新ルール

- Instagramフォロワー5,000人未満を営業対象にする。
- フォロワー500〜5,000人未満を主戦場にする。
- フォロワー2,000人以下は引き続き有望だが、必須条件ではない。
- フォロワー数不明でも、Instagram URLがあり改善余地が明確な場合はB候補としてよい。
- 5,000人以上は原則除外またはC候補扱い。
- 営業対象は、Instagram運用が売上・予約・問い合わせ・採用・信頼形成に直結しやすい業種に限定する。

## フォロワー条件

- A候補: フォロワー5,000人未満を公開情報で確認済み、Instagram URLあり、単独アカウント、改善余地明確、重複なし。
- B候補: Instagram URLあり、フォロワー数未確認または5,000人未満の可能性が高いが数値未確認、改善余地あり、重複なし。
- C候補/除外: 5,000人以上、運用が強い、チェーン/FC/本部、同業、営業禁止、実態不明、重複あり。
- フォロワー数は推測しない。公開情報として確認できた場合のみ数値を記録する。

## 追加対象業種

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

## 除外対象業種

- 医療機関
- 歯科
- 美容医療
- 不動産
- 士業
- BtoB製造業
- 金融/保険
- 投資関連
- 採用代行/マーケティング会社
- SNS運用代行会社

## A/B/C判定

- A: `under_2000` または `under_5000` で、公開情報でフォロワー5,000人未満を確認済み。改善余地が明確で、客単価/LTV/継続利用/紹介効果のいずれかが期待できる。
- B: `unknown`、またはフォロワー数未確認だがInstagram URLと改善余地がある。人間検収でフォロワー数と営業可否を確認する。
- C: `over_5000`、運用が強い、または営業対象外要素がある。原則営業対象には含めない。

## 重複除外ルール

以下の照合を維持・必須化した。

- Google Sheets CSVまたはSheets読み取り結果
- 既存JSON
- 既存レポート
- 暫定/正式重複除外台帳
- Instagram URL
- Instagramユーザー名
- 出典URL
- 店名+地域
- 店名のみの近似一致

ステータスが `未検収`、`検収済`、`除外`、`送信済`、`返信あり`、`商談化`、`反応なしクローズ`、`未送信` の場合は再出力禁止。スプシに存在する店舗は原則すべて再出力しない。

## 日次営業候補生成への影響

- 日次候補10件の確保がしやすくなる。
- A候補を5,000人未満基準へ広げるため、2,000人以下のみでは拾えなかった有望な地域店舗を扱える。
- B候補はフォロワー数未確認でも扱えるが、人間検収で数値・営業不可表記・店舗単独性を確認する。
- 同一業種が10件中5件、同一エリアが10件中5件を超えないようにし、美容/飲食/整体だけに偏らない。

## 期待される改善

- 候補不足の減少。
- パーソナルジム、ピラティス、ペットサロン、フォトスタジオ、整骨院、リフォーム/教室系など、SNS改善の提案が刺さりやすい業種への拡張。
- 予約導線、事例発信、信頼形成、採用広報を含む提案切り口の増加。
- 重複除外の明文化による、検収済み店舗の再出力防止。

## 注意点

- 中小企業全般へ無制限には広げない。
- 5,000人以上は原則除外。例外的にC候補として参考記録するだけで、営業対象には含めない。
- フォロワー数不明はAにしない。原則B候補。
- フォロワー数は推測しない。
- 通常運用ではCSVまたは重複除外台帳がない場合は候補生成を停止する。緊急時のみ人間が明示した場合に限り継続可能。
- 医療・整骨・鍼灸・リラクゼーション系では医療効果を断定しない。

## 更新したファイル

- `docs/sales-targeting-rules.md`
- `data/prospects/prospects.template.json`
- `hermes/prompts/prospect-json-rules.md`
- `hermes/prompts/instagram-sales-list-builder.md`
- `hermes/prompts/instagram-prospect-scoring-review.md`
- `hermes/prompts/scheduled-daily-sales-candidates.md`
- `hermes/prompts/scheduled-research-refill-mon-wed.md`
- `hermes/prompts/weekly-self-content-builder.md`
- `docs/sales/daily-sales-candidates-output.md`
- `docs/quality/no-automation-boundary.md`
- `docs/infra/google-sheets-webhook.md`
- `docs/infra/apps-script-webhook-rules.md`
- `docs/knowledge/document-index.md`
- `docs/knowledge/prompt-index.md`
- `docs/knowledge/use-case-navigation.md`
- `docs/management/growth-experiment-log.md`
- `docs/management/kpi-definitions.md`
- `docs/pr/content-pillars.md`
- `docs/pr/post-idea-bank.md`
- `docs/pr/self-sns-strategy.md`
- `docs/hermes-scheduled-automation.md`

## 更新できなかったファイル

- `docs/sales/sales-targeting-rules.md`: 存在しない。実在する `docs/sales-targeting-rules.md` を更新した。
- `hermes/prompts/daily-sales-candidates-builder.md`: 存在しない。
- `hermes/prompts/sales-candidate-builder.md`: 存在しない。
- 既存の過去日付レポートは履歴保持のため原則更新していない。

## Sheets投入していないこと

- Google Sheets投入はしていない。
- `scripts/sheets/send-prospects.mjs` は実行していない。

## 営業送信していないこと

- 営業メール送信、Instagram DM送信、Instagramコメント投稿、Instagram自動投稿、自動フォロー/いいね、問い合わせフォーム送信はしていない。

## 秘密情報を表示していないこと

- SECRET_TOKEN、Webhook URL、APIキー、OAuth URL、認証情報、Cookie、Gmail app password、SNSログイン情報、口座情報、登録番号は表示していない。
