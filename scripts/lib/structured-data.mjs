import { attributes } from './artifacts.mjs';

export function hasType(value, type) {
  return (Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']]).includes(type);
}

/** Accept standalone nodes, arrays and @graph; malformed JSON stays an explicit diagnostic. */
export function structuredData(content) {
  const nodes = [], problems = [];
  function visit(value) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    nodes.push(value);
    if (value['@graph']) visit(value['@graph']);
  }
  for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    try { visit(JSON.parse(match[2])); }
    catch { problems.push('JSON-LD 解析失败'); }
  }
  return { nodes, problems };
}

/** Google fields, with additional site consistency checks; this does not run Google's validator. */
export function auditBreadcrumbs(nodes, canonical, origin) {
  const problems = [];
  for (const [trail, breadcrumb] of nodes.filter(node => hasType(node, 'BreadcrumbList')).entries()) {
    const label = `BreadcrumbList ${trail + 1}`;
    const items = breadcrumb.itemListElement;
    if (!Array.isArray(items) || items.length < 2) { problems.push(`${label}: 至少需要两个 ListItem`); continue; }
    for (const [index, item] of items.entries()) {
      const itemLabel = `${label} / 第 ${index + 1} 项`;
      if (!hasType(item, 'ListItem')) problems.push(`${itemLabel}: @type 应为 ListItem`);
      if (!Number.isInteger(item?.position) || item.position !== index + 1) problems.push(`${itemLabel}: position 应从 1 连续递增`);
      const name = item?.name ?? (typeof item?.item === 'object' ? item.item?.name : undefined);
      if (typeof name !== 'string' || !name.trim()) problems.push(`${itemLabel}: 缺少有效 name`);
      const target = typeof item?.item === 'string' ? item.item : item?.item?.['@id'];
      // Google permits the last breadcrumb to omit item and infer the current page.
      if (item?.item === undefined && index === items.length - 1) continue;
      try {
        const url = new URL(target);
        if (!target || url.origin !== origin || url.username || url.password || url.search || url.hash) throw new Error('invalid item');
        if (index === items.length - 1 && url.href !== canonical) problems.push(`${itemLabel}: 末项网址与 canonical 不一致`);
      } catch { problems.push(`${itemLabel}: item 应为本站的绝对网址`); }
    }
  }
  return problems;
}
