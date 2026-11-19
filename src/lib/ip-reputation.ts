/** Deterministic browser logic. No storage, clock, network or DOM access. */
import {
  parseInput,
  parseIp,
  isPublicIp,
  object,
  cleanText,
  SOURCE_IDS,
  FIELD_IDS,
  BASIC_FIELDS,
  FLAG_FIELDS,
  ERROR_CODES,
  blankSource,
  type ApiError,
  type Envelope,
  type Report,
  type Resolution,
  type Source,
  type FieldId,
  type Field,
  type Missing,
} from "../../functions/lib/ip-reputation.ts";
export {
  parseInput,
  SOURCE_IDS,
  FIELD_IDS,
  BASIC_FIELDS,
  FLAG_FIELDS,
  ERROR_CODES,
};
export type { Envelope, Report, Resolution, Source, FieldId, Field, ApiError };
export type Language = "zh" | "tw" | "en" | "ko" | "ja";
export const STORAGE_KEY = "clover-ip-reputation:v1";
export const HISTORY_BYTES = 96 * 1024;
const bytes = (s: string) => new TextEncoder().encode(s).length;
const iso = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
function readError(v: unknown): ApiError | null | false {
  if (v === null) return null;
  if (
    !object(v) ||
    !ERROR_CODES.includes(v.code as ApiError["code"]) ||
    typeof v.retryable !== "boolean" ||
    (v.sourceId !== undefined &&
      !SOURCE_IDS.includes(v.sourceId as Source["id"])) ||
    (v.retryAfterSeconds !== undefined &&
      (!Number.isSafeInteger(v.retryAfterSeconds) ||
        !finite(v.retryAfterSeconds)))
  )
    return false;
  return {
    code: v.code as ApiError["code"],
    retryable: v.retryable,
    ...(v.sourceId ? { sourceId: v.sourceId as Source["id"] } : {}),
    ...(v.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: v.retryAfterSeconds as number }
      : {}),
  };
}
function source(v: unknown, index: number): Source | null {
  if (
    !object(v) ||
    v.id !== SOURCE_IDS[index] ||
    ![
      "success",
      "timeout",
      "rate-limited",
      "auth-failed",
      "invalid",
      "failed",
      "disabled",
    ].includes(String(v.status)) ||
    typeof v.cacheHit !== "boolean" ||
    !finite(v.cacheAgeMs) ||
    v.cacheAgeMs >= 60000 ||
    !object(v.fields)
  )
    return null;
  const error = readError(v.error);
  if (error === false) return null;
  const success = v.status === "success",
    disabled = v.status === "disabled";
  if (success && (!iso(v.fetchedAt) || error !== null)) return null;
  if (!success && (v.fetchedAt !== null || v.cacheHit || v.cacheAgeMs !== 0))
    return null;
  if (
    (!success && !disabled && (!error || error.sourceId !== v.id)) ||
    (disabled && (index !== 2 || error !== null))
  )
    return null;
  if (
    (error && v.status === "timeout" && error.code !== "upstream-timeout") ||
    (error && v.status === "auth-failed" && error.code !== "auth-failed") ||
    (error && v.status === "rate-limited" && error.code !== "rate-limited")
  )
    return null;
  const s = blankSource(
    SOURCE_IDS[index],
    disabled ? "key-required" : "unavailable",
    error,
  );
  s.status = v.status as Source["status"];
  s.fetchedAt = v.fetchedAt as string | null;
  s.cacheHit = v.cacheHit;
  s.cacheAgeMs = v.cacheAgeMs;
  for (const k of FIELD_IDS) {
    const f = v.fields[k];
    if (!object(f) || f.upstreamField !== s.fields[k].upstreamField)
      return null;
    const flag = FLAG_FIELDS.includes(k as (typeof FLAG_FIELDS)[number]);
    if (f.value !== null) {
      if (f.reason !== null || !success) return null;
      if (
        flag
          ? typeof f.value !== "boolean"
          : typeof f.value !== "string" ||
            !f.value ||
            cleanText(f.value) !== f.value
      )
        return null;
      if (!success) return null;
      if (
        k === "asn" &&
        (typeof f.value !== "string" ||
          !/^AS[1-9]\d*$/.test(f.value) ||
          Number(f.value.slice(2)) > 4294967295)
      )
        return null;
      if (
        k === "countryCode" &&
        (typeof f.value !== "string" || !/^[A-Z]{2}$/.test(f.value))
      )
        return null;
      if (flag && index !== 2) return null;
    } else if (
      !["not-provided", "unsupported", "unavailable", "key-required"].includes(
        String(f.reason),
      )
    )
      return null;
    if (
      !success &&
      (f.value !== null ||
        f.reason !== (disabled ? "key-required" : "unavailable"))
    )
      return null;
    if (
      success &&
      s.fields[k].upstreamField === null &&
      (f.value !== null || f.reason !== "unsupported")
    )
      return null;
    if (
      success &&
      s.fields[k].upstreamField !== null &&
      f.value === null &&
      f.reason !== "not-provided"
    )
      return null;
    s.fields[k] = {
      value: f.value as Field["value"],
      reason: f.reason as Missing | null,
      upstreamField: f.upstreamField as string | null,
    };
  }
  if (
    v.crawlerName !== null &&
    (typeof v.crawlerName !== "string" ||
      cleanText(v.crawlerName, 120) !== v.crawlerName ||
      !v.crawlerName ||
      index !== 2 ||
      s.fields.crawler.value !== true)
  )
    return null;
  if (s.fields.crawler.value === true && v.crawlerName === null) return null;
  s.crawlerName = v.crawlerName as string | null;
  if (!Array.isArray(v.networkIndicators) || v.networkIndicators.length > 2)
    return null;
  for (const n of v.networkIndicators) {
    if (
      !object(n) ||
      !["company", "asn"].includes(String(n.scope)) ||
      typeof n.raw !== "string" ||
      !n.raw ||
      cleanText(n.raw, 160) !== n.raw ||
      index !== 2 ||
      !success ||
      s.networkIndicators.some((x) => x.scope === n.scope)
    )
      return null;
    s.networkIndicators.push({
      scope: n.scope as "company" | "asn",
      raw: n.raw,
    });
  }
  return s;
}
export function validateResponse(raw: unknown): Envelope | null {
  if (
    !object(raw) ||
    raw.version !== 1 ||
    !["capabilities", "resolution", "report", "error"].includes(
      String(raw.kind),
    ) ||
    !iso(raw.responseAt) ||
    typeof raw.ok !== "boolean" ||
    !["complete", "partial", "unavailable", "invalid"].includes(
      String(raw.status),
    ) ||
    raw.ok !== ["complete", "partial"].includes(String(raw.status))
  )
    return null;
  const error = readError(raw.error);
  if (
    error === false ||
    (raw.ok && error !== null) ||
    (!raw.ok && error === null)
  )
    return null;
  let data: Envelope["data"] = null;
  if (raw.kind === "report") {
    const r = raw.data;
    if (
      !object(r) ||
      typeof r.ip !== "string" ||
      !["enabled", "key-required"].includes(String(r.enhancement)) ||
      !Array.isArray(r.sources) ||
      r.sources.length !== 3
    )
      return null;
    const p = parseInput(r.ip);
    if (
      !p.ok ||
      p.kind !== "ip" ||
      p.query !== r.ip ||
      p.ipVersion !== r.ipVersion
    )
      return null;
    const sources = r.sources.map(source);
    if (sources.some((s) => !s)) return null;
    const valid = sources as Source[],
      disabled = valid[2].status === "disabled";
    if (disabled !== (r.enhancement === "key-required")) return null;
    const enabled = valid.filter((s) => s.status !== "disabled"),
      count = enabled.filter((s) => s.status === "success").length;
    if (
      raw.status !==
      (count === enabled.length
        ? "complete"
        : count
          ? "partial"
          : "unavailable")
    )
      return null;
    data = {
      ip: r.ip,
      ipVersion: r.ipVersion as 4 | 6,
      enhancement: r.enhancement as Report["enhancement"],
      sources: valid,
    };
  } else if (raw.kind === "resolution") {
    const r = raw.data;
    if (
      !object(r) ||
      typeof r.query !== "string" ||
      !Array.isArray(r.addresses) ||
      r.addresses.length > 8 ||
      !Array.isArray(r.families) ||
      r.families.length !== 2 ||
      !Number.isInteger(r.filteredCount) ||
      !finite(r.filteredCount) ||
      r.filteredCount > 256 ||
      typeof r.truncated !== "boolean"
    )
      return null;
    const p = parseInput(r.query);
    if (!p.ok || p.kind !== "domain" || p.query !== r.query) return null;
    const addresses: Resolution["addresses"] = [];
    for (const a of r.addresses) {
      if (!object(a) || typeof a.ip !== "string") return null;
      const ip = parseIp(a.ip);
      if (
        !ip ||
        !isPublicIp(ip) ||
        ip.ip !== a.ip ||
        ip.ipVersion !== a.ipVersion ||
        addresses.some((x) => x.ip === a.ip)
      )
        return null;
      addresses.push({ ip: ip.ip, ipVersion: ip.ipVersion });
    }
    const families: Resolution["families"] = [];
    for (let i = 0; i < 2; i++) {
      const f = r.families[i];
      if (
        !object(f) ||
        f.type !== ["A", "AAAA"][i] ||
        !["success", "empty", "failed"].includes(String(f.status)) ||
        typeof f.cacheHit !== "boolean" ||
        !finite(f.cacheAgeMs) ||
        f.cacheAgeMs >= 60000
      )
        return null;
      const e = readError(f.error);
      if (e === false) return null;
      if (
        f.status === "failed"
          ? e === null ||
            f.fetchedAt !== null ||
            f.cacheHit ||
            f.cacheAgeMs !== 0
          : !iso(f.fetchedAt) || e !== null
      )
        return null;
      families.push({
        type: f.type as "A" | "AAAA",
        status: f.status as "success" | "empty" | "failed",
        error: e as ApiError | null,
        fetchedAt: f.fetchedAt as string | null,
        cacheHit: f.cacheHit,
        cacheAgeMs: f.cacheAgeMs,
      });
    }
    const has = addresses.length > 0,
      partial = families.some((f) => f.status === "failed");
    if (
      raw.status !== (has ? (partial ? "partial" : "complete") : "unavailable")
    )
      return null;
    data = {
      query: r.query,
      addresses,
      families,
      filteredCount: r.filteredCount as number,
      truncated: r.truncated,
    };
  } else if (raw.kind === "capabilities") {
    if (
      !object(raw.data) ||
      !["enabled", "key-required"].includes(String(raw.data.enhancement)) ||
      JSON.stringify(raw.data.sources) !== JSON.stringify(SOURCE_IDS) ||
      raw.status !== "complete"
    )
      return null;
    data = {
      enhancement: raw.data.enhancement as Report["enhancement"],
      sources: SOURCE_IDS,
    };
  } else if (raw.data !== null || raw.ok) return null;
  return {
    version: 1,
    kind: raw.kind as Envelope["kind"],
    ok: raw.ok,
    status: raw.status as Envelope["status"],
    responseAt: raw.responseAt,
    data,
    error,
  };
}
export type ComparisonRow = {
  id: FieldId;
  values: { source: Source["id"]; field: Field; fetchedAt: string | null }[];
  comparison: "same" | "different" | "name-different" | "single" | "missing";
};
export function comparisonRows(report: Report): ComparisonRow[] {
  return FIELD_IDS.map((id) => {
    const values = report.sources.map((s) => ({
        source: s.id,
        field: s.fields[id],
        fetchedAt: s.fetchedAt,
      })),
      provided = values.filter((x) => x.field.value !== null);
    const normalized = provided.map((x) =>
      typeof x.field.value === "string"
        ? x.field.value.trim().replace(/\s+/g, " ").toLowerCase()
        : x.field.value,
    );
    const comparison =
      provided.length === 0
        ? "missing"
        : provided.length === 1
          ? "single"
          : new Set(normalized).size === 1
            ? "same"
            : ["country", "city"].includes(id)
              ? "name-different"
              : "different";
    return { id, values, comparison };
  });
}
export function filterRows(
  rows: ComparisonRow[],
  filter: "all" | "differences" | "provided",
): ComparisonRow[] {
  return rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "differences"
        ? ["different", "name-different"].includes(r.comparison)
        : r.values.some((v) => v.field.value !== null)),
  );
}
export function signalState(field: Field): "flagged" | "not-flagged" | Missing {
  return field.value === true
    ? "flagged"
    : field.value === false
      ? "not-flagged"
      : (field.reason ?? "not-provided");
}
export type Conditions = { q: string; ip?: string };
export function shareConditions(q: string, ip?: string): Conditions | null {
  const p = parseInput(q);
  if (!p.ok) return null;
  if (p.kind === "ip") return { q: p.query };
  const hint = ip ? parseInput(ip) : null;
  return {
    q: p.query,
    ...(hint?.ok && hint.kind === "ip" ? { ip: hint.query } : {}),
  };
}
export function shareFragment(q: string, ip?: string): string {
  const c = shareConditions(q, ip);
  if (!c) return "";
  return "#" + new URLSearchParams(c).toString();
}
export function parseShare(fragment: string): Conditions | null {
  if (fragment.length > 1200) return null;
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  if (
    [...params.keys()].some((k) => !["q", "ip"].includes(k)) ||
    params.getAll("q").length !== 1 ||
    params.getAll("ip").length > 1
  )
    return null;
  return shareConditions(params.get("q") ?? "", params.get("ip") ?? undefined);
}
export type Snapshot = { query: string; selectedIp: string; report: Envelope };
function snapshot(v: unknown): Snapshot | null {
  if (
    !object(v) ||
    typeof v.query !== "string" ||
    typeof v.selectedIp !== "string"
  )
    return null;
  const conditions = shareConditions(v.query, v.selectedIp),
    r = validateResponse(v.report);
  if (
    !conditions ||
    conditions.q !== v.query ||
    !r ||
    r.kind !== "report" ||
    !r.ok ||
    (r.data as Report).ip !== v.selectedIp
  )
    return null;
  const p = parseInput(v.query);
  if (p.ok && p.kind === "ip" && p.query !== v.selectedIp) return null;
  return { query: conditions.q, selectedIp: v.selectedIp, report: r };
}
export function parseHistory(text: string): {
  entries: Snapshot[];
  error: "history-invalid" | null;
} {
  const bad = { entries: [], error: "history-invalid" as const };
  if (bytes(text) > HISTORY_BYTES) return bad;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return bad;
  }
  if (
    !object(v) ||
    v.version !== 1 ||
    !Array.isArray(v.entries) ||
    v.entries.length > 10
  )
    return bad;
  const entries = v.entries.map(snapshot);
  if (entries.some((e) => !e)) return bad;
  const keys = entries.map((e) => e!.query + "\n" + e!.selectedIp);
  if (new Set(keys).size !== keys.length) return bad;
  return { entries: entries as Snapshot[], error: null };
}
export function serializeHistory(entries: Snapshot[]): string {
  const valid = entries
    .slice(0, 10)
    .map(snapshot)
    .filter((s): s is Snapshot => !!s);
  let text = JSON.stringify({ version: 1, entries: valid });
  while (bytes(text) > HISTORY_BYTES && valid.length) {
    valid.pop();
    text = JSON.stringify({ version: 1, entries: valid });
  }
  return text;
}
export function appendHistory(
  entries: Snapshot[],
  entry: Snapshot,
): Snapshot[] {
  const good = snapshot(entry);
  if (!good) return [...entries];
  return parseHistory(
    serializeHistory([
      good,
      ...entries.filter(
        (e) => e.query !== good.query || e.selectedIp !== good.selectedIp,
      ),
    ]),
  ).entries;
}
export function formatUtc(iso: string, language: Language): string {
  return (
    new Intl.DateTimeFormat(
      { zh: "zh-CN", tw: "zh-TW", en: "en-GB", ko: "ko-KR", ja: "ja-JP" }[
        language
      ],
      {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
    ).format(new Date(iso)) + " UTC"
  );
}
