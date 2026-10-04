/** Shared across localized routes. Add a composition only when the task needs it. */
export type ToolWorkspace = 'flow' | 'split' | 'dashboard' | 'canvas' | 'inspector' | 'preview';
export type ToolLayoutMode = 'wide' | 'sidebar';

const WORKSPACES: Record<string, ToolWorkspace> = {
  'json-formatter': 'split',
  base64: 'split',
  'url-encode': 'split',
  'unicode-converter': 'split',
  'json-xml-yaml': 'split',
  'js-formatter': 'split',
  'css-formatter': 'split',
  'html-formatter': 'split',
  'xml-formatter': 'split',
  'sql-formatter': 'split',
  'regex-tester': 'inspector',
  qrcode: 'preview',
  'color-convert': 'preview',
  'unit-converter': 'preview',
  timestamp: 'dashboard',
  'palette-generator': 'canvas',
};

export function toolWorkspace(slug: string): ToolWorkspace {
  return WORKSPACES[slug] ?? 'flow';
}
