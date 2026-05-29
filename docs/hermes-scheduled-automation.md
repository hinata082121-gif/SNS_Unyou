# Hermes定期タスク設定手順

## 目的

Hermes AgentでICHI Socialの営業候補整理と新規候補リサーチを定期実行するための手順です。初期段階では、送信以外の自動化に限定します。

## 前提

- Hermes AgentはWSL2上で起動済み
- ICHI Socialリポジトリに移動できる
- `SHEETS_WEBHOOK_URL` と `SHEETS_SECRET_TOKEN` は必要時のみ設定する
- 営業メール、SNS DM、問い合わせフォーム送信は人間が行う

## Hermesの定期実行

Hermesはcronスケジューラに対応しています。Hermes CLI上で自然言語により定期タスクを登録します。

Gateway常駐を使う場合は、環境に応じて以下を利用します。

```bash
hermes gateway
hermes gateway install
```

Windowsがスリープしていると、WSL2上のHermesが動かない可能性があります。最初の1週間は、自動送信や自動ステータス更新をせず、候補整理とリサーチ結果の品質確認だけを行ってください。

## 毎朝9:00の営業候補10件

Hermes CLIに貼る登録文:

```text
毎日午前9時に、ICHI Socialの営業候補10件を作成してください。hermes/prompts/scheduled-daily-sales-candidates.md のルールに従い、送信は行わず、候補整理と文面下書きだけを行ってください。
```

このタスクでは、Googleスプレッドシートの自動更新も行いません。出力は、人間が確認・手動送信するための候補整理に限定します。

候補取得では、`data/prospects/*.json` を横断確認し、`expanded-area` 系JSONを優先します。さらに `docs/reports/sales/research/*.md` の最新リサーチレポートを参照し、10件未満の場合は対象地域内でWeb補助リサーチを行います。Web補助リサーチで見つけた候補は `新規候補` として扱い、スプレッドシートへ自動投入しません。

実行結果はHermes localに表示し、さらに以下へMarkdown保存します。

```text
docs/reports/sales/daily/YYYY-MM-DD-daily-sales-candidates.md
```

これにより、毎朝の候補リストを後から確認できます。送信やスプレッドシート更新は行いません。

既存スケジュールタスクの修正指示:

```text
これは通常の依頼ではなく、既存のHermes Agentスケジュールタスクの修正依頼です。

対象タスク:
ICHI Social 毎朝営業候補10件作成

Job ID:
bbf132ad0f05

現在のスケジュール:
毎日 9:00

修正内容:
今後は毎朝9:00の実行結果を、Hermes localに表示するだけでなく、Markdownファイルにも保存してください。

保存先:
docs/reports/sales/daily/YYYY-MM-DD-daily-sales-candidates.md

保存内容:
- 実行日
- 実行時刻
- 対象地域
- 対象業態
- 今日の営業候補10件
- 各候補の店名、業態、地域
- 個人店・小規模店らしい理由
- チェーン/FCではなさそうと判断した理由
- 連絡導線
- 送信前確認URL/SNS
- 営業不可・DM不可・問い合わせ不可の確認状況
- DM文面案
- メール件名案
- メール本文案
- 今日の推奨送信順
- 人間が確認すべきチェックリスト
- 除外・後回し候補
- 候補不足がある場合の理由
- 次アクション

重要ルール:
- 営業メール送信は行わない
- SNS DM送信は行わない
- 問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- scripts/sheets/send-prospects.mjs は実行しない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報は表示・保存・ログ出力しない
- 同名ファイルがある場合は上書きせず、-v2, -v3 を付けて保存する
- 修正後、登録済みスケジュールタスクの内容を表示してください
```

既存スケジュールタスクの候補取得改善指示:

