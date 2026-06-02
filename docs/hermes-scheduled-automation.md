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

## ICHI Social 週次ナレッジレビュー

将来的なナレッジ管理部門タスク案です。現時点では営業9:00自動実行の安定確認中のため、すぐに登録せず、docs/prompts/reportsの更新が増えてから登録します。

- 毎週日曜 20:00
- 今週追加/更新されたdocs、prompts、reportsを確認する
- 索引ズレ、古い情報、未整理ファイル、未追跡ファイルを整理する
- 自動コミットや自動削除はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 週次ナレッジレビュー

スケジュール:
毎週日曜 20:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-knowledge-review.md のルールに従い、今週追加/更新されたdocs、prompts、reportsを確認し、索引ズレ、古い情報、重複、未整理ファイル、未追跡ファイルを整理してください。

出力:
docs/reports/knowledge/reviews/YYYY-MM-DD-weekly-knowledge-review.md

重要ルール:
- 自動コミットは行わない
- 自動削除は行わない
- 未追跡ファイルを勝手に追加しない
- 秘密情報を含む可能性があるファイルを自動公開しない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 人間が確認すべき更新、索引反映、アーカイブ候補を分けてください

この内容を毎週日曜20:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次ドキュメント棚卸し

将来的なナレッジ管理部門タスク案です。

- 毎月末日 20:00
- 古くなったドキュメント、重複、矛盾、更新が必要な索引を確認する
- 自動削除はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次ドキュメント棚卸し

スケジュール:
毎月末日 20:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/outdated-docs-review.md のルールに従い、古くなったドキュメント、重複、矛盾、更新が必要な索引を確認してください。

出力:
docs/reports/knowledge/reviews/YYYY-MM-DD-outdated-docs-review.md

重要ルール:
- 自動削除は行わない
- 自動コミットは行わない
- 最新方針と矛盾する可能性がある箇所を人間確認事項として整理してください
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない

この内容を毎月末日20:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social トラブルシューティング支援

必要時に手動実行するナレッジ管理部門タスク案です。

- エラーログや失敗内容をもとに確認ファイルと初動を整理する
- コマンド実行は人間確認前提
- 秘密情報の値は再表示しない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentのトラブルシューティング支援タスクです。

作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/troubleshooting-helper.md のルールに従い、入力したエラーログや失敗内容から、症状、可能性の高い原因、確認するファイル、確認するコマンド、初動、やってはいけないこと、人間判断が必要なことを整理してください。

出力:
docs/reports/knowledge/troubleshooting/YYYY-MM-DD-troubleshooting.md

