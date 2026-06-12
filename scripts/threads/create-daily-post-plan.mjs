#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/create-daily-post-plan.mjs [YYYY-MM-DD]\nCreates a safe local Threads post plan JSON without secrets.");
  process.exit(0);
}

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const rotationIndex = getRotationIndex(date);
const morningIdeas = [
  {
    theme: "プロフィール導線",
    text: "SNSで反応が薄い時は、投稿内容より先にプロフィールの1行目を見直すと改善しやすいです。誰向けに何を頼めるかが3秒で伝わるだけで、問い合わせ前の迷いが減ります。",
    cta: "無料SNS診断では入口導線から確認します。",
  },
  {
    theme: "固定投稿の役割",
    text: "固定投稿は実績紹介だけでなく、初めて見た人の不安を減らす場所です。料金、予約方法、よくある質問のどれか1つが見えるだけでも次の行動に進みやすくなります。",
    cta: "まずは固定投稿の役割を一緒に整理できます。",
  },
  {
    theme: "予約導線改善",
    text: "投稿が良くても、予約ボタンや問い合わせ先が見つけにくいと離脱します。SNS改善は投稿頻度だけでなく、見た後の行き先までセットで見るのが大事です。",
    cta: "導線だけの無料チェックもできます。",
  },
  {
    theme: "小規模店舗のSNS",
    text: "小規模店舗のSNSは、きれいな投稿を増やすより、誰に選ばれているお店かが伝わる方が強いです。人柄、得意分野、来店前の安心材料を整えるだけで見え方が変わります。",
    cta: "今のSNSの見え方を無料で確認します。",
  },
  {
    theme: "投稿テーマ整理",
    text: "投稿ネタに迷う時は、集客投稿、信頼投稿、予約導線投稿の3つに分けると続けやすくなります。毎回売り込みにしなくても、選ばれる理由は積み上げられます。",
    cta: "投稿テーマの棚卸しから相談できます。",
  },
  {
    theme: "CTA改善",
    text: "SNSで問い合わせが少ない時、最後の一文が弱いことがあります。『詳しくはDMへ』だけでなく、何を送ればいいかまで書くと、迷っている人が動きやすくなります。",
    cta: "CTAの言い換え案も無料診断で見ます。",
  },
  {
    theme: "無料診断導線",
    text: "無料診断を置く時は、何を診断するのかを具体化すると反応が変わります。SNS全体より、プロフィール、固定投稿、予約導線の3点確認の方が申し込みやすくなります。",
    cta: "3点だけの無料SNS診断を用意しています。",
  },
];
const eveningIdeas = [
  {
    theme: "共感と導線",
    text: "毎日投稿しているのに問い合わせが増えないと、投稿そのものが悪い気がしてしまいます。でも実際は、投稿後にどこへ進めばいいかが伝わっていないだけのことも多いです。",
    cta: "一度、予約までの流れだけ無料で見ます。",
  },
  {
    theme: "ひとり運用の悩み",
    text: "ひとりでSNSを続けていると、何が正解かわからなくなります。数字だけを見る前に、初めて来た人が安心できる情報が揃っているかを見ると改善点が見つかりやすいです。",
    cta: "気になる方はDMで無料診断と送ってください。",
  },
  {
    theme: "売り込み疲れ",
    text: "SNSで毎回売り込みっぽくなるのが嫌な時は、お客様が来店前に不安に思うことを1つずつ投稿にすると自然です。説明は集客ではなく、安心材料にもなります。",
    cta: "あなたの業種に合う投稿軸を整理します。",
  },
  {
    theme: "問い合わせ前の迷い",
    text: "気になっているのに予約しない人は、興味がないのではなく、まだ少し不安なだけかもしれません。料金、場所、流れ、担当者の雰囲気が見えると一歩進みやすくなります。",
    cta: "SNS上の不安ポイントを無料で確認します。",
  },
  {
    theme: "改善の優先順位",
    text: "SNS改善は全部直そうとすると止まります。まずはプロフィール、固定投稿、予約導線のどれか1つだけで十分です。小さく直して反応を見る方が続けやすいです。",
    cta: "最初に直す1点を無料で提案します。",
  },
  {
    theme: "DMしやすい導線",
    text: "DMしてほしいなら、『DMください』だけでは少し弱いです。何を送ればいいか、どんな返事が返ってくるかまで見えると、相手はかなり動きやすくなります。",
    cta: "DM導線の文面も一緒に見直せます。",
  },
  {
    theme: "反応がない日の見方",
    text: "反応がない日が続いても、すぐ投稿を増やす必要はありません。見られた後に信頼できる情報があるか、問い合わせまで迷わないかを見る方が先の場合があります。",
    cta: "無料SNS診断で詰まりやすい箇所を確認します。",
  },
];
const posts = [
  {
    date,
    time: "11:00",
    ...morningIdeas[rotationIndex],
    slotRole: "know_how_authority",
  },
  {
    date,
    time: "19:00",
    ...eveningIdeas[rotationIndex],
    slotRole: "empathy_dm_guidance",
  },
];

const outDir = path.join(process.cwd(), "data", "threads", "post-plans");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${date}.json`);
fs.writeFileSync(outFile, `${JSON.stringify({ date, posts }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, postCount: posts.length, morningIdeaCount: morningIdeas.length, eveningIdeaCount: eveningIdeas.length, file: path.relative(process.cwd(), outFile) }));

function getRotationIndex(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.floor(utc / 86400000) % 7;
}