```text
これは通常の依頼ではなく、既存のHermes Agentスケジュールタスクの修正依頼です。

対象タスク:
ICHI Social 毎朝営業候補10件作成

Job ID:
bbf132ad0f05

現在のスケジュール:
毎日 9:00

修正内容:
毎朝9:00の営業候補作成では、data/prospects/*.json を横断確認してください。
特に expanded-area 系JSONを優先してください。
docs/reports/sales/research/*.md の直近リサーチレポートも確認してください。

候補が10件に満たない場合は、以下の対象地域内でWeb補助リサーチを行い、新規候補としてレポートに記載してください。

対象地域:
- 川口市
- 蕨市
- 戸田市
- さいたま市南区
- さいたま市浦和区
- 東京都北区
- 東京都板橋区

対象業態:
- 美容室
- ネイル/アイラッシュ
- 整体
- カフェ・飲食

候補は以下に分類してください。
- 送信候補A
- 条件付き候補
- 新規候補
- 除外・後回し候補
- 候補不足

結果は以下へ保存してください。
docs/reports/sales/daily/YYYY-MM-DD-daily-sales-candidates.md

同名ファイルがある場合は上書きせず、-v2, -v3 を付けてください。

重要ルール:
- 営業メール送信は行わない
- SNS DM送信は行わない
- 問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- scripts/sheets/send-prospects.mjs は実行しない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報は表示・保存・ログ出力しない
- 架空URLや架空情報は使わない
- 候補の質が低い場合は無理に10件を満たさず、候補不足として理由を記録してください
- ただし、既存JSONだけを見て即0件で終了せず、Web補助リサーチまで行ってください

修正後、登録済みスケジュールタスクの内容を表示してください。
```

## 毎週月曜・水曜のリサーチ/リスト更新

Hermes CLIに貼る登録文:

```text
毎週月曜と水曜の午前10時30分に、ICHI Socialの新規営業候補をリサーチしてください。hermes/prompts/scheduled-research-refill-mon-wed.md と hermes/prompts/expanded-area-research-rules.md のルールに従い、東京都北区・板橋区を含む拡大地域から、個人店・小規模店舗を優先して候補JSONを作成してください。営業送信は行わず、スプレッドシート投入も人間確認後にしてください。
```

作成するJSONの保存先:

```text
data/prospects/YYYY-MM-DD-expanded-area-a.json
```

スプレッドシートに投入する場合も、必ず人間が内容確認してから以下を実行します。

```bash
node scripts/sheets/send-prospects.mjs data/prospects/YYYY-MM-DD-expanded-area-a.json
```

## ICHI Social 週次市場・競合分析

- 毎週金曜17:00
- 市場分析、競合分析、営業改善、サービス改善レポートを作成する
- `docs/reports/marketing/YYYY-MM-DD-weekly-market-analysis.md` に保存する
- 送信やGoogleスプレッドシート更新は行わない
- 競合情報は公開情報のみを使い、出典URLを残す
- 不明な情報は推測せず `不明` と書く

Hermes CLIに貼る登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次市場・競合分析

スケジュール:
毎週金曜 17:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-market-competitor-analysis.md のルールに従い、ICHI Socialの市場分析・競合分析・営業改善・サービス改善レポートを作成してください。

出力:
docs/reports/marketing/YYYY-MM-DD-weekly-market-analysis.md

重要ルール:
- 営業メール、SNS DM、問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報は表示しない
- 公開情報のみを使う
- 出典URLを残す
- 不明な情報は推測せず「不明」と書く
- 翌週の営業方針、リサーチ地域、文面改善、サービス改善案まで出す

この内容を毎週金曜17:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 毎日返信・商談レビュー

- 毎日18:30
- 返信あり・商談化候補を整理する
- 次の返信文、無料SNS診断、商談準備、次アクションを出す
- 送信やGoogleスプレッドシート更新は行わない
- `SECRET_TOKEN`、Webhook URL、APIキー、認証情報を表示しない

Hermes CLIに貼る登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 毎日返信・商談レビュー

スケジュール:
毎日 18:30

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/daily-reply-and-deal-review.md のルールに従い、その日の返信あり・商談化候補を整理してください。

重要ルール:
- 営業メール送信は行わない
- SNS DM送信は行わない
- 問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報は表示しない
- 次の返信文案、無料SNS診断方針、商談準備、次アクションだけを出す

この内容を毎日18:30のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 週次クライアント運用レビュー

将来的な納品・制作部門タスク案です。

- 毎週月曜 11:30
- 契約中クライアントの投稿予定、素材待ち、確認待ち、月次レポート予定を整理する
- 送信や投稿操作は自動実行しない
- レポート作成のみ行う
- パスワード、SNSログイン情報、APIキー、認証情報は表示しない

