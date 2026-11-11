import type { Metadata } from "next";
import { RedesignEffects } from "@/components/redesign-effects";
import "../redesign.css";

export const metadata: Metadata = {
  title: {
    absolute: "ICHI Social｜小規模事業者向けSNS運用代行（無料投稿案3本つき）",
  },
  description:
    "小規模事業者・個人事業主向けSNS運用代行 ICHI Social。まずは無料で投稿案3本をお作りします。月額38,000円〜、初期設計費は先着3社無料。投稿前に人が確認する運用体制です。",
  alternates: {
    canonical: "/social",
  },
};

const CONSULT_BODY_TAIL =
  "%E3%81%AF%E3%81%98%E3%82%81%E3%81%BE%E3%81%97%E3%81%A6%E3%80%82ICHI%20Social%E3%81%AE%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87%E3%82%92%E5%B8%8C%E6%9C%9B%E3%81%97%E3%81%BE%E3%81%99";

const FORM_FIELDS =
  "%0A%0A%E2%96%A0%20%E5%BA%97%E8%88%97%E5%90%8D%E3%83%BB%E5%B1%8B%E5%8F%B7%EF%BC%9A%0A%E2%96%A0%20%E3%81%8A%E5%90%8D%E5%89%8D%EF%BC%9A%0A%E2%96%A0%20%E3%81%8A%E4%BD%BF%E3%81%84%E3%81%AESNS%EF%BC%88Instagram%EF%BC%8FX%EF%BC%8FTikTok%20%E7%AD%89%EF%BC%89%EF%BC%9A%0A%E2%96%A0%20%E3%82%A2%E3%82%AB%E3%82%A6%E3%83%B3%E3%83%88%E5%90%8D%E3%81%BE%E3%81%9F%E3%81%AFURL%EF%BC%9A%0A%E2%96%A0%20%E7%84%A1%E6%96%99%E6%8A%95%E7%A8%BF%E6%A1%883%E6%9C%AC%E3%81%AE%E3%81%94%E5%B8%8C%E6%9C%9B%EF%BC%88%E4%BB%BB%E6%84%8F%EF%BC%89%EF%BC%9A%0A%E2%96%A0%20%E3%81%9D%E3%81%AE%E4%BB%96%E3%81%94%E7%9B%B8%E8%AB%87%E5%86%85%E5%AE%B9%EF%BC%9A%0A";

const FREE_CONSULT_MAILTO = `mailto:hinata082121@gmail.com?subject=%E3%80%90ICHI%20Social%E3%80%91%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87%E3%83%BB%E6%8A%95%E7%A8%BF%E6%A1%883%E6%9C%AC%E3%81%AE%E4%BE%9D%E9%A0%BC&body=${CONSULT_BODY_TAIL}%E3%80%82${FORM_FIELDS}`;

const LIGHT_MAILTO = `mailto:hinata082121@gmail.com?subject=%E3%80%90ICHI%20Social%E3%80%91%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87%EF%BC%88%E3%83%A9%E3%82%A4%E3%83%88%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%89&body=${CONSULT_BODY_TAIL}%EF%BC%88%E9%96%A2%E5%BF%83%E3%81%AE%E3%81%82%E3%82%8B%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%9A%E3%83%A9%E3%82%A4%E3%83%88%EF%BC%89%E3%80%82${FORM_FIELDS}`;

const STANDARD_MAILTO = `mailto:hinata082121@gmail.com?subject=%E3%80%90ICHI%20Social%E3%80%91%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87%EF%BC%88%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%89%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%89&body=${CONSULT_BODY_TAIL}%EF%BC%88%E9%96%A2%E5%BF%83%E3%81%AE%E3%81%82%E3%82%8B%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%9A%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%89%EF%BC%89%E3%80%82${FORM_FIELDS}`;

const PREMIUM_MAILTO = `mailto:hinata082121@gmail.com?subject=%E3%80%90ICHI%20Social%E3%80%91%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87%EF%BC%88%E3%83%97%E3%83%AC%E3%83%9F%E3%82%A2%E3%83%A0%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%89&body=${CONSULT_BODY_TAIL}%EF%BC%88%E9%96%A2%E5%BF%83%E3%81%AE%E3%81%82%E3%82%8B%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%9A%E3%83%97%E3%83%AC%E3%83%9F%E3%82%A2%E3%83%A0%EF%BC%89%E3%80%82${FORM_FIELDS}`;

