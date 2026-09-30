import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function relativePath(dist, file) {
  return relative(dist, file).replaceAll('\\', '/');
}

export function pagePath(file) {
  return (
    '/' +
    file
      .replace(/(?:^|\/)index\.html$/, '/')
      .replace(/\/+/g, '/')
      .replace(/^\//, '')
  );
}

export function decodeEntities(value) {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#39);/g,
    (entity) =>
      ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
      })[entity],
  );
}

export function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [
      match[1].toLowerCase(),
      decodeEntities(match[3]),
    ]),
  );
}

export function htmlTags(content) {
  // A literal > is legal inside a quoted attribute, e.g. a JSON->CSV description.
  return content.match(/<[a-z][\w-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? [];
}

export function isVerificationFile(path) {
  return /^baidu[-_]verify.*\.html$/.test(path);
}

export function outputPath(dist, pathname) {
  return join(
    dist,
    decodeURIComponent(pathname),
    pathname.endsWith('/') ? 'index.html' : '',
  );
}
