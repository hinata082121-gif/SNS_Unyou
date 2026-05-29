# GitHub運用ルール

## mainブランチ運用

小規模運用では `main` に直接commit/pushする。ただし、実運用ファイルや秘密情報の混入チェックを必ず行う。

## commit前チェック

- `git status --short`
- 未追跡ファイル確認
- `npm run lint`
- `npm run build`
- 必要に応じて `npm run check:sales-env`
- 秘密情報が差分にないか確認

## 未追跡ファイル

`data/prospects/` や `docs/reports/sales/` の未追跡ファイルは勝手にコミットしない。実運用レポートは秘密情報確認後に人間が判断する。

## push失敗時

認証、ネットワーク、タイムアウト、リモート状態を確認する。`git reset --hard` や強制pushは人間確認なしに行わない。

## 将来的なGitHub Actions

Secrets設定、ログマスキング、PRチェック、Vercel連携の範囲を明確にしてから導入する。

