import type { Lang } from "./i18n";
// @ts-ignore CommonJS package without declarations.
import chineseS2t from "chinese-s2t";

// OurAirports public-domain coordinates; source hash is in /focus-flight/geography.json.
// City first, airport second: the city stays concise on the ticket and map.
export const FLIGHT_AIRPORTS = [
  {
    code: "PVG",
    at: [121.805, 31.1434],
    names: ["上海 · 浦东", "Shanghai · Pudong", "상하이 · 푸둥", "上海 · 浦東"],
  },
  {
    code: "SHA",
    at: [121.33426, 31.198104],
    names: [
      "上海 · 虹桥",
      "Shanghai · Hongqiao",
      "상하이 · 훙차오",
      "上海 · 虹橋",
    ],
  },
  {
    code: "PEK",
    at: [116.596702, 40.077349],
    names: [
      "北京 · 首都",
      "Beijing · Capital",
      "베이징 · 서우두",
      "北京 · 首都",
    ],
  },
  {
    code: "PKX",
    at: [116.413967, 39.501289],
    names: ["北京 · 大兴", "Beijing · Daxing", "베이징 · 다싱", "北京 · 大興"],
  },
  {
    code: "TFU",
    at: [104.441284, 30.31252],
    names: ["成都 · 天府", "Chengdu · Tianfu", "청두 · 톈푸", "成都 · 天府"],
  },
  {
    code: "CTU",
    at: [103.945966, 30.558257],
    names: ["成都 · 双流", "Chengdu · Shuangliu", "청두 · 솽류", "成都 · 双流"],
  },
  {
    code: "CAN",
    at: [113.299004, 23.392401],
    names: [
      "广州 · 白云",
      "Guangzhou · Baiyun",
      "광저우 · 바이윈",
      "広州 · 白雲",
    ],
  },
  {
    code: "SZX",
    at: [113.803262, 22.639474],
    names: ["深圳 · 宝安", "Shenzhen · Bao’an", "선전 · 바오안", "深圳 · 宝安"],
  },
  {
    code: "XIY",
    at: [108.762385, 34.442207],
    names: ["西安 · 咸阳", "Xi’an · Xianyang", "시안 · 셴양", "西安 · 咸陽"],
  },
  {
    code: "KMG",
    at: [102.936743, 25.110313],
    names: [
      "昆明 · 长水",
      "Kunming · Changshui",
      "쿤밍 · 창수이",
      "昆明 · 長水",
    ],
  },
  {
    code: "HGH",
    at: [120.428865, 30.23609],
    names: [
      "杭州 · 萧山",
      "Hangzhou · Xiaoshan",
      "항저우 · 샤오산",
      "杭州 · 蕭山",
    ],
  },
  {
    code: "WUH",
    at: [114.213723, 30.774798],
    names: ["武汉 · 天河", "Wuhan · Tianhe", "우한 · 톈허", "武漢 · 天河"],
  },
  {
    code: "HKG",
    at: [113.914862, 22.31184],
    names: [
      "香港 · 赤鱲角",
      "Hong Kong · Chek Lap Kok",
      "홍콩 · 첵랍콕",
      "香港 · チェックラップコック",
    ],
  },
  {
    code: "TPE",
    at: [121.233002, 25.0777],
    names: [
      "台北 · 桃园",
      "Taipei · Taoyuan",
      "타이베이 · 타오위안",
      "台北 · 桃園",
    ],
  },
  {
    code: "KHH",
    at: [120.349998, 22.577101],
    names: [
      "高雄 · 小港",
      "Kaohsiung · Xiaogang",
      "가오슝 · 샤오강",
      "高雄 · 小港",
    ],
  },
  {
    code: "HND",
    at: [139.786958, 35.549678],
    names: ["东京 · 羽田", "Tokyo · Haneda", "도쿄 · 하네다", "東京 · 羽田"],
  },
  {
    code: "NRT",
    at: [140.388714, 35.76858],
    names: ["东京 · 成田", "Tokyo · Narita", "도쿄 · 나리타", "東京 · 成田"],
  },
  {
    code: "KIX",
    at: [135.244003, 34.427299],
    names: ["大阪 · 关西", "Osaka · Kansai", "오사카 · 간사이", "大阪 · 関西"],
  },
  {
    code: "CTS",
    at: [141.690414, 42.774753],
    names: [
      "札幌 · 新千岁",
      "Sapporo · New Chitose",
      "삿포로 · 신치토세",
      "札幌 · 新千歳",
    ],
  },
  {
    code: "FUK",
    at: [130.451004, 33.585899],
    names: [
      "福冈 · 福冈",
      "Fukuoka · Fukuoka",
      "후쿠오카 · 후쿠오카",
      "福岡 · 福岡",
    ],
  },
  {
    code: "OKA",
    at: [127.639804, 26.192437],
    names: ["冲绳 · 那霸", "Okinawa · Naha", "오키나와 · 나하", "沖縄 · 那覇"],
  },
  {
    code: "ICN",
    at: [126.450996, 37.469101],
    names: ["首尔 · 仁川", "Seoul · Incheon", "서울 · 인천", "ソウル · 仁川"],
  },
  {
    code: "GMP",
    at: [126.791, 37.5583],
    names: ["首尔 · 金浦", "Seoul · Gimpo", "서울 · 김포", "ソウル · 金浦"],
  },
  {
    code: "PUS",
    at: [128.938004, 35.179501],
    names: ["釜山 · 金海", "Busan · Gimhae", "부산 · 김해", "釜山 · 金海"],
  },
  {
    code: "CJU",
    at: [126.492548, 33.512058],
    names: ["济州 · 济州", "Jeju · Jeju", "제주 · 제주", "済州 · 済州"],
  },
  {
    code: "SIN",
    at: [103.994003, 1.35019],
    names: [
      "新加坡 · 樟宜",
      "Singapore · Changi",
      "싱가포르 · 창이",
      "シンガポール · チャンギ",
    ],
  },
  {
    code: "BKK",
    at: [100.747002, 13.6811],
    names: [
      "曼谷 · 素万那普",
      "Bangkok · Suvarnabhumi",
      "방콕 · 수완나품",
      "バンコク · スワンナプーム",
    ],
  },
  {
    code: "HKT",
    at: [98.3174, 8.113257],
    names: [
      "普吉 · 普吉",
      "Phuket · Phuket",
      "푸껫 · 푸껫",
      "プーケット · プーケット",
    ],
  },
  {
    code: "CNX",
    at: [98.962601, 18.7668],
    names: [
      "清迈 · 清迈",
      "Chiang Mai · Chiang Mai",
      "치앙마이 · 치앙마이",
      "チェンマイ · チェンマイ",
    ],
  },
  {
    code: "KUL",
    at: [101.709999, 2.74558],
    names: [
      "吉隆坡 · 吉隆坡",
      "Kuala Lumpur · KLIA",
      "쿠알라룸푸르 · KLIA",
      "クアラルンプール · KLIA",
    ],
  },
  {
    code: "PEN",
    at: [100.276185, 5.296303],
    names: ["槟城 · 槟城", "Penang · Penang", "페낭 · 페낭", "ペナン · ペナン"],
  },
  {
    code: "SGN",
    at: [106.652, 10.8188],
    names: [
      "胡志明市 · 新山一",
      "Ho Chi Minh City · Tan Son Nhat",
      "호찌민 · 떤선녓",
      "ホーチミン · タンソンニャット",
    ],
  },
  {
    code: "HAN",
    at: [105.806999, 21.221201],
    names: [
      "河内 · 内排",
      "Hanoi · Noi Bai",
      "하노이 · 노이바이",
      "ハノイ · ノイバイ",
    ],
  },
  {
    code: "DAD",
    at: [108.198997, 16.0439],
    names: [
      "岘港 · 岘港",
      "Da Nang · Da Nang",
      "다낭 · 다낭",
      "ダナン · ダナン",
    ],
  },
  {
    code: "MNL",
    at: [121.019997, 14.5086],
    names: [
      "马尼拉 · 尼诺伊·阿基诺",
      "Manila · Ninoy Aquino",
      "마닐라 · 니노이 아키노",
      "マニラ · ニノイ・アキノ",
    ],
  },
  {
    code: "CEB",
    at: [123.97974, 10.309261],
    names: ["宿务 · 麦克坦", "Cebu · Mactan", "세부 · 막탄", "セブ · マクタン"],
  },
  {
    code: "DPS",
    at: [115.167123, -8.748409],
    names: [
      "巴厘岛 · 伍拉·赖",
      "Bali · Ngurah Rai",
      "발리 · 응우라라이",
      "バリ · ングラ・ライ",
    ],
  },
  {
    code: "CGK",
    at: [106.655998, -6.12557],
    names: [
      "雅加达 · 苏加诺·哈达",
      "Jakarta · Soekarno–Hatta",
      "자카르타 · 수카르노 하타",
      "ジャカルタ · スカルノ・ハッタ",
    ],
  },
] as const;

export function airportChoices(lang: Lang) {
  const index = lang === "en" ? 1 : lang === "ko" ? 2 : lang === "ja" ? 3 : 0;
  return FLIGHT_AIRPORTS.map((a) => {
    const label = lang === "tw" ? chineseS2t.s2t(a.names[0]) : a.names[index];
    return { code: a.code, label, city: label.split(" · ")[0] };
  });
}
