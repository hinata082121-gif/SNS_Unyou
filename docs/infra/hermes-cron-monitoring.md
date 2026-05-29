# Hermes cron監視ルール

## 背景

2026-05-29に、9:00タスクが `grace=7200s` を超過してmissed runとなり、次回へfast-forwardされた事象がありました。

## 確認項目

- cronジョブ一覧
- `last_run_at`
- `last_status`
- `next_run`
- missed run有無
- Gateway稼働状態
- WSL2稼働状態
- systemd linger
- daily-sales-candidatesファイル生成有無

## 9:00タスク未実行時の初動

1. Windows/WSL2が起動していたか確認
2. Gateway状態を確認
3. cron statusとlast_statusを確認
4. `docs/reports/sales/daily/` の当日ファイルを確認
5. 必要なら人間確認のうえ手動実行

## 補完チェック

9:30/13:30補完チェックは、9:00タスクの安定性を確認してから導入する。補完でも送信やSheets更新は行わない。

