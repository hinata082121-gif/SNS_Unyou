# 依存関係メンテナンスルール

## 確認対象

- `package.json`
- lockfile
- Next.js / React / TypeScript / Tailwind
- ESLint
- Node.js runtime
- Hermes/Codex周辺ツール

## 方針

- むやみにアップデートしない
- major updateは別作業に分ける
- security修正は影響範囲を確認する
- update後は `npm run lint` と `npm run build`
- Vercel buildも確認する

## 記録

更新した依存、理由、確認結果、rollback方法を残す。