重要ルール:
- コマンド実行は人間確認前提にしてください
- 秘密情報を見つけても値を再表示しないでください
- 自動削除、自動コミット、外部送信は行わないでください
```

## ICHI Social Hermes cronヘルスチェック

将来的なツール/インフラ管理部門タスク案です。現時点では営業9:00自動実行の安定確認中のため、すぐに登録せず、必要になった段階で登録します。

- 毎日 8:50
- Gateway状態、cron状態、9:00タスクのnext_run、前回実行、missed run有無を確認する
- レポートのみ作成する
- タスク登録/削除はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social Hermes cronヘルスチェック

スケジュール:
毎日 8:50

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/hermes-cron-health-check.md のルールに従い、Gateway状態、cron状態、9:00タスクのnext_run、前回実行、missed run有無、daily-sales-candidates作成状況を確認してください。

出力:
docs/reports/infra/health-checks/YYYY-MM-DD-hermes-cron-health-check.md

重要ルール:
- タスク登録/削除は行わない
- 営業送信、SNS投稿、Sheets投入は行わない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない
- 人間が確認すべきことを分けてください

この内容を毎日8:50のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social インフラ週次ヘルスチェック

将来的なツール/インフラ管理部門タスク案です。

- 毎週土曜 11:00
- Git状態、未追跡ファイル、lint/build、Hermes cron、Sheets Webhook、Vercel確認項目、ログを整理する
- 外部送信やSheets投入はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social インフラ週次ヘルスチェック

スケジュール:
毎週土曜 11:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/infra-health-check.md のルールに従い、Git状態、未追跡ファイル、lint/build、Hermes cron、Sheets Webhook、Vercel確認項目、ログを整理してください。

出力:
docs/reports/infra/health-checks/YYYY-MM-DD-infra-health-check.md

重要ルール:
- 外部送信やSheets投入は行わない
- send-prospects.mjsは人間許可なしに実行しない
- 実運用レポートを勝手にコミットしない
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない

この内容を毎週土曜11:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 秘密情報/環境変数レビュー

将来的なツール/インフラ管理部門タスク案です。

- 毎週土曜 11:30
- docs/reports/data/git diffに秘密情報らしきものがないか確認する
- 実値は表示せず、疑いだけ報告する
- 自動削除や自動ローテーションはしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 秘密情報/環境変数レビュー

スケジュール:
毎週土曜 11:30

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/secrets-and-env-review.md のルールに従い、docs/reports/data/git diffに秘密情報らしきものがないか確認してください。

出力:
docs/reports/infra/health-checks/YYYY-MM-DD-secrets-and-env-review.md

重要ルール:
- 実値は表示せず、疑いだけ報告してください
- 自動削除や自動ローテーションは行わない
- 環境変数、Vercel環境変数、GitHub Secretsを自動変更しない
- 人間がローテーション判断すべき項目を分けてください

この内容を毎週土曜11:30のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次バックアップレビュー

将来的なツール/インフラ管理部門タスク案です。

- 毎月末日 21:00
- GitHub、Google Sheets、Apps Script、Hermes jobs、docs/reports、data/prospectsのバックアップ状態を確認する
- 実値や秘密情報は保存しない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次バックアップレビュー

スケジュール:
毎月末日 21:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/backup-review.md のルールに従い、GitHub、Google Sheets、Apps Script、Hermes jobs、docs/reports、data/prospectsのバックアップ状態を確認してください。

出力:
docs/reports/infra/maintenance/YYYY-MM-DD-backup-review.md

重要ルール:
- 実値や秘密情報は保存しない
- .env実値はバックアップ方法のみ記載し、値は記載しない
- 自動削除、自動コミット、外部送信は行わない
- 人間が行うバックアップ/復旧作業を分けてください

この内容を毎月末日21:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 月次商品改善レビュー

将来的な商品開発・パッケージ改善部門タスク案です。

- 毎月末日 17:00
- 営業/商談/受注/失注/CS/KPIをもとに、プラン・価格・作業範囲・LPコピーの改善候補を整理する
- 自動で価格変更、プラン変更、LP変更、契約変更、請求変更はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次商品改善レビュー

スケジュール:
毎月末日 17:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-product-improvement-review.md のルールに従い、営業/商談/受注/失注/CS/KPIをもとに、ICHI Socialのプラン・価格・作業範囲・LPコピーの改善候補を整理してください。

出力:
docs/reports/product/reviews/YYYY-MM-product-improvement-review.md

重要ルール:
- 価格変更、プラン内容変更、LP変更、契約変更、請求金額変更は行わない
- 成果保証、集客保証、売上保証に見える表現は追加しない
- 改善案は人間判断前提で整理する
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しない

この内容を毎月末日17:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 価格/作業範囲チェック

商品開発・パッケージ改善部門の手動実行タスク案です。

- 提案書・見積・契約書・請求書を作る前に手動実行する
- 現行プラン、初期設計費、キャンペーン、対象外業務と矛盾していないか確認する
- 自動送付はしない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動レビュー依頼です。

タスク名:
ICHI Social 価格/作業範囲チェック

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/pricing-scope-check.md のルールに従い、提案書・見積・契約書たたき台・請求書・商談メモの価格と作業範囲を確認してください。

出力:
docs/reports/product/reviews/YYYY-MM-DD-pricing-scope-check.md

重要ルール:
- 現行価格、初期設計費、キャンペーン、オプション、対象外業務との整合を確認してください
- 自動送付、自動請求、自動契約変更は行わないでください
- 不明点は未確認と書き、人間確認事項に分けてください
```

