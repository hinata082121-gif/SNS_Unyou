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

## 禁止事項

- GmailやSNS DMの完全自動送信は初期段階では行わない
- 問い合わせフォーム送信を自動化しない
- Googleスプレッドシートを勝手に更新しない
- 請求書を自動送付しない
- 入金確認を自動化しない
- 契約判断や価格変更を自動決定しない
- クライアントへの自動連絡を行わない
- 秘密情報や口座情報を自動入力しない
- `SECRET_TOKEN`、Webhook URL、APIキー、認証情報を表示しない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易SNS診断」を入口にする
