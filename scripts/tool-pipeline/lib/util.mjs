import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readText(file, fallback = '') {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeTextAtomic(file, text) {
  ensureDir(dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSyncSafe(tmp, text);
  renameSync(tmp, file);
  return file;
}

function writeFileSyncSafe(file, text) {
  const fd = openSync(file, 'w');
  try {
    writeSync(fd, text);
  } finally {
    closeSync(fd);
  }
}

export function writeJsonAtomic(file, value) {
  return writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function removeFile(file) {
  rmSync(file, { force: true });
}

export function nowIso() {
  return new Date().toISOString();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}h${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/** Date/time in the site timezone, independent of the host TZ (host is UTC). */
export function zonedNow(timeZone = 'Asia/Shanghai', date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return {
    date: dateKey,
    time,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    iso: date.toISOString(),
    parts,
  };
}

export function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) throw new Error(`invalid HH:MM time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function fileSize(file) {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

export function touch(file) {
  try {
    const now = new Date();
    utimesSync(file, now, now);
  } catch {
    /* the lock may have been removed by a concurrent cleanup */
  }
}

export function resetFile(file) {
  writeTextAtomic(file, '');
}

export function tail(text, maxChars = 20000) {
  if (!text) return '';
  return text.length <= maxChars ? text : `…(truncated)…\n${text.slice(-maxChars)}`;
}

export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function expandPattern(pattern, vars = {}) {
  return String(pattern).replace(/\{(cat|slug|tool)\}/g, (_, key) => {
    const value = vars[key];
    if (!value) throw new Error(`pattern ${pattern} requires {${key}}`);
    return value;
  });
}

/** Small glob: `*` = one path segment, `**` = any number of segments, `?` = one char. */
export function globToRegExp(pattern) {
  let out = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        out += '.*';
        index += 1;
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if ('\\^$+.|()[]{}'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchAny(path, patterns, vars = {}) {
  for (const pattern of patterns ?? []) {
    let expanded;
    try {
      expanded = expandPattern(pattern, vars);
    } catch {
      continue;
    }
    if (globToRegExp(expanded).test(path)) return pattern;
  }
  return null;
}

export function toPosix(value) {
  return String(value).replaceAll('\\', '/');
}

export function unique(values) {
  return [...new Set(values)];
}

export function joinPath(...parts) {
  return join(...parts);
}

export function exists(path) {
  return existsSync(path);
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