## ICHI Social 業態別パッケージ改善

商品開発・パッケージ改善部門の手動実行タスク案です。

- 必要時に手動実行する
- 美容室/ネイル/整体/カフェごとの訴求・投稿テーマ・提案文言を見直す
- 自動で営業文面やLPを変更しない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動レビュー依頼です。

タスク名:
ICHI Social 業態別パッケージ改善

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/industry-package-builder.md のルールに従い、美容室、ネイル/アイラッシュ、整体、カフェ・飲食向けの訴求、投稿テーマ、提案文言、アップセル候補を整理してください。

出力:
docs/reports/product/packages/YYYY-MM-DD-industry-package.md

重要ルール:
- 自動で営業文面、LP、契約、請求、価格を変更しないでください
- 成果保証、集客保証、売上保証は書かないでください
- 整体/美容/飲食の表現注意を守ってください
- 人間が最終判断すべきことを分けてください
```

## ICHI Social 月次外注先レビュー

将来的な外注・採用管理部門タスク案です。現時点では外注先がいないため、すぐ登録しない前提です。

- 毎月25日 16:00
- 外注先別の品質、納期、修正回数、コスト、継続可否を整理する
- 自動連絡や支払いはしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次外注先レビュー

スケジュール:
毎月25日 16:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-vendor-review.md のルールに従い、外注先別の品質、納期、修正回数、コスト、継続可否、リスク、次月方針を整理してください。

出力:
docs/reports/outsourcing/reviews/YYYY-MM-vendor-review.md

重要ルール:
- 外注先への自動連絡は行わない
- 支払い実行、契約変更、採用判断は行わない
- クライアント情報、SNSログイン情報、SECRET_TOKEN、Webhook URL、APIキー、口座情報は表示しない

この内容を毎月25日16:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 外注リスクチェック

外注・採用管理部門の手動実行タスク案です。

- 外注依頼前に手動実行する
- 秘密情報、クライアント情報、SNSログイン共有、権利、契約条件、支払い条件を確認する
- 自動依頼はしない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動レビュー依頼です。

タスク名:
ICHI Social 外注リスクチェック

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/outsourcing-risk-check.md のルールに従い、外注依頼前に、秘密情報、クライアント情報、SNSログイン共有、著作権/素材権利、成果保証表現、契約条件、支払い条件、再委託、品質リスクを確認してください。

出力:
docs/reports/outsourcing/risks/YYYY-MM-DD-outsourcing-risk-check.md

重要ルール:
- 外注依頼、自動連絡、契約判断、支払い判断は行わないでください
- 秘密情報の値は表示せず、リスクの種類だけを記録してください
- 人間が判断すべきことを分けてください
```

## ICHI Social 外注タスクブリーフ作成

外注・採用管理部門の手動実行タスク案です。

- 必要時に手動実行する
- 外注依頼内容、成果物、納期、品質基準、禁止事項を整理する
- 自動送信はしない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動下書き依頼です。

タスク名:
ICHI Social 外注タスクブリーフ作成

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/outsourcing-task-brief-builder.md のルールに従い、外注依頼内容、成果物、使用してよい情報、使用してはいけない情報、品質基準、納期、修正ルール、人間確認事項を整理してください。

出力:
docs/reports/outsourcing/briefs/YYYY-MM-DD-outsourcing-task-brief.md

