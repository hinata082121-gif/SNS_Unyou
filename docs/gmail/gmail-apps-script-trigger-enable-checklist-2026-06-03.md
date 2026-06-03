# Gmail Apps Scriptトリガー有効化チェックリスト

## 目的

Gmail営業メール30件/日運用で、Apps Scriptの自動送信トリガーをいつ有効化してよいか、また有効化前に何を確認するかを整理する。

2026-06-04は完全自動トリガーではなく、手動承認つき送信を推奨する。2026-06-04の成功確認後、2026-06-05以降に完全自動トリガー有効化を検討する。

## トリガー有効化前提

- 直近1回の手動承認つき送信が成功している
- sendBatchId二重送信防止が機能している
- 送信後に `LIVE_SEND_ENABLED=false` へ戻せる
- Gmail-ready候補プールに十分な余力がある
- 送信対象シートの列が安定している
- Hermes Agentの監視フローが整っている
- 人間が緊急停止手順を把握している

## いつ有効化してよいか

以下をすべて満たす場合に検討する。

- 2026-06-04の手動承認つき30件送信が成功
- failed=0
- Sheets更新確認済み
- Agent Office記録済み
- `DRY_RUN=true` / `LIVE_SEND_ENABLED=false` へ復帰済み
- 候補プールavailableが60件以上
- 理想的には候補プールavailableが90件以上
- 翌日分outbox30件を作成できる

## まだ有効化してはいけない条件

- 2026-06-04の送信が未実行
- Preflightのみで本番送信実績がない
- 候補プールavailableが30件未満
- 候補プールavailableが60件未満で補充予定が未確定
- failedまたはneeds_reviewが未解消
- Sheets更新確認ができていない
- 送信後の安全復帰が未確認
- Hermes監視が未設定

## setupDailyAutoSendTriggers() 実行前チェック

- `runPreflightCheckOnly()` が成功する
- readyCount=30
- blockedReason=""
- remainingQuota>=30
- sendBatchIdが当日分
- 同一sendBatchIdが未送信
- `AUTO_SEND_ENABLED` の運用方針を人間が承認済み
- 緊急停止手順を確認済み

## removeDailyAutoSendTriggers() の使い方

以下の場合はApps Script画面で `removeDailyAutoSendTriggers()` を実行する。

- 送信対象が不足した
- Preflightが不安定
- Gmail残クォータが不足
- 誤送信リスクがある
- Sheets列が壊れた
- 送信後の安全復帰が確認できない

実行後、Script Propertiesを以下に戻す。

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`
- `AUTO_SEND_ENABLED=false`

## AUTO_SEND_ENABLEDの扱い

- 完全自動トリガーを使う場合のみtrueにする
- 手動承認つき送信ではfalseのままでもよい
- 送信後はfalseへ戻す設計を優先する

## DRY_RUN / LIVE_SEND_ENABLED の扱い

通常時:

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`

手動承認つき送信直前:

- `DRY_RUN=false`
- `LIVE_SEND_ENABLED=true`

送信後:

- `DRY_RUN=true`
- `LIVE_SEND_ENABLED=false`

## 送信後にLIVE_SEND_ENABLED=falseへ戻るか

確認項目:

- 送信成功時にfalseへ戻る
- 送信失敗時にもfalseへ戻る
- 途中停止時にもfalseへ戻る
- 人間が手動で戻す手順も把握している

## sendBatchId二重送信防止

必須:

- sendBatchId形式: `gmail-sales-YYYY-MM-DD`
- 同じsendBatchIdを再送信しない
- 送信済みバッチをScript PropertiesまたはSheetsで確認できる
- 同日再実行時はblockedになる

## 2026-06-04の方針

2026-06-04は手動承認つきで実施する。

- 11:45にPreflight再確認
- 人間が送信可否を判断
- Script Propertiesを送信用に変更
- `runDailyGmailSalesSend()` を手動実行
- 送信後すぐに安全状態へ戻す
- CodexでAgent Officeへ記録
- Hermesは監視と報告のみ

## 2026-06-05以降

2026-06-04成功後に完全自動トリガー有効化を検討する。

ただし、候補プールavailableが60件未満なら完全自動化は保留する。候補プール90件以上なら自動化安定度が高い。

## 最終判断

完全自動トリガー有効化は人間が判断する。

Codexは設計、手順整備、Agent Office更新を担当する。Hermesは監視と報告を担当する。Apps Scriptは安全条件を満たす場合のみ送信実行を担当する。
