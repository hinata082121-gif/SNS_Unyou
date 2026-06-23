export const MORNING_FORMATS = new Set(["sns_tip", "rewrite_demo", "quick_fix", "soft_showcase"]);
export const EVENING_FORMATS = new Set(["shop_sns_aruaru", "humorous_observation", "behind_the_scenes", "honest_opinion", "specific_question"]);

const snsTips = [
  ["空席案内", "飲食店", "本日空きあります", "今日、急に予定が空いた方へ。15時だけご案内できます"],
  ["雨の日", "カフェ", "雨の日サービスあります", "雨の日は、窓側の席がいつもより静かです。温かい飲み物も用意しています"],
  ["予約導線", "美容室", "予約はこちら", "今週、前髪だけ整えたい方へ。30分枠ならまだ入れます"],
  ["ネイル色", "ネイルサロン", "新色入りました", "手元だけ少し春っぽくしたい方へ。肌なじみの良い新色が入りました"],
  ["肩こり", "整体", "肩こりの方へ", "パソコンを閉じても、肩だけ仕事を続けている方へ"],
  ["体験枠", "パーソナルジム", "体験受付中", "運動を始めたいけど、何からで止まっている方へ。体験枠あります"],
  ["教室案内", "教室", "生徒募集中", "久しぶりに何か始めたい方へ。初回は道具なしでも大丈夫です"],
  ["入荷案内", "小売店", "入荷しました", "探していた方が多かったあの商品、少しだけ戻ってきました"],
  ["サロン初回", "個人サロン", "初めての方へ", "初めての場所が少し緊張する方へ。来店の流れを先にまとめました"],
  ["地域告知", "地域サービス", "受付しています", "近所で少し困った時に思い出してもらえるよう、対応できることをまとめました"],
  ["営業時間", "業種共通", "営業時間のお知らせ", "今日行けるかな、と思った時に迷わないよう、今週の受付時間を先に置いておきます"],
  ["写真添え文", "飲食店", "ランチ営業しています", "午後の仕事に支障が出ないくらいの満腹ランチ、あります"],
  ["初回来店", "美容室", "初めての方も歓迎", "初めての美容室、緊張しやすい方へ。最初に希望をゆっくり聞きます"],
  ["メニュー迷い", "カフェ", "おすすめあります", "甘いものか軽食かで迷う方へ。今日は軽めのセットがちょうど良さそうです"],
  ["空き時間", "ネイルサロン", "空き枠のお知らせ", "明日の夕方、爪を整えるだけの短い枠なら空いています"],
  ["姿勢", "整体", "姿勢が気になる方へ", "写真に写った自分の肩の高さ、ちょっと気になった方へ"],
  ["持ち物", "教室", "持ち物のお知らせ", "初回の持ち物、あれこれ揃えなくてOKです。まずは手ぶらに近い形でどうぞ"],
  ["売場案内", "小売店", "売場を変更しました", "いつもの場所にない商品、奥へ引っ越しました。探す時間を減らしたくて変えています"]
];

const rewriteDemos = [
  ["空席の言い換え", "飲食店", "本日空きあります", "今日、急に予定が空いた方へ。15時だけご案内できます"],
  ["肩こりの言い換え", "整体", "肩こりでお悩みの方へ", "パソコンを閉じても、肩だけ仕事を続けている方へ"],
  ["ランチの言い換え", "飲食店", "ランチ営業しています", "午後の仕事に支障が出ないくらいの満腹ランチ、あります"],
  ["新色の言い換え", "ネイルサロン", "新色入りました", "手元だけ少し気分を変えたい日に合う色、入りました"],
  ["体験の言い換え", "パーソナルジム", "体験受付中", "運動しなきゃと思いつつ、靴だけ眠っている方へ"],
  ["教室の言い換え", "教室", "初心者歓迎です", "最初から上手くなくていい教室です。むしろ初回は慣れる日です"],
  ["美容室の言い換え", "美容室", "カットできます", "伸びた分だけ整えて、朝のセットを少し楽にしたい方へ"],
  ["小売の言い換え", "小売店", "セール中です", "迷っていたものを、今日なら少しだけ買いやすくしています"],
  ["個人サロンの言い換え", "個人サロン", "ご予約受付中", "静かに過ごしたい日のための、ひとり時間の枠あります"],
  ["地域サービスの言い換え", "地域サービス", "対応可能です", "近所でこれ誰に頼むんだろう、となった時の候補にどうぞ"],
  ["カフェ席の言い換え", "カフェ", "席あります", "作業したいけど家だと進まない方へ。端の席、空いています"],
  ["メニューの言い換え", "飲食店", "おすすめメニューです", "初めて来た人がだいたい迷って、最後に選ぶ一皿です"],
  ["予約方法の言い換え", "業種共通", "予約はDMで", "空きだけ知りたい方も、DMで時間だけ聞いて大丈夫です"],
  ["ハイライトの言い換え", "業種共通", "詳細はハイライトへ", "初めての方が迷いそうなことだけ、ハイライトにまとめました"],
  ["定休日の言い換え", "小売店", "明日は定休日です", "明日はお店が休みです。今日のうちに見たい方は夕方までどうぞ"],
  ["相談の言い換え", "美容室", "髪のお悩み相談ください", "髪型を変えたいけど、何が似合うかで止まっている方へ"],
  ["姿勢改善の言い換え", "整体", "姿勢改善します", "鏡を見た時の首の位置、少し前に出ている気がする方へ"],
  ["作品紹介の言い換え", "教室", "作品を作りました", "初めてでも、ここまで形になるんだなと分かる作品ができました"]
];

