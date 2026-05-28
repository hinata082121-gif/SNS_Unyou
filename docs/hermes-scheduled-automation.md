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

## 禁止事項

- GmailやSNS DMの完全自動送信は初期段階では行わない
- 問い合わせフォーム送信を自動化しない
- スパム的な一斉送信をしない
- 1日10〜20件程度の小ロットから開始する
- 送信前に相手の公式サイト・SNS・問い合わせ可否を確認する
- 問い合わせフォームで営業不可と書かれている場合は送信しない
- 架空の実績や成果保証表現を使わない
- ICHI Socialの営業は「無料簡易SNS診断」を入口にする
