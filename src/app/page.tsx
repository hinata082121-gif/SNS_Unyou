import type { ReactNode } from "react";

const SERVICE_NAME = "AI SNS Partner";
const SERVICE_LABEL = "AI SNS運用パートナー";
const CONTACT_EMAIL = "contact@example.com";

const navItems = [
  { label: "サービス内容", href: "#solution" },
  { label: "料金", href: "#pricing" },
  { label: "運用フロー", href: "#workflow" },
  { label: "FAQ", href: "#faq" },
];

const problems = [
  {
    title: "投稿が続かない",
    body: "忙しくて、SNS投稿が後回しになってしまう。",
  },
  {
    title: "ネタがない",
    body: "毎月何を投稿すればよいか分からず、発信が止まる。",
  },
  {
    title: "効果が見えない",
    body: "反応は見ているが、次の改善に繋がっていない。",
  },
  {
    title: "外注は高い",
    body: "本格的なSNS代理店は予算的に厳しい。",
  },
];

const solutionRoles = [
  {
    name: "Manus",
    role: "競合・トレンド調査",
    body: "投稿テーマや市場の動きを整理し、企画の材料を集めます。",
  },
  {
    name: "ChatGPT / Claude",
    role: "投稿案・原稿作成",
    body: "業種・トンマナに合わせた投稿文や見出し案を作成します。",
  },
  {
    name: "Hermes Agent",
    role: "運用手順・定期タスク管理",
    body: "顧客ごとの運用方針や定期作業を管理し、継続運用を支援します。",
  },
  {
    name: "Codex",
    role: "集計・レポート自動化補助",
    body: "必要に応じてデータ整理やレポート生成用の補助スクリプトを作成します。",
  },
  {
    name: "Human Review",
    role: "最終確認・品質管理",
    body: "AI任せにせず、人が確認してから納品・投稿します。",
  },
];

const pricingPlans = [
  {
    name: "ライト",
    price: "¥38,000",
    tag: "まず始めたい個人・小規模向け",
    description:
      "投稿作業はお客様側で実施。簡易代行をご希望の場合は要相談です。",
    features: [
      "1SNS対応",
      "投稿企画 月8本",
      "投稿文作成",
      "月次レポート",
      "チャット相談",
    ],
    cta: "ライトで相談する",
    highlighted: false,
  },
  {
    name: "スタンダード",
    price: "¥78,000",
    tag: "本気で伸ばしたい中小向け",
    description:
      "投稿代行と改善提案まで含めた、継続改善の主力プランです。",
    features: [
      "2SNS対応",
      "投稿フル代行 月16本",
      "コメント監視",
      "月次レポート＋改善提案",
      "Manusによるリサーチ補助",
      "AI運用フロー最適化",
    ],
    cta: "スタンダードで相談する",
    highlighted: true,
  },
  {
    name: "プレミアム",
    price: "¥140,000",
    tag: "集客・採用を本格化したい方向け",
    description:
      "採用・集客・キャンペーン運用まで踏み込んで支援します。",
    features: [
      "3SNSまで対応",
      "投稿フル代行 月30本〜",
      "エンゲージメント運用",
      "月1回の戦略MTG",
      "成果連動オプション相談可",
      "改善施策の優先提案",
    ],
    cta: "プレミアムで相談する",
    highlighted: false,
  },
];

