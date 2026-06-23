#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { hasInstagramDestination, loadThreadsBrandConfig, selectInstagramCta } from "./lib/threads-brand.mjs";

loadLocalEnv();

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/threads/create-daily-post-plan.mjs [YYYY-MM-DD]\nCreates a safe local Threads post plan JSON without secrets.");
  process.exit(0);
}

function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const brand = loadThreadsBrandConfig();
  const instagramReady = hasInstagramDestination(brand);
  const morningIndex = getRotationIndex(date, MORNING_BANK.length);
  const eveningIndex = getRotationIndex(date, EVENING_BANK.length);
  const eveningCta = selectEveningCta(eveningIndex, brand, instagramReady);
  const posts = [
    buildPost({ date, time: "11:00", slotRole: "short_practical_value", source: MORNING_BANK[morningIndex], cta: "" }),
    buildPost({ date, time: "19:00", slotRole: "conversation_and_learning", source: EVENING_BANK[eveningIndex], cta: eveningCta })
  ];
  const outDir = path.join(process.cwd(), "data", "threads", "post-plans");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${date}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify({ date, posts }, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    postCount: posts.length,
    morningIdeaCount: MORNING_BANK.length,
    eveningIdeaCount: EVENING_BANK.length,
    duplicateBankTextCount: duplicateTextCount(MORNING_BANK.concat(EVENING_BANK)),
    instagramConfigured: instagramReady,
    ctaCount: posts.filter((post) => post.cta).length,
    file: path.relative(process.cwd(), outFile)
  }));
}

function buildPost({ date, time, slotRole, source, cta }) {
  return {
    date,
    time,
    theme: source.theme,
    pillar: source.pillar,
    hookType: source.hookType,
    text: source.text,
    cta,
    slotRole,
    instagramCtaSuppressed: !cta || !/Instagram/i.test(cta),
    media: { type: "none", items: [] }
  };
}

function getRotationIndex(value, length) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.floor(utc / 86400000) % length;
}

function selectEveningCta(index, config, instagramReady) {
  if (index % 7 !== 1 && index % 7 !== 5) return "";
  if (instagramReady && index % 7 === 1) return selectInstagramCta(config, index);
  return "気になる人は、プロフィールのInstagramも見てみてください。";
}

function duplicateTextCount(items) {
  const texts = items.map((item) => item.text.trim());
  return texts.length - new Set(texts).size;
}

