import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `サービス提供条件 | ${SITE_NAME}`,
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <LegalPage title="サービス提供条件">
      <LegalSection title="サービス内容">
        <p>
          ICHI Socialは、小規模事業者向けのSNS運用支援サービスです。投稿企画、投稿文作成、投稿カレンダー作成、投稿代行、月次レポート、改善提案を中心に支援します。
        </p>
      </LegalSection>
      <LegalSection title="成果保証について">
        <p>
          本サービスは、フォロワー増加、売上増加、集客数増加を保証するものではありません。投稿の継続、内容改善、月次レポートを通じて運用改善を支援します。
        </p>
      </LegalSection>
      <LegalSection title="契約期間・支払い">
        <p>
          効果検証のため、契約期間は原則3ヶ月からを推奨しています。支払いは月額制、請求書払いを想定しています。具体的な条件は契約内容に応じて個別に相談します。
        </p>
      </LegalSection>
      <LegalSection title="対応範囲">
        <ul className="list-disc space-y-2 pl-5">
          <li>投稿企画</li>
          <li>投稿文作成</li>
          <li>投稿カレンダー作成</li>
          <li>投稿代行</li>
          <li>月次レポート</li>
          <li>改善提案</li>
        </ul>
      </LegalSection>
      <LegalSection title="標準プラン外">
        <ul className="list-disc space-y-2 pl-5">
          <li>撮影</li>
          <li>高度な動画編集</li>
          <li>SNS広告運用</li>
          <li>炎上対応</li>
          <li>DM完全代行</li>
          <li>法務判断が必要な投稿確認</li>
        </ul>
      </LegalSection>
      <LegalSection title="投稿前確認">
        <p>
          原則、投稿前に確認フローを挟みます。確認方法や承認期限は、運用開始前に個別に調整します。
        </p>
      </LegalSection>
      <LegalSection title="解約・変更">
        <p>
          解約、プラン変更、対応範囲の変更は、契約内容に応じて個別に相談します。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