重要ルール:
- 外注先へ自動送信しないでください
- クライアント秘密情報、SNSログイン情報、SECRET_TOKEN、Webhook URL、APIキー、口座情報は含めないでください
- 募集、採用、契約、支払いは人間判断としてください
```

## ICHI Social 月次AI運用改善レビュー

将来的なAI運用改善部門タスク案です。現時点では営業9:00自動実行の安定確認中のため、すぐ登録しない前提です。

- 毎月末日 22:00
- AI活用、失敗、プロンプト改善、モデル/ツール課題、コスト/クォータ、自動化境界を整理する
- 自動でモデル変更やプロンプト大幅変更はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 月次AI運用改善レビュー

スケジュール:
毎月末日 22:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/monthly-ai-ops-improvement-review.md のルールに従い、AI活用、失敗、プロンプト改善、モデル/ツール課題、コスト/クォータ、自動化境界を整理してください。

出力:
docs/reports/ai-ops/improvements/YYYY-MM-ai-ops-improvement-review.md

重要ルール:
- 自動でモデル変更、本番プロンプト大幅変更、Hermesタスク登録/削除を行わないでください
- 外部送信、SNS投稿、請求送付、契約判断、価格変更、採用判断、支払い判断は行わないでください
- SECRET_TOKEN、Webhook URL、APIキー、認証情報、口座情報、登録番号は表示しないでください

この内容を毎月末日22:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social プロンプト品質レビュー

AI運用改善部門の手動実行タスク案です。

- 必要時に手動実行する
- 指定プロンプトの目的、入力、出力、禁止事項、人間確認事項、改善案を整理する
- 自動で本番プロンプトを書き換えない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動レビュー依頼です。

タスク名:
ICHI Social プロンプト品質レビュー

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/ai-ops-prompt-review.md のルールに従い、指定プロンプトの目的、入力、出力、禁止事項、人間確認事項、改善案を整理してください。

出力:
docs/reports/ai-ops/reviews/YYYY-MM-DD-ai-ops-prompt-review.md

重要ルール:
- 本番プロンプトを自動で書き換えないでください
- モデル変更、タスク登録/削除、設定変更は行わないでください
- 改善案と人間判断事項を分けてください
```

## ICHI Social AI失敗分析

AI運用改善部門の手動実行タスク案です。

- 必要時に手動実行する
- 失敗内容、期待結果、出力結果、原因、修正案、再発防止を整理する
- 自動で外部送信や設定変更はしない

Hermes CLIに貼る手動実行文:

```text
これは通常の依頼ではなく、Hermes Agentの手動分析依頼です。

タスク名:
ICHI Social AI失敗分析

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/ai-failure-analysis.md のルールに従い、失敗内容、実行したプロンプト、出力結果、期待結果、エラーやログをもとに原因候補、修正方針、修正プロンプト案、再発防止を整理してください。

出力:
docs/reports/ai-ops/failures/YYYY-MM-DD-ai-failure-analysis.md

重要ルール:
- 秘密情報の値は再表示しないでください
- 外部送信、設定変更、モデル変更、本番プロンプト反映は行わないでください
- 人間が判断すべきことを明記してください
```

## ICHI Social Instagram営業候補リサーチ

将来的な営業部門タスク案です。実際の登録は人間確認後に行います。

- 毎週月曜 10:00
- Instagram起点でフォロワー5,000人未満の地域密着型店舗・小規模〜中小規模事業者候補を抽出する
- 営業候補JSONとリサーチレポートを作成する
- Google Sheets投入、Instagram DM送信、コメント投稿、フォーム送信はしない
- Instagramログイン、Cookie利用、大量スクレイピングはしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social Instagram営業候補リサーチ

スケジュール:
毎週月曜 10:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/instagram-sales-list-builder.md のルールに従い、Instagram起点でフォロワー5,000人未満の地域密着型店舗・小規模〜中小規模事業者候補を抽出し、営業候補JSONとレポートを作成してください。

出力:
data/prospects/YYYY-MM-DD-instagram-prospects.json
docs/reports/sales/research/YYYY-MM-DD-instagram-sales-list.md

重要ルール:
- Google Sheets投入、Instagram DM送信、コメント投稿、営業メール送信、問い合わせフォーム送信は行わない
- Instagramログイン、Cookie利用、大量スクレイピングは行わない
- フォロワー数は公開情報で確認できる場合のみ記録し、不明ならnull/unknownにする
- SECRET_TOKEN、Webhook URL、APIキー、SNSログイン情報は表示しない

