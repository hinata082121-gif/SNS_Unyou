import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${SITE_NAME}`,
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="プライバシーポリシー">
      <LegalSection title="取得する情報">
        <p>
          ICHI Socialでは、お問い合わせやサービス提供に必要な範囲で、氏名、メールアドレス、会社名・店舗名、SNS URL、問い合わせ内容などの情報を取得する場合があります。
        </p>
      </LegalSection>
      <LegalSection title="利用目的">
        <ul className="list-disc space-y-2 pl-5">
          <li>問い合わせ対応</li>
          <li>サービス提案</li>
          <li>契約・請求・運用連絡</li>
          <li>サービス改善</li>
        </ul>
      </LegalSection>
      <LegalSection title="第三者提供">
        <p>
          法令に基づく場合を除き、本人の同意なく取得した情報を第三者に提供することはありません。
        </p>
      </LegalSection>
      <LegalSection title="外部サービス・Cookie等">
        <p>
          サイト改善やアクセス状況の把握のため、Google Analytics等のアクセス解析ツールを利用する場合があります。これに伴い、Cookie等を利用して匿名の利用状況データを取得する場合があります。
        </p>
      </LegalSection>
      <LegalSection title="管理">
        <p>
          取得した情報は、紛失、漏えい、改ざん等が起きないよう、適切な管理に努めます。
        </p>
      </LegalSection>
      <LegalSection title="問い合わせ先">
        <p>
          個人情報の取り扱いに関するお問い合わせは、{CONTACT_EMAIL} までご連絡ください。
        </p>
      </LegalSection>
      <LegalSection title="改定">
        <p>
          本ポリシーは、必要に応じて内容を変更する場合があります。変更後の内容は、本ページに掲載した時点で適用されます。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
