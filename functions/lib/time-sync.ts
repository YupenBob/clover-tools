import { assertAllowedTarget, json, readTextLimited } from "./http.ts";
import {
  SOURCES,
  MIN_TIME,
  MAX_TIME,
  type Source,
  type SourceResult,
  type ErrorCode,
} from "../../src/lib/time-sync.ts";
export const URLS = {
  "cloudflare-trace": "https://www.cloudflare.com/cdn-cgi/trace",
  "timeapi-io": "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
} as const;
export const TTL = 15000;
export const cacheKey = (source: Source) =>
  `https://clovertools.cn/__time-sync-sample-v1/${source}`;
export type SampleCache = {
  match(key: string): Promise<Response | undefined>;
  put(key: string, value: Response): Promise<unknown>;
};
/** 每个 isolate 只计算一次，用于证明缓存样本横跨请求期间没有换过时钟源。 */
export const ISOLATE = crypto.randomUUID();
type Anchor = {
  version: 1;
  source: Source;
  sourceSampleMs: number;
  upstreamRttMs: number;
  receivedAtMs: number;
  /** 写入样本时的单调时钟读数，用来验证两轮之间墙上时钟没有跳变。 */
  monoAtMs: number;
  isolate: string;
  timestampResolutionMs: number;
};
export type Dependencies = {
  fetch: typeof fetch;
  now: () => number;
  mono: () => number;
  cache?: SampleCache;
  waitUntil?: (p: Promise<unknown>) => void;
  timeoutMs?: number;
  roundTimeoutMs?: number;
};
const num = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const time = (n: unknown): n is number =>
  num(n) && n >= MIN_TIME && n < MAX_TIME;
