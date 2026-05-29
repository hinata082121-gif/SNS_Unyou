# ログ確認ルール

## 対象ログ

- Hermes logs
- Gateway logs
- cron logs
- errors.log
- `npm run build`
- `npm run lint`
- `npm run check:sales-env`
- Sheets Webhook response
- Vercel deployment logs
- Git push logs

## 初動

1. 直近の実行コマンドと時刻を確認
2. エラーメッセージを保存
3. 秘密情報をマスキング
4. 関連ドキュメントを確認
5. 復旧手順を人間が判断

## 共有時のマスキング

Webhook URL、SECRET_TOKEN、APIキー、認証コード、口座情報、個人情報はそのまま貼らない。

