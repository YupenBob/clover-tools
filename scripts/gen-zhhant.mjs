/**
 * 生成繁体中文（zh-Hant）页面：/zh-hant/ 路由。
 * 基于简体页面用 chinese-s2t 转换，并替换 frontmatter / 导入层级 / 内部链接。
 * 用法：node scripts/gen-zhhant.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { s2t } = (await import('chinese-s2t')).default;

const CATS = ['dev', 'daily', 'fun'];

function replaceFrontmatter(text, newFm) {
  const lines = text.split('\n');
  let first = -1;
  let second = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (first === -1) first = i;
      else {
        second = i;
        break;
      }
    }
  }
  if (first === -1 || second === -1) throw new Error('frontmatter not found');
  return [...lines.slice(0, first), ...newFm.split('\n'), ...lines.slice(second + 1)].join('\n');
}

function deepenImports(text) {
  return text
    .replace(/from '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/g, "from '../../../../")
    .replace(/import '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/g, "import '../../../../");
}

function prefixLinks(text) {
  return text
    .replace(/href="\/tools\//g, 'href="/zh-hant/tools/')
    .replace(/href="\/about\//g, 'href="/zh-hant/about/')
    .replace(/href="\/"(?=[^>]*>)/g, 'href="/zh-hant/"')
    .replace(/`\/tools\/\$\{cat\.id\}\/`/g, '`/zh-hant/tools/${cat.id}/`')
    .replace(/`\/tools\/\$\{c\.id\}\/`/g, '`/zh-hant/tools/${c.id}/`')
    .replace(/\|\| '\/'/, "|| '/zh-hant/'");
}

function toolFrontmatter(cat, slug) {
  return `---
import ToolLayout from '../../../../layouts/ToolLayout.astro';
import ToolPanel from '../../../../components/ToolPanel.astro';
import { getToolMeta, getRelated } from '../../../../lib/i18n';

const category = '${cat}' as const;
const tool = getToolMeta(category, '${slug}', 'tw')!;
const related = getRelated(category, '${slug}', 'tw', 6);
---`;
}

function genToolPages() {
  let count = 0;
  for (const cat of CATS) {
    const srcDir = join(root, 'src', 'pages', 'tools', cat);
    const outDir = join(root, 'src', 'pages', 'zh-hant', 'tools', cat);
    mkdirSync(outDir, { recursive: true });
    for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.astro'))) {
      const slug = file.replace(/\.astro$/, '');
      let text = s2t(readFileSync(join(srcDir, file), 'utf8'));
      text = replaceFrontmatter(text, toolFrontmatter(cat, slug));
      text = text.replace(
        /<ToolLayout category=\{category\} tool=\{tool\} related=\{related\}[^>]*>/,
        '<ToolLayout category={category} tool={tool} related={related}>',
      );
      text = deepenImports(text);
      text = prefixLinks(text);
      writeFileSync(join(outDir, file), text, 'utf8');
      count++;
    }
  }
  console.log(`工具页：${count}`);
}

const HOME_FM = [
  '---',
  "import BaseLayout from '../../layouts/BaseLayout.astro';",
  "import ToolCard from '../../components/ToolCard.astro';",
  "import AdUnit from '../../components/AdUnit.astro';",
  "import GridAdFiller from '../../components/GridAdFiller.astro';",
  "import { SITE } from '../../lib/site';",
  "import { getCategoryMetas, getTools, siteForLang, type ToolCategory } from '../../lib/i18n';",
  '',
  "const lang = 'tw' as const;",
  'const site = siteForLang(lang);',
  'const CATEGORIES = getCategoryMetas(lang);',
  'const TOOLS = {',
  "  dev: getTools('dev', lang),",
  "  daily: getTools('daily', lang),",
  "  fun: getTools('fun', lang),",
  '};',
  '',
  'const total = (Object.keys(TOOLS) as ToolCategory[]).reduce(',
  '  (sum, cat) => sum + TOOLS[cat].length,',
  '  0,',
  ');',
  '',
  'const allTools = (Object.keys(TOOLS) as ToolCategory[]).flatMap((category) =>',
  '  TOOLS[category].map((tool) => ({ ...tool, category })),',
  ');',
  '',
  'const builtCount = allTools.length;',
  "const homeUrl = SITE.url + '/zh-hant/';",
  '',
  'const homeJsonLd = [',
  "  {",
  "    '@context': 'https://schema.org',",
  "    '@type': 'WebSite',",
  '    name: SITE.name,',
  '    url: homeUrl,',
  "    inLanguage: 'zh-Hant',",
  '    potentialAction: {',
  "      '@type': 'SearchAction',",
  '      target: {',
  "        '@type': 'EntryPoint',",
  '        urlTemplate: `${homeUrl}?q={search_term_string}`',
  '      },',
  "      'query-input': 'required name=search_term_string',",
  '    },',
  '  },',
  '  {',
  "    '@context': 'https://schema.org',",
  "    '@type': 'Organization',",
  '    name: SITE.name,',
  '    url: homeUrl,',
  '    logo: `${SITE.url}/clover-logo.svg`,',
  '    sameAs: [SITE.github],',
  '  },',
  '];',
  '---',
].join('\n');

function genHome() {
  const src = join(root, 'src', 'pages', 'index.astro');
  const outDir = join(root, 'src', 'pages', 'zh-hant');
  mkdirSync(outDir, { recursive: true });
  let text = s2t(readFileSync(src, 'utf8'));
  text = replaceFrontmatter(text, HOME_FM);
  text = text.replace('{SITE.tagline}', '{site.tagline}');
  text = text.replace(
    '<BaseLayout jsonLd={homeJsonLd}>',
    '<BaseLayout canonical={homeUrl} jsonLd={homeJsonLd}>',
  );
  text = text.replace("fetch('/search-index.json')", "fetch('/zh-hant/search-index.json')");
  text = prefixLinks(text);
  writeFileSync(join(outDir, 'index.astro'), text, 'utf8');
  console.log('首页：1');
}

const ABOUT_FM = [
  '---',
  "import BaseLayout from '../../layouts/BaseLayout.astro';",
  "import { SITE } from '../../lib/site';",
  "import { getCategoryMetas, getTools, siteForLang, type ToolCategory } from '../../lib/i18n';",
  '',
  "const lang = 'tw' as const;",
  'const site = siteForLang(lang);',
  'const CATEGORIES = getCategoryMetas(lang);',
  "const totalTools = (Object.keys({ dev: getTools('dev', lang), daily: getTools('daily', lang), fun: getTools('fun', lang) }) as ToolCategory[]).reduce(",
  '  (sum, cat) => sum + getTools(cat, lang).length,',
  '  0,',
  ');',
  '',
  'const title = `關於 - ${SITE.name}`;',
  'const description =',
  '  `了解 ${SITE.name}：涵蓋開發實用、日常實用與趣味工具三大類場景的精選線上工具箱，` +',
  '  `共 ${totalTools} 個工具，純瀏覽器處理、資料不出本地、即開即用無需註冊。`;',
  'const canonical = `${SITE.url}/zh-hant/about/`;',
  '',
  'const aboutJsonLd = {',
  "  '@context': 'https://schema.org',",
  "  '@type': 'AboutPage',",
  '  name: `關於 ${SITE.name}`,',
  '  url: canonical,',
  '  description: site.description,',
  "  inLanguage: 'zh-Hant',",
  '  mainEntity: {',
  "    '@type': 'Organization',",
  '    name: SITE.name,',
  '    url: `${SITE.url}/zh-hant/`,',
  '    logo: `${SITE.url}/clover-logo.svg`,',
  '    sameAs: [SITE.github],',
  '  },',
  '};',
  '---',
].join('\n');

function genAbout() {
  const src = join(root, 'src', 'pages', 'about.astro');
  const outDir = join(root, 'src', 'pages', 'zh-hant');
  let text = s2t(readFileSync(src, 'utf8'));
  text = replaceFrontmatter(text, ABOUT_FM);
  text = text.replace('{SITE.tagline}', '{site.tagline}');
  text = prefixLinks(text);
  writeFileSync(join(outDir, 'about.astro'), text, 'utf8');
  console.log('关于：1');
}

const NOTFOUND_FM = `---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../lib/site';
---`;

function gen404() {
  const src = join(root, 'src', 'pages', '404.astro');
  const outDir = join(root, 'src', 'pages', 'zh-hant');
  let text = s2t(readFileSync(src, 'utf8'));
  text = replaceFrontmatter(text, NOTFOUND_FM);
  text = text.replace(
    /(<BaseLayout\s*\n\s*title=\{`[^`]*`\}\s*\n\s*description="[^"]*")(\s*\n>)/,
    '$1\n  canonical={`${SITE.url}/zh-hant/`}$2',
  );
  text = prefixLinks(text);
  writeFileSync(join(outDir, '404.astro'), text, 'utf8');
  console.log('404：1');
}

const CATEGORY_FM = [
  '---',
  "import BaseLayout from '../../../../layouts/BaseLayout.astro';",
  "import ToolCard from '../../../../components/ToolCard.astro';",
  "import AdUnit from '../../../../components/AdUnit.astro';",
  "import GridAdFiller from '../../../../components/GridAdFiller.astro';",
  "import { SITE } from '../../../../lib/site';",
  'import {',
  '  getCategoryMetas,',
  '  getTools,',
  '  pathForLang,',
  '  type ToolCategory,',
  "} from '../../../../lib/i18n';",
  '',
  'export function getStaticPaths() {',
  "  return getCategoryMetas('tw').map((cat) => ({",
  '    params: { category: cat.id },',
  '    props: { cat },',
  '  }));',
  '}',
  '',
  'const { cat } = Astro.props;',
  "const lang = 'tw' as const;",
  'const url = `${SITE.url}/zh-hant/tools/${cat.id}/`;',
  'const tools = getTools(cat.id, lang);',
  'const others = getCategoryMetas(lang).filter((c) => c.id !== cat.id);',
  'const TOOLS = {',
  "  dev: getTools('dev', lang),",
  "  daily: getTools('daily', lang),",
  "  fun: getTools('fun', lang),",
  '};',
  '',
  'const CATEGORY_DESC: Record<ToolCategory, string> = {',
  "  dev: 'CloverTools 開發實用工具合集，涵蓋 JSON 與程式碼格式化、加解密、雜湊、正規表達式、介面除錯等開發者高頻場景，純瀏覽器處理，即開即用無需註冊。',",
  "  daily: 'CloverTools 日常實用工具合集，涵蓋萬年曆、時間戳、單位換算、理財計算、BMI、作息計時等生活與辦公常用工具，資料不出瀏覽器。',",
  "  fun: 'CloverTools 趣味工具合集，包含抽獎、手速測試、ASCII 藝術字、圖片字元畫、隨機數等創意小玩意，給忙碌的日常加點樂趣。',",
  '};',
  '',
  'const jsonLd = {',
  "  '@context': 'https://schema.org',",
  "  '@type': 'ItemList',",
  '  name: `${cat.name}工具`,',
  '  description: cat.blurb,',
  '  url,',
  '  numberOfItems: tools.length,',
  '  itemListElement: tools.map((tool, i) => ({',
  "    '@type': 'ListItem',",
  '    position: i + 1,',
  '    url: `${url}${tool.slug}/`,',
  '    name: tool.name,',
  '  })),',
  '};',
  '---',
].join('\n');

function genCategoryPages() {
  const src = join(root, 'src', 'pages', 'tools', '[category]', 'index.astro');
  const outDir = join(root, 'src', 'pages', 'zh-hant', 'tools', '[category]');
  mkdirSync(outDir, { recursive: true });
  let text = s2t(readFileSync(src, 'utf8'));
  text = replaceFrontmatter(text, CATEGORY_FM);
  text = prefixLinks(text);
  writeFileSync(join(outDir, 'index.astro'), text, 'utf8');
  console.log('分类页：3（动态路由）');
}

genToolPages();
genHome();
genAbout();
gen404();
genCategoryPages();
console.log('完成');
