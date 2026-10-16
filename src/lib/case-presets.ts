/** Public synthetic data shared by the worked example and the actual tool. */
export const CSV_CASE_INPUT = [
  {
    order: "000123",
    item: "四叶草徽章",
    quantity: 2,
    profile: { city: "杭州" },
  },
  {
    order: "000124",
    item: "小机器人贴纸",
    quantity: 1,
    note: "请勿折叠, 谢谢",
  },
];

export const AVATAR_CASE_OPTIONS = {
  seed: "Clover",
  style: "orbit",
  accent: "#e6ad62",
  background: "#f6eddd",
  shape: "round",
  transparent: false,
} as const;