export default function SocialPage() {
  return (
    <div className="rs-root">
      <RedesignEffects variant="social" />
      <header className="rs-header">
        <div className="rs-wrap rs-header-in">
          <a className="rs-logo" href="/social">
            ICHI Social<small>SNS運用代行</small>
          </a>
          <nav className="rs-nav">
            <a href="/">ICHIトップ</a>
            <a href="#plans">料金プラン</a>
            <a href="#price-why">価格の理由</a>
            <a href="#flow">進め方</a>
            <a href="#faq">よくある質問</a>
            <a href="#operator">運営者</a>
          </nav>
        </div>
      </header>

      {/* ファーストビュー */}
      <div className="rs-fv">
        <div className="rs-wrap">
          <span className="rs-eyebrow">
            小規模事業者・個人事業主向け SNS運用代行
          </span>
          <h1>
            まずは<span className="rs-free">無料</span>で、
            <br />
            投稿案3本をお作りします。
          </h1>
          <p className="rs-fv-sub">
            ICHI
            Socialは、投稿企画・原稿作成・投稿代行・月次レポートまでを一括サポートするSNS運用代行です。いきなり契約ではなく、まず無料の投稿案3本で「任せられそうか」を確かめてください。
          </p>
          <div className="rs-points">
            <span>
              月額 <b>¥38,000〜</b>
            </span>
            <span>
              初期設計費 <b>先着3社 ¥0</b>（通常¥120,000）
            </span>
            <span>
              投稿前に <b>人が確認</b>
            </span>
            <span>
              成果保証なし＝<b>正直な運用</b>
            </span>
          </div>
          <div className="rs-cta-block">
            <a className="rs-btn rs-btn-primary" href={FREE_CONSULT_MAILTO}>
              無料で投稿案3本を申し込む（メール）
            </a>
            <p className="rs-cta-note">
              ボタンを押すと、件名・本文が入った状態でメールアプリが開きます。フォーム入力は不要です。
            </p>
          </div>
          <div>
            <span className="rs-slots">
              初期設計費 無料枠{" "}
              <span>
                <span className="rs-num">残り3</span> / 3社
              </span>
              <small>
                ※SNS運用代行の初期設計費の枠です（HP・LP制作の先着枠とは別枠）
              </small>
            </span>
          </div>
        </div>
      </div>

      <div className="rs-wrap">
        {/* 課題 */}
        <section className="rs-section">
          <h2 className="rs-sec-title">
            SNS運用、こんな状態で止まっていませんか？
          </h2>
          <p className="rs-sec-sub">
            小規模事業者・個人事業主の方からよく聞く、4つのつまずきです。
          </p>
          <div className="rs-grid4">
            <div className="rs-card">
              <p className="rs-pain-num">01 / 継続</p>
              <h3>投稿が続かない</h3>
              <p>忙しくて、SNS投稿が後回しになってしまう。</p>
            </div>
            <div className="rs-card">
              <p className="rs-pain-num">02 / 企画</p>
              <h3>ネタがない</h3>
              <p>毎月何を投稿すればよいか分からず、発信が止まる。</p>
            </div>
            <div className="rs-card">
              <p className="rs-pain-num">03 / 改善</p>
              <h3>効果が見えない</h3>
              <p>反応は見ているが、次の改善に繋がっていない。</p>
            </div>
            <div className="rs-card">
              <p className="rs-pain-num">04 / 予算</p>
              <h3>外注は高い</h3>
              <p>本格的なSNS代理店は予算的に厳しい。</p>
            </div>
          </div>
        </section>

        {/* サンプル表示 */}
        <section className="rs-section">
          <h2 className="rs-sec-title">
            運用の進み具合は、毎月見える形で共有します
          </h2>
          <p className="rs-sec-sub">
            下書き作成 → 人が確認 →
            投稿予約、という流れで運用し、月次レポートで数字と改善案を共有します。
          </p>
          <span className="rs-sample-badge">
            サンプル・イメージです（実績数値ではありません）
          </span>
          <div className="rs-dash">
            <p className="rs-dash-flow">
              運用サマリーのイメージ：下書き作成 → 人が確認 → 投稿予約
            </p>
            <div className="rs-stats">
              <div className="rs-stat">
                <small>作成済み・投稿予定</small>
                <b>16件</b>
              </div>
              <div className="rs-stat">
                <small>改善提案</small>
                <b>5件</b>
              </div>
              <div className="rs-stat">
                <small>月次レポート</small>
                <b>作成済み</b>
              </div>
              <div className="rs-stat">
                <small>次月テーマ案</small>
                <b>12件</b>
              </div>
            </div>
          </div>
          <div style={{ height: 16 }} />
          <span className="rs-sample-badge">
            月次レポートのサンプルです（架空の数値です）
          </span>
          <div className="rs-report">
            <h3 style={{ color: "var(--rs-navy)", marginBottom: 8 }}>
              月次レポートサンプル
            </h3>
            <table>
              <tbody>
                <tr>
                  <td>対象月</td>
                  <td>2026年5月（サンプル）</td>
                </tr>
                <tr>
                  <td>投稿本数</td>
                  <td>16本</td>
                </tr>
                <tr>
                  <td>インプレッション</td>
                  <td>28,400</td>
                </tr>
                <tr>
                  <td>いいね数</td>
                  <td>780</td>
                </tr>
                <tr>
                  <td>保存数</td>
                  <td>126</td>
                </tr>
                <tr>
                  <td>プロフィールアクセス</td>
                  <td>340</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 14.5 }}>
              <strong>反応が良かった投稿：</strong>
              Before/After投稿、キャンペーン告知、スタッフ紹介
              <br />
              <strong>次月の改善方針：</strong>保存されやすいノウハウ投稿を増やす
              <br />
              <strong>次月の投稿テーマ案：</strong>12件作成済み
            </p>
            <p className="rs-note" style={{ marginTop: 10 }}>
              ※上記はレポートの形式をお伝えするためのサンプルで、実在のお客様の実績ではありません。数値の確認だけで終わらず、次月の投稿方針まで整理してお渡しします。
            </p>
          </div>
        </section>

        {/* 料金プラン */}
        <section className="rs-section" id="plans">
          <h2 className="rs-sec-title">料金プラン</h2>
          <p className="rs-sec-sub">
            目的や運用量に合わせて選べる3つのプラン。まずは比較しやすいよう、主要な違いを一覧で整理しています。いずれのプランも、アカウント診断・戦略設計・トンマナ設計・運用基盤セットアップを含む初期設計が入口になります。
          </p>
          <div className="rs-grid3">
            <div className="rs-card rs-plan">
              <p className="rs-p-name">ライト</p>
              <p className="rs-p-desc">まず始めたい個人・小規模向け</p>
              <p className="rs-p-price">
                ¥<b>38,000</b> / 月
              </p>
              <ul>
                <li>1SNS対応</li>
                <li>投稿企画 月8本</li>
                <li>投稿文作成</li>
                <li>月次レポート</li>
                <li>チャット相談</li>
              </ul>
              <a className="rs-btn rs-btn-ghost" href={LIGHT_MAILTO}>
                ライトで相談する
              </a>
            </div>
            <div className="rs-card rs-plan rs-reco">
              <span className="rs-reco-badge">おすすめ</span>
              <p className="rs-p-name">スタンダード</p>
              <p className="rs-p-desc">投稿代行と改善提案まで任せたい方向け</p>
              <p className="rs-p-price">
                ¥<b>78,000</b> / 月
              </p>
              <ul>
                <li>2SNS対応</li>
                <li>投稿フル代行 月16本</li>
                <li>コメント監視</li>
                <li>月次レポート＋改善提案</li>
                <li>リサーチ補助</li>
                <li>運用フロー最適化</li>
              </ul>
              <a className="rs-btn rs-btn-primary" href={STANDARD_MAILTO}>
                スタンダードで相談する
              </a>
            </div>
            <div className="rs-card rs-plan">
              <p className="rs-p-name">プレミアム</p>
              <p className="rs-p-desc">集客・採用を本格化したい方向け</p>
              <p className="rs-p-price">
                ¥<b>140,000</b> / 月
              </p>
              <ul>
                <li>3SNSまで対応</li>
                <li>投稿フル代行 月30本〜</li>
                <li>エンゲージメント運用</li>
                <li>月1回の戦略MTG</li>
                <li>成果連動オプション相談可</li>
                <li>改善施策の優先提案</li>
              </ul>
              <a className="rs-btn rs-btn-ghost" href={PREMIUM_MAILTO}>
                プレミアムで相談する
              </a>
            </div>
          </div>
          <p className="rs-note" style={{ marginTop: 10 }}>
            各プランの相談ボタンは、押すと件名・本文が入った状態でメールアプリが開きます。
          </p>

          <div className="rs-initfee">
            <div>
              <p style={{ fontWeight: 800, color: "var(--rs-navy)" }}>
                初期設計費（アカウント診断・戦略設計・トンマナ設計・運用基盤セットアップ）
              </p>
              <p>
                通常 <span className="rs-strike">¥120,000</span> →{" "}
                <b className="rs-big">先着3社限定 ¥0</b>
              </p>
            </div>
            <span
              className="rs-slots"
              style={{ marginTop: 0, border: "1px solid var(--rs-line)" }}
            >
              無料枠{" "}
              <span>
                <span className="rs-num">残り3</span> / 3社
              </span>
            </span>
          </div>
        </section>

        {/* プラン詳細 */}
        <section className="rs-section">
          <h2 className="rs-sec-title">各プランの詳細</h2>
          <p className="rs-sec-sub">
            向いている方・含まれるもの・注意点をプランごとに整理しています。
          </p>
          <div className="rs-grid3">
            <div className="rs-card">
              <h3>ライト詳細</h3>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 6,
                }}
              >
                向いている人
              </p>
              <ul>
                <li>SNS運用を始めたい</li>
                <li>投稿ネタを安定して作りたい</li>
                <li>まずは低コストで試したい</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                含まれるもの
              </p>
              <ul>
                <li>月8本の投稿企画</li>
                <li>投稿文作成</li>
                <li>簡易レポート</li>
                <li>チャット相談</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                注意
              </p>
              <ul>
                <li>投稿作業は顧客側実施、または簡易代行は要相談</li>
                <li>撮影・高度な画像制作は含まない</li>
              </ul>
            </div>
            <div className="rs-card">
              <h3>スタンダード詳細</h3>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 6,
                }}
              >
                向いている人
              </p>
              <ul>
                <li>投稿作成から投稿代行まで任せたい</li>
                <li>2つのSNSを継続的に運用したい</li>
                <li>月次改善まで回したい</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                含まれるもの
              </p>
              <ul>
                <li>月16本の投稿フル代行</li>
                <li>2SNS対応</li>
                <li>コメント監視</li>
                <li>月次レポート</li>
                <li>改善提案</li>
                <li>競合・投稿テーマのリサーチ補助</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                注意
              </p>
              <ul>
                <li>DM完全代行、炎上対応、広告運用は標準外</li>
              </ul>
            </div>
            <div className="rs-card">
              <h3>プレミアム詳細</h3>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 6,
                }}
              >
                向いている人
              </p>
              <ul>
                <li>採用・集客を本格化したい</li>
                <li>投稿量を増やしたい</li>
                <li>戦略MTGも含めて相談したい</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                含まれるもの
              </p>
              <ul>
                <li>月30本以上の投稿フル代行</li>
                <li>3SNSまで対応</li>
                <li>エンゲージメント運用</li>
                <li>月1回の戦略MTG</li>
                <li>優先的な改善提案</li>
              </ul>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--rs-navy)",
                  marginTop: 10,
                }}
              >
                注意
              </p>
              <ul>
                <li>成果連動は個別相談</li>
                <li>広告費・撮影費・高度な動画編集は別途</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 価格の理由（3項目に圧縮） */}
        <section className="rs-section" id="price-why">
          <h2 className="rs-sec-title">なぜ、この価格で提供できるのか</h2>
          <p className="rs-sec-sub">
            料金の考え方と対応範囲をあらかじめ共有し、安心して検討できる状態をつくります。
          </p>
          <div className="rs-grid3">
            <div className="rs-card">
              <h3>1. 価格の考え方</h3>
              <p>
                AIを活用して調査・原稿作成・レポート作成の工数を圧縮し、必要な部分に人の確認を集中させることで、継続しやすい価格を目指しています。裏側では、リサーチ・原稿作成・レポート作成にAIツールを活用し、最終確認は人が行います。AI任せにせず、投稿前の最終確認と方針判断は人が担う体制です。
              </p>
            </div>
            <div className="rs-card">
              <h3>2. 初期設計費について</h3>
              <p>
                通常はアカウント診断、投稿方針の整理、トンマナ設計、競合調査、運用基盤のセットアップを行うため、初期設計費として¥120,000を設定しています。ローンチ初期は実績作成のため、先着3社限定で無料にしています（残り枠は料金プランの欄に表示しています）。
              </p>
            </div>
            <div className="rs-card">
              <h3>3. 対応範囲を先に共有します</h3>
              <p>
                <strong>対応範囲：</strong>
                投稿企画、投稿文作成、投稿カレンダー作成、簡易レポート、改善提案、チャット相談に対応します。
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>対応外範囲：</strong>
                撮影、高度な動画編集、SNS広告運用、炎上対応、DM完全代行、法務判断が必要な投稿確認は標準プラン外です。必要に応じて別途相談となります。
              </p>
            </div>
          </div>
          <div className="rs-grid3" style={{ marginTop: 18 }}>
            <div className="rs-card">
              <h3>ライトプランの設計意図</h3>
              <p>
                投稿を止めないための最低限の運用支援です。企画・原稿・月次レポートを中心に、まずSNS運用の土台を整えたい方向けです。
              </p>
            </div>
            <div className="rs-card">
              <h3>スタンダードプランの設計意図</h3>
              <p>
                投稿代行と改善提案まで含めた主力プランです。2SNSを継続的に運用し、毎月の数字をもとに改善を回していきます。
              </p>
            </div>
            <div className="rs-card">
              <h3>プレミアムプランの設計意図</h3>
              <p>
                採用・集客・キャンペーン運用まで踏み込むプランです。月1回の戦略MTGを行い、より実行力のある改善施策を提案します。
              </p>
            </div>
          </div>
        </section>

        {/* 進め方 */}
        <section className="rs-section" id="flow">
          <h2 className="rs-sec-title">ご契約から運用開始までの流れ</h2>
          <p className="rs-sec-sub">
            効率化と人の確認で、続けやすい運用へ。リサーチ・原稿作成・レポート作成は効率化し、投稿前の確認や方針判断は人が行います。
          </p>
          <div className="rs-steps">
            <div className="rs-step">
              <p className="rs-step-n">01</p>
              <h3>無料相談</h3>
              <p>
                現在のSNS運用状況、目的、課題を確認します。無料投稿案3本のご依頼もこちらから。
              </p>
            </div>
            <div className="rs-step">
              <p className="rs-step-n">02</p>
              <h3>アカウント診断</h3>
              <p>投稿頻度、プロフィール、過去投稿、競合状況を確認します。</p>
            </div>
            <div className="rs-step">
              <p className="rs-step-n">03</p>
              <h3>投稿方針・トンマナ設計</h3>
              <p>誰に、何を、どのような言葉で届けるかを整理します。</p>
            </div>
            <div className="rs-step">
              <p className="rs-step-n">04</p>
              <h3>投稿カレンダー作成</h3>
              <p>月間の投稿テーマ、投稿本数、公開タイミングを設計します。</p>
            </div>
            <div className="rs-step">
              <p className="rs-step-n">05</p>
              <h3>運用開始・月次改善</h3>
              <p>投稿実行後、毎月レポートを作成し、改善案を提案します。</p>
            </div>
          </div>
          <div className="rs-grid3" style={{ marginTop: 18 }}>
            <div className="rs-card">
              <h3>投稿前確認</h3>
              <p>原則、投稿前に確認フローを挟みます。</p>
            </div>
            <div className="rs-card">
              <h3>NG表現管理</h3>
              <p>業種ごとのNGワード・トンマナを管理します。</p>
            </div>
            <div className="rs-card">
              <h3>小規模対応</h3>
              <p>
                個人・店舗・中小企業向けに、無理なく続けられる設計です。投稿して終わりではなく、毎月改善案を提示します。
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="rs-section" id="faq">
          <h2 className="rs-sec-title">よくある質問</h2>
          <p className="rs-sec-sub">
            契約前に確認されることの多い項目をまとめました。
          </p>
          <details>
            <summary>投稿画像も作ってもらえますか？</summary>
            <p>
              簡易的な画像構成案やCanva等での制作補助は対応可能です。撮影や高度なデザイン制作は別途相談です。
            </p>
          </details>
          <details>
            <summary>Instagram以外も対応できますか？</summary>
            <p>
              X、Instagram、TikTok、YouTube
              Shortsなど、目的に応じて相談可能です。
            </p>
          </details>
          <details>
            <summary>最低契約期間はありますか？</summary>
            <p>効果検証のため、原則3ヶ月からを推奨しています。</p>
          </details>
          <details>
            <summary>AIで作った投稿をそのまま出しますか？</summary>
            <p>
              いいえ。下書きや分析にはAIツールも活用しますが、投稿前に人が確認します。
            </p>
          </details>
          <details>
            <summary>炎上対応やDM返信も含まれますか？</summary>
            <p>
              炎上対応・DM完全代行は標準プラン外です。返信案の作成は相談可能です。
            </p>
          </details>
          <details>
            <summary>契約前に相談できますか？</summary>
            <p>
              はい。まずは無料相談で、現在のSNS状況と目的を確認します。無料の投稿案3本もご用意できます。
            </p>
          </details>
          <details>
            <summary>問い合わせはどこからできますか？</summary>
            <p>
              現在はメールで無料相談を受け付けています。各CTAボタンから必要事項を記入して送信できます。ボタンを押すと、件名・本文が入った状態でメールアプリが開きます。
            </p>
          </details>
          <details>
            <summary>成果は保証されますか？</summary>
            <p>
              フォロワー数や売上の増加を保証するものではありません。投稿の継続、内容改善、月次レポートを通じて運用改善を支援します。
            </p>
          </details>
          <details>
            <summary>専用の問い合わせフォームはありますか？</summary>
            <p>
              初期段階ではメールで受け付けています。今後、必要に応じて専用フォームを整備予定です。
            </p>
          </details>
        </section>

        {/* 運営者 */}
        <section className="rs-section" id="operator">
          <div className="rs-operator">
            <div className="rs-who">
              <div className="rs-avatar">佐々木</div>
              <div>
                <h2 style={{ marginBottom: 2 }}>運営者：佐々木陽向</h2>
                <p>ICHI Social 運営者</p>
              </div>
            </div>
            <p>
              「投稿が続かない」「何を発信すればいいか分からない」——小規模な事業者さまから一番多く聞く悩みに、続けられる形で応えたいと思い、このサービスを運営しています。大きな代理店のような分業体制ではなく、運営者本人が直接やり取りし、投稿前の確認まで責任を持って対応します。料金も対応範囲も、契約の前に正直にお伝えします。
            </p>
            <p style={{ marginTop: 12 }}>
              所在地：〒115-0052 東京都北区赤羽北2-1-15
              <br />
              連絡先：
              <a href="mailto:hinata082121@gmail.com">
                hinata082121@gmail.com
              </a>
              <br />
              事業内容：小規模事業者向けSNS運用支援（投稿企画、原稿作成、投稿代行、月次レポート、改善提案）／対応地域：オンライン対応
              <br />
              ※電話番号は、現時点ではサイト上に掲載していません。契約や請求等で必要な場合は、契約時に個別に開示します。
            </p>
          </div>
        </section>

        {/* 最終CTA */}
        <section className="rs-section">
          <div className="rs-final-cta">
            <h2>まずは、今のSNS運用状況を無料で確認します。</h2>
            <p>
              投稿が止まっている、何を発信すればよいか分からない、外注費を抑えて運用を始めたい。そんな方に向けて、現在のSNS状況を確認し、最適な始め方をご提案します。無料の投稿案3本からお試しください。
            </p>
            <div style={{ marginTop: 20 }}>
              <a className="rs-btn rs-btn-primary" href={FREE_CONSULT_MAILTO}>
                無料相談する（メール）
              </a>
              <p className="rs-note" style={{ marginTop: 10 }}>
                ボタンを押すと、件名・本文が入った状態でメールアプリが開きます。
                <br />
                先着3社限定：通常 ¥120,000 の初期設計費を無料（無料枠：残り3 /
                3社）
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="rs-footer">
        <div className="rs-wrap">
          <div className="rs-fnav">
            <a href="/">ICHIトップ</a>
            <a href="#plans">料金プラン</a>
            <a href="#faq">よくある質問</a>
            <a href="#operator">運営者情報</a>
          </div>
          <p>
            © ICHI Social（運営者：佐々木陽向）／〒115-0052
            東京都北区赤羽北2-1-15／お問い合わせ：hinata082121@gmail.com
          </p>
        </div>
      </footer>
    </div>
  );
}