この内容を毎週月曜10:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 自社SNS週次コンテンツ生成

将来的な自社SNS・広報部門タスク案です。実際の登録は人間確認後に行います。

- 毎週月曜 11:00
- ICHI Socialの自社SNS投稿を週1〜2本分作成する
- Instagramキャプション、カルーセル構成、タイトル、ハッシュタグ、CTA、手動投稿チェックリストを生成する
- 自動投稿はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 自社SNS週次コンテンツ生成

スケジュール:
毎週月曜 11:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/weekly-self-content-builder.md のルールに従い、ICHI Socialの自社SNS投稿を週1〜2本分作成してください。

出力:
docs/reports/pr/content/YYYY-MM-DD-weekly-self-content.md

重要ルール:
- Instagram投稿、Threads/X投稿、SNSログイン、予約投稿は行わない
- 架空実績、成果保証、集客保証、売上保証は使わない
- 人間が手動投稿できる原稿、構成、ハッシュタグ、CTA、チェックリストを作成してください

この内容を毎週月曜11:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 自社SNS追加投稿生成

将来的な自社SNS・広報部門タスク案です。余力がある週の2本目作成に使います。

- 毎週木曜 15:00
- 余力がある週に2本目の投稿原稿を作成する
- 手動投稿用の完成原稿のみ生成する
- 自動投稿はしない

Hermes CLIに貼る将来登録文:

```text
これは通常の依頼ではなく、Hermes Agentのスケジュールタスクとして登録してください。

タスク名:
ICHI Social 自社SNS追加投稿生成

スケジュール:
毎週木曜 15:00

実行内容:
作業ディレクトリ /mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css で、hermes/prompts/self-content-post-ready-builder.md のルールに従い、ICHI Socialの手動投稿用SNS原稿を1本作成してください。

出力:
docs/reports/pr/content/YYYY-MM-DD-post-ready-content.md

重要ルール:
- 自動投稿、SNSログイン、クライアント連絡は行わない
- 架空実績、架空数値、成果保証表現を使わない
- Instagramを最優先に、Threads/Xにも転用できる原稿にしてください

この内容を毎週木曜15:00のcronスケジュールとして登録し、登録結果を表示してください。
```

## ICHI Social 日次営業候補0件防止・補完チェック

### 目的

毎日12:00の日次営業候補生成で、候補0件のレポートが出ても成功扱いにしない。12:30 / 14:00補完チェックでは、ファイル存在ではなく候補件数を確認する。

補完チェックの状態は、ローカル用の `Agent Operations Dashboard` にも記録できる。詳細は `docs/ops/agent-operations-dashboard.md` を参照する。

### 成功条件

- 目標: A/B候補10件
- 最低実用ライン: A/B候補8件以上
- 0件: `失敗/未達`
- 1〜7件: `候補不足`
- 8〜9件: 実用可だが補完余地あり
- 10件以上: 完了

### 補完チェックの確認項目

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

### Agent Operations Dashboard連携

- cron開始時: `running`
- 候補10件以上: `success`
- 候補8〜9件: `partial`
- 候補1〜7件: `needs_review`
- 候補0件: `blocked`
- Sheets投入なし、営業送信なしをnotesに残す
- dashboard HTMLは `tmp/agent-dashboard.html` に生成し、公開サイトには出さない

### 既存タスク修正文

これは通常の依頼ではなく、既存のHermes Agentスケジュールタスクの修正依頼です。

対象タスク:
ICHI Social 毎朝営業候補10件作成

修正内容:
毎日12:00の日次営業候補生成では、候補0件を成功扱いしないでください。ファイル存在だけでは完了扱いにせず、当日JSONまたはMarkdownレポート本文の候補件数を確認してください。A/B候補10件を目標、8件以上を最低実用ラインにしてください。0件は失敗/未達、1〜7件は候補不足、8〜9件は実用可だが補完余地あり、10件以上を完了として扱ってください。