const pricingReports = [
  {
    title: "価格の考え方",
    body: "AIを活用して調査・原稿作成・レポート作成の工数を圧縮し、必要な部分に人の確認を集中させることで、継続しやすい価格を目指しています。",
  },
  {
    title: "ライトプランの設計意図",
    body: "投稿を止めないための最低限の運用支援です。企画・原稿・月次レポートを中心に、まずSNS運用の土台を整えたい方向けです。",
  },
  {
    title: "スタンダードプランの設計意図",
    body: "投稿代行と改善提案まで含めた主力プランです。2SNSを継続的に運用し、毎月の数字をもとに改善を回していきます。",
  },
  {
    title: "プレミアムプランの設計意図",
    body: "採用・集客・キャンペーン運用まで踏み込むプランです。月1回の戦略MTGを行い、より実行力のある改善施策を提案します。",
  },
  {
    title: "初期設計費について",
    body: "通常はアカウント診断、投稿方針の整理、トンマナ設計、競合調査、AI運用基盤のセットアップを行うため、初期設計費として¥120,000を設定しています。ローンチ初期は実績作成のため、先着3社限定で無料にしています。",
  },
  {
    title: "対応範囲",
    body: "投稿企画、投稿文作成、投稿カレンダー作成、簡易レポート、改善提案、チャット相談に対応します。",
  },
  {
    title: "対応外範囲",
    body: "撮影、高度な動画編集、SNS広告運用、炎上対応、DM完全代行、法務判断が必要な投稿確認は標準プラン外です。必要に応じて別途相談となります。",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "無料相談",
    body: "現在のSNS運用状況、目的、課題を確認します。",
  },
  {
    number: "02",
    title: "アカウント診断",
    body: "投稿頻度、プロフィール、過去投稿、競合状況を確認します。",
  },
  {
    number: "03",
    title: "投稿方針・トンマナ設計",
    body: "誰に、何を、どのような言葉で届けるかを整理します。",
  },
  {
    number: "04",
    title: "投稿カレンダー作成",
    body: "月間の投稿テーマ、投稿本数、公開タイミングを設計します。",
  },
  {
    number: "05",
    title: "運用開始・月次改善",
    body: "投稿実行後、毎月レポートを作成し、改善案を提案します。",
  },
];

const trustItems = [
  {
    title: "投稿前確認",
    body: "原則、投稿前に確認フローを挟みます。",
  },
  {
    title: "NG表現管理",
    body: "業種ごとのNGワード・トンマナを管理します。",
  },
  {
    title: "月次改善",
    body: "投稿して終わりではなく、毎月改善案を提示します。",
  },
  {
    title: "AI丸投げではない",
    body: "AIで下書き・分析を行い、人間が最終確認します。",
  },
  {
    title: "小規模対応",
    body: "個人・店舗・中小企業向けに、無理なく続けられる設計です。",
  },
];

const faqs = [
  {
    question: "投稿画像も作ってもらえますか？",
    answer:
      "簡易的な画像構成案やCanva等での制作補助は対応可能です。撮影や高度なデザイン制作は別途相談です。",
  },
  {
    question: "Instagram以外も対応できますか？",
    answer:
      "X、Instagram、TikTok、YouTube Shortsなど、目的に応じて相談可能です。",
  },
  {
    question: "最低契約期間はありますか？",
    answer: "効果検証のため、原則3ヶ月からを推奨しています。",
  },
  {
    question: "AIで作った投稿をそのまま出しますか？",
    answer:
      "いいえ。AIで下書き・分析を行い、人間が最終確認します。",
  },
  {
    question: "炎上対応やDM返信も含まれますか？",
    answer:
      "炎上対応・DM完全代行は標準プラン外です。返信案の作成は相談可能です。",
  },
  {
    question: "契約前に相談できますか？",
    answer:
      "はい。まずは無料相談で、現在のSNS状況と目的を確認します。",
  },
];

const reportMetrics = [
  { label: "投稿本数", value: "16本" },
  { label: "インプレッション", value: "28,400" },
  { label: "いいね数", value: "780" },
  { label: "保存数", value: "126" },
  { label: "プロフィールアクセス", value: "340" },
];

