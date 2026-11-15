import { assertAllowedTarget, json, readTextLimited } from "./http.ts";
export const SOURCE_URL = "https://www.cloudflare.com/cdn-cgi/trace";
export const CACHE_KEY = "https://clovertools.cn/__exam-clock-sample-v1";
export const SAMPLE_TTL = 15000;
const MIN = Date.UTC(2000, 0, 1),
  MAX = Date.UTC(2100, 0, 1);
export type Sample = {
  source: "cloudflare-trace";
  sourceSampleMs: number;
  upstreamRttMs: number;
  receivedAtMs: number;
  referenceMs: number;
  expiresAtMs: number;
};
export type SampleCache = {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<unknown>;
};
export type TimeDeps = {
  fetch: typeof fetch;
  now: () => number;
  mono: () => number;
  cache?: SampleCache;
  waitUntil?: (p: Promise<unknown>) => void;
  timeoutMs?: number;
};
export function parseTrace(text: string): number {
  if (/^\s*[\[{<]/.test(text)) throw new Error("upstream-invalid");
  const lines = text.split(/\r?\n/).filter((line) => line.startsWith("ts="));
  if (lines.length !== 1 || !/^ts=\d+(?:\.\d+)?$/.test(lines[0]))
    throw new Error("upstream-invalid");
  const ms = Number(lines[0].slice(3)) * 1000;
  if (!Number.isFinite(ms) || ms < MIN || ms >= MAX)
    throw new Error("upstream-invalid");
  return ms;
}
export function cleanSample(value: unknown, now: number): Sample | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Sample;
  if (
    s.source !== "cloudflare-trace" ||
    ![
      s.sourceSampleMs,
      s.upstreamRttMs,
      s.receivedAtMs,
      s.referenceMs,
      s.expiresAtMs,
      now,
    ].every((n) => typeof n === "number" && Number.isFinite(n)) ||
    s.sourceSampleMs < MIN ||
    s.sourceSampleMs >= MAX ||
    s.receivedAtMs < MIN ||
    s.receivedAtMs >= MAX ||
    s.upstreamRttMs < 0 ||
    s.upstreamRttMs > 3000 ||
    s.referenceMs !== s.sourceSampleMs + s.upstreamRttMs / 2 ||
    s.expiresAtMs !== s.receivedAtMs + SAMPLE_TTL ||
    now < s.receivedAtMs ||
    now >= s.expiresAtMs
  )
    return null;
  return {
    source: "cloudflare-trace",
    sourceSampleMs: s.sourceSampleMs,
    upstreamRttMs: s.upstreamRttMs,
    receivedAtMs: s.receivedAtMs,
    referenceMs: s.referenceMs,
    expiresAtMs: s.expiresAtMs,
  };
}
export function responseForSample(
  sample: Sample,
  now: number,
  cached: boolean,
) {
  const s = cleanSample(sample, now);
  if (!s) throw new Error("upstream-invalid");
  const sampleAgeMs = now - s.receivedAtMs;
  return {
    ok: true,
    serverNowMs: s.referenceMs + sampleAgeMs,
    source: s.source,
    sourceUrl: SOURCE_URL,
    sourceSampleMs: s.sourceSampleMs,
    sampleAgeMs,
    upstreamRttMs: s.upstreamRttMs,
    uncertaintyMs: 1000 + s.upstreamRttMs / 2 + sampleAgeMs * 0.0001,
    cached,
  };
}
const output = (v: unknown, status = 200, headers = {}) =>
  json(v, { status, headers: { "Cache-Control": "no-store", ...headers } });
const failure = (
  code: string,
  status: number,
  retryable: boolean,
  headers = {},
) => output({ ok: false, code, error: code, retryable }, status, headers);
export async function handleTime(
  request: Request,
  deps: TimeDeps,
): Promise<Response> {
  if (request.method !== "GET")
    return failure("method-not-allowed", 405, false, { Allow: "GET" });
  if (new URL(request.url).search) return failure("invalid-query", 400, false);
  try {
    if (deps.cache) {
      try {
        const cached = await deps.cache.match(CACHE_KEY);
        const sample = cached
          ? cleanSample(
              JSON.parse(await readTextLimited(cached, 4096)),
              deps.now(),
            )
          : null;
        if (sample) return output(responseForSample(sample, deps.now(), true));
      } catch {
        /* An unavailable or corrupt cache never blocks fresh sampling. */
      }
    }
    const target = assertAllowedTarget(SOURCE_URL, ["www.cloudflare.com"]);
    if (
      target.href !== SOURCE_URL ||
      target.protocol !== "https:" ||
      target.hostname !== "www.cloudflare.com" ||
      (target.port && target.port !== "443")
    )
      throw new Error("upstream-failed");
    const controller = new AbortController();
    const timeoutMs = Math.min(3000, deps.timeoutMs ?? 3000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("upstream-timeout"));
      }, timeoutMs);
    });
    let sample: Sample;
    try {
      const started = deps.mono(),
        deviceStart = deps.now();
      sample = await Promise.race([
        timeout,
        (async () => {
          const response = await deps.fetch(target, {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: {
              Accept: "text/plain",
              "User-Agent": "CloverTools-Exam-Clock/1.0",
            },
            credentials: "omit",
          });
          if (response.status >= 300 && response.status < 400)
            throw new Error("upstream-redirect");
          if (!response.ok) throw new Error("upstream-failed");
          const text = await readTextLimited(
            response,
            65536,
            controller.signal,
          );
          const sourceSampleMs = parseTrace(text),
            upstreamRttMs = deps.mono() - started,
            receivedAtMs = deps.now();
          if (
            Math.abs(receivedAtMs - deviceStart - upstreamRttMs) > 1000 ||
            upstreamRttMs < 0 ||
            upstreamRttMs > 3000
          )
            throw new Error("upstream-invalid");
          return {
            source: "cloudflare-trace" as const,
            sourceSampleMs,
            upstreamRttMs,
            receivedAtMs,
            referenceMs: sourceSampleMs + upstreamRttMs / 2,
            expiresAtMs: receivedAtMs + SAMPLE_TTL,
          };
        })(),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (deps.cache) {
      const cache = deps.cache;
      const write = Promise.resolve()
        .then(() =>
          cache.put(
            CACHE_KEY,
            json(sample, {
              headers: { "Cache-Control": "public, max-age=15" },
            }),
          ),
        )
        .catch(() => {});
      try {
        deps.waitUntil?.(write);
      } catch {
        /* Cache lifecycle hooks are optional. */
      }
    }
    return output(responseForSample(sample, deps.now(), false));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      message === "body-too-large"
        ? "upstream-too-large"
        : [
              "upstream-invalid",
              "upstream-redirect",
              "upstream-timeout",
            ].includes(message)
          ? message
          : "upstream-failed";
    return failure(code, code === "upstream-timeout" ? 504 : 502, true);
  }
}
