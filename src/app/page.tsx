import type { ReactNode } from "react";
import {
  CONTACT_EMAIL,
  SITE_LABEL,
  SITE_NAME,
  createContactHref,
} from "@/lib/site";

const navItems = [
  { label: "サービス内容", href: "#solution" },
  { label: "料金", href: "#pricing" },
  { label: "運用フロー", href: "#workflow" },
  { label: "FAQ", href: "#faq" },
];

const footerLinks = [
  ...navItems,
  { label: "プライバシーポリシー", href: "/privacy" },
  { label: "運営者情報", href: "/operator" },
  { label: "サービス提供条件", href: "/terms" },
];

const problems = [
  {
    label: "01 / 継続",
    title: "投稿が続かない",
    body: "忙しくて、SNS投稿が後回しになってしまう。",
  },
  {
    label: "02 / 企画",
    title: "ネタがない",
    body: "毎月何を投稿すればよいか分からず、発信が止まる。",
  },
  {
    label: "03 / 改善",
    title: "効果が見えない",
    body: "反応は見ているが、次の改善に繋がっていない。",
  },
  {
    label: "04 / 予算",
    title: "外注は高い",
    body: "本格的なSNS代理店は予算的に厳しい。",
  },
];

const pricingPlans = [
  {
    name: "ライト",
    price: "¥38,000",
    tag: "まず始めたい個人・小規模向け",
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
    tag: "投稿代行と改善提案まで任せたい方向け",
    features: [
      "2SNS対応",
      "投稿フル代行 月16本",
      "コメント監視",
      "月次レポート＋改善提案",
      "リサーチ補助",
      "運用フロー最適化",
    ],
    cta: "スタンダードで相談する",
    highlighted: true,
  },
  {
    name: "プレミアム",
    price: "¥140,000",
    tag: "集客・採用を本格化したい方向け",
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

const pricingDetails = [
  {
    name: "ライト詳細",
    suited: [
      "SNS運用を始めたい",
      "投稿ネタを安定して作りたい",
      "まずは低コストで試したい",
    ],
    included: ["月8本の投稿企画", "投稿文作成", "簡易レポート", "チャット相談"],
    notes: [
      "投稿作業は顧客側実施、または簡易代行は要相談",
      "撮影・高度な画像制作は含まない",
    ],
  },
  {
    name: "スタンダード詳細",
    suited: [
      "投稿作成から投稿代行まで任せたい",
      "2つのSNSを継続的に運用したい",
      "月次改善まで回したい",
    ],
    included: [
      "月16本の投稿フル代行",
      "2SNS対応",
      "コメント監視",
      "月次レポート",
      "改善提案",
      "競合・投稿テーマのリサーチ補助",
    ],
    notes: ["DM完全代行、炎上対応、広告運用は標準外"],
  },
  {
    name: "プレミアム詳細",
    suited: [
      "採用・集客を本格化したい",
      "投稿量を増やしたい",
      "戦略MTGも含めて相談したい",
    ],
    included: [
      "月30本以上の投稿フル代行",
      "3SNSまで対応",
      "エンゲージメント運用",
      "月1回の戦略MTG",
      "優先的な改善提案",
    ],
    notes: ["成果連動は個別相談", "広告費・撮影費・高度な動画編集は別途"],
  },
];

const operationRoles = [
  {
    title: "リサーチ",
    body: "競合・トレンド・過去投稿を確認し、投稿テーマの材料を整理します。",
  },
  {
    title: "原稿作成",
    body: "業種やトンマナに合わせて、投稿文や見出し案を作成します。",
  },
  {
    title: "運用管理",
    body: "月間投稿カレンダー、確認状況、定期タスクを整理します。",
  },
  {
    title: "レポート",
    body: "投稿結果を整理し、次月の改善方針につなげます。",
  },
  {
    title: "人の確認",
    body: "AI任せにせず、投稿前の最終確認と方針判断を行います。",
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
    body: "通常はアカウント診断、投稿方針の整理、トンマナ設計、競合調査、運用基盤のセットアップを行うため、初期設計費として¥120,000を設定しています。ローンチ初期は実績作成のため、先着3社限定で無料にしています。",
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

const reportMetrics = [
  { label: "投稿本数", value: "16本", bar: "70%" },
  { label: "インプレッション", value: "28,400", bar: "88%" },
  { label: "いいね数", value: "780", bar: "62%" },
  { label: "保存数", value: "126", bar: "46%" },
  { label: "プロフィールアクセス", value: "340", bar: "55%" },
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
    body: "下書きや分析にはAIツールも活用しますが、投稿前に人が確認します。",
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
      "いいえ。下書きや分析にはAIツールも活用しますが、投稿前に人が確認します。",
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
  {
    question: "問い合わせはどこからできますか？",
    answer:
      "現在はメールで無料相談を受け付けています。各CTAボタンから必要事項を記入して送信できます。",
  },
  {
    question: "成果は保証されますか？",
    answer:
      "フォロワー数や売上の増加を保証するものではありません。投稿の継続、内容改善、月次レポートを通じて運用改善を支援します。",
  },
  {
    question: "専用の問い合わせフォームはありますか？",
    answer:
      "初期段階ではメールで受け付けています。今後、必要に応じて専用フォームを整備予定です。",
  },
];

function ConsultationLink({
  children,
  variant = "primary",
  className = "",
  plan = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "inverse";
  className?: string;
  plan?: string;
}) {
  const base =
    "inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const variants = {
    primary: "bg-black text-white hover:bg-soft-black",
    secondary:
      "border border-card-border bg-white text-primary hover:border-black hover:bg-muted",
    inverse:
      "border border-white bg-white text-black hover:bg-line focus-visible:outline-white",
  };

  return (
    <a
      href={createContactHref(plan)}
      aria-label={`${String(children)}、メールで問い合わせる`}
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
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={`mb-9 max-w-3xl sm:mb-12 ${
        align === "center" ? "mx-auto text-center" : ""
      }`}
    >
      {eyebrow ? (
        <p className="mb-3 font-number text-xs font-bold uppercase tracking-[0.16em] text-muted-text">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-balance text-2xl font-black leading-[1.35] tracking-normal text-primary sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 max-w-2xl text-base leading-8 text-secondary">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#"
          aria-label={`${SITE_NAME}（${SITE_LABEL}）トップへ`}
          className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <p className="text-base font-black leading-none text-primary">
            {SITE_NAME}
          </p>
          <p className="mt-1 text-[11px] font-medium text-secondary">
            {SITE_LABEL}
          </p>
        </a>
        <nav
          aria-label="主要ナビゲーション"
          className="hidden items-center gap-7 md:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-bold text-secondary transition hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
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
    <div className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm font-black text-primary">今月の運用サマリー</p>
          <p className="mt-1 text-xs leading-6 text-muted-text">
            下書き作成 → 人が確認 → 投稿予約
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-bold text-secondary">
          <span className="size-2 rounded-full bg-black" aria-hidden="true" />
          作成済み
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["投稿予定", "16件"],
          ["改善提案", "5件"],
          ["月次レポート", "作成済み"],
          ["次月テーマ案", "12件"],
          ["確認待ち", "3件"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={`rounded-lg border border-line bg-white p-4 ${
              index === 4 ? "col-span-2" : ""
            }`}
          >
            <p className="text-xs font-bold text-muted-text">{label}</p>
            <p className="mt-2 font-number text-2xl font-black text-primary">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-primary">投稿文の品質確認中</p>
          <p className="font-number text-xs font-bold text-muted-text">80%</p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-line">
          <div className="h-2 w-4/5 rounded-full bg-black" />
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-line px-4 py-2 text-sm font-bold text-secondary">
            {SITE_LABEL}
          </p>
          <h1 className="text-balance text-4xl font-black leading-[1.18] tracking-normal text-primary sm:text-5xl lg:text-[56px]">
            SNS運用を、止めない。
            <br />
            発信を整え、
            <br />
            毎月改善する。
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-secondary sm:text-lg">
            小規模事業者・個人事業主向けに、投稿企画・原稿作成・投稿代行・月次レポートまでを一括サポート。効率的な制作体制と人の確認を組み合わせ、続けやすいSNS運用を実現します。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ConsultationLink>無料相談する</ConsultationLink>
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-card-border bg-white px-5 text-sm font-bold text-primary transition hover:border-black hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              料金プランを見る
            </a>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-text">
            フォーム入力なしで、メールから簡単に相談できます。
          </p>
        </div>
        <HeroDashboard />
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-3 border-y border-line py-5 sm:grid-cols-2 lg:grid-cols-5">
          {[
            "初期設計費 先着3社 ¥0",
            "月額 ¥38,000〜",
            "月次レポート対応",
            "投稿前に人が確認",
            "Gmailで無料相談受付中",
          ].map((item) => (
            <p
              key={item}
              className="flex items-center gap-3 text-sm font-bold text-primary"
            >
              <span className="size-1.5 rounded-full bg-black" aria-hidden="true" />
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="SNS運用、こんな状態で止まっていませんか？" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-card-border bg-card p-5"
            >
              <p className="font-number text-xs font-bold uppercase tracking-[0.12em] text-muted-text">
                {item.label}
              </p>
              <h3 className="mt-5 text-lg font-black text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="料金プラン"
          body="目的や運用量に合わせて選べる3つのプラン。まずは比較しやすいよう、主要な違いを一覧で整理しています。"
        />
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:overflow-visible">
          <div className="flex snap-x snap-mandatory gap-4 lg:grid lg:grid-cols-3 lg:items-stretch">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex min-w-[82vw] snap-center flex-col rounded-xl border p-5 sm:min-w-[360px] lg:min-w-0 ${
                  plan.highlighted
                    ? "border-black bg-black text-white"
                    : "border-card-border bg-card text-primary"
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute right-4 top-4 rounded-full border border-white/30 px-3 py-1 text-xs font-bold text-white">
                    おすすめ
                  </span>
                ) : null}
                <h3 className="text-xl font-black">{plan.name}</h3>
                <p
                  className={`mt-3 min-h-12 text-sm leading-6 ${
                    plan.highlighted ? "text-neutral-200" : "text-secondary"
                  }`}
                >
                  {plan.tag}
                </p>
                <p className="mt-5">
                  <span className="font-number text-4xl font-black tracking-normal">
                    {plan.price}
                  </span>
                  <span
                    className={`ml-2 text-sm font-bold ${
                      plan.highlighted ? "text-neutral-300" : "text-muted-text"
                    }`}
                  >
                    / 月
                  </span>
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <span
                        className={`mt-1 size-1.5 shrink-0 rounded-full ${
                          plan.highlighted ? "bg-white" : "bg-black"
                        }`}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <ConsultationLink
                  className="mt-6 w-full"
                  variant={plan.highlighted ? "inverse" : "primary"}
                  plan={plan.name}
                >
                  {plan.cta}
                </ConsultationLink>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-black bg-white p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-bold text-secondary">
                アカウント診断・戦略設計・トンマナ設計・運用基盤セットアップを含みます。
              </p>
              <p className="mt-2 text-base font-black text-primary">
                通常 初期設計フィー{" "}
                <span className="font-number">¥120,000</span>
              </p>
            </div>
            <p className="rounded-lg bg-black px-4 py-3 text-center text-lg font-black text-white">
              先着3社限定：初期設計費{" "}
              <span className="font-number">¥0</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingDetail() {
  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="各プランの詳細"
          body="比較カードでは概要を確認し、詳細カードでは向いている方・含まれるもの・注意点を整理しています。"
        />
        <div className="space-y-5">
          {pricingDetails.map((detail) => (
            <article
              key={detail.name}
              className="rounded-xl border border-card-border bg-card p-5 sm:p-6"
            >
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1fr_1fr]">
                <div>
                  <p className="font-number text-xs font-bold uppercase tracking-[0.14em] text-muted-text">
                    Plan Detail
                  </p>
                  <h3 className="mt-3 text-xl font-black text-primary">
                    {detail.name}
                  </h3>
                </div>
                <ListBlock title="向いている人" items={detail.suited} />
                <ListBlock title="含まれるもの" items={detail.included} />
              </div>
              <div className="mt-5 rounded-lg border border-line bg-muted p-4">
                <ListBlock title="注意" items={detail.notes} compact />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ListBlock({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-black text-primary">{title}</h4>
      <ul className={compact ? "mt-3 space-y-2" : "mt-3 space-y-3"}>
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-7 text-secondary">
            <span className="mt-3 size-1.5 shrink-0 rounded-full bg-black" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Solution() {
  return (
    <section id="solution" className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="効率化と人の確認で、続けやすい運用へ"
          body="リサーチ・原稿作成・レポート作成は効率化し、投稿前の確認や方針判断は人が行います。スピードと品質管理を両立する運用体制です。"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {operationRoles.map((item, index) => (
            <article
              key={item.title}
              className="rounded-xl border border-card-border bg-card p-5"
            >
              <p className="font-number text-xs font-black text-muted-text">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-lg font-black text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl rounded-lg border border-line bg-muted p-4 text-center text-sm leading-7 text-secondary">
          裏側では、リサーチ・原稿作成・レポート作成にAIツールを活用し、最終確認は人が行います。
        </p>
      </div>
    </section>
  );
}

function PricingReport() {
  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="なぜ、この価格で提供できるのか"
          body="料金の内訳と対応範囲をあらかじめ共有し、安心して検討できる状態をつくります。"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {pricingReports.map((item, index) => (
            <article
              key={item.title}
              className={`rounded-xl border border-card-border bg-card p-5 ${
                index === pricingReports.length - 1 ? "md:col-span-2" : ""
              }`}
            >
              <p className="font-number text-xs font-black text-muted-text">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-base font-black text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="ご契約から運用開始までの流れ" />
        <div className="relative grid gap-4 lg:grid-cols-5">
          <div
            className="absolute left-0 right-0 top-10 hidden h-px bg-line lg:block"
            aria-hidden="true"
          />
          {workflowSteps.map((step) => (
            <article
              key={step.number}
              className="relative rounded-xl border border-card-border bg-card p-5"
            >
              <p className="font-number text-4xl font-black text-primary">
                {step.number}
              </p>
              <h3 className="mt-4 text-base font-black text-primary">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MonthlyReport() {
  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="毎月、数字と改善案をレポートで共有"
          body="数値の確認だけで終わらず、次月の投稿方針まで整理します。"
        />
        <div className="rounded-xl border border-card-border bg-card p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-2 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-number text-xs font-bold uppercase tracking-[0.16em] text-muted-text">
                Sample Monthly Report
              </p>
              <h3 className="mt-2 text-xl font-black text-primary">
                月次レポートサンプル
              </h3>
            </div>
            <p className="text-sm font-bold text-secondary">対象月：2026年5月</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {reportMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-line bg-white p-4"
              >
                <p className="text-xs font-bold text-muted-text">{metric.label}</p>
                <p className="mt-2 font-number text-3xl font-black text-primary">
                  {metric.value}
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-line">
                  <div
                    className="h-1.5 rounded-full bg-black"
                    style={{ width: metric.bar }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              ["反応が良かった投稿", "Before/After投稿、キャンペーン告知、スタッフ紹介"],
              ["次月の改善方針", "保存されやすいノウハウ投稿を増やす"],
              ["次月の投稿テーマ案", "12件作成済み"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-line p-5">
                <h3 className="text-base font-black text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="安心して任せられる運用体制" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {trustItems.map((item, index) => (
            <article
              key={item.title}
              className="rounded-xl border border-card-border bg-card p-5"
            >
              <p className="font-number text-xs font-black text-muted-text">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-base font-black text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeading title="よくある質問" />
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-card-border bg-card p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-primary transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-7 text-secondary">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-black px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-balance text-2xl font-black tracking-normal sm:text-4xl">
          まずは、今のSNS運用状況を無料で確認します。
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-neutral-200">
          投稿が止まっている、何を発信すればよいか分からない、外注費を抑えて運用を始めたい。そんな方に向けて、現在のSNS状況を確認し、最適な始め方をご提案します。
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <ConsultationLink variant="inverse">無料相談する</ConsultationLink>
          <p className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white">
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
    <footer className="bg-off-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-lg font-black">{SITE_NAME}</p>
          <p className="mt-2 text-sm text-neutral-300">{SITE_LABEL}</p>
          <p className="mt-4 text-xs text-neutral-400">
            © 2026 {SITE_NAME}. All rights reserved.
          </p>
        </div>
        <nav aria-label="フッターナビゲーション" className="flex flex-wrap gap-4">
          {footerLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-bold text-neutral-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {item.label}
            </a>
          ))}
          <a
            href={createContactHref()}
            className="text-sm font-bold text-neutral-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            お問い合わせ
          </a>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs leading-6 text-neutral-500">
        メールで無料相談受付中：{CONTACT_EMAIL}
      </p>
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
        <Pricing />
        <PricingDetail />
        <Solution />
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
