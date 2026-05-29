# ローカル開発手順書

## パス

- Windows: `C:\Users\hinat\Documents\Codex\2026-05-27\next-js-react-typescript-tailwind-css`
- WSL: `/mnt/c/Users/hinat/Documents/Codex/2026-05-27/next-js-react-typescript-tailwind-css`

## 基本コマンド

```bash
npm install
npm run dev
npm run lint
npm run build
npm run check:sales-env
```

## .envの扱い

実値はGitに入れない。`.env.example` はダミー値のみ。PowerShellとWSL2では環境変数の設定方法が違う。

## Git操作

`git status --short` で未追跡ファイルを確認し、対象外の実運用ファイルをコミットしない。

## よくあるエラー

- env missing: ローカル環境変数未設定
- build fail: TypeScript/Next.jsエラー
- lint fail: ESLint違反
- push timeout: ネットワーク/認証

