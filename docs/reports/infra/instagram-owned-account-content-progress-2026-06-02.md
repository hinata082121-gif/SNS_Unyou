# Instagram自社アカウント運用コンテンツ進捗確認 2026-06-02

## 調査目的

2026-06-02の営業DM10件完了後、営業DM運用ではなく、ICHI Social自身のInstagram自社アカウント運用に関するコンテンツ制作の進捗を棚卸しした。
Hermes Agent / Agent Officeから見て、方針、投稿案、制作物、実行状況、次タスクが分かる状態に整理する。

## 確認した範囲

- `data/agent-status/tasks/`
- `docs/`
- `docs/reports/`
- `docs/reports/infra/`
- `docs/reports/sales/`
- `scripts/`
- `tmp/`
- プロジェクトルートのREADMEおよび関連Markdown/JSON/JS/TSファイル

検索時は営業リスト系ファイル、Instagram URL、DM本文、Webhook URL、トークン、認証情報を詳細表示しない方針で確認した。

## 見つかった既存ファイル

### 自社Instagram / 自社SNS運用に直接関係するファイル

- `docs/pr/self-sns-strategy.md`
  - 自社SNSの目的、ターゲット、主要チャネル、投稿頻度、初期3か月方針、営業活動との連携、無料SNS診断導線が整理済み。
- `docs/pr/brand-message.md`
  - ICHI Socialのブランドコンセプト、ターゲット、約束する価値、約束しないこと、トーン、CTA例が整理済み。
- `docs/pr/content-pillars.md`
  - 自社発信の柱、投稿例、ショート動画例、CTA、注意点が整理済み。
- `docs/pr/post-idea-bank.md`
  - Instagram営業連動、プロフィール改善、投稿ネタ不足、業態別、予約導線、無料SNS診断、裏側発信など、合計53件程度の投稿テーマ/形式/CTA/注意点が整理済み。
- `docs/pr/launch-content-plan.md`
  - 初期30日間の投稿テーマとショート動画台本案8件が整理済み。
- `docs/pr/social-profile-template.md`
  - Instagramプロフィール案、X/TikTok/YouTube/note向けプロフィール案、リンク導線、固定投稿案、ハイライト案、避ける表現が整理済み。
- `docs/pr/monthly-pr-calendar-template.md`
  - 月間カレンダーのテンプレートは存在。ただし対象月、目的、重点テーマ、投稿一覧は未入力。
- `docs/pr/short-video-script-template.md`
  - ショート動画台本テンプレートは存在。ただし個別台本は未入力テンプレート中心。
- `docs/pr/content-review-checklist.md`
  - 投稿前チェックリスト、投稿保留条件、品質管理部門との接続が整理済み。
- `docs/pr/platform-rules.md`
  - Instagram/X/TikTok/YouTube Shorts/note別の役割、形式、頻度、CTA、避ける内容が整理済み。
- `docs/pr/sample-content-rules.md`
  - サンプル投稿・サンプル改善案の安全ルールが整理済み。
- `docs/pr/pr-stage-rules.md`
  - 自社SNS・広報ステージ管理ルールが整理済み。
- `docs/pr/overview.md`
  - 自社SNS・広報部門の概要ファイル。

### Agent Office / Hermes連携に関係するファイル

- `docs/agent-office.md`
  - Agent Officeの概要、表示、禁止事項が整理済み。
- `data/agent-status/tasks/*.json`
  - 既存タスクは9件確認済み。
  - ただし調査時点では、Instagram自社アカウント運用コンテンツ専用のタスクJSONは見つからなかった。

### 営業DM運用に関係するファイル

- `docs/reports/sales/` 配下に本日営業関連のレポートあり。
- `data/prospects/` 配下に営業候補JSONあり。
- これらは営業データを含むため、今回の自社コンテンツ棚卸しでは詳細表示・Git追加対象から除外した。

## 自社Instagram運用に関する進捗

判定: **B. 企画途中**

理由:

