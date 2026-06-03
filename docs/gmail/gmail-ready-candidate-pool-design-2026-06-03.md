# Gmail送信用候補プール設計

## 目的

毎日30件のGmail営業メール送信を安定させるため、公開メールアドレス確認済み候補を常時プール化する。

2026-06-04分は、既存メール付き候補がすべて2026-06-03送信済み候補と重複し、Gmail-ready候補が0件になった。これは単発エラーではなく、Instagram/フォーム中心の候補生成と、Gmail送信用候補の在庫管理が分離できていないことによる運用課題である。

## 2026-06-04がblockedになった理由

- 2026-06-03にGmail営業メール30件を送信済み
- 既存メール付き候補60件は2026-06-03送信済み候補と重複
- 既存候補118件はメール宛先なし
- Web追加収集は時間超過で中止
- 2026-06-04へ切り出せるGmail-ready候補が0件

## 毎日30件Gmail送信に必要な前提

- 送信当日前にGmail-ready候補が30件以上ある
- できれば2〜5営業日分の候補在庫がある
- 送信済み、返信あり、配信停止、送信禁止、重複を除外できる
- Google Sheetsへ貼り付けるTSVを短時間で作れる
- 30件未達の日は送信しない判断ができる

## 現在の候補生成の問題

既存の営業候補生成はInstagram URL、問い合わせフォーム、店舗情報の整理に寄っている。

Gmail送信には以下が必要だが、既存候補には不足しやすい。

- 公開メールアドレス
- メール掲載元
- メール形式検証
- 送信済み除外
- sendBatchId単位の切り出し

## Gmail送信用候補の定義

Gmail-ready候補は以下を満たす。

- 公開メールアドレスが確認できる
- 推測メールアドレスではない
- 公式サイト、公式SNS、店舗ページ等に掲載されている
- 事業名、業態、地域がある
- 課題仮説または提案角度がある
- 送信済み、返信あり、配信停止、送信禁止ではない
- 同一メール、同一事業者、同一dedupeKeyが重複していない
- 反社会的、風俗、医療広告上リスクが高い候補ではない

## 常時プール方式

Git管理禁止のローカルプールを作る。

- `data/gmail/pool/gmail-ready-candidate-pool.json`
- `data/gmail/pool/gmail-candidate-pool-registry.json`
- `data/gmail/pool/gmail-candidate-pool-excluded.json`

Git管理可の要約だけを残す。

- `docs/gmail/gmail-ready-candidate-pool-summary.md`

## 推奨プール数

| レベル | 件数 | 意味 |
|---|---:|---|
| 最低 | 30 | 当日1回分。これ未満なら送信blocked |
| 推奨 | 90 | 3営業日分。日次送信を安定させる |
| 理想 | 150 | 5営業日分。調査遅延に耐えやすい |

## pool項目

pool本体には以下を持たせる。メールアドレスや営業先情報を含むためGit追加禁止。

- `prospectId`
- `name`
- `businessType`
- `area`
- `email` / `contactEmail`
- `publicSource`
- `sourceUrl`
- `issueHypothesis`
- `salesAngle`
- `firstSeenAt`
- `lastCheckedAt`
- `status`
- `sendHistory`
- `dedupeKey`
- `sourceDomain`
- `safetyChecks`

## status

- `available`
- `reserved`
- `sent`
- `replied`
- `unsubscribed`
- `doNotContact`
- `invalid`
- `needsHuman`

## 毎日30件の切り出しルール

1. `available` の候補だけを見る
2. `sent/replied/unsubscribed/doNotContact/invalid/needsHuman` を除外
3. 同一メール、同一事業者、同一dedupeKeyを除外
4. 送信済みバッチと重複しない候補を選ぶ
5. 30件ちょうど切り出す
6. `sendDate`、`nextActionDate`、`sendBatchId` を付与する
7. outbox JSONとSheets貼り付け用TSVを作成する
8. pool側では対象候補を `reserved` にする

## 除外ルール

- 送信済み: `sent`
- 返信あり: `replied`
- 配信停止: `unsubscribed`
- 送信禁止: `doNotContact`
- メール不正: `invalid`
- 判断保留: `needsHuman`

## メールアドレス公開確認ルール

採用できる:

- 公式サイトの会社概要/店舗情報に掲載
- 公式SNSプロフィールに掲載
- 公式予約/店舗ページに掲載
- 店舗運営元ページに掲載

採用しない:

- 推測メール
- 画像内だけで読み取り困難なメール
- 問い合わせフォームのみ
- Instagram URLのみ
- 掲載元不明
- 送信可否が不明なもの

## Web追加収集の分割方針

前回はWeb検索が長時間化したため、今後は5〜10件単位で分割する。

- 1バッチの採用目標: 5〜10件
- 1バッチごとに保存
- タイムアウト時も途中結果を残す
- 採用/除外理由を記録
- 次バッチでは既存メール/ドメイン/事業者を除外

## Agent Officeでの管理

Agent Officeでは以下を表示する。

- pool available件数
- 最低30件を下回ったか
- 推奨90件を下回ったか
- 当日outbox作成可否
- 送信blocked理由
- 次に補充すべき業態/地域

## Git管理禁止ファイル

- `data/gmail/pool/`
- `data/gmail/outbox/`
- `data/gmail/logs/`
- `data/prospects/`
- `docs/reports/sales/`
- メールアドレス一覧
- 営業先一覧
- Google Sheets IDや秘密値を含むファイル

## 安全停止条件

- pool availableが30件未満
- daily outboxが30件ちょうどでない
- 重複がある
- メール形式不正がある
- 送信済みバッチと重複
- 配信停止/返信あり/送信禁止が混入
- 配信停止案内が本文にない
- Gmail残クォータ不足

