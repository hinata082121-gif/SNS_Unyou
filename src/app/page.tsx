import type { Metadata } from "next";
import { RedesignEffects } from "@/components/redesign-effects";
import "./redesign.css";

export const metadata: Metadata = {
  title: {
    absolute: "ICHI｜小規模事業者のためのSNS運用・業務整理・HP制作",
  },
  description:
    "ICHIは、小規模事業者・個人事業主・中小企業向けに、SNS運用代行（ICHI Social）、業務整理ツールの開発（ICHI AI Works）、HP・LP制作支援を行う事業です。",
  alternates: {
    canonical: "/",
  },
};

const AIWORKS_MAILTO =
  "mailto:hinata082121@gmail.com?subject=%E3%80%90ICHI%20AI%20Works%E3%80%91%E6%A5%AD%E5%8B%99%E3%81%AE%E5%9B%B0%E3%82%8A%E3%81%94%E3%81%A8%E7%9B%B8%E8%AB%87&body=%E3%81%AF%E3%81%98%E3%82%81%E3%81%BE%E3%81%97%E3%81%A6%E3%80%82ICHI%20AI%20Works%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E7%9B%B8%E8%AB%87%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%0A%0A%E2%96%A0%20%E4%BC%9A%E7%A4%BE%E5%90%8D%E3%83%BB%E5%B1%8B%E5%8F%B7%EF%BC%9A%0A%E2%96%A0%20%E3%81%8A%E5%90%8D%E5%89%8D%EF%BC%9A%0A%E2%96%A0%20%E7%8F%BE%E5%9C%A8%E3%81%AE%E7%AE%A1%E7%90%86%E6%96%B9%E6%B3%95%EF%BC%88%E8%A6%8B%E7%A9%8D%E3%83%BB%E8%BF%94%E7%AD%94%E5%BE%85%E3%81%A1%E3%81%AE%E7%AE%A1%E7%90%86%E3%81%AA%E3%81%A9%EF%BC%89%EF%BC%9A%0A%E2%96%A0%20%E5%9B%B0%E3%82%8A%E3%81%94%E3%81%A8%E3%83%BB%E3%81%94%E7%9B%B8%E8%AB%87%E5%86%85%E5%AE%B9%EF%BC%9A%0A";

const HPLP_MAILTO =
  "mailto:hinata082121@gmail.com?subject=%E3%80%90HP%E3%83%BBLP%E5%88%B6%E4%BD%9C%E3%80%91%E7%9B%B8%E8%AB%87&body=%E3%81%AF%E3%81%98%E3%82%81%E3%81%BE%E3%81%97%E3%81%A6%E3%80%82HP%E3%83%BBLP%E5%88%B6%E4%BD%9C%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E7%9B%B8%E8%AB%87%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%0A%0A%E2%96%A0%20%E5%BA%97%E8%88%97%E5%90%8D%E3%83%BB%E4%BC%9A%E7%A4%BE%E5%90%8D%EF%BC%9A%0A%E2%96%A0%20%E3%81%8A%E5%90%8D%E5%89%8D%EF%BC%9A%0A%E2%96%A0%20%E3%81%94%E5%B8%8C%E6%9C%9B%EF%BC%88HP%E5%88%B6%E4%BD%9C%EF%BC%8FLP%E5%88%B6%E4%BD%9C%EF%BC%8F%E6%9B%B4%E6%96%B0%E3%83%BB%E9%81%8B%E7%94%A8%EF%BC%89%EF%BC%9A%0A%E2%96%A0%20%E7%8F%BE%E5%9C%A8%E3%81%AE%E3%82%B5%E3%82%A4%E3%83%88URL%EF%BC%88%E3%81%82%E3%82%8C%E3%81%B0%EF%BC%89%EF%BC%9A%0A%E2%96%A0%20%E3%81%94%E7%9B%B8%E8%AB%87%E5%86%85%E5%AE%B9%EF%BC%9A%0A";

