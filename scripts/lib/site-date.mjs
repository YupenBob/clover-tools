/**
 * 站点日期口径：站点使用 Asia/Shanghai（UTC+8）作为“今天”。
 * 内容门禁与 tick 规划必须使用同一口径，否则在 UTC 晚间（中国已是次日）
 * 会出现“updated 晚于今天”的假失败。
 */
export const SITE_TIME_ZONE = 'Asia/Shanghai'

/** 返回指定时区下的 YYYY-MM-DD。 */
export function todayInZone(timeZone = SITE_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 站点“今天”（Asia/Shanghai）。 */
export function siteToday(now = new Date()) {
  return todayInZone(SITE_TIME_ZONE, now)
}