const aruaruHumor = [
  ["投稿後の脳内", "業種共通", "SNS担当者の脳内。投稿前は反応ありそう、1時間後は夜に伸びるタイプ、翌朝はアルゴリズムのせい。だいたい前向きです。", "shop_sns_aruaru"],
  ["自然な高級感", "業種共通", "店主が言う自然な感じ。そこに高級感、親しみやすさ、売れそう感も追加されがち。SNS担当の頭の中、4ブランドくらい混在中です。", "humorous_observation"],
  ["写真選び", "飲食店", "料理写真を選ぶ時、湯気はもう消えているのに、頭の中ではまだ湯気を探しています。おいしそうの判定、意外と細かいです。", "shop_sns_aruaru"],
  ["カフェ作業席", "カフェ", "カフェの投稿で作業できますと書く時、長居歓迎に見えすぎないよう少し悩みます。言葉の温度調整、地味に難しいです。", "shop_sns_aruaru"],
  ["美容室ビフォー", "美容室", "美容室のBefore写真、撮る側は真剣なのに、お客様の表情がだいたい少し気まずい。あれも含めてリアルです。", "humorous_observation"],
  ["ネイル色名", "ネイルサロン", "ネイルの色名、おしゃれすぎて実物を見るまで分からないことがあります。結局、肌になじむかどうかが一番早い説明だったりします。", "shop_sns_aruaru"],
  ["整体説明", "整体", "整体の説明は、専門的に書くほど読者が離れがちです。肩が仕事を続けている、くらいの方が伝わる日もあります。", "humorous_observation"],
  ["ジム初回", "パーソナルジム", "ジムの初回投稿で追い込み感を出しすぎると、運動前から読者が筋肉痛になります。最初は安心の方が強いです。", "humorous_observation"],
  ["教室募集", "教室", "教室の募集で初心者歓迎と書きながら、写真が上級者作品だけ。見る側は、入門前に卒業制作を見せられた気持ちになります。", "shop_sns_aruaru"],
  ["小売入荷", "小売店", "入荷しました投稿、急いで出したい時ほど写真の背景に段ボールが写りがち。現場感、出すぎ注意です。", "shop_sns_aruaru"],
  ["サロン静けさ", "個人サロン", "個人サロンの静かな雰囲気、文章で伝えようとすると急に詩みたいになります。普通の言葉で十分な時もあります。", "humorous_observation"],
  ["地域サービス", "地域サービス", "地域サービスのSNS、真面目に書くほど役所の案内みたいになることがあります。人が対応している感じを少し足したいです。", "shop_sns_aruaru"],
  ["投稿ネタ会議", "業種共通", "投稿ネタ会議で出る、普通すぎませんか問題。普通すぎることほど、お客さんには助かる情報だったりします。", "shop_sns_aruaru"],
  ["写真より実物", "飲食店", "写真より実物の方が良い日、あります。SNS担当としては悔しいけど、お店としてはかなり良いことです。", "humorous_observation"],
  ["ハッシュタグ迷子", "業種共通", "ハッシュタグを考えすぎると、最後は自分でも何屋さんか分からなくなります。まず本文で伝わる方が先です。", "shop_sns_aruaru"],
  ["ストーリーズ保存", "業種共通", "ストーリーズに出した情報、あとで見返したいものほど流れていきます。大事な案内は投稿かハイライトへ避難させたいです。", "shop_sns_aruaru"]
];