Hermes CLIに貼る登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次クライアント運用レビュー

スケジュール:
毎週月曜 11:30

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-client-operation-review.md のルールに従い、契約中クライアントの投稿予定、素材待ち、確認待ち、月次レポート予定、遅延リスク、次アクションを整理してください。

重要ルール:
- クライアントへの連絡送信は行わない
- SNS投稿操作は行わない
- Googleスプレッドシートの自動更新は行わない
- パスワード、SNSログイン情報、APIキー、認証情報は表示しない
- 人間が対応すべきことを明確に分けてください

この内容を毎週月曜11:30のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次請求レビュー

将来的な法務・契約・請求部門タスク案です。現時点ではクライアントがいないため、すぐに登録せず、契約クライアントが発生してから登録します。

- 毎月25日 10:00
- 契約中クライアントの請求対象、金額、支払期限、未入金、翌月継続確認を整理する
- 請求書の下書きは作成するが、自動送付はしない
- 入金確認は人間が行う
- 実在の口座番号、登録番号、パスワード、APIキー、認証情報は表示しない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次請求レビュー

スケジュール:
毎月25日 10:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/billing-review.md のルールに従い、契約中クライアントの請求対象、金額、支払期限、未入金、翌月継続確認を整理してください。

出力:
docs/reports/admin/checklists/YYYY-MM-DD-billing-review.md

重要ルール:
- 請求書の下書きは作成してよいが、自動送付は行わない
- 入金確認は人間が行う
- クライアントへの自動連絡は行わない
- 実在の口座番号、登録番号、パスワード、APIキー、認証情報は表示しない
- 未確認情報は推測せず「未確認」と書く
- 人間が確認すべき請求、入金、継続確認の次アクションを明確にしてください

この内容を毎月25日10:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 週次KPIレビュー

将来的なKPI・経営管理部門タスク案です。現時点では実データが少ないため、すぐに登録せず、KPI入力値が蓄積してから登録します。

- 毎週日曜 18:00
- 営業・商談・売上・納品KPIを整理する
- 翌週の重点地域、重点業態、改善アクションを出す
- 自動送信、自動請求、自動ステータス更新はしない
- 不明な数値は推測せず「未入力」「未集計」と書く

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次KPIレビュー

スケジュール:
毎週日曜 18:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-kpi-review.md のルールに従い、ICHI Socialの営業・商談・売上・納品・改善KPIを整理してください。

出力:
docs/reports/management/weekly/YYYY-MM-DD-weekly-kpi-review.md

重要ルール:
- 営業メール送信、SNS DM送信、問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- 請求書自動送付や入金確認は行わない
- 契約判断、価格変更、クライアント連絡は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 不明な数値は推測せず「未入力」「未集計」と書く
- 翌週の重点地域、重点業態、改善アクション、人間が判断すべきことを出してください

この内容を毎週日曜18:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次経営レポート

将来的なKPI・経営管理部門タスク案です。現時点では実データが少ないため、すぐに登録せず、受注/請求/納品データが蓄積してから登録します。

- 毎月末日 18:00
- 月次の営業結果、商談、受注、MRR、請求、納品、リスク、翌月方針を整理する
- 自動送付や自動請求はしない
- 入力値ベースで整理し、不明な値は推測しない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次経営レポート

スケジュール:
毎月末日 18:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-management-report.md のルールに従い、ICHI Socialの月次営業結果、商談、受注、MRR、請求、納品、リスク、翌月方針を整理してください。

出力:
docs/reports/management/monthly/YYYY-MM-monthly-management-report.md

重要ルール:
- 営業送信、請求送付、入金確認、契約判断は行わない
- Googleスプレッドシートの自動更新は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 未入力値は推測せず「未入力」「未集計」と書く
- 翌月方針、リスク、意思決定事項、人間が判断すべきことを出してください

この内容を毎月末日18:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 日次全体ブリーフィング

将来的な全体統括部門タスク案です。現時点では営業部門の9:00自動実行安定性を確認中のため、すぐに登録せず、日次営業レポートが安定してから登録します。