- 方針、ターゲット、投稿頻度、CTA、営業DMとの役割分担は整理済み。
- 投稿テーマ一覧、固定投稿案、プロフィール文案、ハイライト案、投稿シリーズ案は十分に存在する。
- 初期30日間のテーマ表とショート動画案はある。
- 一方で、投稿ごとの完成原稿、カルーセル枚ごとの本文、個別リール台本、キャプション、ハッシュタグ、素材メモ、Canvaテンプレ設計、実月の投稿カレンダー、投稿済み/予約済み記録は不足または未確認。
- Agent Office上で自社Instagramコンテンツ制作専用の進捗タスクは未作成だったため、今回タスク化した。

## 確認項目別の状態

| 項目 | 状態 | 根拠 |
|---|---|---|
| アカウントの目的 | 作成済み | `docs/pr/self-sns-strategy.md` |
| ターゲット | 作成済み | `docs/pr/self-sns-strategy.md`, `docs/pr/brand-message.md` |
| 投稿ジャンル | 作成済み | `docs/pr/content-pillars.md`, `docs/pr/post-idea-bank.md` |
| 投稿頻度 | 作成済み | `docs/pr/self-sns-strategy.md`, `docs/pr/platform-rules.md` |
| KPI | 一部作成済み | 保存数、プロフィールアクセス、リンククリック、無料SNS診断問い合わせ、フォロー増加の確認方針あり。ただし具体目標値は未設定。 |
| 導線設計 | 一部作成済み | 無料SNS診断、LP、プロフィールリンク、固定投稿への導線あり。実アカウント反映状況は未確認。 |
| 営業DMとの役割分担 | 作成済み | 営業前後に見られる信頼材料として自社SNSを使う方針あり。 |
| 投稿テーマ一覧 | 作成済み | `docs/pr/post-idea-bank.md`, `docs/pr/launch-content-plan.md` |
| リール案 | 一部作成済み | `docs/pr/launch-content-plan.md` にショート動画台本案あり。個別完成台本は不足。 |
| カルーセル投稿案 | 一部作成済み | 投稿テーマ/形式は多数あり。枚ごとの本文は不足。 |
| ストーリーズ案 | 未着手/未確認 | 専用設計ファイルは見つからず。 |
| 固定投稿案 | 作成済み | `docs/pr/social-profile-template.md` |
| プロフィール文案 | 作成済み | `docs/pr/social-profile-template.md` |
| ハイライト設計 | 作成済み | `docs/pr/social-profile-template.md` |
| 投稿シリーズ案 | 作成済み | `docs/pr/content-pillars.md`, `docs/pr/post-idea-bank.md` |
| 台本 | 一部作成済み | ショート動画台本案/テンプレートはあるが、完成台本は不足。 |
| キャプション | 未着手/未確認 | 完成キャプション集は見つからず。 |
| ハッシュタグ案 | 未着手/未確認 | 専用ファイルや一覧は見つからず。 |
| 画像/動画素材メモ | 未着手/未確認 | 素材棚卸し・素材指示の実ファイルは見つからず。 |
| Canva等テンプレ設計メモ | 未着手/未確認 | 専用メモは見つからず。 |
| 投稿用チェックリスト | 作成済み | `docs/pr/content-review-checklist.md` |
| 投稿カレンダー | テンプレートのみ | `docs/pr/monthly-pr-calendar-template.md` は未入力。 |
| 投稿済み記録 | 未確認 | 投稿済み/予約投稿済みの記録は見つからず。 |
| 投稿予約済み記録 | 未確認 | 予約投稿済みの記録は見つからず。 |

## 営業DM運用と自社アカウント運用の切り分け

### 営業DM運用

- 見込み客候補の選定、検収、手動DM、Google Sheets管理、返信確認、フォローアップ管理が中心。
- 2026-06-02の営業DM10件は完了済み、Google Sheets反映済みという前提。
- 次の主作業は2026-06-05の返信確認・フォローアップ管理。
- 今回は追加候補生成、追加DM、Sheets再送信を行わない。

### 自社アカウント運用

- ICHI Social自身の信頼形成、無料SNS診断への自然導線、営業前後に見られる補助コンテンツが中心。
- 投稿原稿、台本、キャプション、ハッシュタグ、素材指示、カレンダーを作り、人間が確認して手動投稿する。
- 自動投稿、予約投稿、SNSログイン、DM/コメント操作は行わない。

