export const SITE_NAME = "ICHI Social";
export const SITE_LABEL = "小規模事業者向けSNS運用パートナー";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ichisocial.vercel.app";
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hinata082121@gmail.com";
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-Z66RTC04WC";

const CONTACT_SUBJECT = "【ICHI Social】無料相談の希望";

export function createContactHref(plan = "未定") {
  const body = [
    "お名前：",
    "会社名・店舗名：",
    "業種：",
    "現在運用しているSNS URL：",
    "相談したい内容：",
    `希望プラン：${plan}`,
    "希望連絡方法：",
    "備考：",
  ].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    CONTACT_SUBJECT,
  )}&body=${encodeURIComponent(body)}`;
}