const MORNING_BANK = [
  { pillar: "practical", hookType: "specific_fix", theme: "プロフィール1行目", text: "プロフィールの1行目、意外と見られています。\n\n「何屋さんか」より先に「誰の何を助けるか」が見えると、初見の迷いがかなり減ります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "毎日投稿より入口", text: "毎日投稿より先に、入口を整えた方が早いことがあります。\n\nプロフィール、固定投稿、予約導線。\nここが曖昧だと、良い投稿も流れて終わりがちです。" },
  { pillar: "practical", hookType: "before_after", theme: "固定投稿", text: "固定投稿は「実績置き場」だけだともったいないです。\n\n初めて見た人が不安に思うことを1つ消す場所。\n料金、流れ、よくある質問のどれかで十分です。" },
  { pillar: "common_moment", hookType: "relatable", theme: "ネタ切れ", text: "投稿ネタがない日は、店の裏側を見直すと出ます。\n\nよく聞かれる質問、迷われるメニュー、初来店で説明すること。\n全部そのまま投稿の種です。" },
  { pillar: "practical", hookType: "specific_fix", theme: "DM導線", text: "「DMください」だけだと、実は少し動きにくいです。\n\n何を送ればいいか。\n返事で何がわかるか。\nそこまで書くと、DMの心理的な段差が下がります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "映えの優先度", text: "小さなお店のSNS、最初から映えを狙いすぎなくて大丈夫です。\n\n先に必要なのは、安心して選べる情報。\n雰囲気より「迷わない」が効く場面も多いです。" },
  { pillar: "practical", hookType: "checklist", theme: "予約前情報", text: "予約前に知りたいことは、だいたい決まっています。\n\n場所、料金の目安、所要時間、誰が対応するか。\nこの4つが見えるだけで、不安はかなり減ります。" },
  { pillar: "common_moment", hookType: "relatable", theme: "数字の見方", text: "反応が薄い日、すぐ投稿を増やさなくてもいいです。\n\nまず見るのは、見た人が次に進める状態か。\n数字より先に導線が詰まっていることがあります。" },
  { pillar: "practical", hookType: "before_after", theme: "言い換え", text: "「こだわっています」だけだと、少し伝わりにくいです。\n\n何を、なぜ、どんな人のために。\nこの3つに分けると、お店の良さが急に具体的になります。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "検証メモ", text: "投稿を作る時、最初に見るのは文章のきれいさではないです。\n\n誰が読んで、何に気づくか。\nそこが見えない投稿は、整っていても流れやすいです。" },
  { pillar: "practical", hookType: "specific_fix", theme: "メニュー紹介", text: "メニュー紹介は、特徴だけで終わると弱くなりがちです。\n\n誰に合うか。\nどんな時に選ぶか。\nそこまで書くと、読んだ人が自分ごとにしやすいです。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "投稿頻度", text: "投稿頻度を上げる前に、同じ人が見ても疲れない流れかを見たいです。\n\n案内ばかりだと、ちゃんとしていても距離が出ます。" },
  { pillar: "common_moment", hookType: "relatable", theme: "説明過多", text: "まじめに書くほど、文章が長くなることがあります。\n\nでもSNSでは、全部説明するより「まず1つ伝わる」方が強いです。\n今日は1テーマで十分。" },
  { pillar: "practical", hookType: "checklist", theme: "初見チェック", text: "初見の人の目でSNSを見るなら、この3つだけでいいです。\n\n何のお店か。\n誰向けか。\n次に何をすればいいか。\n迷う場所が、そのまま改善点です。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "失敗メモ", text: "以前は、整った説明文ほど良いと思っていました。\n\nでも店舗SNSだと、少し体温がある言葉の方が読まれます。\n正しさだけだと、通り過ぎられます。" },
  { pillar: "practical", hookType: "specific_fix", theme: "写真の添え文", text: "写真に添える一文は、説明より観察が合うことがあります。\n\n「人気です」より「初めての方はこれを選ぶことが多いです」。\n少しだけ景色が見えます。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "売り込み感", text: "売り込み感を消したいなら、売らない投稿を増やすより、不安を減らす投稿を増やす方が自然です。\n\n説明は押し売りではなく、安心材料にもなります。" },
  { pillar: "practical", hookType: "before_after", theme: "予約リンク名", text: "予約リンクの名前、地味ですが大事です。\n\n「リンクはこちら」より「空き状況を見る」。\n何が起きるかわかる言葉の方が、押す前の不安が少ないです。" },
  { pillar: "common_moment", hookType: "relatable", theme: "更新停止", text: "SNSが止まる時、ネタ不足より判断疲れが原因のことがあります。\n\n何を書くか。\nどこまで書くか。\n毎回決めるのは、普通にしんどいです。" },
  { pillar: "practical", hookType: "checklist", theme: "投稿前確認", text: "投稿前に見るのは、うまい文章かどうかよりこの3つ。\n\n誰向けか。\n読後に何が残るか。\n次の行動が見えるか。\nこれだけでかなり変わります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "フォロワー数", text: "フォロワー数が横ばいでも、SNSが全部ダメとは限りません。\n\n初見の安心材料が増えているか。\n問い合わせ前の迷いが減っているか。\nそこも見たいです。" },
  { pillar: "practical", hookType: "specific_fix", theme: "ハイライト", text: "ハイライトは倉庫ではなく、案内板に近いです。\n\n初めての人が探す順に並べる。\nそれだけで、見やすさはかなり変わります。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "運用の裏側", text: "投稿案を作る時、先にCTAを置くと営業っぽくなりやすいです。\n\n先に読者の気づき。\n必要な時だけ導線。\nこの順番の方が自然です。" },
  { pillar: "common_moment", hookType: "relatable", theme: "お知らせ疲れ", text: "お知らせ投稿が続くと、ちゃんと発信しているのに読まれにくくなります。\n\nお知らせの間に、選び方や裏側を混ぜるだけで空気が変わります。" },
  { pillar: "practical", hookType: "before_after", theme: "お客様の声", text: "お客様の声は、そのまま載せるだけでも良いです。\n\nでも「どんな不安が消えた声か」まで添えると、似た悩みの人に届きやすくなります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "完璧主義", text: "投稿を完璧にしてから出すより、伝えたい1点がはっきりしている方が大事です。\n\nSNSは作品というより、会話の入口に近いです。" },
  { pillar: "practical", hookType: "checklist", theme: "プロフィール確認", text: "プロフィールを直すなら、肩書きより先にここを見ます。\n\n誰向けか。\n何を頼めるか。\nどこから予約するか。\nこの3つが見えればまず合格です。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "改善順序", text: "SNS改善は、派手な施策より順番が大事です。\n\n入口を整える。\n安心材料を置く。\n最後に投稿を増やす。\n逆にすると、がんばりが空回りします。" },
  { pillar: "common_moment", hookType: "relatable", theme: "反応の波", text: "反応には波があります。\n\nだから1投稿だけで判断しない方がいいです。\n同じ柱を少し言い換えて、何に反応が出るか見る方が現実的です。" },
  { pillar: "practical", hookType: "specific_fix", theme: "短文化", text: "長い説明を短くする時は、削るより分けるのがおすすめです。\n\n今日は悩み。\n明日は選び方。\n次は予約前の不安。\n1投稿1役にすると読みやすいです。" }
];

const EVENING_BANK = [
  { pillar: "common_moment", hookType: "relatable", theme: "閉店後のSNS", text: "閉店後にSNSを開いて、何を書けばいいかわからなくなる日ありますよね。\n\nそういう日は、今日お客さんに説明したことを1つだけ思い出すので十分です。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "検証の本音", text: "ICHI Socialでも、CTAを入れすぎると急に文章が固くなるなと感じています。\n\n読者に残る気づきが先。\n導線はたまに。\nこのくらいが自然そうです。" },
  { pillar: "common_moment", hookType: "question", theme: "答えやすい問い", text: "お店のSNSで、初めて見た人が一番迷いそうな場所はどこですか。\n\n料金、予約方法、メニュー選び。\nたぶん投稿ネタはそこにあります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "反応ゼロの日", text: "反応が少ない日は、投稿が失敗とは限りません。\n\n見た人が黙ってプロフィールを確認していることもあります。\nだから入口が整っているかは、かなり大事です。" },
  { pillar: "behind_the_scenes", hookType: "failure", theme: "失敗共有", text: "説明を丁寧にしすぎると、かえって読みにくくなることがあります。\n\n伝えたいことを全部入れるより、今日は1つだけ。\nその方が会話になりやすいです。" },
  { pillar: "common_moment", hookType: "relatable", theme: "ひとり運用", text: "ひとりでSNSを回していると、投稿づくりが営業、接客、事務のあとに来ます。\n\nそりゃ重いです。\nだから型を作る価値があります。" },
  { pillar: "practical", hookType: "specific_fix", theme: "今日の振り返り", text: "今日の投稿ネタに困ったら、接客中に2回以上説明したことを使ってみてください。\n\nそれはたぶん、他の人も知りたいことです。" },
  { pillar: "common_moment", hookType: "question", theme: "メニュー迷い", text: "初めてのお客さんがメニューで迷うポイント、決まっていますか。\n\nそこを投稿にすると、売り込みではなく来店前のサポートになります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "きれいな投稿", text: "きれいな投稿なのに反応が薄い時、足りないのはデザインではなく生活感かもしれません。\n\n人がいる感じが見えると、急に距離が縮まります。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "運用メモ", text: "最近あらためて思うのは、SNSは正解文を置く場所というより、気づきのメモを置く場所に近いこと。\n\n少し未完成なくらいが読まれます。" },
  { pillar: "common_moment", hookType: "relatable", theme: "忙しい日の投稿", text: "忙しい日の投稿は、長く書かなくて大丈夫です。\n\n「今日はこの質問が多かったです」だけでも、そのお店らしい発信になります。" },
  { pillar: "practical", hookType: "question", theme: "予約前の不安", text: "予約前の不安を1つだけ消すなら、何を見せますか。\n\n流れ、料金、担当者、店内の雰囲気。\nここを考えると投稿テーマが見えてきます。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "売らない発信", text: "売らない発信は、何も案内しないことではないです。\n\n相手が選びやすくなる情報を置くこと。\nそれだけで十分、営業の手前になります。" },
  { pillar: "behind_the_scenes", hookType: "failure", theme: "言葉の固さ", text: "文章が固くなる時は、だいたい「ちゃんと見せなきゃ」が強すぎる時です。\n\nお店の人が普段話している言葉に戻すと、読みやすくなります。" },
  { pillar: "common_moment", hookType: "relatable", theme: "投稿が怖い", text: "投稿する前に、これで合ってるかなと止まることがあります。\n\nでも読者は完璧な文章より、自分に関係ある一言を探しています。" },
  { pillar: "practical", hookType: "specific_fix", theme: "質問投稿", text: "質問投稿は、広すぎると答えにくいです。\n\n「SNSで困ってますか」より「予約前に不安な情報、何ですか」。\n具体的な方が会話になります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "導線の見直し", text: "問い合わせが少ない時、投稿の中身だけを疑いがちです。\n\nでも実際は、プロフィールから予約までの道順が見えにくいだけのこともあります。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "小さな実験", text: "投稿の実験は、大きく変えなくていいです。\n\n冒頭だけ変える。\nCTAを抜く。\n問いを具体化する。\n小さく変えた方が、何が効いたか見えます。" },
  { pillar: "common_moment", hookType: "relatable", theme: "数字横ばい", text: "数字が横ばいだと焦ります。\n\nでも、同じ数字でも中身は変わっていることがあります。\n保存、プロフィール確認、DM前の迷い。\n見えにくい動きもあります。" },
  { pillar: "practical", hookType: "question", theme: "来店前説明", text: "来店前に説明しておくと、お客さんが安心することは何ですか。\n\nそれはそのまま、夜に読まれやすい投稿になります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "無料導線", text: "無料診断の言葉は便利ですが、毎日出すと重く見えます。\n\n普段は気づきや観察を置いて、必要な時だけ案内する方が自然です。" },
  { pillar: "behind_the_scenes", hookType: "failure", theme: "作り直し", text: "今日の投稿案、最初はかなり説明っぽくなりました。\n\n削って残したのは1つだけ。\n「初見の人が迷わないか」。\n結局そこに戻ります。" },
  { pillar: "common_moment", hookType: "relatable", theme: "お客様目線", text: "お店側には当たり前でも、初めて見る人にはわからないことが多いです。\n\nそこを1つずつ言葉にするだけで、SNSはかなり親切になります。" },
  { pillar: "practical", hookType: "specific_fix", theme: "案内の順番", text: "案内文は、詳しさより順番が大事です。\n\nまず誰向けか。\n次に何ができるか。\n最後にどう動くか。\nこの順だと読みやすいです。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "バズ狙い", text: "店舗SNSは、毎回バズを狙わなくていいと思っています。\n\n必要な人が見た時に、安心して次へ進める。\nその積み重ねの方が強いです。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "返信候補", text: "返信候補を考える時、宣伝を入れない方が自然です。\n\n相手の投稿のどこに反応したか。\nそこだけ具体的に返す方が、会話になります。" },
  { pillar: "common_moment", hookType: "question", theme: "固定投稿の不安", text: "固定投稿に入れるなら、実績と不安解消、どちらを先に見せたいですか。\n\n初めての人目線だと、答えが変わることがあります。" },
  { pillar: "practical", hookType: "specific_fix", theme: "明日の投稿", text: "明日の投稿に迷ったら、今日の接客メモから1つ選ぶ。\n\nうまく書こうとしなくて大丈夫です。\n実際に出た言葉の方が、ちゃんと届くことがあります。" },
  { pillar: "belief_shift", hookType: "myth_bust", theme: "情報量", text: "情報量が多いSNSほど親切、とは限りません。\n\n探す場所が多すぎると迷います。\n少ない情報を、見つけやすく置く方が親切なこともあります。" },
  { pillar: "behind_the_scenes", hookType: "learning", theme: "改善の終わり", text: "SNS改善に終わりはないですが、毎日全部を見る必要もないです。\n\n今週は冒頭。\n来週は導線。\nそのくらい小さく区切る方が続きます。" }
];

main();