export default function HomePage() {
  return (
    <div className="rd-root">
      <RedesignEffects variant="top" />
      <div className="rd-progress" aria-hidden="true" />
      <header className="rd-header">
        <div className="rd-wrap rd-header-in">
          <a className="rd-logo" href="/">
            ICHI<small>ICHI PROJECT</small>
          </a>
          <nav className="rd-nav" aria-label="メインナビゲーション">
            <a href="/social">SNS運用（Social）</a>
            <a href="#aiworks">AI Works</a>
            <a href="#hplp">HP・LP制作</a>
            <a href="#operator">運営者情報</a>
          </nav>
        </div>
      </header>

      <div className="rd-wrap">
        <div className="rd-hero">
          <div className="rd-hero-bg" aria-hidden="true">
            一
          </div>
          <div className="rd-hero-inner">
            <p className="rd-kicker">小規模事業者・個人事業主・中小企業の方へ</p>
            <h1>
              <span className="rd-hline">
                <span>小さな事業の「発信」と「業務」を、</span>
              </span>
              <span className="rd-hline">
                <span>
                  <span className="rd-hl">止めない</span>ための3つの支援。
                </span>
              </span>
            </h1>
            <p className="rd-lead">
              ICHIは、SNS運用の代行、社内業務を整理するツールの開発、ホームページ・LPの制作支援を行う事業です。効率化できるところは効率化し、判断と確認は人が行う。その進め方で、無理なく続けられる形をご提案します。
            </p>
            <div className="rd-hero-meta" aria-label="ICHIの特徴">
              <div>
                <b>人が確認する</b>
                <span>投稿前の確認と方針判断は人が担います</span>
              </div>
              <div>
                <b>範囲を先に共有</b>
                <span>できること・できないことを最初にお伝えします</span>
              </div>
              <div>
                <b>直接やり取り</b>
                <span>運営者本人が一貫して対応します</span>
              </div>
            </div>
          </div>
        </div>

        <section
          className="rd-section"
          id="services"
          aria-labelledby="services-title"
        >
          <div className="rd-sec-head rd-reveal">
            <div>
              <p className="rd-sec-label">01 — SERVICES</p>
              <h2 className="rd-sec-title" id="services-title">
                ICHIのサービス
              </h2>
            </div>
            <p className="rd-sec-sub">
              ご相談の内容に合わせて、窓口は3つに分かれています。まずは
              SNS運用代行からご相談ください。
            </p>
          </div>

          <div className="rd-cards" id="serviceCards">
            <article className="rd-card rd-main rd-reveal rd-d1">
              <div className="rd-card-num">
                <span>SERVICE 01</span>
                <i>01</i>
              </div>
              <span className="rd-tag">まずはこちら｜SNS運用代行</span>
              <h3>
                ICHI Social<small>SNS運用代行</small>
              </h3>
              <p>
                投稿企画・原稿作成・投稿代行・月次レポートまでを一括サポートする、小規模事業者・個人事業主向けのSNS運用代行です。契約の前に、
                <strong>無料で投稿案3本</strong>をお作りします。
              </p>
              <ul>
                <li>投稿企画・原稿作成</li>
                <li>投稿代行・月次レポート</li>
                <li>投稿前に人が確認</li>
              </ul>
              <div className="rd-divider" />
              <p className="rd-price">
                月額 <b>¥38,000</b>〜<br />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  初期設計費 先着3社無料
                </span>
              </p>
              <a className="rd-btn rd-btn-primary" href="/social">
                <span>ICHI Socialの詳細を見る</span>
                <span className="rd-arr" aria-hidden="true">
                  →
                </span>
              </a>
            </article>

            <article className="rd-card rd-reveal rd-d2" id="aiworks">
              <div className="rd-card-num">
                <span>SERVICE 02</span>
                <i>02</i>
              </div>
              <span className="rd-tag">開発中｜業務整理ツール</span>
              <h3>
                ICHI AI Works<small>業務整理ツール</small>
              </h3>
              <p>
                中小企業向けに、日々の業務を整理し、社内の確認や引き継ぎを進めやすくするツールを開発しています。第一弾は「見積・返答待ち管理ツール」です。現在開発中です。
              </p>
              <p>
                案件の担当者、次の対応、期限、やり取りの履歴を整理するためのツールです。現在の管理方法や困りごと、導入への関心をお聞かせください。
              </p>
              <div className="rd-divider" />
              <a className="rd-btn rd-btn-ghost" href={AIWORKS_MAILTO}>
                <span>業務の困りごとを相談する</span>
                <span className="rd-arr" aria-hidden="true">
                  →
                </span>
              </a>
              <p className="rd-note">
                ボタンを押すと、件名・本文が入った状態でメールアプリが開きます。
              </p>
            </article>

            <article className="rd-card rd-reveal rd-d3" id="hplp">
              <div className="rd-card-num">
                <span>SERVICE 03</span>
                <i>03</i>
              </div>
              <span className="rd-tag">HP・LP制作／運用支援</span>
              <h3>
                HP・LP制作<small>制作・更新支援</small>
              </h3>
              <p>
                ホームページやランディングページの制作、既存ページの文章・画像の更新をご相談いただけます。スマホでの表示や、お問い合わせまでの導線も確認します。案件ごとに現在の環境とご希望の内容を確認し、対応範囲を合意したうえで進めます。
              </p>
              <div className="rd-divider" />
              <p className="rd-price">
                LP制作 <b>¥95,000</b>〜<br />
                HP制作 <b>¥180,000</b>〜<br />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  （税込・先着3社料金）
                </span>
              </p>
              <a className="rd-btn rd-btn-ghost" href={HPLP_MAILTO}>
                <span>HP・LP制作を相談する</span>
                <span className="rd-arr" aria-hidden="true">
                  →
                </span>
              </a>
              <p className="rd-note">
                通常料金は LP制作 110,000円／HP制作
                200,000円／月額更新 11,000円（税込）。先着3社はHP・LPを合算した契約成立順で、ICHI
                Socialの初期設計費の先着3社とは別枠です。詳細条件はご相談時にご案内します。ボタンを押すと、件名・本文が入った状態でメールアプリが開きます。
              </p>
            </article>
          </div>

          <div className="rd-service-foot rd-reveal">
            <span>迷ったら、まずは SNS運用の無料相談からどうぞ。</span>
            <a href="/social">無料投稿案3本について →</a>
          </div>

          <div className="rd-flow rd-reveal" aria-label="進め方">
            <div className="rd-flow-item">
              <b>
                <span>1</span> 相談・確認
              </b>
              <p>現在の状況と目的をうかがい、対応範囲を先に共有します。</p>
            </div>
            <div className="rd-flow-item">
              <b>
                <span>2</span> 設計・提案
              </b>
              <p>無理なく続けられる形に整理し、進め方をご提案します。</p>
            </div>
            <div className="rd-flow-item">
              <b>
                <span>3</span> 実行・改善
              </b>
              <p>人が確認しながら進め、結果を見て次を整えます。</p>
            </div>
          </div>
        </section>

        <section
          className="rd-section"
          id="operator"
          style={{ paddingTop: 8 }}
        >
          <div className="rd-operator rd-reveal">
            <h2>運営者について</h2>
            <p>
              ICHIは、運営者・佐々木陽向が一人ひとりの事業者さまと直接やり取りしながら運営しています。大きな代理店のような分業体制ではありません。その分、料金と対応範囲をあらかじめ正直に共有し、できること・できないことを先にお伝えする進め方を大切にしています。
            </p>
            <p style={{ marginTop: 12 }}>
              所在地：〒115-0052 東京都北区赤羽北2-1-15／連絡先：
              <a href="mailto:hinata082121@gmail.com">
                hinata082121@gmail.com
              </a>
              （オンライン対応）
              <br />
              ※電話番号はサイト上に掲載していません。契約や請求等で必要な場合は、契約時に個別に開示します。
            </p>
          </div>
        </section>
      </div>

      <footer className="rd-footer">
        <div className="rd-wrap">
          <div className="rd-fnav">
            <a href="/social">ICHI Social（SNS運用代行）</a>
            <a href="#aiworks">ICHI AI Works</a>
            <a href="#hplp">HP・LP制作</a>
            <a href="#operator">運営者情報</a>
          </div>
          <p>
            © ICHI（運営者：佐々木陽向）／お問い合わせ：hinata082121@gmail.com
          </p>
        </div>
      </footer>
    </div>
  );
}