候補が10件未満の場合は探索Tierを順に広げてください。Tier 1では業種を拡張し、Tier 2ではエリアを拡張し、Tier 3ではフォロワー数不明でもInstagram URLと改善余地がある候補をB候補として許容し、Tier 4では近接条件の地域密着型候補をB候補として許容してください。

0件の場合は `emergency_refill_mode` に切り替え、CSVがなくても中止せず、`CSV未設置のため完全照合未実施` と明記してください。ローカルJSON、既存レポート、台帳で最大限重複除外し、最低8件、目標10件を出力してください。

重要ルール:
- Google Sheets投入は行わない
- `scripts/sheets/send-prospects.mjs` は実行しない
- 営業メール送信は行わない
- Instagram DM送信は行わない
- Instagramコメント投稿は行わない
- Instagram自動投稿、自動フォロー、自動いいねは行わない
- 問い合わせフォーム送信は行わない
- 秘密情報や認証情報は表示・保存・ログ出力しない

修正後、登録済みスケジュールタスクの内容を表示してください。

## Agent Status Prompt Footer標準適用

今後、Hermes Agentへ貼るスケジュール登録文、既存タスク修正文、手動実行プロンプトの末尾には、`docs/ops/agent-status-prompt-footer.md` の内容を付ける。

- status JSON更新を標準運用にする
- 作業開始時に `running` を記録する
- 主要フェーズ完了時に `phase` / `progress` を更新する
- 候補0件は `success` にしない
- 作業後に `npm run agent:status:validate` と `npm run agent:status:render` を実行する
- `tmp/agent-dashboard.html` はローカル確認専用とし、公開サイトへ出さない
- 秘密情報はstatus JSONに入れない

## 禁止事項

- GmailやSNS DMの完全自動送信は初期段階では行わない
- 問い合わせフォーム送信を自動化しない
- Googleスプレッドシートを勝手に更新しない
- 請求書を自動送付しない
- 入金確認を自動化しない
- 契約判断や価格変更を自動決定しない
- 価格変更の自動決定、プラン内容の自動変更を行わない
- LPの自動変更、契約内容の自動変更、請求金額の自動変更を行わない
- クライアントへの自動連絡を行わない
- 継続提案、アップセル提案を自動送信しない
- 解約処理、契約変更を自動化しない
- 未追跡ファイルの自動削除を行わない
- 実運用レポートの自動コミットを行わない
- スケジュールタスクの勝手な登録/削除を行わない
- 投稿操作を自動化しない
- SNS権限操作を自動化しない
- 法務判断、税務判断を自動化しない
- SNSへの自動投稿を行わない
- 架空実績、架空数値、実績の無断掲載、スクリーンショットの無断利用を行わない
- 成果保証表現の追加、実績/数値の捏造を行わない
- 外注先への自動連絡、外注募集の自動掲載、外注候補の自動採用を行わない
- 業務委託契約の自動締結、支払い実行、請求書自動処理を行わない
- クライアント情報、SNSログイン情報、秘密情報を外注先へ自動共有しない
- モデルの自動変更、本番プロンプトの自動大幅変更を行わない
- AI改善案の自動本番反映、Hermesタスクの自動登録/削除を行わない
- .env、GitHub Secrets、Vercel環境変数を自動変更しない
- 自動修正後の自動公開、自動修正後の自動送信を行わない
- 秘密情報や口座情報を自動入力しない
- 秘密情報の自動表示/保存を行わない
- 環境変数、Vercel環境変数、GitHub Secretsを自動変更しない
- Apps Scriptの自動デプロイを行わない
- Webhook URLの自動再発行を行わない
- SHEETS_SECRET_TOKENの自動ローテーションを行わない
- `SECRET_TOKEN`、Webhook URL、APIキー、認証情報を表示しない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易SNS診断」を入口にする
