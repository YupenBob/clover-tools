/** HTTP reference diagnostics. No DOM, network, storage or ambient clock access. */
export type Language = "zh" | "tw" | "en" | "ja" | "ko";
export const SOURCES = ["cloudflare-trace", "timeapi-io"] as const;
export type Source = (typeof SOURCES)[number];
export const MIN_TIME = 946684800000,
  MAX_TIME = 4102444800000;
export const STORAGE_KEY = "clover-time-sync:v1";
export const ERROR_CODES = [
  "method-not-allowed",
  "invalid-query",
  "upstream-timeout",
  "upstream-http",
  "upstream-invalid",
  "upstream-too-large",
  "upstream-redirect",
  "sample-expired",
  "server-clock-changed",
  "upstreams-unavailable",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ApiError = { code: ErrorCode; retryable: boolean };
export type GoodSource = {
  source: Source;
  ok: true;
  nowMs: number;
  sourceSampleMs: number;
  upstreamRttMs: number;
  sampleAgeMs: number;
  timestampResolutionMs: number;
  cached: boolean;
};
export type BadSource = { source: Source; ok: false; error: ApiError };
export type SourceResult = GoodSource | BadSource;
export type TimeResponse = {
  version: 1;
  ok: boolean;
  status: "complete" | "partial" | "unavailable";
  responseAtRuntimeMs: number;
  sources: SourceResult[];
  error: ApiError | null;
};
export type Reason = ErrorCode | "high-rtt" | "clock-jump" | "invalid-rtt";
export type Sample = {
  source: Source;
  offsetMs: number | null;
  uncertaintyMs: number | null;
  upstreamRttMs: number | null;
  sampleAgeMs: number | null;
  cached: boolean | null;
  included: boolean;
  reason: Reason | null;
};
export type Quality = "consistent" | "single" | "conflict" | "unavailable";
export type Aggregate = {
  status: Quality;
  offsetMs: number | null;
  uncertaintyMs: number | null;
  count: number;
  interval: [number, number] | null;
};
export type Anchors = { w0: number; w1: number; p0: number; p1: number };
export type Snapshot = {
  id: string;
  deviceAtMs: number;
  networkAtMs: number | null;
  status: Quality;
  offsetMs: number | null;
  uncertaintyMs: number | null;
  browserRttMs: number | null;
  runtimeAtMs: number | null;
  sources: Sample[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const range = (v: unknown, min: number, max: number): v is number =>
  finite(v) && v >= min && v < max;
const epoch = (v: unknown) => range(v, MIN_TIME, MAX_TIME);
const errorValid = (e: unknown): e is ApiError =>
  object(e) &&
  ERROR_CODES.includes(e.code as ErrorCode) &&
  typeof e.retryable === "boolean";
export function median(values: readonly number[]): number | null {
  if (!values.every(finite)) throw new Error("invalid-number");
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : a[m - 1] / 2 + a[m] / 2;
}
export function validateTimeResponse(v: unknown): {
  value: TimeResponse | null;
  error: "upstream-invalid" | null;
} {
  const invalid = { value: null, error: "upstream-invalid" as const };
  if (
    !object(v) ||
    v.version !== 1 ||
    typeof v.ok !== "boolean" ||
    !finite(v.responseAtRuntimeMs) ||
    !Array.isArray(v.sources) ||
    v.sources.length !== 2
  )
    return invalid;
  const sources: SourceResult[] = [];
  for (let i = 0; i < 2; i++) {
    const s = v.sources[i];
    if (!object(s) || s.source !== SOURCES[i] || typeof s.ok !== "boolean")
      return invalid;
    if (s.ok) {
      if (
        !epoch(s.nowMs) ||
        !epoch(s.sourceSampleMs) ||
        !range(s.upstreamRttMs, 0, 3001) ||
        !range(s.sampleAgeMs, 0, 15000) ||
        !range(s.timestampResolutionMs, 0.001, 60001) ||
        typeof s.cached !== "boolean"
      )
        return invalid;
      if (
        Math.abs(
          (s.nowMs as number) -
            ((s.sourceSampleMs as number) +
              (s.upstreamRttMs as number) / 2 +
              (s.sampleAgeMs as number)),
        ) > 1
      )
        return invalid;
      sources.push({
        source: SOURCES[i],
        ok: true,
        nowMs: s.nowMs as number,
        sourceSampleMs: s.sourceSampleMs as number,
        upstreamRttMs: s.upstreamRttMs as number,
        sampleAgeMs: s.sampleAgeMs as number,
        timestampResolutionMs: s.timestampResolutionMs as number,
        cached: s.cached,
      });
    } else {
      if (
        !errorValid(s.error) ||
        [
          "nowMs",
          "sourceSampleMs",
          "upstreamRttMs",
          "sampleAgeMs",
          "timestampResolutionMs",
          "cached",
        ].some((k) => k in s)
      )
        return invalid;
      sources.push({
        source: SOURCES[i],
        ok: false,
        error: { code: s.error.code, retryable: s.error.retryable },
      });
    }
  }
  const count = sources.filter((s) => s.ok).length;
  if (
    v.ok !== count > 0 ||
    v.status !==
      (count === 2 ? "complete" : count === 1 ? "partial" : "unavailable") ||
    (count ? v.error !== null : !errorValid(v.error))
  )
    return invalid;
  return {
    value: {
      version: 1,
      ok: v.ok,
      status: v.status as TimeResponse["status"],
      responseAtRuntimeMs: v.responseAtRuntimeMs,
      sources,
      error: count ? null : (v.error as ApiError),
    },
    error: null,
  };
}
export function roundReason(a: Anchors): "invalid-rtt" | "clock-jump" | null {
  const r = a.p1 - a.p0;
  if (![a.w0, a.w1, a.p0, a.p1].every(finite) || !finite(r) || r < 0)
    return "invalid-rtt";
  return Math.abs(a.w1 - a.w0 - r) > 100 ? "clock-jump" : null;
}
export function estimateOffset(s: SourceResult, a: Anchors): Sample {
  const base: Sample = {
    source: s.source,
    offsetMs: null,
    uncertaintyMs: null,
    upstreamRttMs: null,
    sampleAgeMs: null,
    cached: null,
    included: false,
    reason: null,
  };
  if (!s.ok) return { ...base, reason: s.error.code };
  if (
    !epoch(s.nowMs) ||
    !epoch(s.sourceSampleMs) ||
    !range(s.upstreamRttMs, 0, 3001) ||
    !range(s.sampleAgeMs, 0, 15000) ||
    !range(s.timestampResolutionMs, 0.001, 60001)
  )
    return { ...base, reason: "upstream-invalid" };
  const r = a.p1 - a.p0,
    reason = roundReason(a);
  const diag = {
    ...base,
    upstreamRttMs: s.upstreamRttMs,
    sampleAgeMs: s.sampleAgeMs,
    cached: s.cached,
  };
  if (reason) return { ...diag, reason };
  return {
    ...diag,
    offsetMs: s.nowMs + r / 2 - (a.w0 + r),
    uncertaintyMs:
      Math.max(1000, s.timestampResolutionMs) +
      s.upstreamRttMs / 2 +
      r / 2 +
      s.sampleAgeMs * 0.0001,
    included: r <= 2000 && s.upstreamRttMs <= 2000,
    reason: r > 2000 || s.upstreamRttMs > 2000 ? "high-rtt" : null,
  };
}
export function classifyQuality(count: number, consistent: boolean): Quality {
  return count === 0
    ? "unavailable"
    : count === 1
      ? "single"
      : consistent
        ? "consistent"
        : "conflict";
}
export function aggregateSamples(samples: readonly Sample[]): Aggregate {
  // Unknown/runtime rows never enter consensus, and repeated sources never gain weight.
  const a = samples.filter(
    (s) =>
      SOURCES.includes(s.source) &&
      s.included &&
      finite(s.offsetMs) &&
      finite(s.uncertaintyMs) &&
      s.uncertaintyMs >= 0,
  );
  if (new Set(a.map((s) => s.source)).size !== a.length)
    throw new Error("duplicate-source");
  const consistent =
    a.length < 2 ||
    Math.abs(a[0].offsetMs! - a[1].offsetMs!) <=
      a[0].uncertaintyMs! + a[1].uncertaintyMs!;
  const status = classifyQuality(a.length, consistent);
  if (!a.length || !consistent)
    return {
      status,
      offsetMs: null,
      uncertaintyMs: null,
      count: a.length,
      interval: null,
    };
  const d = median(a.map((s) => s.offsetMs!))!,
    u = Math.max(...a.map((s) => Math.abs(s.offsetMs! - d) + s.uncertaintyMs!));
  return {
    status,
    offsetMs: d,
    uncertaintyMs: u,
    count: a.length,
    interval: [d - u, d + u],
  };
}
const locales: Record<Language, string> = {
  zh: "zh-CN",
  tw: "zh-TW",
  en: "en-GB",
  ja: "ja-JP",
  ko: "ko-KR",
};
export function formatNumber(n: number, lang: Language, digits = 1): string {
  return new Intl.NumberFormat(locales[lang], {
    maximumFractionDigits: digits,
  }).format(n);
}
export function formatDelta(ms: number, lang: Language): string {
  if (!finite(ms)) throw new Error("invalid-number");
  if (Math.abs(ms) < 1)
    return {
      zh: "偏差小于 1 毫秒",
      tw: "偏差小於 1 毫秒",
      en: "Offset is less than 1 millisecond",
      ja: "時刻差は1ミリ秒未満です",
      ko: "편차가 1밀리초 미만입니다",
    }[lang];
  const a = Math.abs(ms),
    i = a >= 3600000 ? 3 : a >= 60000 ? 2 : a >= 1000 ? 1 : 0,
    n = formatNumber(a / [1, 1000, 60000, 3600000][i], lang);
  const units = {
    zh: ["毫秒", "秒", "分钟", "小时"],
    tw: ["毫秒", "秒", "分鐘", "小時"],
    en: ["ms", "second", "minute", "hour"],
    ja: ["ミリ秒", "秒", "分", "時間"],
    ko: ["밀리초", "초", "분", "시간"],
  }[lang];
  return {
    zh: `设备约${ms > 0 ? "慢" : "快"} ${n} ${units[i]}`,
    tw: `裝置約${ms > 0 ? "慢" : "快"} ${n} ${units[i]}`,
    en: `Your device is about ${n} ${units[i]}${i > 0 && Math.round((a / [1, 1000, 60000, 3600000][i]) * 10) / 10 !== 1 ? "s" : ""} ${ms > 0 ? "behind" : "ahead"}`,
    ja: `端末の時計が約${n}${units[i]}${ms > 0 ? "遅れています" : "進んでいます"}`,
    ko: `기기 시계가 약 ${n}${units[i]} ${ms > 0 ? "느립니다" : "빠릅니다"}`,
  }[lang];
}
export function formatBeijing(
  ms: number,
  lang: Language,
  forceFallback = false,
): { date: string; time: string } {
  if (!finite(ms) || Math.abs(ms) > 8.63e15) return { date: "—", time: "—" };
  // Shanghai used historical offsets and daylight saving before 1992.
  // A diagnostic clock always displays the promised fixed UTC+8.
  if (ms < Date.UTC(1992, 0, 1)) forceFallback = true;
  if (!forceFallback)
    try {
      const parts = new Intl.DateTimeFormat(locales[lang], {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(ms);
      const get = (k: string) => parts.find((p) => p.type === k)!.value;
      return {
        date: new Intl.DateTimeFormat(locales[lang], {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(ms),
        time: `${get("hour")}:${get("minute")}:${get("second")}`,
      };
    } catch {
      /* Fixed UTC+8 fallback. */
    }
  const d = new Date(ms + 28800000),
    pad = (v: number) => String(v).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  };
}
export function liveReference(
  anchor: { networkMs: number; monoMs: number },
  monoMs: number,
): number | null {
  const age = monoMs - anchor.monoMs;
  return finite(age) && age >= 0 && age < 60000 ? anchor.networkMs + age : null;
}
function validSnapshot(v: unknown): v is Snapshot {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !v.id.length ||
    v.id.length > 100 ||
    !finite(v.deviceAtMs) ||
    Math.abs(v.deviceAtMs) > 8.63e15 ||
    !["consistent", "single", "conflict", "unavailable"].includes(
      v.status as string,
    ) ||
    !Array.isArray(v.sources) ||
    v.sources.length !== 2
  )
    return false;
  if (
    ![
      v.networkAtMs,
      v.offsetMs,
      v.uncertaintyMs,
      v.browserRttMs,
      v.runtimeAtMs,
    ].every((n) => n === null || finite(n))
  )
    return false;
  if (v.networkAtMs !== null && Math.abs(v.networkAtMs as number) > 8.63e15)
    return false;
  if (
    (v.browserRttMs !== null && (v.browserRttMs as number) < 0) ||
    (v.uncertaintyMs !== null && (v.uncertaintyMs as number) < 0)
  )
    return false;
  const has = ["consistent", "single"].includes(v.status as string);
  if (
    has !==
      (v.offsetMs !== null &&
        v.uncertaintyMs !== null &&
        v.networkAtMs !== null) ||
    (!has &&
      (v.offsetMs !== null ||
        v.uncertaintyMs !== null ||
        v.networkAtMs !== null))
  )
    return false;
  for (let i = 0; i < 2; i++) {
    const s = v.sources[i];
    if (
      !object(s) ||
      s.source !== SOURCES[i] ||
      typeof s.included !== "boolean" ||
      !(s.cached === null || typeof s.cached === "boolean") ||
      !(
        s.reason === null ||
        [...ERROR_CODES, "high-rtt", "clock-jump", "invalid-rtt"].includes(
          s.reason as Reason,
        )
      )
    )
      return false;
    if (
      ![s.offsetMs, s.uncertaintyMs, s.upstreamRttMs, s.sampleAgeMs].every(
        (n) => n === null || finite(n),
      )
    )
      return false;
    if (
      [s.uncertaintyMs, s.upstreamRttMs, s.sampleAgeMs].some(
        (n) => n !== null && (n as number) < 0,
      )
    )
      return false;
    if (
      (s.sampleAgeMs !== null && (s.sampleAgeMs as number) >= 15000) ||
      (s.upstreamRttMs !== null && (s.upstreamRttMs as number) > 3000) ||
      (s.offsetMs === null) !== (s.uncertaintyMs === null) ||
      (s.uncertaintyMs !== null && (s.uncertaintyMs as number) < 1000) ||
      (!s.included && s.reason === null) ||
      (s.included &&
        (s.cached === null ||
          s.upstreamRttMs === null ||
          s.sampleAgeMs === null ||
          (s.upstreamRttMs as number) > 2000 ||
          v.browserRttMs === null ||
          (v.browserRttMs as number) > 2000)) ||
      (s.included &&
        (s.offsetMs === null || s.uncertaintyMs === null || s.reason !== null))
    )
      return false;
  }
  try {
    const agg = aggregateSamples(v.sources as Sample[]);
    return (
      agg.status === v.status &&
      agg.offsetMs === v.offsetMs &&
      agg.uncertaintyMs === v.uncertaintyMs
    );
  } catch {
    return false;
  }
}
export function parseHistory(text: string | null): {
  records: Snapshot[];
  error: boolean;
  blocked: boolean;
} {
  if (text === null) return { records: [], error: false, blocked: false };
  try {
    if (new TextEncoder().encode(text).length > 65536) throw new Error();
    const v: unknown = JSON.parse(text);
    if (!object(v) || v.version !== 1)
      return { records: [], error: true, blocked: true };
    if (
      !Array.isArray(v.records) ||
      v.records.length > 10 ||
      !v.records.every(validSnapshot) ||
      new Set(v.records.map((r) => r.id)).size !== v.records.length
    )
      throw new Error();
    const records: Snapshot[] = v.records.map((r) => ({
      id: r.id,
      deviceAtMs: r.deviceAtMs,
      networkAtMs: r.networkAtMs,
      status: r.status,
      offsetMs: r.offsetMs,
      uncertaintyMs: r.uncertaintyMs,
      browserRttMs: r.browserRttMs,
      runtimeAtMs: r.runtimeAtMs,
      sources: r.sources.map((s) => ({
        source: s.source,
        offsetMs: s.offsetMs,
        uncertaintyMs: s.uncertaintyMs,
        upstreamRttMs: s.upstreamRttMs,
        sampleAgeMs: s.sampleAgeMs,
        cached: s.cached,
        included: s.included,
        reason: s.reason,
      })),
    }));
    return { records, error: false, blocked: false };
  } catch {
    return { records: [], error: true, blocked: true };
  }
}
export function appendHistory(
  records: readonly Snapshot[],
  record: Snapshot,
): Snapshot[] {
  if (!validSnapshot(record)) throw new Error("invalid-history");
  return [record, ...records.filter((r) => r.id !== record.id)].slice(0, 10);
}
export function serializeHistory(records: readonly Snapshot[]): string {
  const text = JSON.stringify({ version: 1, records: records.slice(0, 10) });
  const parsed = parseHistory(text);
  if (parsed.error) throw new Error("invalid-history");
  return JSON.stringify({ version: 1, records: parsed.records });
}
