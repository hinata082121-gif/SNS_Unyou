import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `運営者情報 | ${SITE_NAME}`,
  alternates: {
    canonical: "/operator",
  },
};

const operatorRows = [
  ["サービス名", "ICHI Social"],
  ["運営者", "佐々木陽向"],
  ["連絡先", CONTACT_EMAIL],
  ["事業内容", "小規模事業者向けSNS運用支援"],
  ["対応内容", "投稿企画、原稿作成、投稿代行、月次レポート、改善提案"],
  ["対応地域", "オンライン対応"],
];

export default function OperatorPage() {
  return (
    <LegalPage title="運営者情報">
      <LegalSection title="基本情報">
        <dl className="divide-y divide-line">
          {operatorRows.map(([label, value]) => (
            <div key={label} className="grid gap-2 py-4 sm:grid-cols-[160px_1fr]">
              <dt className="font-bold text-primary">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>
      <LegalSection title="住所・電話番号について">
        <p>
          住所および電話番号は、現時点ではサイト上に掲載していません。契約や請求等で必要な場合は、契約時に個別に開示します。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
