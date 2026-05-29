# ファイル命名ルール

## 基本

- 恒久ドキュメントとプロンプトはkebab-caseを基本にする
- 日付つきレポートは `YYYY-MM-DD` 形式にする
- 月次レポートは `YYYY-MM` 形式にする
- 同名ファイルがある場合は上書きせず `-v2`, `-v3` を付ける
- 店舗名をファイル名に入れる場合は英数字または安全なローマ字/slug化を推奨する
- 秘密情報、メールアドレス、電話番号、口座番号、認証情報をファイル名に入れない

## 対象別ルール

- `docs/`: `department-topic.md`
- `hermes/prompts/`: `task-purpose.md`
- `docs/reports/`: `YYYY-MM-DD-purpose.md` または `YYYY-MM-client-name-purpose.md`
- `data/prospects/`: `YYYY-MM-DD-area-score-count.json`
- `data/management/`: `purpose-template.md`

## 例

- `docs/reports/sales/daily/2026-05-29-daily-sales-candidates.md`
- `docs/reports/knowledge/reviews/2026-05-29-weekly-knowledge-review.md`
- `data/prospects/2026-05-29-expanded-area-a.json`