## 完了済み

- 自社SNS戦略の骨子
- ブランドメッセージ
- 投稿テーマの柱
- 投稿アイデア集
- 初期30日投稿テーマ
- 固定投稿案
- Instagramプロフィール案
- ハイライト案
- 投稿前チェックリスト
- プラットフォーム別発信ルール
- サンプル投稿安全ルール
- 自社SNS・広報ステージ管理ルール

## 未着手 / 不足

- 実アカウントのプロフィール反映状況確認
- 初回固定投稿3本の完成原稿
- カルーセル各枚の本文
- 個別リール台本の完成版
- キャプション集
- ハッシュタグ案
- ストーリーズ案
- 画像/動画素材メモ
- Canva等のテンプレ設計メモ
- 実月の投稿カレンダー
- 投稿済み/投稿予約済みの記録
- KPIの数値目標
- Agent Office上での継続進捗タスク運用

## 人間確認待ち

- 自社Instagramアカウントの実プロフィール文にどの案を採用するか
- 最初に固定投稿化する3テーマ
- 週1運用か週2運用か
- 投稿曜日: 水曜のみか、水曜+金曜か
- 無料SNS診断CTAの表現
- LP/問い合わせ導線の実URL運用
- Canvaテンプレのデザイン方向性
- 投稿可否判断と投稿作業そのもの

## 次にやるべきこと

1. 人間が自社Instagramプロフィール案を確認し、実アカウントへ反映するか判断する。
2. 初回固定投稿3本を選ぶ。
   - ICHI Socialで支援できること
   - 無料SNS診断で見るポイント
   - 小規模店舗SNSのよくある課題
3. 初回投稿セットとして、以下を作る。
   - カルーセル構成
   - 画像テキスト
   - キャプション
   - ハッシュタグ
   - 素材/Canva指示
   - 投稿前チェック結果
4. 実月の投稿カレンダーを作る。
5. 投稿は人間が手動で行い、投稿済み記録を別途残す。
6. Agent Officeで「営業DM」と「自社発信コンテンツ制作」を分けて進捗確認する。

## 注意事項

- 架空実績、架空URL、成果保証表現は使わない。
- 実在店舗の情報、Instagram URL、DM文面を無断で自社投稿に使わない。
- 医療/美容/飲食表現は断定しない。
- 自社Instagram投稿も必ず人間確認後に手動で行う。
- 自動投稿、予約投稿、DM、コメント、フォロー、いいねは行わない。
- SNSログイン情報、Webhook URL、トークン、秘密情報は表示・保存・コミットしない。

## 今回行っていないこと

- 営業候補生成は行っていない。
- Google Sheets再送信は行っていない。
- `scripts/sheets/send-prospects.mjs` は実行していない。
- Instagram DM送信は行っていない。
- Instagramコメント投稿は行っていない。
- Instagram投稿/予約投稿は行っていない。
- 自動フォロー/いいねは行っていない。
- 営業データの詳細表示は行っていない。
- 秘密情報の表示は行っていない。

## 2026-06-02 初回投稿セット制作フェーズ

2026-06-02に、以下の初回投稿準備物を追加作成した。

- `docs/pr/instagram-initial-post-set-2026-06-02.md`
- `docs/pr/instagram-reels-scripts-2026-06-02.md`
- `docs/pr/instagram-caption-hashtag-bank-2026-06-02.md`
- `docs/pr/instagram-two-week-calendar-2026-06-02.md`
- `data/agent-status/tasks/instagram-initial-post-set-2026-06-02.json`

これにより、自社Instagramコンテンツ制作は **B: 企画途中** から **C候補: 制作準備中** へ進められる状態になった。
ただし、実投稿、予約投稿、DM、コメント、Google Sheets再送信、営業候補生成は行っていない。

公開前には、人間が以下を確認する。

- プロフィール文
- 問い合わせ/無料SNS診断の導線
- 固定投稿3本の投稿順
- リール2本のテロップと音源
- CTAの強さ
- Canva等の画像素材と権利
- 成果保証や誇大表現に見えないか
