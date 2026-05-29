# トラブルシューティング索引

| トラブル | 症状 | 確認するファイル/ログ | よくある原因 | 初動 | やってはいけないこと |
|---|---|---|---|---|---|
| 9:00タスクが実行されない | レポートがない | Hermes local、`docs/hermes-scheduled-automation.md` | WSL2停止、Gateway未起動 | Hermes状態確認 | 勝手に再登録しない |
| daily-sales-candidatesが作成されない | `docs/reports/sales/daily/` に当日分がない | `scheduled-daily-sales-candidates.md` | 保存ルール未反映 | 手動実行で確認 | 送信しない |
| 候補が0件になる | 候補不足 | 日次レポート、`data/prospects/` | 連絡導線不足、Web補助未実行 | 取得ソース確認 | 架空候補を作らない |
| Sheets投入に失敗する | Apps Scriptエラー | `docs/sheets-webhook-usage.md` | URL/トークン/入力規則 | envとJSON確認 | tokenをログ表示しない |
| Unauthorizedになる | 認証エラー | Apps Script設定 | SECRET_TOKEN不一致 | 人間がtoken確認 | tokenを共有しない |
| 業態プルダウン不一致 | B列入力規則違反 | `send-prospects.mjs`, JSON | `美容室`以外 | 値を正規化 | シート側を無断変更しない |
| Webhook URL未設定 | env missing | `check-sales-env.mjs` | 環境変数未設定 | PowerShellで設定 | 実値をコミットしない |
| Gmail/IMAP認証エラー | メール取得失敗 | Hermes設定 | 認証/権限 | 人間が設定確認 | 認証情報を書かない |
| Gemini quota exhausted | モデル上限 | Hermesログ | quota不足 | 時間を置く/モデル確認 | 無理な連続実行 |
| モデルクレジット不足 | 実行失敗 | Hermesログ | 残高不足 | 人間が確認 | APIキー共有 |
| push失敗 | timeout/auth error | Git output | 認証/ネットワーク | 再認証後push | resetしない |
| build失敗 | `npm run build`失敗 | buildログ | TS/Nextエラー | 該当ファイル確認 | 関係ない変更を戻さない |
| lint失敗 | ESLintエラー | lintログ | 記法/未使用 | 該当行修正 | ルール無効化を乱用しない |
| 未追跡ファイルが残る | git statusに?? | `docs/knowledge/untracked-files-policy.md` | 実運用ファイル | 触るか確認 | 勝手に削除/コミットしない |
| 秘密情報混入疑い | token等が見える | `docs/quality/confidential-info-rules.md` | 誤保存 | 値を再表示せず隔離判断 | そのままpushしない |
| AIが指示と違う出力をした | 形式/内容が違う | `docs/ai-ops/failure-analysis-rules.md` | プロンプト不足 | 失敗分析 | そのまま送付しない |
| プロンプト変更後に品質が落ちた | 以前より抽象的/危険 | `docs/ai-ops/prompt-evaluation-framework.md` | 回帰テスト不足 | 回帰テスト | 即本番反映しない |
| モデルquota/credit不足 | 実行失敗 | `docs/ai-ops/cost-and-quota-management.md` | 利用上限 | 頻度/分割確認 | 連続再実行しない |
| 長すぎる出力で扱いづらい | レビュー困難 | `docs/ai-ops/context-management-rules.md` | 制約不足 | 要約/分割 | 重要情報を削らない |
| AIが禁止事項に触れた | 自動送信等を提案 | `docs/ai-ops/human-in-the-loop-rules.md` | 境界不足 | 停止/修正 | 外部操作しない |
| AIが古い前提を使った | 旧価格/旧ルール | `docs/ai-ops/memory-and-history-rules.md` | 履歴依存 | 最新ファイル確認 | 古い会話を信用しない |
| AIが保存先を間違えた | 別パスに出力 | `docs/ai-ops/prompt-design-rules.md` | 出力先指示不足 | ファイル移動/修正 | 放置しない |

## インフラ系トラブルの参照先

- Hermes cron/Gateway: `docs/infra/hermes-cron-monitoring.md`, `docs/infra/hermes-operations.md`
- WSL2/Windows: `docs/infra/wsl2-windows-operations.md`
- Sheets Webhook: `docs/infra/google-sheets-webhook.md`, `docs/infra/apps-script-webhook-rules.md`
- Vercel: `docs/infra/vercel-deployment.md`
- GitHub: `docs/infra/github-workflow.md`
- 秘密情報/環境変数: `docs/infra/environment-variables.md`, `docs/infra/secrets-management.md`
- 障害対応: `docs/infra/incident-response.md`
- AI運用改善: `docs/ai-ops/overview.md`, `docs/ai-ops/failure-analysis-rules.md`, `docs/ai-ops/model-fallback-rules.md`
