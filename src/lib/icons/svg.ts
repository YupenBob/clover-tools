import type { IconNode } from './types';

export interface IconRenderOptions {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  label?: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render icon data as a self-contained 24x24 SVG string.
 * Shared by the Astro <Icon> component (SSR) and small client-side scripts that
 * need to inject an icon into dynamic markup without shipping the whole registry.
 */
export function renderIconSvg(nodes: IconNode, options: IconRenderOptions = {}): string {
  const { size = '1em', strokeWidth = 2, className = '', label } = options;
  const classes = ['icon', className].filter(Boolean).join(' ');
  const accessible = label
    ? `role="img" aria-label="${escapeAttr(label)}"`
    : 'role="presentation" aria-hidden="true"';
  const title = label ? `<title>${escapeAttr(label)}</title>` : '';
  const body = nodes
    .map(([tag, attrs]) => {
      const serialized = Object.entries(attrs)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}="${escapeAttr(String(value))}"`)
        .join(' ');
      return `<${tag} ${serialized}></${tag}>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeAttr(String(size))}" height="${escapeAttr(String(size))}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${escapeAttr(String(strokeWidth))}" stroke-linecap="round" stroke-linejoin="round" class="${classes}" focusable="false" ${accessible}>${title}${body}</svg>`;
}