const behindHonest = [
  ["CTA控えめ", "業種共通", "ICHI Socialでも、CTAを入れすぎると文章が急に固くなるなと感じています。読者に残る気づきが先。導線はたまに。", "behind_the_scenes"],
  ["作り直し", "業種共通", "投稿案を作っていて、説明っぽいなと思ったら一度ぜんぶ崩します。正しい文より、読んだ人が自分に寄せられる文にしたいです。", "behind_the_scenes"],
  ["本音", "業種共通", "正直、店舗SNSは毎日すごいことを書かなくていいと思っています。小さな不安を1つ減らす投稿の方が、ちゃんと効くことがあります。", "honest_opinion"],
  ["失敗", "業種共通", "以前は、丁寧に説明するほど良いと思っていました。でもSNSでは、丁寧すぎると距離が出ることもあります。少し体温が欲しいです。", "behind_the_scenes"],
  ["検証", "業種共通", "投稿の検証は、大きく変えなくて大丈夫です。冒頭だけ変える。CTAを抜く。問いを具体化する。そのくらいが見やすいです。", "behind_the_scenes"],
  ["意見", "業種共通", "バズだけを追う店舗SNSは、少し疲れやすいです。必要な人が見た時に迷わない状態を作る方が、長く効きます。", "honest_opinion"],
  ["制作力", "業種共通", "言い換えを考える時は、盛るより先に場面を探します。読者の日常に近づけると、同じ情報でも急に読みやすくなります。", "behind_the_scenes"],
  ["反省", "業種共通", "きれいにまとめた投稿ほど、あとで見ると何も引っかからないことがあります。少しだけ本音が入る方が、残りやすいです。", "honest_opinion"],
  ["裏側", "業種共通", "投稿制作でよく見るのは、何を言うかより何を削るかです。1投稿に役割を詰めると、読者がどこを見ればいいか迷います。", "behind_the_scenes"],
  ["本音の導線", "業種共通", "導線は大事。でも毎回そこへ連れていこうとすると、読者は少し身構えます。何も売らない投稿の日も必要です。", "honest_opinion"]
];

const quickFixes = [
  ["冒頭改善", "業種共通", "冒頭の一文だけ、読者の状況から始めてみてください。お知らせ感が減って、少し自分ごとに近づきます。"],
  ["予約導線", "業種共通", "予約リンクの名前は、何ができるかで書くと押しやすいです。リンクはこちらより、空き状況を見るの方が迷いません。"],
  ["写真説明", "飲食店", "料理写真には、味の説明より食べる場面を添えるのもありです。仕事の合間に、夜に軽く、みたいな一言です。"],
  ["初回不安", "美容室", "初めての人向けには、技術より流れを見せると安心されます。到着から相談までが見えるだけで緊張が下がります。"],
  ["色選び", "ネイルサロン", "新色紹介は、色名より似合う場面を書くと伝わります。仕事でも浮きにくい、休日に少し明るい、などです。"],
  ["整体投稿", "整体", "専門用語が増えたら、日常の動作に戻すと読みやすいです。朝起きた時、椅子から立つ時、スマホを見た後。"],
  ["ジム投稿", "パーソナルジム", "ジム投稿は結果だけでなく、初回の不安を減らす情報も強いです。服装、持ち物、きつさの目安。"],
  ["教室投稿", "教室", "教室の投稿は、完成品だけでなく途中も見せると入りやすいです。最初はここからでOK、が伝わります。"],
  ["小売投稿", "小売店", "商品の説明は、誰が使うと良さそうかを足すと選びやすくなります。特徴より先に使う人です。"],
  ["地域投稿", "地域サービス", "地域サービスは、対応できないことも少し書くと親切です。できる範囲が見えると、問い合わせ前の迷いが減ります。"]
];

const questions = [
  ["予約前の不安", "業種共通", "初めて行くお店で、予約前に分かっていると安心する情報は何ですか。料金、流れ、場所、担当者。投稿ネタはそこにあります。"],
  ["メニュー迷い", "飲食店", "初めての人がメニューで迷うとしたら、どこですか。量、辛さ、人気、注文の仕方。そこを投稿にすると親切です。"],
  ["美容室相談", "美容室", "美容室に行く前、いちばん言葉にしにくい希望は何ですか。長さ、雰囲気、扱いやすさ。ここを拾う投稿は読まれます。"],
  ["ネイル相談", "ネイルサロン", "ネイルで初めての人が迷いやすいのは、色ですか、形ですか、持ちですか。答えやすい問いは会話の入口になります。"],
  ["教室初回", "教室", "新しい教室に行く前、何が分かると申し込みやすいですか。持ち物、雰囲気、初回の流れ。どれも投稿にできます。"],
  ["地域サービス", "地域サービス", "近所で困った時、どんな言葉なら頼みやすいですか。専門的な説明より、状況の例がある方が届くことがあります。"]
];

