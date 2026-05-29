# インフラリスク台帳

| リスク | 兆候 | 影響 | 初動 | 恒久対策 | 人間確認 |
|---|---|---|---|---|---|
| PCスリープでHermes cronが動かない | missed run | 日次レポート欠落 | PC/WSL確認 | 電源設定/補完チェック | 必要 |
| Gateway停止 | cron停止 | タスク未実行 | Gateway確認 | 常駐設定 | 必要 |
| モデルquota/credit不足 | 実行失敗 | レポート欠落 | ログ確認 | 利用量管理 | 必要 |
| Webhook token mismatch | Unauthorized | Sheets投入不可 | token確認 | rotation手順 | 必要 |
| Sheets validation error | 入力規則違反 | 行追加失敗 | JSON確認 | 許可値同期 | 必要 |
| Vercel build失敗 | デプロイ失敗 | 公開遅延 | build log確認 | 事前build | 必要 |
| Git push失敗 | timeout/auth | 反映遅延 | 再認証 | 認証管理 | 必要 |
| 秘密情報漏えい | 実値混入 | セキュリティ事故 | push停止 | スキャン | 必要 |
| 未追跡ファイル誤コミット | 実データ混入 | 情報漏えい | 差分確認 | policy徹底 | 必要 |
| Apps Script redeploy忘れ | 修正未反映 | Webhook失敗 | deploy確認 | checklist化 | 必要 |
| .env未設定 | env missing | スクリプト停止 | env確認 | example整備 | 必要 |
| Gmail/IMAP認証エラー | errors.log増加 | 監視ノイズ | 設定確認 | 不要連携停止 | 必要 |

