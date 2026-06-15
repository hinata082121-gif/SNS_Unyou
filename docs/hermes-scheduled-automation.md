# Hermes定期タスク設定手順

## 目的

Hermes AgentでICHI Socialの営業候補整理と新規候補リサーチを定期実行するための手順です。初期段階では、送信以外の自動化に限定します。

## Agent Office公開確認

Next.jsアプリ内の `/agent-office` は、Vercel公開URLからスマホで確認するための表示専用ダッシュボードです。
Hermes Agentは、各タスクの進捗を `data/agent-status/tasks/*.json` に記録し、Codexが必要に応じてAgent Officeへ反映します。

運用ルール:

- HermesはGmail本番送信、自動返信、Instagram操作、Google Sheets送信済み更新を実行しない
- `/agent-office` には安全な進捗要約だけを表示する
- 営業先名、メールアドレス、送信対象リスト、outbox、candidate pool、秘密情報は表示しない
- Vercel本番では環境変数 `AGENT_OFFICE_ACCESS_KEY` による簡易アクセスキーを設定する
- 完全自動化や送信実行の判断は、人間確認とApps Script側の安全条件を前提にする

### 自動業務完了後の共通ルール

HermesまたはCodexが自動業務の結果を確認したら、以下を標準手順にします。

1. 対応する `data/agent-status/tasks/*.json` を更新する
2. 個人情報を含まないsummary docsを更新する
3. `npm run agent:status:validate` を実行する
4. `npm run agent:status:render` と `npm run agent:office:render` を実行する
5. 秘密情報を含まないファイルだけを個別にGit追加する
6. `git add .` は使わない
7. commit/pushし、Vercelの `/agent-office` に反映する

blocked/failedの場合は、`nextAction` に人間が次に判断すべきことを必ず書きます。
Gmail送信対象、候補プール本体、送信ログ本体、営業リスト本体はGitに追加しません。

## 現行Hermesスケジュール（2026-06-04時点）

この節を現行のHermesスケジュールとして扱います。下部の古い登録例や履歴的なタスク説明と矛盾する場合は、この節の内容を優先します。

