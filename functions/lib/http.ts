/**
 * Shared helpers for Cloudflare Pages Functions.
 *
 * Network tools must use these helpers so timeouts, allowlists, error shapes and
 * cache headers stay consistent. They intentionally use only Web APIs that both
 * Workers and Node 22 provide, which also keeps scripts/tests able to import them.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });
}

export function error(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function cacheHeaders(seconds = 30): Record<string, string> {
  return { 'Cache-Control': `public, max-age=${Math.max(0, Math.min(3600, seconds))}` };
}

export function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}

export function corsHeaders(origin = '*'): Record<string, string> {
  return { 'Access-Control-Allow-Origin': origin };
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return numbers;
}

/** True for loopback, private, link-local, CGNAT, metadata and other internal targets. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true;
  }
  const ipv4 = parseIpv4(host);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = host;
  if (host.includes(':') && (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80'))) {
    return true;
  }
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isPrivateHost(mapped);
  }
  return false;
}

function matchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const allowed = entry.toLowerCase().replace(/^\./, '');
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

/**
 * Validate an outbound URL. Throws `private-target`, `target-not-allowed`,
 * `invalid-protocol` or `invalid-url`; callers map these to a structured error.
 */
export function assertAllowedTarget(input: string, allowlist?: string[]): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('invalid-url');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid-protocol');
  if (url.username || url.password) throw new Error('invalid-credentials');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (![80, 443].includes(port)) throw new Error('invalid-port');
  if (isPrivateHost(url.hostname)) throw new Error('private-target');
  if (allowlist?.length && !matchesAllowlist(url.hostname, allowlist)) {
    throw new Error('target-not-allowed');
  }
  return url;
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  return fetch(input, {
    redirect: 'manual',
    ...init,
    signal: AbortSignal.timeout(Math.max(100, Math.min(15000, timeoutMs))),
  });
}

/** Read a JSON body with a hard size cap; throws `body-too-large` when exceeded. */
export async function readJsonLimited<T = unknown>(
  response: Response,
  maxBytes = 256 * 1024,
): Promise<T> {
  const text = await readTextLimited(response, maxBytes);
  return JSON.parse(text) as T;
}

export async function readTextLimited(
  response: Response,
  maxBytes = 256 * 1024,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new Error('body-too-large');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

export function normalizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out/i.test(message)) return 'upstream-timeout';
  if (message === 'body-too-large') return 'upstream-too-large';
  if (message === 'private-target' || message === 'target-not-allowed') return 'target-blocked';
  return 'upstream-failed';
}
