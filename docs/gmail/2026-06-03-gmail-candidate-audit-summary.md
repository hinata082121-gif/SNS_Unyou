# 2026-06-03 Gmail送信用候補 監査サマリー

## 目的

既存営業候補から、Gmail営業メール30件送信に使える候補があるかを確認する。

## 走査対象

- `data/prospects/` 配下の実候補JSON
- テンプレート/テスト用JSONは集計対象外
- 営業先名、メール宛先、URLの詳細は本サマリーに記載しない

## 集計結果

| 分類 | 件数 |
|---|---:|
| 走査ファイル数 | 10 |
| 総候補数 | 118 |
| gmail_ready | 0 |
| needs_email | 31 |
| contact_form_only | 47 |
| instagram_only | 10 |
| excluded_duplicate | 0 |
| excluded_sent | 30 |
| excluded_unsubscribe | 0 |
| excluded_needs_human | 0 |

## 判定

既存候補だけでは、Gmail営業メール送信に必要な30件を確保できない。

既存候補の多くはInstagram起点または問い合わせフォーム起点であり、Gmail送信用メール宛先が未取得だった。

## 出力したGit管理外ファイル

- `data/gmail/outbox/2026-06-03-gmail-ready-candidates.json`
- `data/gmail/outbox/2026-06-03-gmail-candidate-classification.json`

これらは営業先情報を含む可能性があるためGit追加しない。

## 次アクション

Gmail-ready候補を30件にするため、公開メール宛先つき候補の追加収集が必要。
