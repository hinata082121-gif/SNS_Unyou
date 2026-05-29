# プロンプト バージョン管理ルール

## 更新タイミング

- 指示違反が起きた
- 保存先を間違えた
- 禁止事項が不足していた
- 出力品質が落ちた
- モデル変更で挙動が変わった
- 業務ルールが変わった

## 変更時のルール

- 変更理由を残す
- 大きな変更は別ファイルまたは変更履歴に残す
- 既存プロンプトを壊さない
- 出力先変更時は関連索引も更新する
- 禁止事項変更時は品質管理/ナレッジ管理にも反映する
- old/deprecated扱いにする場合は理由を書く

## Git commit message

例:

- `docs: update daily sales prompt rules`
- `feat: add ai ops prompt evaluation`
- `fix: prevent forbidden automation in prompt`

## 人間確認が必要な変更

- モデル指定変更
- 自動化範囲変更
- 外部操作を伴う変更
- 秘密情報取り扱い変更
- 本番運用中プロンプトの大幅変更
