# Gmail-ready候補プール不足チェック（2026-07-09）

## 安全集計

- totalReady: 148
- availableForNextSend: 87
- recommendedPoolShortage: 3
- candidatePoolShortage: false（totalReady >= 90 かつ availableForNextSend >= 60 のため blocked 条件には未該当）
- recommendedShortageNeedsReview: true（推奨90件に3件不足）

## 判定

翌日以降の自動送信が即時に候補不足で停止する閾値（totalReady < 90 または availableForNextSend < 60）には該当しません。ただし、availableForNextSend は推奨90件を3件下回っているため、人間確認前提の補充強化を needs_review として促します。

## 補充準備

安全な集計のみを確認しました。候補本体、営業先一覧、メールアドレス一覧、秘密情報の参照が必要になる補充ワークフローは実行していません。自動候補生成は初期運用では needs_review とし、人間確認を前提にします。

## 実施しなかったこと

- Gmail送信なし
- runDailyGmailSalesSend() 実行なし
- 自動返信なし
- Apps Scriptトリガー作成・削除・変更なし
- Google Sheets送信済み更新なし
- Instagram投稿/DM/コメント/フォロー/いいねなし
- 本番メールテンプレート自動差し替えなし
- data/gmail/ 本体、data/prospects/、docs/reports/sales/、tmp/ のGit追加なし
- .env / .env.local の参照・表示・Git追加なし
- APIキー、トークン、Sheet ID、Apps Script URL、Webhook URL、メールアドレス、営業先名、返信本文、Gmailスレッド全文の表示なし