| ジョブID | 状態 | タスク名 | スケジュール | 役割 |
|---|---|---|---|---|
| `bbf132ad0f05` | 有効 | ICHI Gmail 毎日12時 30件メール送信チェック | 毎日 12:00 | Gmail営業30件/日の送信前条件確認、送信結果確認、Agent Office記録。旧「ICHI Social 毎日12時営業候補10件作成」から変更済み。条件未達なら送信せず `blocked` / `needs_review` にする。 |
| `8613043c053f` | 有効 | ICHI Gmail 12:30送信結果・Agent Office反映チェック | 毎日 12:30 | 12:00送信チェック後の送信結果を安全な件数だけ確認し、Agent Status更新、Agent Office render、lint/build、commit/pushまで進める。返信確認は次アクションとして引き継ぐ。 |
| `97f734b7344d` | paused / 無効化 | ICHI Social 月水リサーチ・リスト更新 | 停止中 | `eb1341568dbc` が有効なため、重複防止で停止する。 |
| `eb1341568dbc` | 有効 | ICHI Gmail 月木営業リスト更新 | 毎週 月曜・木曜 10:30（cron: `30 10 * * 1,4`） | Gmail-ready候補を各回最大200件補充する。送信はしない。 |
| `2be513dbe07f` | 有効 | ICHI Social 金曜17時 市場・競合分析 | 毎週 金曜 17:00 | SNS運用代行、小規模店舗支援、AI自動化、Gmail営業、Instagram集客の市場・競合分析を行う。 |
| 未登録 | 追加予定 | ICHI Gmail 金曜18時 営業メール改善・反応率分析 | 毎週 金曜 18:00（cron候補: `0 18 * * 5`） | 17:00市場分析と直近1週間のGmail営業結果をもとに、翌週の件名・本文・CTA・訴求軸の改善案を作成する。初期運用では本番テンプレート自動反映なし、人間承認制にする。 |
| `0305facfaef7` | 有効 | ICHI Gmail 14時 失敗・不足リカバリ確認 | 毎日 14:00 | 未送信、失敗、候補不足、Agent Office未反映を確認する。 |
| `5b20e0820c82` | 有効 | ICHI Gmail 17時 返信確認・翌日準備チェック | 毎日 17:00 | 返信確認、人間確認必要性、翌日分候補・outbox準備状況を確認する。 |
| `4e4ed67216e3` | 有効 | ICHI Gmail 毎日17:20 翌日outbox30件自動準備・Sheet反映 | 毎日 17:20（cron: `20 17 * * *`） | JST翌日の日付を解決し、過去送信済み・重複を除外して翌日outbox30件を準備する。安全なSheet反映経路が使える場合のみGmail送信対象へ反映し、できない場合はneeds_reviewとして必要作業を明記する。 |
| `ee8473f970ff` | 有効 | ICHI Gmail 毎日17:30 返信確認実行・記録 | 毎日 17:30（cron: `30 17 * * *`、次回: `2026-06-05T17:30:00+09:00`） | 返信確認結果を安全に記録し、replyCheckExecutedとneedsHumanEmailCheckをAgent Officeへ反映する。 |
| `1365e7b16899` | 有効 | ICHI Agent Office 毎日18:30 反映監査・未反映検知 | 毎日 18:30（cron: `30 18 * * *`、次回: `2026-06-04T18:30:00+09:00`） | 当日分の自動化タスクがAgent Officeに反映されているか確認し、未反映、古い更新、stale候補を安全な状態だけで記録する。Gmail送信、自動返信、Apps Scriptトリガー操作、Instagram操作はしない。 |
| `758eef276079` | 有効 | ICHI Gmail 候補プール不足時 補充強化チェック | 月曜・木曜 16:00（cron: `0 16 * * 1,4`、次回: `2026-06-08T16:00:00+09:00`） | totalReadyが90件未満、またはavailableForNextSendが60件未満の場合に補充強化が必要と記録する。 |

共通方針:

