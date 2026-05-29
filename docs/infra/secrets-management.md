# 秘密情報管理ルール

## 禁止情報

- SECRET_TOKEN
- Webhook URLの実値
- APIキー
- OAuth URL
- 認証コード
- Gmail app password
- SNSログイン情報
- 銀行口座番号
- 適格請求書登録番号の実値
- 顧客情報
- 未公開売上情報

## 保存してよい場所

- ローカル環境変数
- Vercel/GitHubなど公式のSecrets/Environment Variables
- 人間が管理する安全なパスワード管理ツール

## 保存してはいけない場所

- Git管理ファイル
- docs/reports
- Hermes出力
- issue/PRコメント
- チャットログ
- スクリーンショット

## Gitコミット前チェック

`git diff --cached` と秘密情報スキャンを確認する。疑わしい値を見つけたら値を再表示せず、コミットを止める。

## 漏えい疑い時

外部共有を止め、該当秘密情報をローテーションし、Git履歴に入った可能性があれば履歴対応を人間が判断する。

