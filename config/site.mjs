/** Shared public settings. Keep build scripts and rendered pages on the same origin. */
export const SITE_DEFAULTS = {
  name: 'CloverTools',
  tagline: '开发、日常、趣味三合一的在线工具箱',
  description:
    'CloverTools 精选在线工具，覆盖开发实用、日常实用与趣味工具三类场景，多数工具在浏览器本地处理，联网功能会明确说明，即开即用无需注册。',
  url: 'https://clovertools.cn',
  github: 'https://github.com/YupenBob/clover-tools',
};

export function resolveSiteUrl(value = SITE_DEFAULTS.url) {
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'PUBLIC_SITE_URL must be an HTTP(S) origin without credentials, path, query or fragment',
    );
  }
  return url.origin;
}

export const LEGAL = {
  kinds: ['privacy', 'terms', 'contact'],
  updated: '2026-09-30',
};

export const HOME = { featuredGuideCount: 6 };