- Hermesは監視・確認・記録を担当する
- Gmail実送信はApps Script側の安全条件を満たす場合のみ行う
- 自動返信はしない
- Instagram操作はしない
- Agent Officeと `/agent-office` には安全な件数、状態、`nextAction` のみ反映する
- メールアドレス、営業先名、返信本文、Gmailスレッド全文、秘密情報は表示しない
- `data/gmail/` 本体、`data/prospects/`、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` はGit追加禁止

### Gmail営業リスト更新タスク

- ジョブID: `eb1341568dbc`
- cron: `30 10 * * 1,4`
- 役割: 月曜/木曜10:30にGmail-ready候補の補充状況を確認する
- 出力: 安全なsummary docsとAgent statusのみ
- 禁止: Gmail送信、自動返信、営業先リスト本体のGit追加

### 翌日outbox準備タスク

- ジョブID: `4e4ed67216e3`
- cron: `20 17 * * *`

毎日17:20の翌日outbox30件自動準備は、`npm run gmail:outbox:prepare-tomorrow` を標準コマンドにします。
このコマンドはJST翌日を対象にし、sendBatchIdを `gmail-sales-YYYY-MM-DD` 形式で生成します。
過去送信済み、同一メール、同一dedupeKey、同一事業者相当の重複を除外し、30件未満または重複検出時はblockedにします。

17:20タスクは、outbox/TSV作成だけでなくSheet反映までを目標にします。
安全なSheet反映経路が有効な場合のみGmail送信対象シートへ自動反映し、反映後にPreflight診断またはreadyRows検証へ進みます。
Sheet反映経路が未設定またはdry-runの場合は、`sheetSynced=false`、`manualPasteRequired=true`、`preflightPending=true` としてAgent Officeに表示します。
Sheet反映が未完了の場合、翌日12:00送信はreadyRows=30にならないためblockedのままにします。
`data/gmail/` 本体、outbox、TSV、メールアドレス一覧はGit追加しません。

2026-06-05分は初回17:20実行より前に12:00自動送信予定があるため、一回限りで事前にoutbox30件とSheets貼り付け用TSVを準備しました。
ただし緊急確認で、2026-06-05分outboxが2026-06-04送信済み候補と30件すべて重複していたため、旧outbox/TSVは使用禁止です。
公開メール確認済み候補を緊急補充し、過去送信済み候補と重複ゼロの新outbox30件とSheets貼り付け用TSVを再作成しました。
旧6/5 TSVがSheetsに入っている場合は、送信前に必ず新TSVへ差し替え、Preflightで `readyCount=30` と `blockedReason=""` を確認します。

### 返信確認実行・記録タスク

- ジョブID: `ee8473f970ff`
- cron: `30 17 * * *`
- 次回実行: `2026-06-05T17:30:00+09:00`

毎日17:30の返信確認実行・記録は、`gmail_reply_check` カテゴリでAgent statusへ記録します。
replyCheckExecuted、repliedCount、unreadReplyCount、needsHumanEmailCheckだけを安全に反映し、返信本文、営業先名、メールアドレスは表示しません。

### 候補プール不足時 補充強化チェック

- ジョブID: `758eef276079`
- cron: `0 16 * * 1,4`
- 次回実行: `2026-06-08T16:00:00+09:00`

月曜・木曜16:00の候補プール不足時チェックは、totalReadyが90件未満、またはavailableForNextSendが60件未満の場合に `needs_review` として補充強化を記録します。
自動候補生成は初期運用では行わず、既存の安全ワークフローに限定します。

### 金曜市場分析タスク

金曜市場分析は、`market_analysis` カテゴリでAgent statusへ記録します。
市場分析の実データ取得は金曜タスク実行時に行い、通常のHermes監視では予定、実行中、完了、確認待ちだけを記録します。

### 金曜営業メール改善タスク

金曜18:00の営業メール改善・反応率分析は、`gmail_sales_improvement` カテゴリでAgent statusへ記録します。
17:00の市場・競合分析結果と直近1週間のGmail営業結果をもとに、翌週の件名、本文、CTA、訴求軸の改善案を作成します。
初期運用では改善案を `needs_review` とし、本番テンプレートへの反映は人間承認後に限定します。
Gmail送信、自動返信、Apps Scriptトリガー操作、本番テンプレート自動差し替えは行いません。

### Agent Office反映監査タスク

- ジョブID: `1365e7b16899`
- cron: `30 18 * * *`
- 次回実行: `2026-06-04T18:30:00+09:00`

毎日18:30のAgent Office反映監査・未反映検知は、`agent_office_monitoring` カテゴリでAgent statusへ記録します。
当日実行予定だったGmail送信、送信後確認、失敗・不足確認、返信確認、営業リスト更新、市場分析、営業メール改善、完全自動送信開始状態がAgent Officeへ反映されているか確認します。
未反映、古い `updatedAt`、`running` のままのタスク、blocked/needs_review未対応があれば、安全な件数とnextActionだけをAgent Officeへ記録します。
Gmail送信、自動返信、Apps Scriptトリガー操作、Google Sheets送信済み更新、Instagram操作は行いません。

### Gmail返信確認監視

Gmail返信確認は、`gmail_reply_check` カテゴリでAgent statusへ記録します。
Hermesは09:00、12:30、17:00の返信確認結果を見て、`needsHumanEmailCheck` と `unreadReplyCount` の件数だけを報告します。
返信本文、メールアドレス、営業先名、GmailスレッドURLは表示しません。
自動返信は行いません。

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

## 2026-06-03以降の営業主タスク変更

営業運用の主タスクは「毎日10件候補作成」から「毎日30件Gmail営業メール送信」へ変更する。

候補作成はGmail送信の前工程として扱い、Gmail送信が完了していない場合は営業日次タスクを完了扱いにしない。

### 基本スケジュール案

- 10:30: 候補補充/リサーチ。月水は既存の月水リサーチを継続し、それ以外の日は必要時のみ補充する。
- 11:30: 送信対象30件の抽出、メール宛先確認、重複/除外チェック。
- 12:00: Gmail営業メール30件送信。DRY_RUN未通過または送信対象不足の場合はblockedにする。
- 12:30: 送信結果確認、Google Sheets更新、Agent Office更新。
- 14:00: 未送信/失敗/候補不足の補完チェック。Hermesタスク登録は人間確認後に行う。
- 17:00: 当日まとめと翌日アクション整理。

### 2026-06-03の扱い

12:00 cronはerror報告だったが、候補作成成果物とAgent status上では10件候補作成済みとして扱う。

ただし、Gmail送信は別タスク `gmail-daily-sales-send-2026-06-03` で管理する。2026-06-03分は追加確認後にApps Script上で30件送信が完了し、Agent Officeでは `success` として記録済み。

2026-06-04以降は、Gmail営業メール30件/日の完全自動送信設計を `docs/gmail/gmail-daily-full-auto-send-design-2026-06-03.md` に従って扱う。11:30 Preflight、12:00送信、12:30送信後確認、14:00失敗/不足確認はApps Script側の安全条件を満たす場合だけ有効化する。

14:00補完タスクは、未送信/失敗/候補不足の確認用とし、自動再送信は行わない。Hermesタスク登録/削除/変更は人間確認後に行う。

### Gmail送信用候補プール補充

毎日30件Gmail送信を安定させるには、送信タスクとは別に公開メールアドレス確認済み候補のプール補充タスクを置く。

- 09:00: Gmail-ready候補プール残数確認
- 09:15: 不足分補充バッチ1。1バッチ5〜10件を目標にする
- 09:45: 不足分補充バッチ2。タイムアウト前に途中保存する
- 10:15: pool availableから当日outbox30件を作成
- 10:45: Sheets貼り付け用TSV作成/検証
- 11:30: Apps Script Preflight
- 12:00: 安全条件を満たす場合のみGmail送信

判定:

- pool availableが60件未満: 補充対象
- pool availableが30件未満: 当日送信は `blocked`
- outboxが30件ちょうどでない: 当日送信は `blocked`
- 送信済み、返信あり、配信停止、送信禁止、重複が混入: 当日送信は `blocked`

候補プール本体、outbox、TSV、ログ、メールアドレス一覧はGitに追加しない。Agent Officeには件数、blocked理由、次回補充必要数だけを記録する。

### 2026-06-04 手動承認つき送信とHermes監視

2026-06-04分は、outbox30件、Sheets貼り付け、Apps Script PreflightのreadyCount=30確認まで完了済みとして扱う。ただし、2026-06-04分を2026-06-03夜に送信しない。

2026-06-04の運用:

- 11:45: 人間がApps Scriptで `runPreflightCheckOnly()` を再実行する
- PreflightでreadyCount=30、blockedReason空、remainingQuota>=30を確認する
- 人間がScript Propertiesを送信用に切り替える
- 人間が `runDailyGmailSalesSend()` を手動実行する
- 送信後すぐに `DRY_RUN=true` / `LIVE_SEND_ENABLED=false` / `AUTO_SEND_ENABLED=false` へ戻す
- Codexで送信結果をAgent Officeへ記録する
- Hermesは監視・確認・報告のみ行い、送信実行しない

2026-06-05以降の完全自動トリガー有効化は、2026-06-04の手動承認つき送信が成功してから検討する。候補プールavailableが60件未満の場合は完全自動化を保留し、90件以上で安定運用候補とする。

### Threads運用タスク

ICHI Socialの新部門としてThreads運用を追加する。Gmail営業が個別接触を担当するのに対し、Threadsは公開発信による認知、共感、無料SNS診断への導線づくりを担当する。

登録済み/有効のタスク:

| 時刻 | ジョブID | タスク | cron | 次回実行 | 状態 | 役割 |
|---|---|---|---|---|---|---|
| 毎日 11:00 | `2c6a2309255f` | ICHI Threads 毎日11時 ノウハウ投稿 | `0 11 * * *` | `2026-06-06T11:00:00+09:00` | 有効 / scheduled | 小規模店舗・個人事業者向けSNS改善ノウハウ投稿。自動返信/いいね/フォローなし。 |
| 毎日 19:00 | `d02c609665e8` | ICHI Threads 毎日19時 共感・導線投稿 | `0 19 * * *` | `2026-06-06T19:00:00+09:00` | 有効 / scheduled | 共感、問いかけ、無料SNS診断導線投稿。自動返信/いいね/フォローなし。 |
| 金曜 20:00 | `807bcd30473d` | ICHI Threads 金曜20時 バズ投稿分析・投稿文改善 | `0 20 * * 5` | `2026-06-12T20:00:00+09:00` | 有効 / scheduled | バズ投稿傾向分析と翌週投稿改善案作成。投稿文丸コピーなし、自動返信/いいね/フォローなし。 |

Threads投稿は、`THREADS_PUBLISH_ENABLED=true` かつ `THREADS_DRY_RUN=false` が確認できる場合のみ、公式APIまたは正式に許可された投稿経路で実行する。
初期状態では `THREADS_PUBLISH_ENABLED=false`、`THREADS_DRY_RUN=true` として扱い、API未設定時は `blocked` としてAgent Officeへ反映する。

Threadsスクリプトは、Hermes Agentの定期実行でもプロジェクトルートの `.env.local` を自動読み込みする。
2026-06-11時点で、11:00/19:00の検証は `apiConfigured=true`、`publishEnabled=false`、`dryRun=true`、`published=false` として確認済み。
これは投稿許可が無効な安全停止状態であり、blockedReasonは `publish_disabled` としてAgent Officeへ反映する。

同日にThreads APIのテキスト投稿フローを実装し、`api_publish_not_implemented_in_local_stub` は解消済み。
実投稿は `THREADS_PUBLISH_ENABLED=true` かつ `THREADS_DRY_RUN=false` の場合だけ行う。
`THREADS_PUBLISH_ENABLED=true` でも `THREADS_DRY_RUN=true` なら `threads_dry_run` で停止し、API投稿は行わない。
初回本番投稿はHermes自動化ではなく、人間がPowerShellの一時環境変数で1件だけ実施して結果を確認する。

2026-06-12の11時投稿未実行は、Threads APIではなくHermes provider/model設定の問題だった。
エラーは `Unknown provider 'openai'` で、`npm run threads:post:11` へ到達していなかった。
Threads投稿タスクはAI推論不要のため、以下のno-agent cronへ再作成した。

| 時刻 | 新ジョブID | タスク | cron | 実行方式 | command/script |
|---|---|---|---|---|---|
| 毎日 11:00 | `6fbea6039fcf` | ICHI Threads 毎日11時 ノウハウ投稿 | `0 11 * * *` | no-agent | `ichi_threads_post_11.py` -> `npm run threads:post:11` |
| 毎日 19:00 | `ee568dbda7ab` | ICHI Threads 毎日19時 共感・導線投稿 | `0 19 * * *` | no-agent | `ichi_threads_post_19.py` -> `npm run threads:post:19` |
| 金曜 20:00 | `96bd94126b9d` | ICHI Social 金曜20時 営業・Threads KPI改善レビュー | `0 20 * * 5` | no-agent | `ichi_threads_weekly_analyze.py` -> `npm run threads:weekly:analyze` と `npm run sales:kpi:summary` の安全な件数レビュー |

no-agent実行のため、投稿タスクはprovider/model解決に依存しない。
Hermes gatewayは手動バックグラウンド起動済みだが、Windowsログイン時の自動起動にはUAC付きで `hermes gateway install` を完了する必要がある。
安全テストでは `THREADS_PUBLISH_ENABLED=false`、`THREADS_DRY_RUN=true` を一時指定し、11時/19時コマンド到達と `publish_disabled` を確認した。

Threads運用でも、自動返信、自動いいね、自動フォロー、無断転載、ログイン画面操作、ブラウザ操作による投稿は行わない。
APIトークン、投稿先ID、App Secret、Client Secret、APIレスポンスの秘密情報は表示・保存・Git追加しない。

### ICHI Social KPI改善レビュー

金曜20:00のno-agent週次タスクは、Threads投稿改善に加えてGmail営業KPI改善レビューも担当します。

- Gmail返信KPIは `npm run sales:kpi:summary` の安全な件数だけを確認する
- Gmail outboxのcopyVariant A/BはローカルJSONメタデータで比較し、TSV/Sheet列は初期運用では増やさない
- 30/60/90日の返信率、ポジティブ返信率、商談化、初売上KPIに対して改善案を作る
- Threads 11:00はノウハウ/権威づけ、19:00は共感/DM導線として翌週案を見直す
- 改善案は `needs_review` とし、本番GmailテンプレートやThreads投稿へ自動反映しない

禁止事項は従来通りです。Gmail送信、Threads投稿、自動返信、自動いいね、自動フォロー、Google Sheets更新、Apps Scriptトリガー操作、秘密情報表示は行いません。

### 2026-06-13 Threads/Gmail入力データ保証

2026-06-13のThreads 11時投稿は、Hermes cronとno-agent実行自体は正常で、`npm run threads:post:11` まで到達した。
新しい障害原因は `post_date_not_found` で、当日分の投稿計画が未生成だったことです。

今後の11時/19時投稿タスクは、投稿コマンド実行前に `npm run threads:plan:ensure:rolling` を実行する。
投稿スクリプト側でも当日分計画を自動補完し、今日、翌日、翌々日の3日分をAsia/Tokyo基準で保証する。
API_SERVER_KEY警告はこのcron停止の直接原因ではありません。

Gmail 2026-06-13のPreflightでは、sendDateとsendBatchIdは正しかったが、Sheet上の30行がreadyではなく `statusMismatchCount=30` だった。
自動化では「実行ジョブ」と「実行前データ生成/ready遷移」の両方を監視する。
17:20翌日準備後は、outbox30件、Sheet同期、status=ready、Preflight成功を確認し、条件未達なら12:00送信はblockedにする。
送信許可は恒久的にtrueにせず、Preflight成功後に当日分だけ有効化し、送信後はOFFへ戻す設計を維持する。

### 2026-06-15 緊急復旧後の現行スケジュール

Threads:

- `6fbea6039fcf`: ICHI Threads 毎日11時 ノウハウ投稿 / `0 11 * * *` / no-agent / `ichi_threads_post_11.py`
- `ee568dbda7ab`: ICHI Threads 毎日19時 共感・導線投稿 / `0 19 * * *` / no-agent / `ichi_threads_post_19.py`
- `96bd94126b9d`: ICHI Social 金曜20時 営業・Threads KPI改善レビュー / `0 20 * * 5` / no-agent / `ichi_threads_weekly_analyze.py`

Gmail:

- `b1aa88ba6cd4`: ICHI Gmail 毎日10:30 候補リスト不足確認 / `30 10 * * *`
- `22286e4c7945`: ICHI Gmail 毎日11:30 Preflight監視 / `30 11 * * *`
- `e6c05b32f9ff`: ICHI Gmail 毎日12:10 送信結果確認 / `10 12 * * *`
- `c1f9aad68b12`: ICHI Gmail 毎日12:30 KPI集計 / `30 12 * * *`
- `9c19cdb3b3c8`: ICHI Gmail 毎日17:20 翌日outbox生成・Sheet同期 / `20 17 * * *`
- `3f86f0242f56`: ICHI Gmail 毎日17:30 翌日準備結果確認 / `30 17 * * *`

Gmail本送信はHermesから二重実行しない。
12時の本送信はApps Script側の既存安全条件を正とし、Hermesは準備、監視、Agent Office反映を担当する。

### Gmail日次batchローテーション監視

Gmail営業30件/日の通常運用では、12:00の送信チェックはJST当日を対象にし、sendBatchIdは原則 `gmail-sales-YYYY-MM-DD` とする。
17:20の翌日outbox準備タスクはJST翌日を対象にする。

2026-06-05の緊急r2 batchは6/5専用であり、6/6以降へ持ち越さない。
HermesはPreflight/診断ログで以下を確認する。

- `currentJstDate`
- `expectedSendDate`
- `expectedSendBatchId`
- `sendDateSource`
- `sendBatchIdSource`
- `staleSendDate`
- `staleBatchId`
- `dryRun`
- `liveSendEnabled`
- `autoSendEnabled`
- `blockedReason`

`expectedSendDate` が当日と一致しない場合、または `batch_already_sent` が出た場合は、古いbatchを再送しない。
送信済み行をreadyへ戻さず、新しい日付または新しいbatchIdのoutbox準備をnextActionにする。
Apps Script診断ログに出る実際の `dryRun` / `liveSendEnabled` / `autoSendEnabled` を送信可否の基準とする。

2026-06-08はscheduled実行でGmail営業30件送信が成功した。
`sendBatchId=gmail-sales-2026-06-08`、processed=30、failed=0、`batch_marked_sent`、`live_send_reset_after_run` を安全な件数として記録済み。
6/5固定batch問題は復旧完了、本文のリテラル `\n` 表示問題も解消済みとして扱う。
6/8分は再送信禁止とし、6/9以降の日次ローテーション、17:20翌日outbox準備、12:30/14:00/17:00/17:30/18:30の監視を継続する。

2026-06-08の点検では、2026-06-09分のsendDate/sendBatchIdは `2026-06-09` / `gmail-sales-2026-06-09` として正常に解決できた。
ただし過去送信済み候補を除外すると5件しか選出できず、selectedCount=30未満のためblocked。
6/9分を送信するには、Gmail-ready候補を25件以上補充してから再選出し、Sheet反映とPreflight確認を行う。

同日中にGmail-ready候補を補充し、2026-06-09分はselectedCount=30、duplicateCount=0、sheetsReadyTsvCreated=trueまで復旧した。
安全なSheet自動反映経路は未確認のため、`sheetSynced=false`、`manualPasteRequired=true` としてAgent Officeへ表示する。
6/9送信前には、TSVをGmail送信対象シートへ貼り付け、Preflight診断とPreflight本体でreadyCount=30、blockedReason空を確認する。

### 12:30送信結果・Agent Office反映タスク

12:30タスクは、Gmail本番送信やGoogle Sheets更新を行わず、12:00送信結果をAgent Officeへ反映する担当にする。

実行すること:

- Apps ScriptまたはHermesが取得した安全な送信結果メタ情報を確認する
- `processed`、`failedCount`、`sendBatchId`、`batch_marked_sent`、`live_send_reset_after_run` を件数/真偽値だけで記録する
- `npm run gmail:send-result:record -- --date YYYY-MM-DD --processed 30 --failed 0 --batch-marked-sent true --live-send-reset-after-run true` を使って日付別Agent Status JSONを作成/更新する
- `npm run agent:status:validate`
- `npm run agent:status:render`
- `npm run agent:office:render`
- `npm run lint`
- `npm run build`
- 安全なAgent Status JSONとdocsだけを個別に `git add` する
- `git add .` は使わず、commit/pushしてVercelの `/agent-office` へ反映する

禁止事項:

- Gmail本番送信しない
- `runDailyGmailSalesSend()` を実行しない
- 送信済み行をreadyへ戻さない
- Google Sheetsを更新しない
- Apps Scriptトリガー操作をしない
- 自動返信しない
- Threads投稿、Instagram操作をしない
- `data/gmail/`、`data/prospects/`、`docs/reports/sales/`、`tmp/`、`.env`、`.env.local` をGit追加しない
- メールアドレス、営業先名、本文全文、返信本文、Gmailスレッド全文、Sheet ID、Apps Script URL、Webhook URL、APIキー、トークンを表示/コミットしない

## 禁止事項

## 2026-06-11 Gmail送信対象Sheet自動反映仕様

17:20タスクは `ICHI Gmail 毎日17:20 翌日outbox30件自動準備・Sheet反映` として運用する。
cronは `20 17 * * *`、実行コマンドは `npm run gmail:outbox:prepare-and-sync-tomorrow` を推奨する。

実行内容:

- JST翌日の日付を解決する
- 翌日outbox30件を作成する
- `selectedCount=30`、`duplicateCount=0`、`shortage=0` を確認する
- Sheets-ready TSVを作成する
- `GMAIL_SHEET_SYNC_ENABLED=true` かつ `GMAIL_SHEET_SYNC_DRY_RUN=false` の場合のみ、Google SheetsのGmail送信対象タブへ反映する
- 同期が無効またはdry-runなら `sheetSynced=false`、`manualPasteRequired=true` としてAgent Officeへ記録する
- 同期後はApps ScriptのPreflight診断またはready行検証へ接続する
- `sendDate`、`sendBatchId`、`selectedCount`、`rowCount`、`sheetSynced`、`manualPasteRequired`、`readyRowsVerified`、`preflightPending` だけを安全に記録する
- 失敗時は `blocked` または `needs_review` として `/agent-office` に表示する

使用する環境変数名:

- `GMAIL_SHEET_SYNC_ENABLED`
- `GMAIL_SHEET_SYNC_DRY_RUN`
- `GMAIL_SHEET_WEBHOOK_URL`
- `GMAIL_SHEET_SYNC_TOKEN`
- `GMAIL_SHEET_TARGET_NAME`
- `GMAIL_SHEET_READY_TAB_NAME`

値は表示、ログ出力、Agent Status保存、Git追加をしない。
Apps Script側のWeb App受信口を使う場合、GitHub反映後に `Code.gs` をscript.google.comへ手動反映し、Script Properties側にも同期トークンを設定する。

Gmail系Nodeスクリプトは起動時に `scripts/lib/load-local-env.mjs` を読み込み、`.env`、`.env.local` の順に環境変数を読み込む。
既存の `process.env` は上書きしない。
2026-06-11のdry-run確認では、`.env.local` の同期設定を読み込んだ結果、Sheet同期ステップは `sheet_sync_disabled` ではなく `sheet_sync_dry_run` で停止した。
この状態では `sheetSynced=false`、`manualPasteRequired=true` で、Google Sheets本番更新は行われない。

このタスクではGmail送信、`runDailyGmailSalesSend()`、送信済み行のready復帰、Apps Scriptトリガー操作、自動返信、Threads投稿、Instagram操作を行わない。
メールアドレス、営業先名、本文全文、返信本文、Gmailスレッド全文、Sheet ID、Apps Script URL、Webhook URL、APIキー、トークンを表示/コミットしない。

- Gmail送信はApps Scriptの安全条件、sendBatchId重複防止、30件ちょうどのready確認、Gmail残クォータ確認を満たす場合のみ行う
- Gmail本番トリガー有効化は人間確認後に行う
- Gmail送信後は `LIVE_SEND_ENABLED=false` / `AUTO_SEND_ENABLED=false` へ戻し、二重送信を防止する
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
