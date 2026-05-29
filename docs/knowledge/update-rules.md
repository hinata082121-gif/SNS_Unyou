# ドキュメント更新ルール

## いつ更新するか

- 新しい部門、プロンプト、レポート保存先を追加した時
- 価格、プラン、初期費用、キャンペーンが変わった時
- 対象地域、対象業態、営業除外条件が変わった時
- Hermesスケジュールタスクを追加/変更/停止した時
- サービス範囲、納品範囲、請求ルール、解約ルールが変わった時
- 禁止事項や秘密情報ルールが変わった時

## 変更別の更新先

- 価格変更: `docs/admin/`, `docs/deals/`, `docs/management/`, LP文言
- 営業ルール変更: `docs/sales-targeting-rules.md`, `docs/sales/`, `hermes/prompts/*sales*`
- 自動化タスク変更: `docs/hermes-scheduled-automation.md`, `docs/knowledge/task-index.md`
- サービス範囲変更: `docs/delivery/`, `docs/admin/scope-and-disclaimer.md`
- 法務/請求変更: `docs/admin/`, `docs/quality/pre-contract-checklist.md`
- 新規レポート保存先追加: `docs/knowledge/report-index.md`

## 古い情報の扱い

古い情報はすぐ削除せず、更新待ち、古くなった可能性あり、アーカイブ候補として扱う。Git履歴に残るため、秘密情報が混入した場合は通常の修正だけでなく、漏えい対応を検討する。

## 更新履歴

大きな方針変更は、該当ドキュメント内に変更日、変更内容、理由、関連ファイルを短く残す。

