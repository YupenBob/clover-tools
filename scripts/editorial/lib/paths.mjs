/** 仓库根与自动化流水线路径解析。所有路径都相对于仓库根。 */
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

/** scripts/editorial/lib → 仓库根（上三级） */
export const ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

export function rootPath(...parts) {
  return join(ROOT, ...parts);
}

/** 本地自动化状态目录（.gitignore 已忽略）；测试可用 DSH_EDITORIAL_STATE_DIR 覆盖。 */
export const STATE_DIR = process.env.DSH_EDITORIAL_STATE_DIR
  ? resolve(process.env.DSH_EDITORIAL_STATE_DIR)
  : rootPath('.editorial');

export const STATE_PATHS = {
  dir: STATE_DIR,
  config: join(STATE_DIR, 'config.json'),
  queue: join(STATE_DIR, 'queue.json'),
  state: join(STATE_DIR, 'state.json'),
  paused: join(STATE_DIR, 'PAUSED'),
  locks: join(STATE_DIR, 'locks'),
  drafts: join(STATE_DIR, 'drafts'),
  runs: join(STATE_DIR, 'runs'),
  gsc: join(STATE_DIR, 'gsc'),
  secrets: join(STATE_DIR, 'secrets'),
  githubToken: join(STATE_DIR, 'secrets', 'github-token'),
};

/** 仓库内与自动文章相关的路径（相对仓库根，带结尾 / 表示目录前缀） */
export const REPO_PATHS = {
  guidesDir: 'data/editorial-guides/',
  autoIndex: 'src/lib/guides-auto.ts',
  imagesDir: 'public/article-images/',
  articleAssets: 'public/article-assets/',
  casesDir: 'scripts/editorial/cases/',
  docsAutomation: 'docs/EDITORIAL-AUTOMATION.md',
};
