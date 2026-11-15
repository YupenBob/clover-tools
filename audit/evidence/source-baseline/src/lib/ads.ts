/**
 * Google AdSense 广告配置
 *
 * 在 AdSense 控制台创建「自适应展示广告单元」后，
 * 把生成的 slot ID 填入下方 AD_SLOTS 对应位置，再重新构建部署。
 * 广告默认关闭；站点验证 meta 和 ads.txt 保留。占位符不渲染。
 */
export const ADSENSE_CLIENT = 'ca-pub-2739960879713370';

// Site ownership verification is independent of serving ads. Enable serving only
// after site approval, placement review and regional consent configuration.
export const ADS_ENABLED = import.meta.env.PUBLIC_ADS_ENABLED === 'true';

export function canServeAds(path: string): boolean {
  const base = path.replace(/^\/(en|ko|ja|zh-hant)(?=\/)/, '');
  return ADS_ENABLED && !/^\/(404(?:\.html)?|privacy|terms|contact|about)(\/|$)/.test(base);
}

export const AD_SLOTS = {
  /** 首页：搜索区/分类标签之后、第一个分类区块之前 */
  home_top: 'PLACEHOLDER_HOME_TOP',
  /** 分类页：tool-hero 之后、工具网格之前 */
  category_top: 'PLACEHOLDER_CATEGORY_TOP',
  /** 工具页：工具面板区之后、使用说明区之前 */
  tool_bottom: 'PLACEHOLDER_TOOL_BOTTOM',
  /** 工具页：相关工具面板下方（侧栏矩形广告） */
  tool_sidebar: '9174056084',
  /** 首页/分类页工具网格：末行空白补齐广告 */
  grid_filler: '', // Keep ads separate from clickable tool cards.
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;

/** 返回可用的 slot ID；空值或占位符返回 null（不渲染广告位）。 */
export function getAdSlot(key: AdSlotKey): string | null {
  const id = AD_SLOTS[key];
  return id && !id.startsWith('PLACEHOLDER_') ? id : null;
}
