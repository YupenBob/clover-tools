/**
 * 清空构建产物目录，避免残留旧文件。
 * 用法：node scripts/clean-dist.mjs
 */
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });
console.log('dist 已清空');
