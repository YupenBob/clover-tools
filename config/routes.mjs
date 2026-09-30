/** Locale IDs are internal; prefixes are public URLs (tw uses /zh-hant/). */
export const LOCALES = {
  zh: {
    prefix: '',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    browserPrefixes: ['zh'],
  },
  tw: {
    prefix: '/zh-hant',
    htmlLang: 'zh-Hant',
    ogLocale: 'zh_TW',
    browserPrefixes: ['zh-hant', 'zh-tw', 'zh-hk', 'zh-mo'],
  },
  ko: {
    prefix: '/ko',
    htmlLang: 'ko',
    ogLocale: 'ko_KR',
    browserPrefixes: ['ko'],
  },
  ja: {
    prefix: '/ja',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    browserPrefixes: ['ja'],
  },
  en: {
    prefix: '/en',
    htmlLang: 'en',
    ogLocale: 'en_US',
    browserPrefixes: ['en'],
  },
};

export const ROUTE_POLICY = {
  // Retain the existing staged rollout until translated tool UX/content is reviewed.
  toolIndexLanguages: ['zh'],
  localizedSections: [{ prefix: '/guides', languages: ['zh'] }],
  browserFallbackLanguage: 'en',
};

export function languageFromPath(path) {
  return (
    Object.keys(LOCALES).find((lang) => {
      const { prefix } = LOCALES[lang];
      return prefix && (path === prefix || path.startsWith(prefix + '/'));
    }) ?? 'zh'
  );
}

export function stripLanguage(path) {
  const prefix = LOCALES[languageFromPath(path)].prefix;
  return path.slice(prefix.length) || '/';
}

export function localizedPath(path, lang) {
  if (!LOCALES[lang]) throw new Error(`Unsupported language: ${lang}`);
  const base = stripLanguage(path);
  return LOCALES[lang].prefix + (base === '/' ? '/' : base);
}

export function isErrorPath(path) {
  return /^\/404(?:\/|\.html)?$/.test(stripLanguage(path));
}

export function availableLanguages(path) {
  const base = stripLanguage(path);
  const section = ROUTE_POLICY.localizedSections.find(
    ({ prefix }) => base === prefix || base.startsWith(prefix + '/'),
  );
  return section?.languages ?? Object.keys(LOCALES);
}

export function isIndexablePath(path) {
  if (isErrorPath(path)) return false;
  const lang = languageFromPath(path);
  if (!availableLanguages(path).includes(lang)) return false;
  return (
    !/^\/tools(?:\/|$)/.test(stripLanguage(path)) ||
    ROUTE_POLICY.toolIndexLanguages.includes(lang)
  );
}

export function switchLanguagePath(path, lang) {
  return localizedPath(
    isErrorPath(path) || !availableLanguages(path).includes(lang) ? '/' : path,
    lang,
  );
}

export function alternateLanguages(path) {
  if (isErrorPath(path)) return [];
  return availableLanguages(path).filter((lang) =>
    isIndexablePath(localizedPath(path, lang)),
  );
}