- 毎日8:30
- 各部門の状況を横断し、今日の最重要タスク、ボトルネック、リスク、推奨アクションを出す
- 自動送信、自動ステータス更新、自動請求、自動連絡はしない
- Hermesには整理・要約・提案・レポート下書きまでを任せる

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 日次全体ブリーフィング

スケジュール:
毎日 8:30

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/daily-executive-briefing.md のルールに従い、ICHI Socialの各部門状況を横断して、今日の最重要タスク、ボトルネック、リスク、推奨アクションを整理してください。

出力:
docs/reports/executive/daily/YYYY-MM-DD-daily-executive-briefing.md

重要ルール:
- 営業メール送信、SNS DM送信、問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- 請求書送付、入金確認、契約判断、価格変更は行わない
- クライアントへの自動連絡、投稿操作、SNS権限操作は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 不明な情報は「未確認」と書き、人間が判断すべきことを分けてください

この内容を毎日8:30のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 週次全体レビュー

将来的な全体統括部門タスク案です。現時点ではすぐに登録せず、週次KPIレビューが安定してから登録します。

- 毎週日曜 19:00
- 部門別進捗、KPI、リスク、翌週方針、意思決定候補を整理する
- 自動実行はレポート作成のみ
- 人間が判断すべきことを明確に分ける

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次全体レビュー

スケジュール:
毎週日曜 19:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-executive-review.md のルールに従い、ICHI Social全体の部門別進捗、KPI、リスク、翌週方針、意思決定候補を整理してください。

出力:
docs/reports/executive/weekly/YYYY-MM-DD-weekly-executive-review.md

重要ルール:
- 営業送信、SNS DM送信、問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- 請求送付、入金確認、契約判断、価格変更は行わない
- クライアントへの自動連絡、投稿操作、SNS権限操作は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 翌週の重点テーマ、やめること、意思決定候補、人間が判断すべきことを出してください

この内容を毎週日曜19:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次全体レビュー

将来的な全体統括部門タスク案です。現時点ではすぐに登録せず、月次経営レポートが安定してから登録します。

- 毎月末日 19:00
- 月次の部門横断レビュー、売上見込み、MRR、受注/失注、来月方針を整理する
- 自動送付や外部連絡はしない
- 法務判断、税務判断、価格変更は人間が行う

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次全体レビュー

スケジュール:
毎月末日 19:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-executive-review.md のルールに従い、ICHI Social全体の月次部門横断レビュー、売上見込み、MRR、受注/失注、来月方針、意思決定候補を整理してください。

出力:
docs/reports/executive/monthly/YYYY-MM-monthly-executive-review.md

重要ルール:
- 営業送信、SNS DM送信、問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- 請求送付、入金確認、契約判断、価格変更は行わない
- クライアントへの自動連絡、投稿操作、SNS権限操作は行わない
- 法務判断、税務判断は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 来月方針、リスク、意思決定候補、人間が判断すべきことを出してください

この内容を毎月末日19:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 自社SNS月間カレンダー作成

将来的な自社SNS・広報部門タスク案です。現時点では営業9:00自動実行の安定確認中のため、すぐに登録せず、投稿運用を始める段階で登録します。

- 毎月1日 10:00
- 自社SNSの月間投稿カレンダーを作成する
- 架空実績や架空数値を使わない
- 自動投稿はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 自社SNS月間カレンダー作成

スケジュール:
毎月1日 10:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/self-sns-monthly-calendar-builder.md のルールに従い、ICHI Socialの自社SNS月間投稿カレンダーを作成してください。

出力:
docs/reports/pr/calendars/YYYY-MM-ichisocial-pr-calendar.md

重要ルール:
- SNSへの自動投稿は行わない
- 外部SNSアカウント操作は行わない
- 架空実績、架空数値、成果保証表現を使わない
- 実績掲載やスクリーンショット掲載は許可がある場合のみ扱う
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない

この内容を毎月1日10:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 自社SNS週次レビュー

将来的な自社SNS・広報部門タスク案です。

- 毎週金曜 18:00
- 今週の自社SNS投稿案、反応、改善点、翌週テーマを整理する
- 自動投稿や外部連絡はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 自社SNS週次レビュー