function ConsultationLink({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const base =
    "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const variants = {
    primary:
      "bg-primary text-white shadow-sm shadow-blue-600/20 hover:bg-primary-dark",
    secondary:
      "border border-border bg-white text-main hover:border-primary hover:text-primary",
  };

  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      aria-label={`${children}、メールで問い合わせる`}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-12">
      {eyebrow ? (
        <p className="mb-3 text-sm font-bold text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-2xl font-bold tracking-normal text-main sm:text-3xl">
        {title}
      </h2>
      {body ? (
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-sub">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-18 sm:px-6 lg:px-8">
        <a
          href="#"
          aria-label={`${SERVICE_NAME}（${SERVICE_LABEL}）トップへ`}
          className="shrink-0"
        >
          <p className="text-base font-extrabold leading-none text-main">
            {SERVICE_NAME}
          </p>
          <p className="mt-1 text-[11px] font-medium text-sub">
            小規模事業者向けSNS運用代行
          </p>
        </a>
        <nav
          aria-label="主要ナビゲーション"
          className="hidden items-center gap-6 md:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-bold text-sub transition hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <ConsultationLink className="min-w-28 px-4 sm:min-w-32">
          無料相談
        </ConsultationLink>
      </div>
    </header>
  );
}

function HeroDashboard() {
  return (
    <div className="relative rounded-[28px] border border-blue-100 bg-gradient-to-br from-soft-blue via-white to-soft-green p-4 shadow-2xl shadow-blue-900/10 sm:p-6">
      <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-sub">今月の運用サマリー</p>
            <p className="mt-1 text-xs text-sub">AI下書き → 人が確認 → 投稿予約</p>
          </div>
          <span className="rounded-full bg-soft-green px-3 py-1 text-xs font-bold text-emerald-700">
            作成済み
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["投稿予定", "16件"],
            ["改善提案", "5件"],
            ["月次レポート", "作成済み"],
            ["次月テーマ案", "12件"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-white p-3"
            >
              <p className="text-xs font-medium text-sub">{label}</p>
              <p className="mt-2 font-number text-2xl font-extrabold text-main">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-section p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">
              AI
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-main">投稿文の品質確認中</p>
              <div className="mt-2 h-2 rounded-full bg-border">
                <div className="h-2 w-4/5 rounded-full bg-accent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-blue-100 bg-soft-blue px-4 py-2 text-sm font-bold text-primary">
            AIで効率化し、人が品質確認するSNS運用代行
          </p>
          <h1 className="text-balance text-4xl font-black leading-[1.18] tracking-normal text-main sm:text-5xl lg:text-[56px]">
            SNS投稿を、止めない。
            <br />
            AI運用で、
            <br />
            毎月改善する。
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-sub sm:text-lg">
            小規模事業者・個人事業主向けに、投稿企画・原稿作成・投稿代行・月次レポートまでを一括サポート。AIによる効率化と人の確認を組み合わせ、続けやすいSNS運用を実現します。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ConsultationLink>無料相談する</ConsultationLink>
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-bold text-main transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              料金プランを見る
            </a>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "月額 ¥38,000〜",
              "先着3社 初期設計費 ¥0",
              "投稿企画 / 投稿代行 / 月次レポート対応",
              "人が最終確認するAI活用型運用",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-border bg-white p-3 text-sm font-bold text-main"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-soft-green text-xs text-emerald-700">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <HeroDashboard />
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-section px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="SNS運用、こんな状態で止まっていませんか？" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-bold text-main">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-sub">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Solution() {
  return (
    <section id="solution" className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="AIと人の確認を組み合わせた、続けやすいSNS運用"
          body="AIで調査・下書き・分析を効率化し、人が最終確認を行うことで、低コストでも安定したSNS運用を目指します。"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {solutionRoles.map((item) => (
            <article
              key={item.name}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <p className="font-number text-sm font-extrabold text-primary">
                {item.name}
              </p>
              <h3 className="mt-3 text-base font-bold text-main">{item.role}</h3>
              <p className="mt-3 text-sm leading-7 text-sub">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="bg-section px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="料金プラン"
          body="まずは小さく始めたい方から、本格的に集客・採用を伸ばしたい方まで、運用目的に合わせて選べます。"
        />
        <div className="mb-6 rounded-3xl border border-amber-200 bg-warning p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-bold text-amber-800">
                初回のみ / アカウント診断・戦略設計・トンマナ設計・AI運用基盤セットアップ
              </p>
              <p className="mt-2 text-base font-bold text-main">
                通常 初期設計フィー{" "}
                <span className="font-number">¥120,000</span>
              </p>
            </div>
            <p className="rounded-2xl bg-white px-4 py-3 text-center text-lg font-black text-primary shadow-sm">
              先着3社限定：初期設計費{" "}
              <span className="font-number">¥0</span>
            </p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {pricingPlans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${
                plan.highlighted
                  ? "border-primary shadow-xl shadow-blue-900/10 lg:-mt-3 lg:mb-3"
                  : "border-border"
              }`}
            >
              {plan.highlighted ? (
                <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                  おすすめ
                </span>
              ) : null}
              <h3 className="text-xl font-black text-main">{plan.name}</h3>
              <p className="mt-3 text-sm font-bold text-primary">{plan.tag}</p>
              <p className="mt-5">
                <span className="font-number text-4xl font-black tracking-normal text-main sm:text-5xl">
                  {plan.price}
                </span>
                <span className="ml-2 text-sm font-bold text-sub">/ 月</span>
              </p>
              <p className="mt-4 min-h-14 text-sm leading-7 text-sub">
                {plan.description}
              </p>
              <ul className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-main">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-soft-green text-xs font-bold text-emerald-700">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <ConsultationLink
                className="mt-6 w-full"
                variant={plan.highlighted ? "primary" : "secondary"}
              >
                {plan.cta}
              </ConsultationLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingReport() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="なぜ、この価格で提供できるのか"
          body="料金の内訳と対応範囲をあらかじめ共有し、安心して検討できる状態をつくります。"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {pricingReports.map((item, index) => (
            <article
              key={item.title}
              className={`rounded-2xl border border-border bg-white p-5 shadow-sm ${
                index === pricingReports.length - 1 ? "md:col-span-2" : ""
              }`}
            >
              <h3 className="text-base font-bold text-main">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-sub">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="bg-section px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="ご契約から運用開始までの流れ" />
        <div className="grid gap-4 lg:grid-cols-5">
          {workflowSteps.map((step) => (
            <article
              key={step.number}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <p className="font-number text-sm font-black text-primary">
                {step.number}
              </p>
              <h3 className="mt-3 text-base font-bold text-main">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-sub">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MonthlyReport() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="毎月、数字と改善案をレポートで共有"
          body="数値の確認だけで終わらず、次月の投稿方針まで整理します。"
        />
        <div className="rounded-3xl border border-border bg-white p-4 shadow-xl shadow-blue-900/10 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-primary">Sample Monthly Report</p>
              <h3 className="mt-2 text-xl font-black text-main">
                月次レポートサンプル
              </h3>
            </div>
            <p className="text-sm font-bold text-sub">対象月：2026年5月</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {reportMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-border bg-section p-4"
              >
                <p className="text-xs font-bold text-sub">{metric.label}</p>
                <p className="mt-2 font-number text-3xl font-black text-main">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border p-5">
              <h3 className="text-base font-bold text-main">
                反応が良かった投稿
              </h3>
              <p className="mt-3 text-sm leading-7 text-sub">
                Before/After投稿、キャンペーン告知、スタッフ紹介
              </p>
            </div>
            <div className="rounded-2xl border border-border p-5">
              <h3 className="text-base font-bold text-main">次月の改善方針</h3>
              <p className="mt-3 text-sm leading-7 text-sub">
                保存されやすいノウハウ投稿を増やす
              </p>
            </div>
            <div className="rounded-2xl border border-border p-5">
              <h3 className="text-base font-bold text-main">
                次月の投稿テーマ案
              </h3>
              <p className="mt-3 text-sm leading-7 text-sub">
                12件作成済み
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="bg-section px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="安心して任せられる運用体制" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {trustItems.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-bold text-main">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-sub">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeading title="よくある質問" />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-main focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-soft-blue text-primary transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-7 text-sub">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-primary px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-balance text-2xl font-black tracking-normal sm:text-4xl">
          まずは、今のSNS運用状況を無料で確認します。
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-blue-50">
          投稿が止まっている、何を発信すればよいか分からない、外注費を抑えて運用を始めたい。そんな方に向けて、現在のSNS状況を確認し、最適な始め方をご提案します。
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            aria-label="無料相談する、メールで問い合わせる"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-primary transition hover:bg-soft-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            無料相談する
          </a>
          <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/20">
            先着3社限定：通常{" "}
            <span className="font-number">¥120,000</span>{" "}
            の初期設計費を無料
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-lg font-extrabold text-main">{SERVICE_NAME}</p>
          <p className="mt-2 text-sm text-sub">小規模事業者向けSNS運用代行</p>
          <p className="mt-4 text-xs text-sub">
            © 2026 {SERVICE_NAME}. All rights reserved.
          </p>
        </div>
        <nav aria-label="フッターナビゲーション" className="flex flex-wrap gap-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-bold text-sub hover:text-primary"
            >
              {item.label}
            </a>
          ))}
          {/* TODO: 公開前に正式メールアドレスへ差し替え */}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-sm font-bold text-sub hover:text-primary"
          >
            お問い合わせ
          </a>
        </nav>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Pricing />
        <PricingReport />
        <Workflow />
        <MonthlyReport />
        <Trust />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
