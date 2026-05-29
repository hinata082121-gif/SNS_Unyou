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

## 禁止事項

- GmailやSNS DMの完全自動送信は初期段階では行わない
- 問い合わせフォーム送信を自動化しない
- Googleスプレッドシートを勝手に更新しない
- `SECRET_TOKEN`、Webhook URL、APIキー、認証情報を表示しない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易SNS診断」を入口にする