const showcases = [
  ["ランチ実演", "飲食店", "普通「ランチ営業しています」\n少しラフに「午後の仕事に支障が出ないくらいの満腹ランチ、あります」\n情報は同じでも、お店の空気まで少し出せます。"],
  ["サロン実演", "個人サロン", "普通「リラックスできます」\n少し具体的に「人と話しすぎた日の、静かに戻る時間にどうぞ」\n雰囲気は、場面にすると伝わりやすいです。"]
];

const extraCasuals = [
  ["レジ横案内", "小売店", "レジ横に置いた小物、実は一番説明しやすい商品だったりします。小さいものほど、使う場面まで書くと急に選びやすくなります。", "sns_tip"],
  ["黒板メニュー", "飲食店", "黒板メニューは、名前より一言コメントが効くことがあります。今日は軽め、しっかりめ、初めてならこれ。選ぶ理由が見えると強いです。", "sns_tip"],
  ["予約前DM", "業種共通", "DMの最初の一文を用意しておくと、見る側はかなり楽です。「空き時間だけ知りたいです」でOK、くらい書いておく感じです。", "quick_fix"],
  ["スタッフ紹介", "美容室", "スタッフ紹介は、経歴より話しやすい空気が見えると強いです。得意なスタイルと、初回でよく聞くことを添えるだけで近くなります。", "quick_fix"],
  ["ジムあるある", "パーソナルジム", "ジム投稿で気合いを出しすぎると、まだ入会していない人まで追い込まれます。最初の一歩は、やさしめで十分です。", "shop_sns_aruaru"],
  ["カフェ写真", "カフェ", "カフェ写真、良い席ほど誰かが座っている問題。撮れた時に限ってカップの向きが惜しい。SNS担当者、地味に戦っています。", "humorous_observation"],
  ["ネイル相談", "ネイルサロン", "普通「デザイン相談できます」\n少しラフに「画像はあるけど、これが自分の爪に合うか分からない方へ」\n迷いをそのまま書くと届きます。", "rewrite_demo"],
  ["教室の一歩", "教室", "普通「初心者向けです」\n少し具体的に「道具の名前がまだ分からない方でも大丈夫です」\n初心者の不安は、かなり細かいです。", "rewrite_demo"],
  ["整体の予約", "整体", "普通「ご予約受付中」\n少し日常寄りに「今週こそ首まわりをどうにかしたい方へ」\n体の悩みは、生活の言葉にすると伝わります。", "rewrite_demo"],
  ["地域の頼みごと", "地域サービス", "地域サービスの投稿は、かっこよさより頼みやすさが大事な日があります。これ頼んでいいのかな、を減らす文章が効きます。", "honest_opinion"],
  ["投稿の温度", "業種共通", "投稿の温度が高すぎると売り込みに見えて、低すぎると事務連絡になります。ちょうどいい温度、だいたい普段の接客の言葉です。", "behind_the_scenes"],
  ["商品棚", "小売店", "商品棚の写真は、全体を見せるより「今日はここだけ見て」で切る方が伝わることがあります。視線の案内も投稿の仕事です。", "sns_tip"],
  ["雨の日美容室", "美容室", "雨の日の美容室投稿、空き情報だけで終わらせるのは惜しいです。湿気で髪がまとまらない方へ、まで書くと急に近くなります。", "sns_tip"],
  ["サロンあるある", "個人サロン", "個人サロンの静けさを伝えたいのに、文章にすると急に高級旅館みたいになることがあります。普通の言葉で十分な時もあります。", "shop_sns_aruaru"],
  ["メニュー名", "飲食店", "メニュー名がおしゃれすぎる時は、説明に少しだけ日常を足すと安心です。どんな味か、どんな日に合うか。そこだけでOKです。", "quick_fix"],
  ["返信しやすい問い", "業種共通", "投稿の最後を質問にするなら、答えが1秒で浮かぶくらいがちょうどいいです。広い質問は、読む側も少し構えます。", "quick_fix"],
  ["制作の本音", "業種共通", "投稿制作で一番むずかしいのは、良いことを書くより、良いことを言いすぎないことかもしれません。余白がある方が読まれます。", "honest_opinion"],
  ["店主の当たり前", "業種共通", "店主には当たり前。でも見る側には面白い。そういう情報、かなりあります。仕込み、選び方、失敗しない頼み方。全部ネタです。", "behind_the_scenes"]
];

