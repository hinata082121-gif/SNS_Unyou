# 日次運用ガイド

## 朝に確認すること

1. `docs/reports/sales/daily/` の当日レポートを確認する
2. 候補が0件または候補不足の場合は `docs/knowledge/troubleshooting-index.md` を見る
3. 送信予定候補がある場合は `docs/quality/pre-send-checklist.md` で確認する
4. 人間が公式サイト/SNS/営業不可表記を確認する
5. 問題なければ人間が手動で営業送信する

## 返信確認

- 返信が来たら `docs/deals/reply-workflow.md` を確認する
- 診断許可が取れそうなら `docs/deals/free-sns-audit-flow.md` を使う
- 18:30商談レビューを使う場合は `daily-reply-and-deal-review.md` を参照する

## 当日レポート保存

- 営業候補: `docs/reports/sales/daily/`
- 品質レビュー: `docs/reports/quality/reviews/`
- 商談/返信レビュー: 必要に応じて `docs/reports/`

## 今日やらないこと

- 営業送信の自動化
- SNS DMの自動化
- 問い合わせフォーム送信の自動化
- スプレッドシート自動更新
- 請求送付、契約判断、価格変更

## 問題が起きた場合

まず `docs/knowledge/troubleshooting-index.md` を確認し、必要なら `hermes/prompts/troubleshooting-helper.md` を使って確認すべきファイルと初動を整理する。

