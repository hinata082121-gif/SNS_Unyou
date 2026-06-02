# 問い合わせ用メールアドレス変更レポート

## 実行日時

2026-06-02 Asia/Tokyo

## 変更理由

従来の問い合わせ用メールアドレスに私用メールも多く届くため、ICHI Socialの公開問い合わせ先を専用の新メールアドレスへ変更した。

## 新しい問い合わせ用メールアドレス

sskhinata0821@gmail.com

## 更新したファイル

- `src/lib/site.ts`

## 旧メールが残っている箇所

検索対象内の追跡対象ファイルでは、旧メールアドレスは残っていない。

## 旧メールを残した理由

旧メールは公開問い合わせ先として残していない。GitHub認証メール、Git author、Hermes Gateway、Google連携、環境変数、認証系設定は今回の変更対象外のため確認・変更していない。

## mailtoリンク確認

`src/lib/site.ts` の `createContactHref()` は `CONTACT_EMAIL` から `mailto:` を生成する。宛先は新しい公開問い合わせ用メールアドレスになり、件名生成処理は維持している。

営業候補店舗側の `mailto:` はICHI Socialの公開問い合わせ先ではないため変更していない。

## lint結果

`npm run lint` 成功。

## build結果

`npm run build` 成功。

## 秘密情報混入チェック結果

差分確認で秘密情報の実値混入は検出されなかった。秘密情報の値は表示していない。

## 変更していないもの

- GitHub認証メール
- Git author / git config user.email
- SSHキーのコメント/認証設定
- Hermes Gatewayの許可メールやログイン用Googleアカウント
- Google Sheets / Apps Script / Vercel / GitHub Secrets の認証情報
- 環境変数ファイル
- OAuth設定
- Gmail送信設定

## Google Sheets投入していないこと

Google Sheetsへの投入は行っていない。`scripts/sheets/send-prospects.mjs` も実行していない。

## 営業送信していないこと

営業メール送信、Instagram DM送信、問い合わせフォーム送信、Instagramコメント投稿、自社SNS投稿は行っていない。

## 秘密情報を表示していないこと

認証情報、トークン、Webhook実URL、APIキー、OAuth URL、認証コード、Gmail app password、Cookie、SNSログイン情報、口座情報、登録番号は表示・保存していない。