スケジュール:
毎週金曜 18:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/pr-weekly-content-review.md のルールに従い、自社SNSの投稿案、実施状況、反応、改善点、翌週テーマを整理してください。

出力:
docs/reports/pr/reviews/YYYY-MM-DD-pr-weekly-review.md

重要ルール:
- SNSへの自動投稿は行わない
- 外部SNSアカウント操作やクライアント連絡は行わない
- 反応が未入力の場合は推測しない
- 架空実績や架空数値を作らない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない

この内容を毎週金曜18:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social ショート動画台本作成

将来的な自社SNS・広報部門タスク案です。

- 毎週火曜 15:00
- TikTok/Reels/YouTube Shorts向けの短尺台本案を作成する
- 動画投稿はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social ショート動画台本作成

スケジュール:
毎週火曜 15:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/short-video-script-builder.md のルールに従い、TikTok/Reels/YouTube Shorts向けの短尺台本案を作成してください。

出力:
docs/reports/pr/scripts/YYYY-MM-DD-ichisocial-short-video-script.md

重要ルール:
- 動画投稿は行わない
- 外部SNSアカウント操作は行わない
- 成果保証、集客保証、売上保証をしない
- 医療/整体/美容/飲食の表現に注意する
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない

この内容を毎週火曜15:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 週次AI運用監査

将来的な品質管理・AI運用監査部門タスク案です。現時点では営業9:00自動実行の安定確認中のため、すぐに登録せず、AI生成物が増えてから登録します。

- 毎週土曜 10:00
- 今週作成されたAI生成物、禁止自動化違反、秘密情報混入、成果保証表現、架空実績、Hermes実行失敗を確認する
- レポートのみ作成する
- 自動修正や外部送信はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次AI運用監査

スケジュール:
毎週土曜 10:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-ai-ops-audit.md のルールに従い、今週作成されたAI生成物、禁止自動化違反、秘密情報混入、成果保証表現、架空実績、Hermes実行失敗を確認してください。

出力:
docs/reports/quality/audits/YYYY-MM-DD-weekly-ai-ops-audit.md

重要ルール:
- 自動修正後の自動公開/送信は行わない
- 営業送信、SNS投稿、請求送付、契約判断、価格変更は行わない
- 秘密情報を見つけても値を再表示せず、種類だけをマスキングして記録してください
- Level 4相当の問題はインシデント記録候補として整理してください

この内容を毎週土曜10:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 営業送信前品質レビュー

将来的な品質管理・AI運用監査部門タスク案です。

- 毎営業日 8:45
- 当日送信予定の営業候補と文面を確認する
- 送信可否、条件付き、除外を整理する
- 実際の送信はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 営業送信前品質レビュー

スケジュール:
平日 8:45

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/pre-send-sales-review.md のルールに従い、当日送信予定の営業候補と文面を確認し、送信可否、条件付き、除外を整理してください。

出力:
docs/reports/quality/reviews/YYYY-MM-DD-pre-send-sales-review.md

重要ルール:
- 実際の営業送信は行わない
- SNS DM送信や問い合わせフォーム送信は行わない
- Googleスプレッドシートの自動更新は行わない
- 営業不可、予約専用フォーム、チェーン/FC、本部運営の可能性を確認してください
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない

この内容を平日8:45のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 自社SNS公開前レビュー

将来的な品質管理・AI運用監査部門タスク案です。

- 毎週金曜 16:30
- 自社SNS投稿案・ショート動画台本を確認する
- 架空実績/成果保証/権利リスクを確認する
- 実際の投稿はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 自社SNS公開前レビュー

スケジュール:
毎週金曜 16:30

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/pr-content-quality-review.md のルールに従い、自社SNS投稿案・ショート動画台本を確認し、架空実績、成果保証、権利リスク、秘密情報混入を確認してください。

出力:
docs/reports/quality/reviews/YYYY-MM-DD-pr-content-quality-review.md

重要ルール:
- 実際のSNS投稿は行わない
- 外部SNSアカウント操作は行わない
- 架空実績、架空数値、実績の無断掲載、スクリーンショットの無断利用を止めてください
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報は表示しない

この内容を毎週金曜16:30のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 週次カスタマーサクセスレビュー