export function parseTrace(text: string): number {
  if (/^\s*[\[{<]/.test(text)) throw new Error("upstream-invalid");
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith("ts="));
  if (lines.length !== 1 || !/^ts=\d+(?:\.\d+)?$/.test(lines[0]))
    throw new Error("upstream-invalid");
  const ms = Number(lines[0].slice(3)) * 1000;
  if (!time(ms)) throw new Error("upstream-invalid");
  return ms;
}
export function parseTimeApi(text: string): number {
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("upstream-invalid");
  }
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    v.timeZone !== "UTC" ||
    typeof v.dateTime !== "string"
  )
    throw new Error("upstream-invalid");
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]00:00)?$/.exec(
      v.dateTime,
    );
  if (!m) throw new Error("upstream-invalid");
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number),
    ms = Number((m[7] || "").padEnd(3, "0").slice(0, 3));
  const n = Date.UTC(year, month - 1, day, hour, minute, second, ms),
    d = new Date(n);
  if (
    !time(n) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  )
    throw new Error("upstream-invalid");
  return n;
}
export function exactTarget(source: Source, url: string): string {
  if (url !== URLS[source]) throw new Error("upstream-invalid");
  const u = assertAllowedTarget(url, ["www.cloudflare.com", "timeapi.io"]);
  if (u.protocol !== "https:" || u.port) throw new Error("upstream-invalid");
  return u.href;
}
function clean(
  v: unknown,
  source: Source,
  now: number,
  mono: number,
): Anchor | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const s = v as Anchor;
  const wallAge = now - s.receivedAtMs,
    monoAge = mono - s.monoAtMs;
  // 缓存只在本 isolate 内、且墙上时钟与单调时钟增量一致时复用：
  // 换 isolate 或期间发生过墙钟跳变，就无法证明样本年龄，直接当未命中。
  if (s.isolate !== ISOLATE || !num(monoAge) || monoAge < 0 || Math.abs(wallAge - monoAge) > 100)
    return null;
  if (
    s.version !== 1 ||
    s.source !== source ||
    !time(s.sourceSampleMs) ||
    !num(s.receivedAtMs) ||
    !num(s.upstreamRttMs) ||
    s.upstreamRttMs < 0 ||
    s.upstreamRttMs > 3000 ||
    s.timestampResolutionMs !== 1000 ||
    !num(now) ||
    wallAge < 0 ||
    wallAge >= TTL
  )
    return null;
  return {
    version: 1,
    source,
    sourceSampleMs: s.sourceSampleMs,
    upstreamRttMs: s.upstreamRttMs,
    receivedAtMs: s.receivedAtMs,
    monoAtMs: s.monoAtMs,
    isolate: ISOLATE,
    timestampResolutionMs: 1000,
  };
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("upstream-timeout"));
    if (signal.aborted) {
      reject(new Error("upstream-timeout"));
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort))
      .catch(() => {});
  });
}
const fail = (source: Source, code: ErrorCode): SourceResult => ({
  source,
  ok: false,
  error: {
    code,
    retryable: code !== "method-not-allowed" && code !== "invalid-query",
  },
});
async function sample(
  source: Source,
  deps: Dependencies,
  roundSignal: AbortSignal,
): Promise<{ anchor: Anchor; cached: boolean } | SourceResult> {
  // Cache work shares the per-source deadline; unavailable caches cannot stall a round.
  const controller = new AbortController(),
    timer = setTimeout(
      () => controller.abort(),
      Math.min(3000, Math.max(1, deps.timeoutMs ?? 3000)),
    );
  const abort = () => controller.abort();
  roundSignal.addEventListener("abort", abort, { once: true });
  const signal = controller.signal;
  try {
    if (deps.cache) {
      const cacheController = new AbortController();
      const cacheTimer = setTimeout(
        () => cacheController.abort(),
        Math.min(100, Math.max(1, deps.timeoutMs ?? 100)),
      );
      const cacheSignal = AbortSignal.any([signal, cacheController.signal]);
      try {
        const c = await abortable(
          deps.cache.match(cacheKey(source)),
          cacheSignal,
        );
        if (c) {
          const text = await abortable(
            readTextLimited(c, 4096, cacheSignal),
            cacheSignal,
          );
          const a = clean(JSON.parse(text), source, deps.now(), deps.mono());
          if (a) return { anchor: a, cached: true };
        }
      } catch {
        /* Cache failure falls through to fresh sampling. */
      } finally {
        clearTimeout(cacheTimer);
      }
    }
    signal.throwIfAborted();
    const w0 = deps.now(),
      p0 = deps.mono();
    const response = await abortable(
      deps.fetch(exactTarget(source, URLS[source]), {
        redirect: "manual",
        signal,
        headers: {
          Accept: source === "timeapi-io" ? "application/json" : "text/plain",
          "User-Agent": "CloverTools-TimeSync/1.0",
        },
      }),
      signal,
    );
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      throw new Error("upstream-redirect");
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error("upstream-http");
    }
    const text = await abortable(
      readTextLimited(response, 65536, signal),
      signal,
    );
    const p1 = deps.mono(),
      w1 = deps.now(),
      u = p1 - p0;
    if (!num(u) || u < 0 || Math.abs(w1 - w0 - u) > 100)
      throw new Error("server-clock-changed");
    if (u > 3000) throw new Error("upstream-timeout");
    const sourceSampleMs =
      source === "cloudflare-trace" ? parseTrace(text) : parseTimeApi(text);
    const anchor: Anchor = {
      version: 1,
      source,
      sourceSampleMs,
      upstreamRttMs: u,
      receivedAtMs: w1,
      monoAtMs: p1,
      isolate: ISOLATE,
      timestampResolutionMs: 1000,
    };
    // 缓存写入由整轮装配完成、确认没有服务端时钟跳变后再统一提交，
    // 否则被拒绝的一轮里可能留下“跳变前”的采样，下一轮会把它误当成
    // 正常经过的时间而算出错误的网络参考。
    return { anchor, cached: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const code: ErrorCode = signal.aborted
      ? "upstream-timeout"
      : message === "body-too-large"
        ? "upstream-too-large"
        : [
              "upstream-http",
              "upstream-redirect",
              "upstream-timeout",
              "server-clock-changed",
            ].includes(message)
          ? (message as ErrorCode)
          : "upstream-invalid";
    return fail(source, code);
  } finally {
    clearTimeout(timer);
    roundSignal.removeEventListener("abort", abort);
  }
}
export async function handleTimeSync(
  request: Request,
  deps: Dependencies,
): Promise<Response> {
  const output = (data: unknown, status = 200, headers = {}) =>
    json(data, {
      status,
      headers: { "Cache-Control": "no-store", ...headers },
    });
  const bad = (code: ErrorCode, status: number, headers = {}) =>
    output(
      {
        version: 1,
        ok: false,
        status: "unavailable",
        responseAtRuntimeMs: deps.now(),
        sources: SOURCES.map((s) => fail(s, code)),
        error: { code, retryable: false },
      },
      status,
      headers,
    );
  if (request.method !== "GET")
    return bad("method-not-allowed", 405, { Allow: "GET" });
  if (new URL(request.url).search) return bad("invalid-query", 400);
  const controller = new AbortController(),
    timer = setTimeout(
      () => controller.abort(),
      Math.min(4500, Math.max(1, deps.roundTimeoutMs ?? 4500)),
    );
  const w0 = deps.now(),
    p0 = deps.mono();
  try {
    const results = await Promise.all(
      SOURCES.map((s) => sample(s, deps, controller.signal)),
    );
    const e = deps.now(),
      elapsed = deps.mono() - p0,
      changed =
        !num(e) ||
        !num(elapsed) ||
        elapsed < 0 ||
        Math.abs(e - w0 - elapsed) > 100;
    const freshAnchors: Anchor[] = [];
    const sources: SourceResult[] = results.map((r, i) => {
      if (changed) return fail(SOURCES[i], "server-clock-changed");
      if (!("anchor" in r)) return r;
      const age = e - r.anchor.receivedAtMs;
      if (age < 0) return fail(SOURCES[i], "server-clock-changed");
      if (age >= TTL) return fail(SOURCES[i], "sample-expired");
      const nowMs = r.anchor.sourceSampleMs + r.anchor.upstreamRttMs / 2 + age;
      if (!time(nowMs)) return fail(SOURCES[i], "upstream-invalid");
      if (!r.cached) freshAnchors.push(r.anchor);
      return {
        source: SOURCES[i],
        ok: true,
        nowMs,
        sourceSampleMs: r.anchor.sourceSampleMs,
        upstreamRttMs: r.anchor.upstreamRttMs,
        sampleAgeMs: age,
        timestampResolutionMs: r.anchor.timestampResolutionMs,
        cached: r.cached,
      };
    });
    if (deps.cache && freshAnchors.length) {
      const put = Promise.all(
        freshAnchors.map((anchor) =>
          Promise.resolve()
            .then(() =>
              deps.cache!.put(
                cacheKey(anchor.source),
                json(anchor, {
                  headers: { "Cache-Control": "public, max-age=15" },
                }),
              ),
            )
            .catch(() => {}),
        ),
      );
      deps.waitUntil?.(put);
    }
    const count = sources.filter((s) => s.ok).length,
      timeout = sources.every(
        (s) => !s.ok && s.error.code === "upstream-timeout",
      );
    return output(
      {
        version: 1,
        ok: count > 0,
        status:
          count === 2 ? "complete" : count === 1 ? "partial" : "unavailable",
        responseAtRuntimeMs: e,
        sources,
        error: count
          ? null
          : {
              code: timeout ? "upstream-timeout" : "upstreams-unavailable",
              retryable: true,
            },
      },
      count ? 200 : timeout ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
