# 金曜市場分析 自動化土台

## 目的

毎週金曜に、SNS運用代行、小規模店舗支援、AI自動化市場の変化を確認し、翌週の営業、Instagram投稿、サービス改善へ反映する。

## 対象

- 小規模店舗向けSNS運用
- 店舗向けAI自動化
- 競合の訴求変化
- 無料SNS診断への導線
- 翌週の投稿テーマと営業切り口

## 実行方針

今回、実データ取得や市場分析の実行は行わない。
2026-06-05の金曜タスクで公開情報を確認し、summary docsとAgent statusを更新する。

## Agent Officeでの表示

`data/agent-status/tasks/market-analysis-friday-2026-06-05.json` を `/agent-office` で表示し、予定、実行中、完了、確認待ち、停止を確認できるようにする。

## 金曜タスクで記録する項目

- analysisCompleted
- reportCreated
- recommendationCount
- nextExperimentCount
- humanReviewRequired
- nextRunAt

## 禁止事項

- 秘密値を出さない
- 実在営業先データを引用しない
- 営業メール送信やSNS操作を行わない
- 不明な市場情報を断定しない
