import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { root } from './build-config.mjs';

/** Resolve the pinned Chromium used by every browser check. No channel fallback. */
export function findChromium() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH && existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }
  const base = join(root, '.playwright-browsers');
  if (!existsSync(base)) return null;
  for (const entry of readdirSync(base)) {
    const candidate = join(base, entry, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
    const headless = join(base, entry, 'chrome-linux', 'headless_shell');
    if (existsSync(headless)) return headless;
  }
  return null;
}