export const THREADS_CONTENT_BANK = [
  ...snsTips.map(([theme, targetIndustry, plain, rewrite], index) => entry({ index, format: "sns_tip", contentPillar: "sns_tip", hookType: "usable_tip", tone: "casual_practical", theme, targetIndustry, text: `${plain}、だけだと少し事務連絡っぽいです。\n\n「${rewrite}」くらいにすると、急に自分事になります。` })),
  ...rewriteDemos.map(([theme, targetIndustry, plain, rewrite], index) => entry({ index, format: "rewrite_demo", contentPillar: "rewrite_demo", hookType: "before_after", tone: "casual_practical", theme, targetIndustry, text: `普通\n「${plain}」\n\n少し日常寄り\n「${rewrite}」\n\n悩みや状況を場面にすると、目に止まりやすくなります。` })),
  ...aruaruHumor.map(([theme, targetIndustry, text, format], index) => entry({ index, format, contentPillar: "humor_and_aruaru", hookType: format === "shop_sns_aruaru" ? "relatable" : "humorous_observation", tone: "casual_humor", theme, targetIndustry, text })),
  ...behindHonest.map(([theme, targetIndustry, text, format], index) => entry({ index, format, contentPillar: "behind_and_honest", hookType: format === "honest_opinion" ? "honest_opinion" : "behind_the_scenes", tone: "human_practical", theme, targetIndustry, text })),
  ...quickFixes.map(([theme, targetIndustry, text], index) => entry({ index, format: "quick_fix", contentPillar: "quick_fix", hookType: "specific_fix", tone: "casual_practical", theme, targetIndustry, text })),
  ...questions.map(([theme, targetIndustry, text], index) => entry({ index, format: "specific_question", contentPillar: "participation", hookType: "specific_question", tone: "conversational", theme, targetIndustry, text })),
  ...showcases.map(([theme, targetIndustry, text], index) => entry({ index, format: "soft_showcase", contentPillar: "soft_showcase", hookType: "rewrite_showcase", tone: "casual_practical", theme, targetIndustry, text, hasDirectSalesCta: false })),
  ...extraCasuals.map(([theme, targetIndustry, text, format]) => entry({ index: 0, format, contentPillar: pillarForFormat(format), hookType: hookForFormat(format), tone: format.includes("aruaru") || format.includes("humorous") ? "casual_humor" : "casual_practical", theme, targetIndustry, text }))
].map((item, index) => ({
  ...item,
  contentKey: `${item.format}-${String(index + 1).padStart(3, "0")}`
}));

function entry({ format, contentPillar, hookType, tone, theme, targetIndustry, text, hasDirectSalesCta = false }) {
  return {
    theme,
    text: expandText(text, format),
    cta: "",
    contentPillar,
    format,
    hookType,
    tone,
    targetIndustry,
    hasQuestion: /[？?]|ですか/.test(text),
    hasDirectSalesCta,
    media: { type: "none", items: [] }
  };
}

function expandText(text, format) {
  if (String(text).length >= 70) return text;
  const suffixByFormat = {
    sns_tip: " 言い方を少し変えるだけで、見え方はちゃんと変わります。",
    rewrite_demo: " 悩みを場面に寄せると、読み手が自分ごとにしやすいです。",
    shop_sns_aruaru: " こういう小さな違和感、店舗SNSではかなり起きます。",
    humorous_observation: " 少し笑えるけど、投稿づくりではけっこう大事です。",
    behind_the_scenes: " こういう細かい調整を、投稿前にかなり見ています。",
    honest_opinion: " きれいに言い切らない方が、伝わる日もあります。",
    quick_fix: " まずはここだけ直す、くらいが続けやすいです。",
    specific_question: " 答えやすい問いにすると、会話の入口になります。",
    soft_showcase: " 情報は同じでも、雰囲気まで少し伝えられます。"
  };
  return `${text}${suffixByFormat[format] || " 少しだけ言い方を変えると、伝わり方が変わります。"}`;
}

function pillarForFormat(format) {
  if (format === "sns_tip") return "sns_tip";
  if (format === "rewrite_demo") return "rewrite_demo";
  if (format === "quick_fix") return "quick_fix";
  if (format === "honest_opinion" || format === "behind_the_scenes") return "behind_and_honest";
  if (format === "specific_question") return "participation";
  if (format === "soft_showcase") return "soft_showcase";
  return "humor_and_aruaru";
}

function hookForFormat(format) {
  if (format === "rewrite_demo") return "before_after";
  if (format === "quick_fix") return "specific_fix";
  if (format === "honest_opinion") return "honest_opinion";
  if (format === "behind_the_scenes") return "behind_the_scenes";
  if (format === "specific_question") return "specific_question";
  if (format === "soft_showcase") return "rewrite_showcase";
  if (format === "sns_tip") return "usable_tip";
  return "relatable";
}
