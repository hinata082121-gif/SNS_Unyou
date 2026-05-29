# 障害対応手順

| インシデント | 重大度 | 初動 | 確認するファイル/ログ | 停止する作業 | 復旧手順 | 再発防止 |
|---|---|---|---|---|---|---|
| Hermes 9:00タスク未実行 | 中 | Gateway/cron確認 | Hermes logs, `docs/reports/sales/daily/` | 自動判断 | 手動実行検討 | 監視強化 |
| cron missed run | 中 | grace/last_run確認 | cron logs | 関連自動化 | 次回確認 | PCスリープ対策 |
| Gateway停止 | 中 | Gateway再起動検討 | Gateway logs | cron依存作業 | 人間が起動 | 起動手順整備 |
| Sheets投入失敗 | 中 | env/validation確認 | Webhook response | 再送信 | JSON修正 | 事前検証 |
| Unauthorized | 高 | token確認 | Apps Script/env | 投入 | token再設定 | 秘密管理 |
| Vercel build失敗 | 中 | build log確認 | Vercel/npm build | 本番反映 | 修正/rollback | CI確認 |
| Git push失敗 | 低〜中 | 認証/通信確認 | Git output | 強制操作 | 再認証 | timeout長め |
| SECRET_TOKEN漏えい疑い | 最高 | 共有停止 | git diff/log | 送信/投入 | ローテーション | スキャン |
| Webhook URL漏えい疑い | 最高 | 共有停止 | git diff/log | 投入 | 再発行 | URL管理 |
| 誤って送信系処理実行 | 高 | 状況記録 | shell/logs | 追加送信 | シート確認 | 権限制御 |
| スプレッドシート誤投入 | 中 | 該当行確認 | Sheets | 追加投入 | 人間が修正 | テスト分離 |
| 未追跡ファイル誤コミット | 中 | 内容確認 | git show | push/公開 | revert等判断 | status確認 |
| 秘密情報をGitに入れた疑い | 最高 | push停止 | git diff/log | push/共有 | 履歴対応判断 | pre-commit確認 |