将来的なカスタマーサクセス部門タスク案です。現時点では実クライアントがいないため、すぐに登録せず、契約クライアントが発生してから登録します。

- 毎週木曜 17:00
- 契約中クライアントのヘルススコア、素材待ち、確認待ち、解約リスク、継続提案、アップセル余地を整理する
- 自動連絡はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次カスタマーサクセスレビュー

スケジュール:
毎週木曜 17:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/client-success-weekly-review.md のルールに従い、契約中クライアントのヘルススコア、素材待ち、確認待ち、解約リスク、継続提案、アップセル余地を整理してください。

出力:
docs/reports/cs/YYYY-MM-DD-client-success-weekly-review.md

重要ルール:
- クライアントへの自動連絡は行わない
- 継続提案やアップセル提案の自動送信は行わない
- 契約変更、価格変更、解約処理は行わない
- 請求書送付、入金確認、SNS投稿、SNS権限操作は行わない
- 秘密情報、認証情報、口座情報は表示しない

この内容を毎週木曜17:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 初月クライアントチェック

将来的なカスタマーサクセス部門タスク案です。現時点では実クライアントがいないため、すぐに登録せず、初回受注後に登録します。

- 毎営業日 16:00
- 契約開始から7日/14日/30日のクライアントがいないか確認する
- 必要なチェックレポートと連絡文面案を作成する
- 自動送信はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 初月クライアントチェック

スケジュール:
平日 16:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、契約開始から7日/14日/30日のクライアントがいないか確認し、必要に応じて hermes/prompts/client-7-day-check.md、hermes/prompts/client-14-day-check.md、hermes/prompts/client-30-day-check.md のルールに従ってチェックレポートと連絡文面案を作成してください。

出力:
docs/reports/cs/checks/YYYY-MM-DD-client-name-7-day-check.md
docs/reports/cs/checks/YYYY-MM-DD-client-name-14-day-check.md
docs/reports/cs/checks/YYYY-MM-DD-client-name-30-day-check.md

重要ルール:
- クライアントへの自動送信は行わない
- 契約変更、価格変更、解約処理は行わない
- 数値が取れない場合は未取得と書く
- 成果保証、集客保証、売上保証はしない
- 秘密情報、認証情報、口座情報は表示しない

この内容を平日16:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次継続提案レビュー

将来的なカスタマーサクセス部門タスク案です。

- 毎月20日 15:00
- 月次レポート後の継続提案、プラン変更、解約リスクを整理する
- 自動連絡や契約変更はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次継続提案レビュー

スケジュール:
毎月20日 15:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-client-success-review.md と hermes/prompts/renewal-proposal-builder.md のルールに従い、月次レポート後の継続提案、プラン変更、解約リスクを整理してください。

出力:
docs/reports/cs/monthly/YYYY-MM-client-name-success-review.md
docs/reports/cs/renewal/YYYY-MM-DD-client-name-renewal-proposal.md

重要ルール:
- クライアントへの自動連絡は行わない
- 継続提案やアップセル提案の自動送信は行わない
- 契約変更、価格変更、解約処理は行わない
- 請求書送付、入金確認は行わない
- 秘密情報、認証情報、口座情報は表示しない

この内容を毎月20日15:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## 禁止事項

- GmailやSNS DMの完全自動送信は初期段階では行わない
- 問い合わせフォーム送信を自動化しない
- Googleスプレッドシートを勝手に更新しない
- 請求書を自動送付しない
- 入金確認を自動化しない
- 契約判断や価格変更を自動決定しない
- クライアントへの自動連絡を行わない
- 継続提案、アップセル提案を自動送信しない
- 解約処理、契約変更を自動化しない
- 投稿操作を自動化しない
- SNS権限操作を自動化しない
- 法務判断、税務判断を自動化しない
- SNSへの自動投稿を行わない
- 架空実績、架空数値、実績の無断掲載、スクリーンショットの無断利用を行わない
- 自動修正後の自動公開、自動修正後の自動送信を行わない
- 秘密情報や口座情報を自動入力しない
- `SECRET_TOKEN`、Webhook URL、APIキー、認証情報を表示しない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易SNS診断」を入口にする
