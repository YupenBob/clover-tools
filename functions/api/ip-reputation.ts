import { assertAllowedTarget, readTextLimited, noStore } from "../lib/http.ts";
import {
  parseInput,
  normalizeSource,
  blankSource,
  filterDns,
  selectAddresses,
  SOURCE_IDS,
  object,
  type Envelope,
  type ApiError,
  type ErrorCode,
  type Source,
  type SourceId,
  type Family,
  type DnsResult,
  type Report,
} from "../lib/ip-reputation.ts";
type CacheEntry = { value: Source | DnsResult; at: number; ttl: number };
export type Dependencies = {
  fetch: typeof fetch;
  now: () => number;
  cache: Map<string, CacheEntry>;
  backoff: Map<string, { until: number; error: ApiError }>;
  timeoutMs?: number;
  budgetMs?: number;
};
const cache = new Map<string, CacheEntry>(),
  backoff = new Map<string, { until: number; error: ApiError }>();
const defaults: Dependencies = {
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  cache,
  backoff,
};
class Failure extends Error {
  code: ErrorCode;
  http: number;
  retryAfterSeconds?: number;
  constructor(code: ErrorCode, http = 502, retryAfterSeconds?: number) {
    super(code);
    this.code = code;
    this.http = http;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
const err = (
  code: ErrorCode,
  sourceId?: SourceId,
  retryAfterSeconds?: number,
): ApiError => ({
  code,
  retryable: ![
    "auth-failed",
    "invalid-input",
    "special-address",
    "invalid-domain",
    "internal-domain",
    "empty-input",
    "input-too-long",
    "method-not-allowed",
    "invalid-body",
    "unsupported-media",
    "body-too-large",
    "origin-rejected",
  ].includes(code),
  ...(sourceId ? { sourceId } : {}),
  ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
});
function failure(e: unknown, signal?: AbortSignal): Failure {
  return e instanceof Failure
    ? e
    : signal?.aborted
      ? new Failure("upstream-timeout", 504)
      : e instanceof Error && e.message === "body-too-large"
        ? new Failure("upstream-too-large")
        : new Failure("upstream-invalid");
}
function bounded<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Failure("upstream-timeout", 504));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    p.then(resolve, reject).finally(() =>
      signal.removeEventListener("abort", abort),
    );
  });
}
function output(
  kind: Envelope["kind"],
  data: Envelope["data"],
  status: Envelope["status"],
  at: number,
  error: ApiError | null = null,
  http = 200,
  headers: Record<string, string> = {},
): Response {
  const body: Envelope = {
    version: 1,
    kind,
    ok: status === "complete" || status === "partial",
    status,
    responseAt: new Date(at).toISOString(),
    data,
    error,
  };
  const text = JSON.stringify(body);
  if (new TextEncoder().encode(text).length > 128 * 1024)
    return output(
      "error",
      null,
      "unavailable",
      at,
      err("upstream-too-large"),
      502,
    );
  return new Response(text, {
    status: http,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...noStore(),
      ...headers,
    },
  });
}
function exactTarget(input: string, host: string, path: string): URL {
  const url = assertAllowedTarget(input, [host]);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.port ||
    url.pathname !== path ||
    url.username ||
    url.password
  )
    throw new Failure("upstream-invalid");
  return url;
}
async function sha(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function getCache(d: Dependencies, key: string): CacheEntry | null {
  try {
    const c = d.cache.get(key);
    const age = c ? d.now() - c.at : -1;
    return c && age >= 0 && age < c.ttl ? c : null;
  } catch {
    return null;
  }
}
function putCache(d: Dependencies, key: string, v: CacheEntry) {
  try {
    if (d.cache.size >= 256) d.cache.delete(d.cache.keys().next().value!);
    d.cache.set(key, v);
  } catch {
    /* Cache is optional. */
  }
}
function retryAfter(v: string | null, now: number): number | undefined {
  if (!v) return;
  const s = /^\d+$/.test(v) ? Number(v) : (Date.parse(v) - now) / 1000;
  return s >= 0 && Number.isSafeInteger(Math.ceil(s))
    ? Math.ceil(s)
    : undefined;
}
async function upstream(
  d: Dependencies,
  url: URL,
  init: RequestInit,
  limit: number,
  total: AbortSignal,
): Promise<unknown> {
  const signal = AbortSignal.any([
    total,
    AbortSignal.timeout(d.timeoutMs ?? 4000),
  ]);
  try {
    const response = await bounded(
      d.fetch(url, { ...init, redirect: "manual", signal }),
      signal,
    );
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      throw new Failure("upstream-redirect");
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Failure(
        response.status === 429
          ? "rate-limited"
          : [401, 403].includes(response.status)
            ? "auth-failed"
            : "upstream-http",
        502,
        response.status === 429
          ? retryAfter(response.headers.get("Retry-After"), d.now())
          : undefined,
      );
    }
    return JSON.parse(
      await bounded(readTextLimited(response, limit, signal), signal),
    );
  } catch (e) {
    throw failure(e, signal);
  }
}
function businessFailure(raw: unknown): Failure | null {
  if (!object(raw)) return new Failure("upstream-invalid");
  if (raw.error || raw.success === false) {
    // Inspect only for classification; never expose upstream messages or request echoes.
    const message = JSON.stringify({
      error: raw.error,
      reason: raw.reason,
      message: raw.message,
      code: raw.code,
    }).slice(0, 2048);
    if (/key|auth|forbidden|unauthor/i.test(message))
      return new Failure("auth-failed");
    if (/limit|quota|too.many/i.test(message))
      return new Failure("rate-limited");
    return new Failure("upstream-invalid");
  }
  return null;
}
async function lookupSource(
  id: SourceId,
  ip: string,
  key: string,
  partition: string,
  d: Dependencies,
  total: AbortSignal,
): Promise<Source> {
  if (id === "ipapi.is" && !key) return blankSource(id, "key-required");
  const cacheKey = `v1:${id}:${partition}:${ip}`;
  const cached = getCache(d, cacheKey);
  if (cached) {
    const source = structuredClone(cached.value as Source);
    return {
      ...source,
      cacheHit: true,
      cacheAgeMs: Math.max(0, d.now() - cached.at),
    };
  }
  try {
    let blocked: { until: number; error: ApiError } | undefined;
    try {
      blocked = d.backoff.get(`v1:${id}:${partition}`);
    } catch {}
    if (blocked && blocked.until > d.now())
      throw new Failure(
        "rate-limited",
        502,
        Math.ceil((blocked.until - d.now()) / 1000),
      );
    const encoded = encodeURIComponent(ip);
    const url =
      id === "ipwho.is"
        ? exactTarget(`https://ipwho.is/${encoded}`, "ipwho.is", `/${encoded}`)
        : id === "ipapi.co"
          ? exactTarget(
              `https://ipapi.co/${encoded}/json/`,
              "ipapi.co",
              `/${encoded}/json/`,
            )
          : exactTarget("https://api.ipapi.is/", "api.ipapi.is", "/");
    const raw = await upstream(
      d,
      url,
      id === "ipapi.is"
        ? {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ q: ip, key }),
          }
        : { headers: { Accept: "application/json" } },
      128 * 1024,
      total,
    );
    if (key && JSON.stringify(raw).includes(key))
      throw new Failure("upstream-invalid");
    const business = businessFailure(raw);
    if (business) throw business;
    const source = normalizeSource(
      id,
      raw,
      ip,
      new Date(d.now()).toISOString(),
    );
    if (!source) throw new Failure("upstream-invalid");
    // Even unexpected secret echoes in allowlisted strings must not escape or enter cache.
    if (key && JSON.stringify(source).includes(key))
      throw new Failure("upstream-invalid");
    putCache(d, cacheKey, {
      value: source,
      at: Date.parse(source.fetchedAt!),
      ttl: 60000,
    });
    return source;
  } catch (e) {
    const f = failure(e, total),
      error = err(f.code, id, f.retryAfterSeconds),
      source = blankSource(id, "unavailable", error);
    source.status =
      f.code === "upstream-timeout"
        ? "timeout"
        : f.code === "rate-limited"
          ? "rate-limited"
          : f.code === "auth-failed"
            ? "auth-failed"
            : [
                  "upstream-invalid",
                  "upstream-too-large",
                  "upstream-redirect",
                ].includes(f.code)
              ? "invalid"
              : "failed";
    if (f.code === "rate-limited" && f.retryAfterSeconds)
      try {
        if (d.backoff.size >= 256)
          d.backoff.delete(d.backoff.keys().next().value!);
        d.backoff.set(`v1:${id}:${partition}`, {
          until: d.now() + f.retryAfterSeconds * 1000,
          error,
        });
      } catch {}
    return source;
  }
}
async function resolveFamily(
  query: string,
  type: "A" | "AAAA",
  d: Dependencies,
  total: AbortSignal,
): Promise<{ family: Family; result: DnsResult | null }> {
  const cacheKey = `v1:dns:${type}:${query}`,
    hit = getCache(d, cacheKey);
  const family: Family = {
    type,
    status: "success",
    error: null,
    fetchedAt: null,
    cacheHit: !!hit,
    cacheAgeMs: hit ? Math.max(0, d.now() - hit.at) : 0,
  };
  try {
    let result = hit?.value as DnsResult | undefined;
    if (!result) {
      let blocked: { until: number; error: ApiError } | undefined;
      try {
        blocked = d.backoff.get("v1:dns");
      } catch {}
      if (blocked && blocked.until > d.now())
        throw new Failure(
          "rate-limited",
          502,
          Math.ceil((blocked.until - d.now()) / 1000),
        );
      const url = exactTarget(
        "https://cloudflare-dns.com/dns-query",
        "cloudflare-dns.com",
        "/dns-query",
      );
      url.searchParams.set("name", query);
      url.searchParams.set("type", type);
      const raw = await upstream(
        d,
        url,
        { headers: { Accept: "application/dns-json" } },
        64 * 1024,
        total,
      );
      result = filterDns(raw, query, type) ?? undefined;
      if (!result)
        throw new Failure(
          object(raw) &&
            typeof raw.Status === "number" &&
            ![0, 3].includes(raw.Status)
            ? "dns-failed"
            : "dns-invalid",
        );
      if (result.ttl >= 15)
        putCache(d, cacheKey, {
          value: result,
          at: d.now(),
          ttl: Math.min(60, result.ttl) * 1000,
        });
    }
    family.status = result.empty ? "empty" : "success";
    family.fetchedAt = new Date(hit?.at ?? d.now()).toISOString();
    return { family, result };
  } catch (e) {
    const f = failure(e, total);
    if (f.code === "rate-limited" && f.retryAfterSeconds)
      try {
        if (d.backoff.size >= 256)
          d.backoff.delete(d.backoff.keys().next().value!);
        d.backoff.set("v1:dns", {
          until: d.now() + f.retryAfterSeconds * 1000,
          error: err(f.code, undefined, f.retryAfterSeconds),
        });
      } catch {}
    return {
      family: {
        ...family,
        status: "failed",
        error: err(f.code, undefined, f.retryAfterSeconds),
      },
      result: null,
    };
  }
}
export async function handleIpReputation(
  request: Request,
  env: { IPAPI_IS_KEY?: string } = {},
  deps: Partial<Dependencies> = {},
): Promise<Response> {
  const d = { ...defaults, ...deps },
    total = AbortSignal.timeout(d.budgetMs ?? 4500),
    url = new URL(request.url),
    key = typeof env.IPAPI_IS_KEY === "string" ? env.IPAPI_IS_KEY.trim() : "";
  const fail = (
    code: ErrorCode,
    http = 400,
    headers: Record<string, string> = {},
  ) =>
    output(
      "error",
      null,
      http < 500 ? "invalid" : "unavailable",
      d.now(),
      err(code),
      http,
      headers,
    );
  if (!["GET", "POST"].includes(request.method))
    return fail("method-not-allowed", 405, { Allow: "GET, POST" });
  if (url.search) return fail("invalid-body");
  if (request.method === "GET")
    return output(
      "capabilities",
      { enhancement: key ? "enabled" : "key-required", sources: SOURCE_IDS },
      "complete",
      d.now(),
    );
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return fail("origin-rejected", 403);
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("Content-Type") ?? "",
    )
  )
    return fail("unsupported-media", 415);
  let body: unknown;
  try {
    const readerResponse = new Response(request.body);
    body = JSON.parse(
      await bounded(readTextLimited(readerResponse, 2048, total), total),
    );
  } catch (e) {
    const f = failure(e, total);
    return fail(
      f.code === "upstream-too-large"
        ? "body-too-large"
        : f.code === "upstream-timeout"
          ? "upstream-timeout"
          : "invalid-body",
      f.code === "upstream-too-large"
        ? 413
        : f.code === "upstream-timeout"
          ? 504
          : 400,
    );
  }
  if (
    !object(body) ||
    Object.keys(body).length !== 2 ||
    !Object.keys(body).every((k) => ["action", "query"].includes(k)) ||
    (body.action !== "lookup" && body.action !== "resolve") ||
    typeof body.query !== "string"
  )
    return fail("invalid-body");
  const parsed = parseInput(body.query);
  if (!parsed.ok) return fail(parsed.code);
  if (
    (body.action === "lookup" && parsed.kind !== "ip") ||
    (body.action === "resolve" && parsed.kind !== "domain")
  )
    return fail("invalid-input");
  if (body.action === "resolve") {
    const families = await Promise.all(
      (["A", "AAAA"] as const).map((type) =>
        resolveFamily(parsed.query, type, d, total),
      ),
    );
    const selected = selectAddresses(
      families.flatMap((f) => f.result?.ips ?? []),
    );
    const data = {
      query: parsed.query,
      ...selected,
      families: families.map((f) => f.family),
      filteredCount: families.reduce(
        (n, f) => n + (f.result?.filteredCount ?? 0),
        0,
      ),
    };
    const failed = families.filter((f) => f.family.status === "failed");
    if (!data.addresses.length) {
      const code = failed.length
        ? failed.every((f) => f.family.error?.code === "upstream-timeout")
          ? "upstream-timeout"
          : "dns-failed"
        : "dns-no-address";
      return output(
        "resolution",
        data,
        "unavailable",
        d.now(),
        err(code),
        code === "dns-no-address"
          ? 422
          : code === "upstream-timeout"
            ? 504
            : 502,
      );
    }
    return output(
      "resolution",
      data,
      failed.length ? "partial" : "complete",
      d.now(),
    );
  }
  let partition = "basic";
  try {
    if (key) partition = await bounded(sha(key), total);
  } catch {
    return fail("upstream-timeout", 504);
  }
  const sources = await Promise.all(
    SOURCE_IDS.map((id) =>
      lookupSource(id, parsed.query, key, partition, d, total),
    ),
  );
  const enabled = sources.filter((s) => s.status !== "disabled"),
    count = enabled.filter((s) => s.status === "success").length;
  const data: Report = {
    ip: parsed.query,
    ipVersion: parsed.ipVersion!,
    enhancement: key ? "enabled" : "key-required",
    sources,
  };
  const status =
      count === enabled.length ? "complete" : count ? "partial" : "unavailable",
    allTimeout = enabled.every((s) => s.status === "timeout");
  return output(
    "report",
    data,
    status,
    d.now(),
    count
      ? null
      : err(allTimeout ? "upstream-timeout" : "upstreams-unavailable"),
    count ? 200 : allTimeout ? 504 : 502,
  );
}
export const onRequest = (context: {
  request: Request;
  env: { IPAPI_IS_KEY?: string };
}) => handleIpReputation(context.request, context.env);
