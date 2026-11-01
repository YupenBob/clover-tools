import { EDITORIAL_GUIDES } from './editorial-guides.ts';
import { AUTO_GUIDES } from './guides-auto.ts';

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  category: string;
  toolSlug: string;
  published: string;
  updated: string;
  readingMinutes: number;
  content: string;
  faqs: GuideFaq[];
  sources: { title: string; url: string }[];
  image?: string;
  focus?: string;
  notice?: string;
}

/**
 * 已校对发布的指南。每篇都对应一个真实工具场景，正文使用可信的本地 HTML
 * 输出到静态页面；新增文章前应先校对示例、来源和适用边界。
 */
export const GUIDES: Guide[] = [...EDITORIAL_GUIDES, ...AUTO_GUIDES];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function getGuidesForTool(toolSlug: string): Guide[] {
  return GUIDES.filter((guide) => guide.toolSlug === toolSlug);
}
