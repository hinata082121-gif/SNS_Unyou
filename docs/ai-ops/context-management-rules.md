# コンテキスト管理ルール

## AIに渡すべき情報

- 目的
- 現在の状況
- 直近の完了事項
- 既存部門一覧
- 重要な禁止事項
- 出力先
- 参照すべき索引

## 渡さない情報

- APIキー
- SECRET_TOKEN
- Webhook URLの実値
- SNSログイン情報
- 口座情報
- 個人情報
- 顧客名簿/予約情報

## 未追跡ファイル

未追跡ファイルは勝手に削除/コミットしない。必要なら `docs/knowledge/untracked-files-policy.md` を参照する。

## 索引

- 目的別: `docs/knowledge/use-case-navigation.md`
- ドキュメント: `docs/knowledge/document-index.md`
- プロンプト: `docs/knowledge/prompt-index.md`
- タスク: `docs/knowledge/task-index.md`

## 長すぎる場合

要約してから進める。古い情報と新しい情報が衝突する場合は新しい指示を優先し、推測しない。
